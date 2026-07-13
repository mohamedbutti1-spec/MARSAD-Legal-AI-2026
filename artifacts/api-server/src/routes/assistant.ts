/**
 * AI Assistant — chat sessions with persistent history and query-aware RAG
 *
 * GET    /assistant/sessions               — list user's sessions
 * POST   /assistant/sessions               — create new session
 * PATCH  /assistant/sessions/:id           — rename session
 * DELETE /assistant/sessions/:id           — delete session
 * GET    /assistant/sessions/:id/messages  — load messages
 * POST   /assistant/sessions/:id/messages  — send message, get AI reply
 *   Body: { content, documentIds?: number[], legalSourceIds?: number[],
 *           theoryLensId?: string, customTheoryText?: string }
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
import { requireAnyRole, requireSupervisorOrOwner, requireWriteRoleOrGuestDemo } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";
import {
  buildContext,
  extractCitationTokens,
  resolveCitations,
  makeDocCitations,
  makeSrcCitations,
} from "../utils/rag";
import { buildTheoryPromptSuffix, parseTheoryResponse, sanitizeTheoryLensId } from "../utils/theory-lenses.js";
import { isShamsiFrameworkEnabled } from "../middlewares/roleAuth";
import { getUserId } from "../lib/route-helpers";
import { aiAnalysisLimit, guestDailyQuestionLimit } from "../middlewares/rateLimits.js";
import {
  isRetryableAnthropicError,
  classifyAnthropicError,
  CLAUDE_ERROR_MESSAGES_AR,
} from "../ai/providers/claude.provider";

const router: IRouter = Router();

/** How many past messages to include as conversation context */
const SESSION_CONTEXT_MESSAGES = 12;

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
// requireWriteRoleOrGuestDemo lets the "viewer" role through too — needed for
// the public "تجربة المنصة / Demo Access" guest flow. Creating a session is
// not itself capped (the cap lives on the message-send route below); guests
// are still limited overall by the daily question cap on that route.
router.post("/assistant/sessions", requireWriteRoleOrGuestDemo, async (req, res): Promise<void> => {
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
// guestDailyQuestionLimit (5/day, IP-keyed) applies only to the "viewer" role —
// see requireWriteRoleOrGuestDemo. It runs before aiAnalysisLimit so a guest
// who is over their daily cap gets the demo-specific message, not the generic
// per-minute one.
router.post(
  "/assistant/sessions/:id/messages",
  requireWriteRoleOrGuestDemo,
  guestDailyQuestionLimit,
  aiAnalysisLimit,
  async (req, res): Promise<void> => {
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

  // Theory lens — optional overlay that appends a named analytical framework.
  // Al-Shamsi ('shamsi') is owner-only; downgraded server-side for anyone else,
  // even if the frontend sent it directly to the API.
  const theoryLensId: string = sanitizeTheoryLensId(
    req.body.theoryLensId as string,
    req.user?.role,
    isShamsiFrameworkEnabled(),
  );
  const customTheoryText: string = ((req.body.customTheoryText as string) ?? "").trim();
  const { suffix: theorySuffix, markerLabel: theoryMarkerLabel } =
    buildTheoryPromptSuffix(theoryLensId, customTheoryText);

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

  // ─── MARSAD Supreme Administrative Law Engine — System Prompt (Phase 52) ──
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
   — اكتب صراحةً: "لم يُعثر على سند إماراتي مُلزم في المصادر المفهرسة."
   — واصل بتحليل مقارن مُصنَّف صراحةً في كل جملة كـ"سلطة قانونية مقنعة غير ملزمة"
   — لا تُقدّم غياب النص على أنه وجود، حتى حين يكون الحكم صحيحاً فقهاً.
   — لا تتجاهل سلطة مخالفة صامتاً — كل سلطة مضادة تُعالَج صراحةً ويُبيَّن سبب عدم تطبيقها.

═══════════════════════════════════════════════════════════════════
تنسيق الاستشهاد — إلزامي في كل اقتباس
═══════════════════════════════════════════════════════════════════

عند الإشارة لأي سلطة قانونية أورد الحقول الثمانية بالترتيب:
[SRC:N] أو [DOC:N] — الولاية | مستوى السلطة | إلزامي/مقنع/أكاديمي | اسم السلطة | م./حكم رقم | السنة | سبب التطبيق | الثقة

الولاية: اتحادي / إماراتي محلي (أبوظبي، دبي، ...) / فرنسي / أوروبي / مقارن
مستوى السلطة: دستوري (1) / تشريعي (2–3) / تنفيذي (4–6) / قضائي (7أ/7ب/7ج) / أكاديمي (8)
الإلزام: إلزامي (نص صريح ملزم) | مقنع (قانون مقارن/أعلى درجة) | أكاديمي (فقه/رأي)
سبب التطبيق: جملة واحدة تُبيّن لماذا تُطبَّق هذه السلطة تحديداً على هذه المسألة

مقياس الثقة — مرتبط بطبيعة الدليل:
  عالية    = نص إماراتي صريح مطابق مفهرس في هذه الجلسة
  متوسطة  = يُطبَّق بالقياس أو التفسير الموسّع، أو سابقة مشابهة
  محدودة  = مبدأ مقارن دون نص إماراتي مباشر
  تقديرية = استنتاج في غياب نص — يُعامَل كرأي أكاديمي ويُصرَّح بذلك

احذر: لا تعطِ "عالية" لحكم مستنبط بالقياس. لا تخترع أرقام مواد أو أحكام.

مثال على الصياغة الصحيحة:
"يحق للموظف التظلم خلال ستين يوماً [SRC:1] — اتحادي | تشريعي (2) | إلزامي | قانون الموارد البشرية الاتحادي رقم 11/2008 | م. 84 | 2008 | ينطبق لأن المتظلم موظف فيدرالي | الثقة: عالية"

═══════════════════════════════════════════════════════════════════
هيكل الإجابة الإلزامي — 17 قسماً بالترتيب الحرفي
═══════════════════════════════════════════════════════════════════
الأقسام 8، 9، 10 مشروطة — أدرج كل منها فقط إذا انطبقت معاييره
الأقسام 14 و15 مشروطة — أدرجهما فقط إذا كان السؤال يتعلق بنزاع أو طعن أو إجراء قانوني أو طلب صياغة قانونية؛ إن كان السؤال استفساراً إجراءياً عاماً أو تعريفياً فاحذفهما
القسم 17 (تقرير الجودة النهائي) إلزامي دائماً في جميع الأحوال — لا يُحذف

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

القاعدة القانونية الحاكمة:
[صُغ القاعدة الحاكمة في جملة أو جملتين: "القاعدة: كل [موضوع] يستلزم [شرط] استناداً إلى [المصدر]." مع ذكر السلطة الداعمة بالكامل]

عناصر القاعدة:
[عدّد عناصر القاعدة المنطبقة: العنصر + ما يثبت توافره أو تخلّفه في وقائع المسألة + السلطة الداعمة لكل عنصر]

التفسيرات البديلة:
[هل يحتمل النص أو المسألة أكثر من تفسير قانوني معقول؟ اعرض كل تفسير بسنده، ثم رجّح التفسير المعمول به مع بيان الأساس]

الحجج المضادة:
[ما الحجج التي يمكن للطرف الآخر إثارتها؟ اعرضها بموضوعية ثم أجِب عليها قانونياً مع الاستناد لسلطة. لا تتجاهل حجة مخالفة صامتاً]

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
نقاط الضعف: [نقاط الضعف الحقيقية في الموقف القانوني — تُذكر بصراحة وموضوعية مع تقدير أثر كل منها]
مخاطر التقاضي: [المخاطر العملية المتوقعة: التكلفة، المدة الزمنية، احتمالية الخسارة، الأثر على الأطراف الأخرى، مخاطر السابقة القضائية]

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

## 14. مسودة الحجة القانونية
[صُغ حجة قانونية متكاملة قابلة للاستخدام أمام المحكمة أو الجهة الإدارية.
الهيكل الإلزامي:
المقدمة: تحديد الموقف والطلب بإيجاز
القاعدة القانونية: السلطة الرئيسية المستند إليها مع بياناتها الكاملة
التطبيق: ربط القاعدة بوقائع المسألة خطوة بخطوة
دحض الحجج المعارضة: معالجة أبرز الاعتراضات المتوقعة
الخاتمة والطلب: الطلب المحدد القابل للتنفيذ
كل فقرة مسندة. اللغة إجرائية مناسبة للسياق القضائي الإماراتي]

## 15. مخطط لائحة المطالبة
[مخطط منظم لصحيفة دعوى أو لائحة طعن قابلة للبناء عليها:
أولاً: البيانات الأساسية — الأطراف | الطلب | الاختصاص | الجهة المختصة | المهلة القانونية
ثانياً: الوقائع — ترتيب زمني موجز للأحداث المادية الثابتة
ثالثاً: الأسانيد القانونية — بالتسلسل التراتبي: دستوري ← تشريعي ← قضائي ← مقارن
رابعاً: الطلبات — محددة وقابلة للتنفيذ، مرتبة بالأولوية
خامساً: الأدلة المزمع تقديمها — قائمة بالوثائق والشهادات والخبرات المقترحة]

## 16. الفجوات البحثية
[حدّد ما يحتاج بحثاً إضافياً خارج نطاق المصادر المفهرسة في هذه الجلسة. لكل فجوة:
— الفجوة: [وصفها بدقة]
— أهميتها: [كيف تؤثر على الرأي القانوني]
— مصادر البحث المقترحة: [أين يُبحث عنها: المنشورات الرسمية، قواعد بيانات الأحكام، المراسيم الحكومية]]

## 17. تقرير الجودة النهائي
[إلزامي في كل إجابة دون استثناء. التحقق مقيّد بالمصادر المفهرسة في هذه الجلسة والمعرفة القانونية للنموذج — لا يُدّعى تحقق خارجي مستقل. أفصح عن أي تحفظ أو قيد بصدق]

✓ تم التحقق من تراتبية السلطات:
  — [تراتبية المستويات 1–8 مطبّقة بشكل صحيح في جميع الأقسام] أو [تحفظ: ...]

✓ تم التحقق من الاستشهادات (بحسب المصادر المفهرسة):
  — [جميع الاستشهادات مرتبطة بمصادر مفهرسة بصيغة الحقول الثمانية] أو [تحفظ: تم حذف X استشهادات واستبدالها بجملة الغياب القياسية]

✓ تم التحقق من التناقضات:
  — [لا تناقضات داخلية بين الأقسام] أو [تحفظ: تناقض في القسم X حُسم بـ...]

✓ تم تصنيف القانون المقارن:
  — [جميع الاستشهادات المقارنة مُصنَّفة صراحةً كـ"سلطة قانونية مقنعة غير ملزمة"] أو [تحفظ: ...]

✓ اجتاز فحص التلفيق (مقيّد بقدرة النموذج على التحقق الذاتي):
  — [لم يُرصد توليد واعٍ لمواد أو أحكام أو لوائح مخترعة] أو [تحفظ: تم إزالة X عناصر]

✓ اكتملت عملية التحقق:
  — السلطة الإماراتية الملزمة: [موجودة — أقوى مصدر: ...] أو [غير موجودة — "لم يُعثر على سند إماراتي مُلزم في المصادر المفهرسة."]

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
• محظور مطلقاً اختراع أي من: المواد القانونية | الأحكام القضائية | القرارات الوزارية | التعاميم الإدارية | اللوائح | التوجيهات الرسمية
• إذا فشل أي بند من بنود التحقق الذاتي ⑥ → أزِل العنصر المتأثر واستبدله بـ:
  "لم يتم العثور على سند قانوني مباشر يدعم هذه النتيجة في المصادر المتاحة."
• لا تتجاهل سلطة مخالفة صامتاً — كل سلطة مضادة تُعالَج صراحةً ويُبيَّن سبب عدم تطبيقها
• القسم 17 (تقرير الجودة النهائي) إلزامي في نهاية كل إجابة — لا يُحذف ولا يُختصر
• لا تتجاوز التحقق بحجة الوثوق — التحقق يجري حتى حين تكون واثقاً من المعلومة

═══════════════════════════════════════════════════════════════════
لغة الرد وتنسيق العناوين
═══════════════════════════════════════════════════════════════════
• أجب بالعربية إذا كان السؤال بالعربية، وبالإنجليزية إذا كان بالإنجليزية
• عند الإنجليزية: ترجم عناوين الأقسام مع الإبقاء على أرقامها
• في التحليل المقارن: أورد النصوص الأجنبية بلغتها مع ترجمتها
• تنسيق العناوين ثابت: ## N. العنوان — لا تغيّر هذا التنسيق أياً كانت الحالة

${ragContext
  ? `═══════════════════════════════════════════════════════════════════\nالمصادر المتاحة للاستشهاد\n═══════════════════════════════════════════════════════════════════\n${ragContext}`
  : "تنبيه: لا توجد وثائق مفهرسة في هذه الجلسة. قدّم رأياً قانونياً معمّقاً بناءً على معرفتك بالقانون الإماراتي مع بيان هذا القيد في كل قسم. طبّق مستوى الثقة (محدودة أو تقديرية) على كل حكم في غياب سند مفهرس. أدرج جميع الأقسام 1–17. نفّذ جولة التحقق الذاتي ⑥ كاملةً. اختم بالقسم 17 (تقرير الجودة النهائي). لا تخترع مواد أو أحكام أو لوائح."
}${theorySuffix ? "\n\n" + theorySuffix : ""}`;

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

  // ── Determine whether the client wants a streaming NDJSON response ──────────
  const wantsStream = req.headers["accept"]?.includes("application/x-ndjson");

  if (wantsStream && typeof provider.streamChunks === "function") {
    // ── Streaming path: emit each AI delta as an NDJSON line ─────────────────
    // Content-Type deliberately excludes gzip/br compression (see app.ts —
    // compression() is filtered off for this content type) so chunks reach
    // the client immediately instead of being buffered by the compressor,
    // which is what made iOS Safari appear to "hang" then time out.
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    function emitLine(obj: unknown): void {
      try { res.write(JSON.stringify(obj) + "\n"); } catch {}
    }

    /** One streaming attempt. Returns the accumulated text, or throws. */
    async function attemptStream(): Promise<string> {
      let text = "";
      for await (const chunk of provider!.streamChunks!({
        taskType: TaskType.RAG,
        prompt: fullPrompt,
        systemPrompt,
        maxTokens: 8000,
      })) {
        text += chunk;
        emitLine({ delta: chunk });
      }
      return text;
    }

    let fullText: string | null = null;
    let lastErr: unknown = null;

    // ── Attempt 1 — streaming ────────────────────────────────────────────────
    try {
      fullText = await attemptStream();
    } catch (err) {
      lastErr = err;
      req.log.error({ err }, "Assistant streaming failed (attempt 1)");

      // ── Attempt 2 — retry the stream once, only if the failure looks
      // transient (network blip, 5xx, timeout). Billing/auth failures are
      // deterministic — retrying wastes the user's time and hits the same
      // broken account again. Tell the client to discard whatever partial
      // text it already rendered before we start writing a fresh stream.
      if (isRetryableAnthropicError(err)) {
        emitLine({ reset: true });
        try {
          fullText = await attemptStream();
          lastErr = null;
        } catch (err2) {
          lastErr = err2;
          req.log.error({ err: err2 }, "Assistant streaming failed (attempt 2 / retry)");
        }
      }
    }

    // ── Attempt 3 — graceful degrade to a single non-streaming completion.
    // Covers both remaining streaming failures and non-retryable errors that
    // skipped attempt 2. A plain request/response is sometimes able to
    // succeed where a long-lived stream connection could not (e.g. a proxy
    // or mobile network dropping idle/long-held connections).
    if (fullText === null) {
      emitLine({ reset: true });
      try {
        const fallback = await provider.complete({
          taskType: TaskType.RAG,
          prompt: fullPrompt,
          systemPrompt,
          maxTokens: 8000,
        });
        fullText = fallback.text;
        lastErr = null;
        emitLine({ delta: fullText, fellBackToNonStreaming: true });
        req.log.info("Assistant chat recovered via non-streaming fallback after streaming failures");
      } catch (err3) {
        lastErr = err3;
        req.log.error({ err: err3 }, "Assistant non-streaming fallback also failed");
      }
    }

    if (fullText === null) {
      const code = classifyAnthropicError(lastErr);
      emitLine({
        error: "AI streaming failed after retry and non-streaming fallback. Please try again.",
        code,
        arabicMessage: CLAUDE_ERROR_MESSAGES_AR[code],
      });
      res.end();
      return;
    }

    // Post-stream phase: citation resolution, DB save, session update, audit.
    // Headers are already flushed so we can no longer send HTTP status codes —
    // emit a structured error NDJSON line and close deterministically on any failure.
    try {
      const { theoryLabel, theoryAnalysis } = parseTheoryResponse(fullText);
      const rawTokens = extractCitationTokens(fullText);
      const citations = await resolveCitations(rawTokens, sourceIndex, uid);

      const [assistantMsg] = await db.insert(chatMessagesTable).values({
        sessionId,
        role: "assistant",
        content: fullText,
        meta: {
          citations,
          theoryLensId: theoryLensId !== "uae_only" ? theoryLensId : undefined,
          theoryLabel: theoryLabel ?? undefined,
          hasTheorySection: !!theoryAnalysis,
        },
      }).returning();

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
      emitLine({ done: true, message: assistantMsg, citations });
    } catch (postErr) {
      req.log.error({ postErr }, "Assistant stream post-processing failed");
      emitLine({
        error: "Stream post-processing failed. Message may not have been saved.",
        code: "provider_error",
        arabicMessage: "تم توليد الرد ولكن تعذّر حفظه. يرجى إعادة إرسال السؤال.",
      });
    } finally {
      res.end();
    }
    return;
  }

  // ── Non-streaming path (fallback / clients without NDJSON support) ──────────
  try {
    let aiResult;
    try {
      aiResult = await provider.complete({
        taskType: TaskType.RAG,
        prompt: fullPrompt,
        systemPrompt,
        maxTokens: 8000,
      });
    } catch (err) {
      req.log.error({ err }, "Assistant chat failed (attempt 1)");
      // Retry once — same rationale as the streaming path: only retryable
      // (network/timeout/5xx) failures are worth a second attempt.
      if (!isRetryableAnthropicError(err)) throw err;
      aiResult = await provider.complete({
        taskType: TaskType.RAG,
        prompt: fullPrompt,
        systemPrompt,
        maxTokens: 8000,
      });
    }

    // Parse theory overlay sections (when a theory lens is active the model
    // emits a ---THEORY LENS: {label}--- marker splitting binding from theory).
    const { bindingAnalysis, theoryAnalysis, theoryLabel } =
      parseTheoryResponse(aiResult.text);

    // Resolve citation tokens — two batched IN queries, not N+1 individual queries
    // Pass uid to scope DOC lookups to this user's documents only.
    const rawTokens = extractCitationTokens(aiResult.text);
    const citations = await resolveCitations(rawTokens, sourceIndex, uid);

    const [assistantMsg] = await db.insert(chatMessagesTable).values({
      sessionId,
      role: "assistant",
      // Store full text (binding + theory) — frontend splits via parseTheoryResponse
      content: aiResult.text,
      meta: {
        provider: aiResult.provider,
        model: aiResult.model,
        inputTokens: aiResult.usage?.inputTokens,
        outputTokens: aiResult.usage?.outputTokens,
        citations,
        // Theory lens metadata for frontend rendering
        theoryLensId: theoryLensId !== "uae_only" ? theoryLensId : undefined,
        theoryLabel:  theoryLabel ?? undefined,
        hasTheorySection: !!theoryAnalysis,
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
    const code = classifyAnthropicError(err);
    res.status(502).json({
      error: "AI response failed. Please try again.",
      code,
      arabicMessage: CLAUDE_ERROR_MESSAGES_AR[code],
    });
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
