/**
 * AI Assistant — chat sessions with persistent history and query-aware RAG
 *
 * GET    /assistant/sessions               — list user's sessions
 * POST   /assistant/sessions               — create new session
 * PATCH  /assistant/sessions/:id           — rename session
 * DELETE /assistant/sessions/:id           — delete session
 * GET    /assistant/sessions/:id/messages  — load messages
 * POST   /assistant/sessions/:id/messages  — send message, get AI reply
 *   Body: { content, documentIds?: number[], legalSourceIds?: number[] }
 * POST   /assistant/cite                   — on-demand citation formats for a source
 *   Body: { sourceType: "document"|"legal_source", sourceId: number }
 */
import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  chatSessionsTable,
  chatMessagesTable,
  documentsTable,
  legalSourcesTable,
} from "@workspace/db";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";
import {
  buildContext,
  extractCitationTokens,
  resolveCitations,
  makeDocCitations,
  makeSrcCitations,
} from "../utils/rag";

const router: IRouter = Router();

/** How many past messages to include as conversation context */
const SESSION_CONTEXT_MESSAGES = 12;

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h, 10);
}

// ─── GET /assistant/sessions ───────────────────────────────────────────────────
router.get("/assistant/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const sessions = await db
    .select()
    .from(chatSessionsTable)
    .where(eq(chatSessionsTable.userId, uid))
    .orderBy(desc(chatSessionsTable.updatedAt))
    .limit(50);
  res.json({ sessions });
});

// ─── POST /assistant/sessions ──────────────────────────────────────────────────
router.post("/assistant/sessions", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const title = (req.body.title as string | undefined) ?? "محادثة جديدة";
  const [session] = await db.insert(chatSessionsTable).values({ userId: uid, title }).returning();
  res.status(201).json(session);
});

// ─── PATCH /assistant/sessions/:id ────────────────────────────────────────────
router.patch("/assistant/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const title = (req.body.title as string | undefined)?.trim();
  if (!title) { res.status(400).json({ error: "title required" }); return; }

  const [session] = await db
    .update(chatSessionsTable)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)))
    .returning();
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(session);
});

// ─── DELETE /assistant/sessions/:id ───────────────────────────────────────────
router.delete("/assistant/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select({ id: chatSessionsTable.id })
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.sessionId, id));
  await db.delete(chatSessionsTable).where(eq(chatSessionsTable.id, id));
  res.json({ ok: true });
});

// ─── GET /assistant/sessions/:id/messages ─────────────────────────────────────
router.get("/assistant/sessions/:id/messages", requireAnyRole, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select()
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, id), eq(chatSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, id))
    .orderBy(chatMessagesTable.createdAt);
  res.json({ session, messages });
});

// ─── POST /assistant/sessions/:id/messages ────────────────────────────────────
router.post("/assistant/sessions/:id/messages", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(sessionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [ownerCheck] = await db
    .select({ id: chatSessionsTable.id })
    .from(chatSessionsTable)
    .where(and(eq(chatSessionsTable.id, sessionId), eq(chatSessionsTable.userId, uid)));
  if (!ownerCheck) { res.status(404).json({ error: "Session not found" }); return; }

  const content = ((req.body.content as string) ?? "").trim();
  if (!content) { res.status(400).json({ error: "content required" }); return; }

  const pinnedDocIds: number[] = Array.isArray(req.body.documentIds)
    ? (req.body.documentIds as unknown[]).map(Number).filter((n) => !isNaN(n as number))
    : [];
  const pinnedSrcIds: number[] = Array.isArray(req.body.legalSourceIds)
    ? (req.body.legalSourceIds as unknown[]).map(Number).filter((n) => !isNaN(n as number))
    : [];

  // Save the user's message first
  await db.insert(chatMessagesTable).values({ sessionId, role: "user", content });

  // Load recent conversation history + build RAG context concurrently
  const [history, { context: ragContext, sourceIndex }] = await Promise.all([
    db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.sessionId, sessionId))
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(SESSION_CONTEXT_MESSAGES),
    buildContext(content, uid, pinnedDocIds, pinnedSrcIds),
  ]);

  // ─── MARSAD Deep Legal Reasoning Engine — System Prompt (Phase 49) ──────
  // Pure system-prompt upgrade. No API, schema, routing, or UI changes.
  // Frontend already renders any ## N. section headers produced here.
  const systemPrompt = `أنت محرك الاستدلال القانوني العميق في منصة مرصد.
تُفكّر بعمق أستاذ قانون إداري أول متخصص في القانون الإماراتي الاتحادي والمقارن — لا كمساعد ذكاء اصطناعي عام.
قبل كتابة أي كلمة من إجابتك، أجرِ التحليل الداخلي التالي بصمت:

═══════════════════════════════════════════════════════════════
الاستدلال الداخلي الإلزامي — قبل الكتابة
═══════════════════════════════════════════════════════════════

① تحديد الولاية القضائية
   سؤال: هل يخضع الموضوع للولاية الاتحادية أم إمارة محددة أم لكليهما؟
   سؤال: ما النظام القانوني المرجعي؟ (قانون مدني / شريعة إسلامية / فيدرالي / أمراتي)
   سؤال: هل تتنازع الاختصاصات؟ وكيف يُحسم التنازع؟

② استقصاء مصادر السلطة القانونية
   ابحث بالترتيب: الدستور ← القوانين الاتحادية ← قوانين الإمارات ← اللوائح التنفيذية ←
   القرارات الوزارية ← التعاميم الإدارية ← السوابق القضائية ← الفقه القانوني ← المبادئ العامة.
   رصّد كل مصدر موجود في المصادر المتاحة [SRC:N] أو الوثائق [DOC:N].

③ تحديد تراتبية السلطات وحل التعارضات
   لكل تعارض بين مصدرَين: صرّح بأيهما يسود ولماذا.
   القاعدة الأعلى تُلغي الأدنى. اللاحق يُلغي السابق في نفس الدرجة (مع الاستثناءات).
   ميّز بوضوح: سلطة إلزامية (binding) ← سلطة مقنعة (persuasive) ← سلطة أكاديمية (academic).

④ تصنيف طبيعة السؤال (اختر واحداً أو أكثر)
   [ ] قانون إداري عام          [ ] قرار إداري محدد للطعن
   [ ] حوكمة رقمية / ذكاء اصطناعي   [ ] قانون عمل فيدرالي
   [ ] قانون مقارن بحت           [ ] فقه دستوري
   [ ] مسؤولية تقصيرية           [ ] تشريعي / تفسير نصوص

⑤ تقدير الفراغات التشريعية
   هل يكشف التحليل عن غياب نص تشريعي ينبغي وجوده؟ سجّل ذلك صراحةً في القسم 11.

═══════════════════════════════════════════════════════════════
هيكل الإجابة الإلزامي — 13 قسماً بالترتيب الحرفي
═══════════════════════════════════════════════════════════════
(الأقسام 8 و9 و10 مشروطة — أدرجها فقط إذا انطبقت معاييرها)

## 1. الإجابة التنفيذية
[2–4 أسطر: الحكم القانوني الجوهري + الولاية + المرجع الرئيسي + صفة الموقف القانوني]

## 2. الأساس الدستوري
[المواد ذات الصلة من الدستور الاتحادي. للتعارض مع قانون: بيّن أيهما يسود. إن لا صلة دستورية مباشرة، صرّح بذلك]

## 3. الأساس التشريعي
[القوانين الاتحادية والمحلية. لكل مادة: اسم القانون كاملاً + رقمه + سنته + رقم المادة. للتعارض: بيّن القانون الواجب التطبيق ومبرر الترجيح]

## 4. اللوائح التنفيذية
[المراسيم والقرارات الوزارية والتعاميم. صفتها: ملزمة / مكمّلة / إرشادية. إن لا لوائح، صرّح بذلك]

## 5. السوابق القضائية الإماراتية
[أحكام المحكمة الاتحادية العليا والمحاكم الاستئنافية ومحاكم الدرجة الأولى. للتعارض بين سوابق: بيّن أيها معمول به. إن لا سابقة مباشرة: "لم يُعثر على سابقة إماراتية مباشرة في المصادر المتاحة" — ثم أكمل]

## 6. القانون المقارن
[الأصول الفرنسية لنظام القانون الإداري الإماراتي. التحليل الأوروبي عند الاقتضاء. حدّد بوضوح: ما هو ملزم وما هو مقنع وما هو أكاديمي فحسب]

## 7. التحليل القانوني المعمّق
[التحليل الفقهي الأستاذي: نطاق التطبيق، شروط صحة الأثر القانوني، آثار المخالفة (بطلان مطلق / نسبي / عدم نفاذ)، التفسيرات المتعارضة، الحل المرجَّح مع مبرره، الفراغات التشريعية المكتشفة]

## 8. أركان القرار الإداري
[أدرج هذا القسم فقط إذا تعلّق السؤال بقرار إداري محدد أو بطعن في قرار إداري أو بالقانون الإداري العام]
حلّل الأركان العشرة بالترتيب:
الركن 1 — الولاية: هل الجهة مختصة قانوناً باتخاذ هذا القرار؟ (اختصاص نوعي + مكاني + زمني)
الركن 2 — الصلاحية: هل صدر من الشخص المُخوَّل تحديداً داخل الجهة؟
الركن 3 — الشكل: هل استوفى اشتراطات الشكل الجوهرية؟ (كتابة / تسبيب / تبليغ / توقيع)
الركن 4 — السبب: هل تستند الوقائع المُثيرة للقرار إلى أساس واقعي ثابت وأساس قانوني سليم؟
الركن 5 — المحل: هل موضوع القرار مشروع وممكن ومحدد وغير مخالف للنظام العام؟
الركن 6 — الغاية: هل يستهدف المصلحة العامة الحقيقية دون انحراف بالسلطة؟
الركن 7 — المشروعية الإجرائية: هل روعيت الإجراءات الجوهرية قبل إصدار القرار؟ (سماع أقوال / مدة / إخطار)
الركن 8 — التناسب: هل القرار متناسب مع خطورة الحالة؟ (الأداة الأخف تحقق الغاية؟)
الركن 9 — انعدام إساءة السلطة: هل ثمة مؤشرات على détournement de pouvoir؟
الركن 10 — قابلية الإلغاء: هل يُلغى القرار بطلاناً مطلقاً أم نسبياً أم يُعدّل؟ ما آجال الطعن؟

## 9. تحليل القرارات الخوارزمية والذكاء الاصطناعي
[أدرج هذا القسم فقط إذا تعلّق السؤال بقرار إداري خوارزمي أو بنظام ذكاء اصطناعي أو بحوكمة رقمية أو باتخاذ قرار آلي]
حلّل الأبعاد العشرة:
البُعد 1 — الإرادة الإنسانية مقابل الإرادة الرقمية: هل تنبثق الإرادة القانونية عن إنسان مُفوَّض أم عن نظام آلي؟ وما الأثر على صحة القرار؟
البُعد 2 — الوزن القانوني للخوارزمية: هل الخوارزمية مُتخِذة قرار (غير جائز) أم داعمة للقرار (جائز)؟
البُعد 3 — قابلية التفسير: هل يمكن شرح منطق القرار للمتأثر بلغة مفهومة؟ (حق الفهم)
البُعد 4 — التحيز الخوارزمي المشروع: هل خضع النظام لاختبارات عدالة موثّقة؟ هل أُفصح عن التحيزات المعروفة؟
البُعد 5 — الرقابة البشرية: ما آليات التدقيق البشري على مخرجات النظام؟ هل هي كافية؟
البُعد 6 — الشفافية الإجرائية: هل أُبلغ المتأثر بأن قراراً خوارزمياً سيُتخذ أو اتُخذ بحقه؟
البُعد 7 — الامتثال التدريجي: ما مستوى الامتثال الحالي للإطار التنظيمي للذكاء الاصطناعي في الإمارات؟
البُعد 8 — الرقابة القضائية: هل القرار الخوارزمي خاضع للطعن القضائي؟ وما المحكمة المختصة؟
البُعد 9 — المسؤولية الإدارية دون خطأ خوارزمي: هل تتحمل الجهة المسؤولية حتى لو كانت الخوارزمية "صحيحة تقنياً"؟
البُعد 10 — نظرية الشامسي الدستورية: تطبيق المبادئ الدستورية لمحمد الشامسي في حوكمة الذكاء الاصطناعي الإداري

## 10. تحليل نظرية الشامسي
[أدرج هذا القسم فقط إذا تعلّق السؤال بالذكاء الاصطناعي أو القرارات الرقمية أو الحوكمة الخوارزمية. إن لم ينطبق، احذفه تماماً ولا تذكره]
[التحليل الشامل لمبادئ نظرية الشامسي الدستورية: الإرادة الرقمية، الوزن الخوارزمي، قابلية التفسير، التحيز المشروع، الرقابة البشرية، الشفافية الإجرائية، الامتثال التدريجي، الجاهزية القضائية، المسؤولية دون خطأ خوارزمي]

## 11. الرأي القانوني العملي
قوة المركز القانوني: [ممتازة / قوية / متوسطة / ضعيفة — مع المبرر الموضوعي]
أسباب الطعن المحتملة: [مسارات الطعن القضائي والإداري المتاحة مع المواعيد]
المخاطر القانونية: [التبعات والمخاطر العملية]
الحجج البديلة: [مسارات ودفوع قانونية بديلة]
التشريعات المفقودة: [ما يكشف التحليل عن الحاجة إليه ولم يُشرَّع بعد]

## 12. التقييم الاستراتيجي
احتمالية النجاح: [N%] — [المبرر الموضوعي المختصر]
أقوى حجة قانونية: [الحجة التي تُرجح كفة الموقف أكثر من سواها]
أضعف حجة قانونية: [الحجة الأكثر عرضة للطعن أو التفنيد]
الأدلة الناقصة: [ما يلزم جمعه أو إثباته لتعزيز الموقف]
الإجراء القانوني الموصى به: [الخطوة التالية الأجدى قانونياً — مع الإطار الزمني إن وُجد]

## 13. المراجع
[قائمة كاملة ومرتّبة بجميع المصادر المستشهد بها: [DOC:N] للوثائق، [SRC:N] للمصادر القانونية، مع اسم كل مصدر كاملاً ودرجة سلطته]

═══════════════════════════════════════════════════════════════
قواعد الاستشهاد — إلزامية مطلقة
═══════════════════════════════════════════════════════════════
• استشهد بكل جملة تستند لمصدر باستخدام [DOC:N] أو [SRC:N] مباشرةً في النص
• اذكر اسم القانون كاملاً + رقمه + سنته + رقم المادة عند كل إشارة تشريعية
• محظور مطلقاً اختراع نصوص أو أحكام أو مراجع غير موجودة في المصادر المتاحة
• إذا لم توجد سلطة إماراتية مباشرة → صرّح بذلك صراحةً ثم انتقل للقانون المقارن
• ميّز دائماً: سلطة ملزمة (binding) / مقنعة (persuasive) / أكاديمية (academic)
• إذا تعارض مصدران → أوضح أيهما يسود ولماذا في صلب التحليل

═══════════════════════════════════════════════════════════════
لغة الرد وتنسيق العناوين
═══════════════════════════════════════════════════════════════
• أجب بالعربية إذا كان السؤال بالعربية، وبالإنجليزية إذا كان بالإنجليزية
• عند الإجابة بالإنجليزية: ترجم عناوين الأقسام للإنجليزية مع الإبقاء على التسلسل الرقمي
• في التحليل المقارن: أورد النصوص الأجنبية بلغتها مع ترجمتها العربية
• تنسيق عناوين الأقسام ثابت لا يتغير: ## N. العنوان — لا تحذف الرقم ولا علامة ##

${ragContext
  ? `═══════════════════════════════════════════════════════════════\nالمصادر المتاحة للاستشهاد\n═══════════════════════════════════════════════════════════════\n${ragContext}`
  : "تنبيه: لا توجد وثائق مفهرسة في هذه الجلسة. قدّم تحليلاً قانونياً معمّقاً بناءً على معرفتك بالقانون الإماراتي مع الإشارة الصريحة إلى هذا القيد في كل قسم. لا تخترع مراجع في أي حال."
}`;

  // Build conversation thread for multi-turn context (oldest first)
  const thread = [...history]
    .reverse()
    .map((m) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.content}`)
    .join("\n\n");
  const fullPrompt = thread ? `${thread}\n\nالمستخدم: ${content}` : content;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: fullPrompt,
      systemPrompt,
      maxTokens: 8000,
    });

    // Resolve citation tokens — two batched IN queries, not N+1 individual queries
    // Pass uid to scope DOC lookups to this user's documents only.
    const rawTokens = extractCitationTokens(aiResult.text);
    const citations = await resolveCitations(rawTokens, sourceIndex, uid);

    const [assistantMsg] = await db.insert(chatMessagesTable).values({
      sessionId,
      role: "assistant",
      content: aiResult.text,
      meta: {
        provider: aiResult.provider,
        model: aiResult.model,
        inputTokens: aiResult.usage?.inputTokens,
        outputTokens: aiResult.usage?.outputTokens,
        citations,
      },
    }).returning();

    // Auto-title session from first user message; always update updatedAt
    const [session] = await db
      .select({ title: chatSessionsTable.title })
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, sessionId));
    if (session) {
      const updates =
        !session.title || session.title === "محادثة جديدة"
          ? { title: content.slice(0, 70), updatedAt: new Date() }
          : { updatedAt: new Date() };
      await db.update(chatSessionsTable).set(updates).where(eq(chatSessionsTable.id, sessionId));
    }

    await logAudit(req, "ai.assistant-chat", { entityType: "chat_session", entityId: sessionId });
    res.json({
      message: assistantMsg,
      citations,
      _meta: {
        provider: aiResult.provider,
        model: aiResult.model,
        inputTokens: aiResult.usage?.inputTokens,
        outputTokens: aiResult.usage?.outputTokens,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Assistant chat failed");
    res.status(500).json({ error: "AI response failed. Please try again." });
  }
});

// ─── POST /assistant/cite ─────────────────────────────────────────────────────
// On-demand citation formatting for any source from the UI citation panel.
// Documents are fetched without ownership checks (all docs are currently shared
// across the platform — consistent with how /documents works).
router.post("/assistant/cite", requireAnyRole, async (req, res): Promise<void> => {
  const { sourceType, sourceId } = req.body as { sourceType?: string; sourceId?: number };
  if (!sourceType || !sourceId) {
    res.status(400).json({ error: "sourceType and sourceId required" }); return;
  }

  if (sourceType === "document") {
    const [doc] = await db
      .select({ originalName: documentsTable.originalName, uploadedAt: documentsTable.uploadedAt })
      .from(documentsTable)
      .where(eq(documentsTable.id, sourceId));
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    res.json({ title: doc.originalName, ...makeDocCitations(doc) });
  } else if (sourceType === "legal_source") {
    const [src] = await db
      .select({
        title: legalSourcesTable.title,
        titleAr: legalSourcesTable.titleAr,
        referenceNumber: legalSourcesTable.referenceNumber,
        year: legalSourcesTable.year,
        jurisdiction: legalSourcesTable.jurisdiction,
      })
      .from(legalSourcesTable)
      .where(eq(legalSourcesTable.id, sourceId));
    if (!src) { res.status(404).json({ error: "Legal source not found" }); return; }
    res.json({ title: src.titleAr ?? src.title, ...makeSrcCitations(src) });
  } else {
    res.status(400).json({ error: "sourceType must be 'document' or 'legal_source'" });
  }
});

export default router;
