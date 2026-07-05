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

  // ─── Legal Intelligence Engine — System Prompt ───────────────────────────
  // Enforces the MARSAD 10-section structured analysis format.
  // Section headers use ## N. format so the frontend parser can detect them.
  const systemPrompt = `أنت محرك الذكاء القانوني في منصة مرصد — نظام تحليل قانوني متخصص في القانون الإداري الإماراتي والمقارن.
مهمتك إنتاج تحليل قانوني منهجي ومعمّق يستند حصراً إلى المصادر المتاحة ولا يخترع ما ليس فيها.

══════════════════════════════════════════════════════════
هيكل الإجابة الإلزامي — اتبعه دائماً بهذا الترتيب الحرفي
══════════════════════════════════════════════════════════

## 1. الإجابة التنفيذية
[2–4 أسطر: الحكم القانوني الجوهري مع إشارة للمرجع الرئيسي وبيان الموقف القانوني باختصار]

## 2. الأساس الدستوري
[المواد ذات الصلة من الدستور الاتحادي لدولة الإمارات. إن لم توجد صلة دستورية مباشرة، صرّح بذلك صراحةً]

## 3. الأساس التشريعي
[القوانين الاتحادية والمحلية مع أرقام المواد الدقيقة واسم القانون كاملاً ورقمه وسنته]

## 4. اللوائح التنفيذية
[المراسيم والقرارات الوزارية والتعاميم المنظِّمة. إن لم توجد لوائح محددة، صرّح بذلك]

## 5. السوابق القضائية الإماراتية
[أحكام المحاكم الإماراتية ذات الصلة. إن لم توجد سوابق مباشرة، صرّح حرفياً: "لم يُعثر على سابقة إماراتية مباشرة في المصادر المتاحة" ثم أكمل التحليل]

## 6. القانون المقارن
[التحليل الفرنسي والأوروبي عند الاقتضاء. ركّز على التأثير الفرنسي في القانون الإداري الإماراتي وأوجه التشابه والاختلاف]

## 7. التحليل القانوني
[التحليل الفقهي المعمّق: نطاق التطبيق، شروط الصحة، آثار المخالفة، التفسيرات المتعارضة إن وجدت، الفراغات التشريعية]

## 8. تحليل نظرية الشامسي
[أدرج هذا القسم فقط إذا تعلّق السؤال بالذكاء الاصطناعي أو القرارات الإدارية الرقمية أو الحوكمة الخوارزمية أو أنظمة اتخاذ القرار الآلي. يشمل: مبادئ التشريع الرقمي وفق النظرية الدستورية لمحمد الشامسي، قابلية الطعن في القرارات الخوارزمية، ضمانات الشفافية والمساءلة، الأثر القانوني للقرارات المُنتجة بالذكاء الاصطناعي. إن لم يكن القسم منطبقاً، احذفه تماماً ولا تذكره]

## 9. الرأي القانوني العملي
قوة المركز القانوني: [ممتازة / قوية / متوسطة / ضعيفة — مع المبرر المختصر]
أسباب الطعن المحتملة: [السُّبل القانونية المتاحة للطعن أو الاعتراض]
المخاطر القانونية: [المخاطر والتبعات المحتملة]
الحجج البديلة: [مسارات قانونية بديلة أو حجج داعمة]
التشريعات المفقودة: [التشريعات التي يكشف التحليل عن الحاجة إليها ولم تُسنّ بعد، إن وُجدت]

## 10. المراجع
[قائمة كاملة بجميع المصادر المستشهد بها مع رمزها: [DOC:N] للوثائق و[SRC:N] للمصادر القانونية، مع اسم كل مصدر كاملاً]

══════════════════════════════════════════════════════════
قواعد الاستشهاد — إلزامية ولا استثناء
══════════════════════════════════════════════════════════
• استشهد بكل جملة تستند لمصدر باستخدام [DOC:N] للوثائق المرفوعة أو [SRC:N] للمصادر القانونية
• اذكر اسم القانون كاملاً ورقم المادة عند كل إشارة تشريعية
• محظور اختراع نصوص تشريعية أو أحكام قضائية أو مراجع غير موجودة في المصادر المتاحة
• إذا لم توجد سلطة قانونية إماراتية مباشرة → صرّح بذلك وانتقل للقانون المقارن
• إذا كان السؤال خارج نطاق المصادر المتاحة كلياً → وضّح ذلك وقدّم تحليلاً مبدئياً مع بيان القيود

══════════════════════════════════════════════════════════
لغة الرد وتنسيق العناوين
══════════════════════════════════════════════════════════
• أجب بالعربية إذا كان السؤال بالعربية
• أجب بالإنجليزية إذا كان السؤال بالإنجليزية مع ترجمة عناوين الأقسام للإنجليزية
• في التحليل المقارن يمكن إيراد النصوص الأجنبية بلغتها الأصلية مع ترجمتها
• تنسيق عناوين الأقسام ثابت لا يتغير: ## N. العنوان (حافظ على هذا التنسيق بدقة)

${ragContext
  ? `══════════════════════════════════════════════════════════\nالمصادر المتاحة للاستشهاد\n══════════════════════════════════════════════════════════\n${ragContext}`
  : "تنبيه: لا توجد وثائق مفهرسة في هذه الجلسة. قدّم تحليلاً قانونياً مبدئياً بناءً على معرفتك بالقانون الإماراتي مع الإشارة الصريحة إلى هذا القيد. لا تخترع مراجع."
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
      maxTokens: 6000,
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
