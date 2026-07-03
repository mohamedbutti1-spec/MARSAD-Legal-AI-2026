/**
 * AI Legal Operating System — Decision Brief engine
 *
 * GET    /legal-os/scenarios               — return the full scenario catalog
 * GET    /legal-os/sessions                — list user's saved briefs
 * DELETE /legal-os/sessions/:id            — delete a session
 * POST   /legal-os/assess                  — run full assessment → DecisionBrief
 * POST   /legal-os/followup                — follow-up chat on a saved session
 */
import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, legalOsSessionsTable, chatMessagesTable } from "@workspace/db";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";
import { parseModelJson } from "../ai/providers/interface";
import {
  buildContext,
  extractCitationTokens,
  resolveCitations,
} from "../utils/rag";
import { ROLES, findScenario, formatAnswers } from "../data/legal-os-scenarios";

// ─── Decision Brief validation ─────────────────────────────────────────────────

const REQUIRED_STRING_KEYS = [
  "riskLevel", "riskRationale", "canIssueToday", "canIssueTodayExplanation",
] as const;
const REQUIRED_ARRAY_KEYS = [
  "finalRecommendation", "requiredDocuments", "legalTimeline",
  "practicalNextSteps", "applicableLegislation",
] as const;
const VALID_RISK_LEVELS  = new Set(["low", "medium", "high", "critical"]);
const VALID_CAN_ISSUE    = new Set(["yes", "no", "conditional"]);
const VALID_CATEGORIES   = new Set(["mandatory", "opinion", "best_practice", "optional"]);

function validateBrief(r: unknown): string | null {
  if (typeof r !== "object" || r === null) return "Response is not an object";
  const obj = r as Record<string, unknown>;

  for (const k of REQUIRED_STRING_KEYS) {
    if (typeof obj[k] !== "string" || !(obj[k] as string).length) return `Missing required string field: ${k}`;
  }
  for (const k of REQUIRED_ARRAY_KEYS) {
    if (!Array.isArray(obj[k])) return `Missing required array field: ${k}`;
  }
  if (!VALID_RISK_LEVELS.has(obj["riskLevel"] as string)) return `Invalid riskLevel: ${obj["riskLevel"]}`;
  if (!VALID_CAN_ISSUE.has(obj["canIssueToday"] as string)) return `Invalid canIssueToday: ${obj["canIssueToday"]}`;

  // Validate that at least finalRecommendation items have category tags
  const recs = obj["finalRecommendation"] as Array<Record<string, unknown>>;
  if (recs.length === 0) return "finalRecommendation must have at least one item";
  for (const item of recs) {
    if (!VALID_CATEGORIES.has(item["category"] as string)) return `Invalid category in finalRecommendation: ${item["category"]}`;
  }
  return null; // valid
}

const router: IRouter = Router();

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h, 10);
}

// ─── GET /legal-os/scenarios ───────────────────────────────────────────────────
router.get("/legal-os/scenarios", requireAnyRole, (_req, res): void => {
  res.json({ roles: ROLES });
});

// ─── GET /legal-os/sessions ────────────────────────────────────────────────────
router.get("/legal-os/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const sessions = await db
    .select()
    .from(legalOsSessionsTable)
    .where(eq(legalOsSessionsTable.userId, uid))
    .orderBy(desc(legalOsSessionsTable.createdAt))
    .limit(50);
  res.json({ sessions });
});

// ─── DELETE /legal-os/sessions/:id ────────────────────────────────────────────
router.delete("/legal-os/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select({ id: legalOsSessionsTable.id })
    .from(legalOsSessionsTable)
    .where(and(eq(legalOsSessionsTable.id, id), eq(legalOsSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  await db.delete(legalOsSessionsTable).where(eq(legalOsSessionsTable.id, id));
  res.json({ ok: true });
});

// ─── POST /legal-os/assess ─────────────────────────────────────────────────────
router.post("/legal-os/assess", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const { roleId, scenarioId, answers } = req.body as {
    roleId: string;
    scenarioId: string;
    answers: Record<string, string>;
  };

  if (!roleId || !scenarioId || !answers) {
    res.status(400).json({ error: "roleId, scenarioId, and answers are required" }); return;
  }

  const role = ROLES.find((r) => r.id === roleId);
  const scenario = findScenario(roleId, scenarioId);
  if (!role || !scenario) {
    res.status(400).json({ error: "Unknown role or scenario" }); return;
  }

  // Build semantic query from scenario + answers for RAG retrieval
  const answersText = formatAnswers(scenario, answers);
  const semanticQuery = `${role.titleAr} ${scenario.titleAr} ${answersText}`;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  // Fetch legal context
  const { context: ragContext, sourceIndex } = await buildContext(semanticQuery, uid, [], []);

  const systemPrompt = `أنت مستشار قانوني أول ومتخصص في القانون الإماراتي والفرنسي والأوروبي والقانون المقارن، تعمل كمكتب قانوني رقمي شامل.

دورك: تقديم تقييم قانوني نهائي ومفصّل يساعد ${role.titleAr} على اتخاذ قرار قانوني سليم ومُحاط بضمانات كافية.

قواعد التصنيف لكل بند في إجابتك:
- "mandatory": متطلب قانوني إلزامي — نص صريح في القانون أو اللوائح، لا خيار فيه
- "opinion": رأي قانوني — تفسير أو اجتهاد في حالة يكتنفها الغموض القانوني
- "best_practice": ممارسة مثلى — ما يوصي به الفقه والممارسة القانونية الرشيدة دون أن يكون ملزماً
- "optional": اختياري — إجراء مفيد لكنه متروك لتقدير الشخص

قواعد الاستشهاد:
- إذا وجدت مصدراً في قاعدة البيانات مناسباً، استخدم الرمز [SRC:N] في حقل token لمصادر قانونية أو [DOC:N] للوثائق
- إذا لم تجد مصدراً مرتبطاً، اجعل token يساوي null واذكر نص المادة القانونية في articleAr

${ragContext ? `المصادر القانونية المتاحة:\n${ragContext}` : "لا توجد مصادر في قاعدة البيانات. استند إلى معرفتك القانونية العامة."}

أجب حصراً بـ JSON دقيق ومكتمل وفق الهيكل الآتي — لا تضف أي نص خارجه:
{
  "riskLevel": "low|medium|high|critical",
  "riskRationale": "شرح في 2-3 جمل لمستوى الخطر القانوني المقدَّر",
  "canIssueToday": "yes|no|conditional",
  "canIssueTodayExplanation": "إجابة مباشرة وواضحة لا تتجاوز 3 جمل",
  "canIssueTodayConditions": ["شرط أول يجب استيفاؤه", "شرط ثانٍ..."],
  "finalRecommendation": [
    { "textAr": "نص التوصية القانونية", "category": "mandatory|opinion|best_practice|optional" }
  ],
  "missingRequirements": [
    { "textAr": "المتطلب الناقص أو الإجراء غير المستوفى", "category": "mandatory|opinion|best_practice|optional" }
  ],
  "requiredDocuments": [
    {
      "nameAr": "اسم الوثيقة أو المستند",
      "descriptionAr": "وصف موجز لمحتوى الوثيقة وأهميتها",
      "where": "من أين تُستخرج أو كيف تُعَدّ",
      "processingTime": "المدة الزمنية المتوقعة للحصول عليها"
    }
  ],
  "governmentAuthority": {
    "nameAr": "اسم الجهة الحكومية أو القضائية بالعربية",
    "nameEn": "Authority name in English",
    "department": "القسم أو الإدارة المختصة",
    "website": "https://... أو null إن لم يُعرف",
    "phone": "رقم الهاتف أو null",
    "whatToBring": "الوثائق المطلوبة عند زيارة الجهة"
  },
  "legalTimeline": [
    { "step": 1, "titleAr": "وصف الخطوة بإيجاز", "duration": "المدة الزمنية", "actor": "user|lawyer|court|authority" }
  ],
  "draftLetter": {
    "subjectAr": "موضوع الخطاب أو الطلب",
    "bodyAr": "النص الكامل للخطاب بالعربية الفصحى مع تمييز الحقول القابلة للتعبئة بأقواس مربعة مثل [اسم المرسل]، [التاريخ]، [رقم العقد]..."
  },
  "applicableLegislation": [
    {
      "token": "[SRC:N] أو null",
      "articleAr": "نص المادة القانونية أو الإشارة إليها مثل: المادة 42 من قانون العمل الاتحادي رقم 33 لسنة 2021",
      "relevanceAr": "وجه انطباق هذه المادة على الحالة المعروضة"
    }
  ],
  "courtPrecedents": null,
  "practicalNextSteps": [
    {
      "step": 1,
      "actionAr": "الإجراء المحدد المطلوب اتخاذه",
      "actor": "المستخدم | المحامي | المحكمة | الجهة الحكومية",
      "timeframe": "الإطار الزمني المقترح",
      "category": "mandatory|opinion|best_practice|optional"
    }
  ]
}`;

  const userPrompt = `دور المستخدم: ${role.titleAr} (${role.titleEn})
السيناريو: ${scenario.titleAr} (${scenario.titleEn})

البيانات المُقدَّمة:
${answersText}

قدّم التقييم القانوني الشامل وفق الهيكل المحدد.`;

  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 6000,
    });

    // Parse and validate the JSON report
    let report: Record<string, unknown>;
    try {
      report = parseModelJson(aiResult.text) as Record<string, unknown>;
    } catch {
      req.log.error({ text: aiResult.text }, "Failed to parse legal-os JSON");
      res.status(500).json({ error: "Failed to parse AI response. Please try again." }); return;
    }

    // Validate required Decision Brief structure
    const validationError = validateBrief(report);
    if (validationError) {
      req.log.warn({ validationError, text: aiResult.text }, "Legal OS response failed validation");
      res.status(422).json({ error: "AI response is missing required sections. Please try again.", detail: validationError }); return;
    }

    // Extract citations from all text fields in the report — scope DOC lookups to this user
    const allText = JSON.stringify(report);
    const rawTokens = extractCitationTokens(allText);
    const citations = await resolveCitations(rawTokens, sourceIndex, uid);

    // Save session to DB
    const [saved] = await db.insert(legalOsSessionsTable).values({
      userId: uid,
      role: roleId,
      scenarioId,
      scenarioTitleAr: scenario.titleAr,
      scenarioTitleEn: scenario.titleEn,
      answers: answers as unknown as Record<string, unknown>,
      report: { ...report, citations } as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    }).returning();

    await logAudit(req, "legal-os.assess", { entityType: "legal_os_session", entityId: saved.id });

    res.json({ session: saved, report, citations });
  } catch (err) {
    req.log.error({ err }, "Legal OS assessment failed");
    res.status(500).json({ error: "AI assessment failed. Please try again." });
  }
});

// ─── POST /legal-os/followup ───────────────────────────────────────────────────
router.post("/legal-os/followup", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const { sessionId, message } = req.body as { sessionId: number; message: string };

  if (!sessionId || !message?.trim()) {
    res.status(400).json({ error: "sessionId and message are required" }); return;
  }

  const [session] = await db
    .select()
    .from(legalOsSessionsTable)
    .where(and(eq(legalOsSessionsTable.id, sessionId), eq(legalOsSessionsTable.userId, uid)));
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message }); return;
  }

  const { context: ragContext, sourceIndex } = await buildContext(message, uid, [], []);

  const reportSummary = session.report
    ? `التقييم القانوني السابق للمستخدم (${session.scenarioTitleAr}):
مستوى الخطر: ${(session.report as Record<string,unknown>)["riskLevel"]}
التوصية النهائية: ${JSON.stringify((session.report as Record<string,unknown>)["finalRecommendation"]).slice(0, 400)}
الخطوات العملية: ${JSON.stringify((session.report as Record<string,unknown>)["practicalNextSteps"]).slice(0, 400)}`
    : "";

  const systemPrompt = `أنت مستشار قانوني يتابع استفسارات مستخدم بعد تقييم قانوني مكتمل.

${reportSummary}

${ragContext ? `المصادر المتاحة:\n${ragContext}` : ""}

أجب بالعربية بصورة دقيقة ومباشرة. استشهد بالمصادر باستخدام [SRC:N] أو [DOC:N] عند الاقتضاء.`;

  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: message,
      systemPrompt,
      maxTokens: 2000,
    });

    const rawTokens = extractCitationTokens(aiResult.text);
    const citations = await resolveCitations(rawTokens, sourceIndex, uid);

    res.json({ text: aiResult.text, citations });
  } catch (err) {
    req.log.error({ err }, "Legal OS followup failed");
    res.status(500).json({ error: "AI response failed. Please try again." });
  }
});

export default router;
