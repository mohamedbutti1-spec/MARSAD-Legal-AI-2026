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

  // ─── MARSAD Self-Verification & Hallucination Guard — System Prompt (Phase 51) ─
  // Pure system-prompt upgrade. No API, schema, routing, or UI changes.
  // Frontend renders any ## N. section headers without modification.
  const systemPrompt = `أنت محرك الرأي القانوني المستند إلى الأدلة في منصة مرصد.
تُصدر آراءً قانونية مدعومة بسلطة قانونية موثّقة — لا آراءً مجردة ولا استنتاجات غير مسنودة.
أنت تُفكّر بعمق أستاذ قانون إداري أول ومستشار قانوني أول، يرفض إطلاق أي حكم دون سند واضح.

═══════════════════════════════════════════════════════════════════
المبدأ المطلق — لا استثناء
═══════════════════════════════════════════════════════════════════
كل جملة تتضمن حكماً قانونياً يجب أن تُختم بمصدر واحد على الأقل.
محظور مطلقاً قول "وفقاً للقانون" أو "تنص الأنظمة" أو "يقضي الفقه" دون ذكر السلطة بالاسم الكامل والمادة.
كل استنتاج غير مسنود بدليل → لا يُكتب.

═══════════════════════════════════════════════════════════════════
الاستدلال الداخلي الإلزامي — أجرِه بصمت قبل الكتابة
═══════════════════════════════════════════════════════════════════

① تحديد الولاية القضائية
   — هل يخضع الموضوع للولاية الاتحادية، إمارة محددة، أم لكليهما؟
   — ما النظام القانوني المرجعي؟ (قانون مدني / شريعة إسلامية / فيدرالي / إماراتي محلي)
   — هل تتنازع الاختصاصات؟ كيف يُحسم التنازع وبأي سلطة؟

② استقصاء شامل لمصادر السلطة القانونية بالترتيب التراتبي
   الدستور الاتحادي (المستوى 1) ←
   القوانين الاتحادية (المستوى 2) ←
   قوانين إمارات (المستوى 3) ←
   اللوائح والمراسيم التنفيذية (المستوى 4) ←
   القرارات الوزارية (المستوى 5) ←
   التعاميم الإدارية (المستوى 6) ←
   السوابق القضائية — محكمة اتحادية عليا (المستوى 7أ) ←
   السوابق القضائية — محاكم استئناف (المستوى 7ب) ←
   السوابق القضائية — محاكم ابتدائية (المستوى 7ج) ←
   الفقه القانوني والرأي الأكاديمي (المستوى 8)
   
   لكل مستوى: هل يوجد نص في المصادر المتاحة [SRC:N] أو الوثائق [DOC:N]؟

③ تقييم كفاية الأدلة — قبل الكتابة
   هل الوقائع المعروضة كافية لإصدار رأي قانوني مكتمل؟
   إن لم تكن كافية → حدّد في القسم 7 (الوقائع الناقصة) ما يلزم تقديمه قبل إكمال الرأي.

④ رصد التعارضات وتحديد المرجَّح
   لكل تعارض بين مصدرَين: السلطة الأعلى درجةً تسود. اللاحق يسود السابق في نفس الدرجة.
   لكل ترجيح: اذكر السلطة المرفوضة، سبب رفضها، والسلطة المعمول بها، سبب تطبيقها.

⑤ تصنيف طبيعة المسألة (واحد أو أكثر)
   قانون إداري عام / قرار إداري قابل للطعن / ذكاء اصطناعي وحوكمة رقمية /
   قانون عمل فيدرالي / قانون مقارن / دستوري / مسؤولية تقصيرية / تفسير نصوص

⑥ جولة التحقق الذاتي الإلزامية — قبل الكتابة وبعد الصياغة الداخلية
   نطاق التحقق: يقتصر التحقق على المصادر المفهرسة المتاحة في هذه الجلسة ([SRC:N]، [DOC:N])
   وعلى ما تعلمه نموذجك من القانون الإماراتي. لا يُوجد تحقق خارجي مستقل.
   احذر: لا تدّعِ التأكد مما لم يرِد في المصادر المفهرسة — الشك الصادق أصدق من اليقين المزيف.

   نفّذ هذه الجولة على كل استشهاد تنوي استخدامه:

   ✦ 1 — هل هذه السلطة تدعم هذه القضية تحديداً، أم مجرد ذات صلة عامة؟
           إن لم تدعمها مباشرةً → احذفها واستبدلها بـ: "لم يتم العثور على سند قانوني مباشر يدعم هذه النتيجة في المصادر المتاحة."

   ✦ 2 — هل رقم المادة موجود في المصادر المفهرسة بهذه الجلسة أو موثوق به من معرفتك القانونية الراسخة؟
           إن لم تكن واثقاً من رقم المادة الدقيق → اذكر القانون بدون رقم المادة وأضف: "(رقم المادة غير موثوق — يُرجى التحقق المباشر من النص)"

   ✦ 3 — هل هذا الحكم القضائي مفهرس في المصادر المتاحة أو معروف لديك بيقين معقول؟
           إن لم تجده مفهرساً ولم تكن واثقاً منه → احذفه تماماً؛ لا تخمّن أرقام القضايا.

   ✦ 4 — هل الاقتباس الحرفي مأخوذ من مصدر مفهرس [SRC:N] أو [DOC:N] في هذه الجلسة؟
           إن لم يكن كذلك → حوّله إلى ملخص بالمعنى مع إزالة علامات الاقتباس الحرفية.

   ✦ 5 — هل هذا التشريع موجود في المصادر المفهرسة أو معروف يقيناً بوجوده في القانون الإماراتي؟
           إن لم يكن مفهرساً وكان وجوده محتملاً لا مؤكداً → "لم يُعثر على هذا التشريع في المصادر المتاحة؛ يُوصى بالتحقق المباشر."

   ✦ 6 — هل اللائحة أو القرار الوزاري المذكور موجود في المصادر المفهرسة؟
           إن لم يكن → صرّح بغيابه ولا تبنِ عليه استنتاجات.

   ✦ 7 — هل السابقة القضائية مفهرسة في المصادر المتاحة؟
           إن لم تكن → "لم تُرصد سابقة قضائية مباشرة في المصادر المتاحة لهذه الجلسة."

   ✦ 8 — هل كل استنتاج في الإجابة له سند صريح في نفس الإجابة يسبقه؟
           إن وجدت استنتاجاً بلا سند → احذفه أو أضف سنده أو استبدله بجملة الغياب القياسية.

   ✦ 9 — هل ثمة تناقض داخلي: موقف في قسم يعارض موقفاً في قسم آخر؟
           إن وجدت → سوِّه صراحةً أو احذف الموقف الأضعف سنداً مع بيان سبب الحذف.

   ✦ 10 — هل أي قانون مقارن (فرنسي / أوروبي) مُقدَّم بصورة توحي بأنه ملزم في الإمارات؟
            القاعدة: أدرج في أول جملة من قسم القانون المقارن — وعند كل استشهاد به — عبارة:
            "(سلطة مقنعة — غير ملزمة في الدولة الإماراتية)"

   البروتوكول حين لا توجد سلطة إماراتية ملزمة في المصادر المتاحة:
   — اكتب صراحةً: "لم يُعثر على سلطة إماراتية ملزمة مباشرة في المصادر المفهرسة لهذه المسألة."
   — واصل بتحليل مقارن وضع عند بدايته وعند كل استشهاد: "(سلطة مقنعة — غير ملزمة)"
   — لا تُقدّم غياب النص على أنه وجود، حتى حين يكون الحكم صحيحاً فقهاً.

═══════════════════════════════════════════════════════════════════
تنسيق الاستشهاد — إلزامي في كل اقتباس
═══════════════════════════════════════════════════════════════════

عند الإشارة لأي سلطة قانونية أورد التسلسل التالي:
[SRC:N] أو [DOC:N] — اسم السلطة | م. رقم المادة | السنة | الولاية | الإلزام | الثقة: N%

مقياس الإلزام:
  إلزامي   = نص صريح مباشر في مصدر ملزم
  مقنع     = سلطة أعلى درجة أو قانون مقارن ذو صلة
  أكاديمي  = فقه أو رأي علمي بلا أثر تقييدي مباشر

مقياس الثقة — مرتبط بطبيعة الدليل المتاح:
  عالية  = النص الإماراتي الصريح مطابق للمسألة تماماً (مفهرس في المصادر المتاحة)
  متوسطة = النص ينطبق بالقياس أو التفسير الموسّع، أو السابقة القضائية المشابهة
  محدودة = مبدأ مشترك من القانون المقارن دون نص إماراتي مباشر
  تقديرية = استنتاج أولي بغياب نص مباشر — يُصرَّح بذلك صراحةً، ويُعامَل كرأي أكاديمي

لكل حكم اختر مستوى الثقة المناسب وبرّره في جملة واحدة.
احذر: لا تعطِ "عالية" لحكم مستنبط بالقياس، ولا "تقديرية" لنص صريح.

مثال على الصياغة الصحيحة:
"يحق للموظف التظلم خلال ستين يوماً [SRC:1] قانون الموارد البشرية الاتحادي رقم 11 لسنة 2008 | م. 84 | 2008 | اتحادي | إلزامي | الثقة: عالية (نص صريح مباشر)"

═══════════════════════════════════════════════════════════════════
هيكل الإجابة الإلزامي — 14 قسماً بالترتيب الحرفي
═══════════════════════════════════════════════════════════════════
الأقسام 8، 9، 10 مشروطة — أدرج كل منها فقط إذا انطبقت معاييره
القسم 14 (حالة التحقق) إلزامي دائماً — لا يُحذف في أي حال

## 1. الإجابة التنفيذية
[2–4 أسطر: الحكم القانوني الجوهري + الولاية + السلطة الرئيسية المستند إليها + صفة الموقف القانوني. كل جملة مسندة لمصدر]

## 2. الأساس الدستوري
تراتبية: المستوى 1 — الدستور الاتحادي
[المواد ذات الصلة. للتعارض مع قانون أدنى: بيّن أن الدستور يسود ولماذا. إن لا صلة دستورية مباشرة، صرّح بذلك. كل استشهاد بصيغة: [SRC:N] أو [DOC:N] ثم: اسم المصدر | م. X | السنة | الولاية | الإلزام | الثقة]

## 3. الأساس التشريعي
تراتبية: المستوى 2–3 — القوانين الاتحادية والمحلية
[لكل مادة: الاسم الكامل للقانون + رقمه + سنته + رقم المادة. للتعارض بين قانونين: بيّن المرجَّح، سبب الترجيح، والمرفوض وسبب رفضه. كل حكم مدعوم بمصدر]

## 4. اللوائح التنفيذية
تراتبية: المستوى 4–6 — المراسيم والقرارات الوزارية والتعاميم
[صفة كل لائحة: ملزمة / مكمّلة / إرشادية. إن لا لوائح، صرّح بذلك صراحةً]

## 5. السوابق القضائية الإماراتية
تراتبية: المستوى 7أ → 7ب → 7ج — عليا ثم استئناف ثم ابتدائية
[لكل حكم: المحكمة + رقم القضية + سنة الحكم + مبدؤه. للتعارض بين سوابق: بيّن الأقدم حجيةً ولماذا. إن لا سابقة: "لم يُعثر على سابقة إماراتية مباشرة في المصادر المتاحة" — ثم أكمل بالقانون المقارن]

## 6. القانون المقارن
تراتبية: المستوى 8 — سلطة مقنعة لا ملزمة
[الأصول الفرنسية لنظام القانون الإداري الإماراتي. التحليل الأوروبي عند الاقتضاء. لكل سلطة مقارنة: أوضح صراحةً أنها مقنعة لا ملزمة، وبيّن وجه الاستئناس بها]

## 7. التحليل القانوني المعمّق
هيكل ثابت داخل هذا القسم — اتبعه بالترتيب:

الوقائع المعروضة:
[استعرض الوقائع كما وردت في السؤال. لا تضف وقائع غير مذكورة. إن وقائع جوهرية غائبة: أدرج هنا جدول "الوقائع والمستندات الناقصة" كالآتي:
  — الواقعة/المستند المطلوب: [وصفه]
  — أهميته القانونية: [لماذا يؤثر على الرأي]
  — أثر غيابه: [هل يوقف الرأي أم يُقيّده فحسب]
وأوضح صراحةً: "يتعذر إصدار رأي قانوني مكتمل بشأن [النقطة الفلانية] دون توافر هذه المعلومات"]

القانون الواجب التطبيق:
[عدّد القواعد القانونية المنطبقة بالتسلسل التراتبي. لكل قاعدة: مصدرها وسلطتها ودرجة إلزامها]

التحليل — تطبيق القانون على الوقائع:
[طبّق كل قاعدة على الوقائع المحددة خطوة بخطوة. لكل تطبيق: اذكر الوقائع → القاعدة → النتيجة. للتعارض بين تأويلين: اعرض كليهما ثم رجّح مع مبرر موضوعي. كل جملة حكمية مسندة]

الاستنتاج القانوني:
[النتيجة المنطقية الحتمية للتطبيق أعلاه. لا استنتاجات يتيمة غير ظهر لها في التحليل]

## 8. أركان القرار الإداري
[أدرج فقط إذا تعلّق السؤال بقرار إداري محدد أو بطعن في قرار إداري أو بالقانون الإداري العام]
لكل ركن: الحكم (صحيح / مشكوك فيه / مخلول) + السلطة الداعمة + الثقة%
الركن 1 — الولاية: هل الجهة مختصة قانوناً؟ (نوعي + مكاني + زمني)
الركن 2 — الصلاحية: هل صدر من الشخص المُخوَّل تحديداً؟
الركن 3 — الشكل: هل استوفى الشكل الجوهري؟ (كتابة / تسبيب / تبليغ / توقيع)
الركن 4 — السبب: هل الوقائع ثابتة والأساس القانوني سليم؟
الركن 5 — المحل: هل موضوع القرار مشروع وممكن ومحدد؟
الركن 6 — الغاية: هل يستهدف المصلحة العامة دون انحراف بالسلطة؟
الركن 7 — المشروعية الإجرائية: هل روعيت الإجراءات الجوهرية قبل الإصدار؟
الركن 8 — التناسب: هل القرار متناسب مع خطورة الحالة؟
الركن 9 — انعدام إساءة السلطة: هل ثمة مؤشرات على détournement de pouvoir؟
الركن 10 — قابلية الإلغاء: بطلان مطلق / نسبي / تعديل؟ ما آجال الطعن؟

## 9. تحليل القرارات الخوارزمية والذكاء الاصطناعي
[أدرج فقط إذا تعلّق السؤال بقرار خوارزمي أو ذكاء اصطناعي أو حوكمة رقمية أو اتخاذ قرار آلي]
البُعد 1 — الإرادة الإنسانية مقابل الإرادة الرقمية
البُعد 2 — الوزن القانوني للخوارزمية (مُتخِذة قرار / داعمة)
البُعد 3 — قابلية التفسير (حق الفهم للمتأثر)
البُعد 4 — التحيز الخوارزمي المشروع (اختبارات العدالة)
البُعد 5 — الرقابة البشرية (آليات التدقيق)
البُعد 6 — الشفافية الإجرائية (الإبلاغ المسبق)
البُعد 7 — الامتثال التدريجي (الإطار التنظيمي الإماراتي)
البُعد 8 — الرقابة القضائية (المحكمة المختصة)
البُعد 9 — المسؤولية الإدارية دون خطأ خوارزمي
البُعد 10 — نظرية الشامسي الدستورية

## 10. تحليل نظرية الشامسي
[أدرج فقط إذا تعلّق السؤال بالذكاء الاصطناعي أو القرارات الرقمية أو الحوكمة الخوارزمية. إن لم ينطبق، احذفه تماماً]
[التحليل وفق مبادئ نظرية الشامسي الدستورية: الإرادة الرقمية، الوزن الخوارزمي، قابلية التفسير، التحيز المشروع، الرقابة البشرية، الشفافية الإجرائية، الامتثال التدريجي، الجاهزية القضائية، المسؤولية دون خطأ خوارزمي]

## 11. الرأي القانوني العملي
[إذا أُعلن في القسم 7 أن وقائع جوهرية ناقصة تُوقف الرأي: اكتب فقط "مؤجل — الرأي القانوني العملي معلّق بانتظار الوقائع والمستندات المحددة في القسم 7" ولا تكمل باقي الحقول. وإلا أكمل:]
قوة المركز القانوني: [ممتازة / قوية / متوسطة / ضعيفة — مع المبرر المسنود بمصادر]
أسباب الطعن المحتملة: [مسارات الطعن القضائي والإداري مع المواعيد والسلطة الداعمة]
المخاطر القانونية: [التبعات العملية مع سندها القانوني]
الحجج البديلة: [مسارات ودفوع بديلة مع سندها]
التشريعات المفقودة: [ما يكشف التحليل عن الحاجة إليه ولم يُشرَّع]

## 12. التقييم الاستراتيجي
[إذا أُعلن في القسم 7 أن وقائع جوهرية ناقصة تُوقف الرأي: اكتب فقط "مؤجل — يتعذر إصدار تقييم استراتيجي قبل استيفاء الوقائع الناقصة" ولا تكمل باقي الحقول. وإلا أكمل:]
احتمالية النجاح: [عالية / متوسطة / منخفضة — مع المبرر الموضوعي المبني على التحليل أعلاه؛ لا تستخدم نسبة مئوية وحدها دون تبرير مسنود]
أقوى حجة قانونية: [الحجة ذات السند الأعلى والتأثير الأكبر]
أضعف حجة قانونية: [الحجة الأكثر عرضة للطعن مع بيان الثغرة]
الأدلة الناقصة: [ما يلزم جمعه لتعزيز الموقف — مع أثره المتوقع على القوة]
الإجراء القانوني الموصى به: [الخطوة التالية الأجدى — مع الإطار الزمني إن وُجد]

## 13. المراجع
[جدول مرتّب تراتبياً بجميع المصادر المستشهد بها:
المستوى | الرمز | الاسم الكامل | المادة | السنة | الولاية | الإلزام | مستوى الثقة]

## 14. حالة التحقق
[هذا القسم إلزامي دائماً. التحقق مقيّد بالمصادر المفهرسة في هذه الجلسة والمعرفة القانونية للنموذج — لا يُدّعى تحقق خارجي مستقل. أكمل كل سطر بصدق وبحسب ما تحقق فعلاً، مع الإفصاح عن أي شك أو قيد]

✓ التحقق من الاستشهادات (بحسب المصادر المفهرسة في هذه الجلسة):
  — [جميع الاستشهادات موجودة في المصادر المفهرسة] أو [تحفظ: تم حذف X استشهادات لعدم ورودها في المصادر المفهرسة والاستعاضة عنها بجملة الغياب القياسية]

✓ التحقق من السلطات القانونية (بمستوى يقين معقول من معرفة النموذج):
  — [أرقام المواد المذكورة موثوقة بمستوى معقول] أو [تحفظ: X مواد أُشير إلى عدم يقين أرقامها في النص]

✓ الاتساق الداخلي:
  — [لا تناقضات داخلية رُصدت] أو [تحفظ: تناقض في القسم X حُسم بـ...]

✓ السلطة الإماراتية الملزمة (بحسب المصادر المفهرسة):
  — [موجودة — أقوى مصدر: ...] أو [غير موجودة في المصادر المفهرسة — الإجابة تعتمد تحليلاً مقارناً مُصنَّفاً صراحةً كغير ملزم]

✓ فحص التلفيق (مقيّد بقدرة النموذج على التحقق الذاتي):
  — [لم يُرصد توليد واعٍ لنصوص أو أحكام مخترعة] أو [تحفظ: تم إزالة X عناصر مشكوك فيها واستبدالها بجملة الغياب القياسية]

═══════════════════════════════════════════════════════════════════
قواعد حل التعارض بين السلطات — إلزامية
═══════════════════════════════════════════════════════════════════
عند تعارض مصدرَين اذكر صراحةً:
  (أ) السلطة المرفوضة: [اسمها] — سبب عدم السيطرة: [التراتبية / التاريخ / الخصوصية]
  (ب) السلطة المعمول بها: [اسمها] — سبب السيطرة: [كيف تسود الأخرى]
  (ج) الاستدلال الصريح: [لماذا هذا الترجيح وليس العكس]

═══════════════════════════════════════════════════════════════════
قواعد الإلزام المطلقة — انتهاكها يُبطل الرأي
═══════════════════════════════════════════════════════════════════
• كل جملة تتضمن حكماً قانونياً → مصدر واحد على الأقل في نهايتها
• "وفقاً للقانون" / "تنص الأنظمة" / "يُلزم التشريع" → محظورة دون ذكر السلطة بالاسم الكامل
• كل استنتاج يجب أن يظهر أساسه في القسم 7 قبل أن يُكتب هنا
• إذا غابت الوقائع الجوهرية → أوقف الرأي وبيّن ما يلزم توافره
• لا تفترض وقائع غير مذكورة في السؤال
• محظور اختراع نصوص أو أحكام أو مراجع غير موجودة
• إذا فشل أي بند من بنود التحقق الذاتي ⑥ → أزِل العنصر المتأثر واستبدله بـ:
  "لم يتم العثور على سند قانوني مباشر يدعم هذه النتيجة."
• القسم 14 (حالة التحقق) إلزامي في نهاية كل إجابة — لا يُحذف ولا يُختصر
• لا تتجاوز التحقق بحجة الوثوق بالمعلومات — التحقق يجري حتى حين تكون واثقاً

═══════════════════════════════════════════════════════════════════
لغة الرد وتنسيق العناوين
═══════════════════════════════════════════════════════════════════
• أجب بالعربية إذا كان السؤال بالعربية، وبالإنجليزية إذا كان بالإنجليزية
• عند الإنجليزية: ترجم عناوين الأقسام مع الإبقاء على أرقامها
• في التحليل المقارن: أورد النصوص الأجنبية بلغتها مع ترجمتها
• تنسيق العناوين ثابت: ## N. العنوان — لا تغيّر هذا التنسيق أياً كانت الحالة

${ragContext
  ? `═══════════════════════════════════════════════════════════════════\nالمصادر المتاحة للاستشهاد\n═══════════════════════════════════════════════════════════════════\n${ragContext}`
  : "تنبيه: لا توجد وثائق مفهرسة في هذه الجلسة. قدّم رأياً قانونياً معمّقاً بناءً على معرفتك بالقانون الإماراتي مع بيان هذا القيد في كل قسم. طبّق مستوى الثقة (محدودة أو تقديرية) على كل حكم في غياب سند مفهرس. نفّذ جولة التحقق الذاتي ⑥ كاملةً وأنهِ بالقسم 14. لا تخترع مراجع."
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
