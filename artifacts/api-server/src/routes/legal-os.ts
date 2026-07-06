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
import { ROLES, findScenario, formatAnswers, type Role, type Scenario } from "../data/legal-os-scenarios";
import { legalOsCustomRolesTable, legalOsCustomScenariosTable } from "@workspace/db";
import { getUserId } from "../lib/route-helpers";
import { aiAnalysisLimit } from "../middlewares/rateLimits.js";

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

// ─── Shared catalog helper ─────────────────────────────────────────────────────
/**
 * Returns the full scenario catalog: hardcoded built-ins merged with any
 * admin-created roles/scenarios from the database.
 *
 * Custom DB scenarios attached to a built-in role override an existing
 * scenario with the same id, or are appended as new scenarios.
 * Entirely new DB roles (not matching any built-in id) are appended at the end.
 *
 * Falls back to the hardcoded-only catalog if the DB is unavailable.
 */
async function getMergedCatalog(): Promise<Role[]> {
  const [dbRoles, dbScenarios] = await Promise.all([
    db.select().from(legalOsCustomRolesTable),
    db.select().from(legalOsCustomScenariosTable).where(eq(legalOsCustomScenariosTable.isActive, true)),
  ]);

  // Deep clone the hardcoded catalog so we don't mutate the module-level constant
  const merged: Role[] = ROLES.map((r) => ({ ...r, scenarios: [...r.scenarios] }));

  // Merge DB scenarios into built-in roles, or queue for custom-role attachment
  for (const dbs of dbScenarios) {
    const scenario: Scenario = {
      id: dbs.scenarioKey,
      titleAr: dbs.titleAr,
      titleEn: dbs.titleEn,
      descriptionAr: dbs.descriptionAr,
      jurisdictions: (dbs.jurisdictions as string[]) ?? [],
      estimatedMinutes: dbs.estimatedMinutes,
      questions: (dbs.questions as Scenario["questions"]) ?? [],
    };
    const builtinRole = merged.find((r) => r.id === dbs.roleKey);
    if (builtinRole) {
      const idx = builtinRole.scenarios.findIndex((s) => s.id === scenario.id);
      if (idx >= 0) builtinRole.scenarios[idx] = scenario;
      else builtinRole.scenarios.push(scenario);
    }
    // Custom-role scenarios are handled in the loop below
  }

  // Append fully custom DB roles (not present in the hardcoded catalog)
  for (const dbRole of dbRoles) {
    if (merged.some((r) => r.id === dbRole.roleKey)) continue;
    const roleScenarios = dbScenarios
      .filter((s) => s.roleKey === dbRole.roleKey)
      .map((s): Scenario => ({
        id: s.scenarioKey,
        titleAr: s.titleAr,
        titleEn: s.titleEn,
        descriptionAr: s.descriptionAr,
        jurisdictions: (s.jurisdictions as string[]) ?? [],
        estimatedMinutes: s.estimatedMinutes,
        questions: (s.questions as Scenario["questions"]) ?? [],
      }));
    merged.push({
      id: dbRole.roleKey,
      titleAr: dbRole.titleAr,
      titleEn: dbRole.titleEn,
      descriptionAr: dbRole.descriptionAr,
      icon: dbRole.icon,
      scenarios: roleScenarios,
    });
  }

  return merged;
}

/** Find a role and scenario by id within the merged catalog. */
async function findInMergedCatalog(
  roleId: string,
  scenarioId: string,
): Promise<{ role: Role; scenario: Scenario } | null> {
  const roles = await getMergedCatalog();
  const role = roles.find((r) => r.id === roleId);
  if (!role) return null;
  const scenario = role.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;
  return { role, scenario };
}

// ─── GET /legal-os/scenarios ───────────────────────────────────────────────────
router.get("/legal-os/scenarios", requireAnyRole, async (_req, res): Promise<void> => {
  try {
    res.json({ roles: await getMergedCatalog() });
  } catch {
    // Fallback to hardcoded catalog on DB error
    res.json({ roles: ROLES });
  }
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

/** Write a single NDJSON event to the response. */
function writeEvent(res: import("express").Response, section: string, data: unknown): void {
  res.write(JSON.stringify({ section, data }) + "\n");
}

// ─── Shared prompt preamble (context, classification rules, citation rules) ───
function buildPromptPreamble(roleTitleAr: string, ragContext: string): string {
  return `أنت مستشار قانوني أول ومتخصص في القانون الإماراتي والفرنسي والأوروبي والقانون المقارن، تعمل كمكتب قانوني رقمي شامل.

دورك: تقديم تقييم قانوني نهائي ومفصّل يساعد ${roleTitleAr} على اتخاذ قرار قانوني سليم ومُحاط بضمانات كافية.

قواعد التصنيف لكل بند في إجابتك:
- "mandatory": متطلب قانوني إلزامي — نص صريح في القانون أو اللوائح، لا خيار فيه
- "opinion": رأي قانوني — تفسير أو اجتهاد في حالة يكتنفها الغموض القانوني
- "best_practice": ممارسة مثلى — ما يوصي به الفقه والممارسة القانونية الرشيدة دون أن يكون ملزماً
- "optional": اختياري — إجراء مفيد لكنه متروك لتقدير الشخص

قواعد الاستشهاد:
- إذا وجدت مصدراً في قاعدة البيانات مناسباً، استخدم الرمز [SRC:N] في حقل token لمصادر قانونية أو [DOC:N] للوثائق
- إذا لم تجد مصدراً مرتبطاً، اجعل token يساوي null واذكر نص المادة القانونية في articleAr

${ragContext ? `المصادر القانونية المتاحة:\n${ragContext}` : "لا توجد مصادر في قاعدة البيانات. استند إلى معرفتك القانونية العامة."}`;
}

// ─── NDJSON system prompt: one JSON object per line per section ───────────────
// Claude outputs each section as a separate line so we can emit it the moment
// the newline arrives, without waiting for the full response to complete.
function buildNdjsonSystemPrompt(roleTitleAr: string, ragContext: string): string {
  return `${buildPromptPreamble(roleTitleAr, ragContext)}

أجب حصراً بـ NDJSON — سطر واحد لكل حقل، بالترتيب الدقيق أدناه. كل سطر هو كائن JSON يحتوي مفتاحاً واحداً فقط. لا تُضف أي نص أو شرح خارج هذه الأسطر. ابدأ مباشرةً بالسطر الأول:
{"riskLevel":"low|medium|high|critical"}
{"riskRationale":"شرح في 2-3 جمل"}
{"canIssueToday":"yes|no|conditional"}
{"canIssueTodayExplanation":"إجابة مباشرة لا تتجاوز 3 جمل"}
{"canIssueTodayConditions":["شرط أول","شرط ثانٍ"]}
{"finalRecommendation":[{"textAr":"نص التوصية","category":"mandatory|opinion|best_practice|optional"}]}
{"missingRequirements":[{"textAr":"المتطلب الناقص","category":"mandatory|opinion|best_practice|optional"}]}
{"requiredDocuments":[{"nameAr":"اسم الوثيقة","descriptionAr":"وصف موجز","where":"من أين تُستخرج","processingTime":"المدة"}]}
{"governmentAuthority":{"nameAr":"اسم الجهة","nameEn":"Authority Name","department":"القسم","website":"https://... أو null","phone":"رقم أو null","whatToBring":"الوثائق المطلوبة"}}
{"legalTimeline":[{"step":1,"titleAr":"وصف الخطوة","duration":"المدة","actor":"user|lawyer|court|authority"}]}
{"draftLetter":{"subjectAr":"موضوع الخطاب","bodyAr":"النص الكامل..."}}
{"applicableLegislation":[{"token":"[SRC:N] أو null","articleAr":"المادة القانونية","relevanceAr":"وجه الانطباق"}]}
{"courtPrecedents":null}
{"practicalNextSteps":[{"step":1,"actionAr":"الإجراء المطلوب","actor":"المستخدم","timeframe":"الإطار الزمني","category":"mandatory|opinion|best_practice|optional"}]}`;
}

// ─── Non-streaming (JSON blob) system prompt ─────────────────────────────────
function buildJsonSystemPrompt(roleTitleAr: string, ragContext: string): string {
  return `${buildPromptPreamble(roleTitleAr, ragContext)}

أجب حصراً بـ JSON دقيق ومكتمل وفق الهيكل الآتي — لا تضف أي نص خارجه:
{
  "riskLevel": "low|medium|high|critical",
  "riskRationale": "شرح في 2-3 جمل لمستوى الخطر القانوني المقدَّر",
  "canIssueToday": "yes|no|conditional",
  "canIssueTodayExplanation": "إجابة مباشرة وواضحة لا تتجاوز 3 جمل",
  "canIssueTodayConditions": ["شرط أول يجب استيفاؤه", "شرط ثانٍ..."],
  "finalRecommendation": [{ "textAr": "نص التوصية القانونية", "category": "mandatory|opinion|best_practice|optional" }],
  "missingRequirements": [{ "textAr": "المتطلب الناقص", "category": "mandatory|opinion|best_practice|optional" }],
  "requiredDocuments": [{ "nameAr": "اسم الوثيقة", "descriptionAr": "وصف موجز", "where": "من أين تُستخرج", "processingTime": "المدة" }],
  "governmentAuthority": { "nameAr": "اسم الجهة", "nameEn": "Authority name in English", "department": "القسم المختص", "website": "https://... أو null", "phone": "رقم الهاتف أو null", "whatToBring": "الوثائق المطلوبة" },
  "legalTimeline": [{ "step": 1, "titleAr": "وصف الخطوة", "duration": "المدة الزمنية", "actor": "user|lawyer|court|authority" }],
  "draftLetter": { "subjectAr": "موضوع الخطاب", "bodyAr": "النص الكامل للخطاب..." },
  "applicableLegislation": [{ "token": "[SRC:N] أو null", "articleAr": "المادة القانونية", "relevanceAr": "وجه الانطباق" }],
  "courtPrecedents": null,
  "practicalNextSteps": [{ "step": 1, "actionAr": "الإجراء المحدد", "actor": "المستخدم", "timeframe": "الإطار الزمني", "category": "mandatory|opinion|best_practice|optional" }]
}`;
}

// ─── POST /legal-os/assess ─────────────────────────────────────────────────────
router.post("/legal-os/assess", requireSupervisorOrOwner, aiAnalysisLimit, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const { roleId, scenarioId, answers } = req.body as {
    roleId: string;
    scenarioId: string;
    answers: Record<string, string>;
  };

  if (!roleId || !scenarioId || !answers) {
    res.status(400).json({ error: "roleId, scenarioId, and answers are required" }); return;
  }

  const found = await findInMergedCatalog(roleId, scenarioId).catch(() => null);
  if (!found) {
    res.status(400).json({ error: "Unknown role or scenario" }); return;
  }
  const { role, scenario } = found;

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
  let ragContext: string;
  let sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>;
  try {
    ({ context: ragContext, sourceIndex } = await buildContext(semanticQuery, uid, [], []));
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to retrieve legal context. Please try again." }); return;
  }

  const userPrompt = `دور المستخدم: ${role.titleAr} (${role.titleEn})
السيناريو: ${scenario.titleAr} (${scenario.titleEn})

البيانات المُقدَّمة:
${answersText}

قدّم التقييم القانوني الشامل وفق الهيكل المحدد.`;

  // ── Determine whether the client wants a streaming NDJSON response ──────────
  const wantsStream = req.headers["accept"]?.includes("application/x-ndjson");

  if (wantsStream && typeof provider.streamChunks === "function") {
    // ── True streaming path: emit each section as its NDJSON line arrives ────
    // Claude is instructed to output one {"key": value} per line. We consume
    // token deltas in real time, buffer them until a newline is seen, then
    // parse and forward each completed section immediately.
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx/proxy buffering
    res.flushHeaders();

    const collectedSections: Record<string, unknown> = {};
    let lineBuffer = "";

    /** Parse a completed NDJSON line from the model and emit it if valid. */
    function processLine(line: string): void {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        const entries = Object.entries(parsed);
        if (entries.length !== 1) return; // unexpected shape — skip
        const [key, value] = entries[0];
        collectedSections[key] = value;
        writeEvent(res, key, value);
      } catch {
        // Malformed line from the model — skip silently
      }
    }

    try {
      for await (const chunk of provider.streamChunks({
        taskType: TaskType.RAG,
        prompt: userPrompt,
        systemPrompt: buildNdjsonSystemPrompt(role.titleAr, ragContext),
        maxTokens: 6000,
      })) {
        lineBuffer += chunk;
        // Flush every complete line immediately
        let newlineIdx: number;
        while ((newlineIdx = lineBuffer.indexOf("\n")) !== -1) {
          processLine(lineBuffer.slice(0, newlineIdx));
          lineBuffer = lineBuffer.slice(newlineIdx + 1);
        }
      }
      // Handle any trailing content without a final newline
      if (lineBuffer.trim()) processLine(lineBuffer);

      // Validate the assembled brief
      const validationError = validateBrief(collectedSections);
      if (validationError) {
        req.log.warn({ validationError }, "Legal OS NDJSON response failed validation");
        writeEvent(res, "error", "AI response is missing required sections. Please try again.");
        res.end(); return;
      }

      // Resolve citations then emit
      const allText = JSON.stringify(collectedSections);
      const rawTokens = extractCitationTokens(allText);
      const citations = await resolveCitations(rawTokens, sourceIndex, uid);
      writeEvent(res, "citations", citations);

      // Persist session
      const [saved] = await db.insert(legalOsSessionsTable).values({
        userId: uid,
        role: roleId,
        scenarioId,
        scenarioTitleAr: scenario.titleAr,
        scenarioTitleEn: scenario.titleEn,
        answers: answers as unknown as Record<string, unknown>,
        report: { ...collectedSections, citations } as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      }).returning();

      await logAudit(req, "legal-os.assess", { entityType: "legal_os_session", entityId: saved.id });

      writeEvent(res, "done", { sessionId: saved.id });
      res.end();
    } catch (err) {
      req.log.error({ err }, "Legal OS streaming assessment failed");
      try { writeEvent(res, "error", "AI assessment failed. Please try again."); res.end(); } catch {}
    }
    return;
  }

  // ── Non-streaming (fallback) path — also used when provider lacks streamChunks ─
  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: userPrompt,
      systemPrompt: buildJsonSystemPrompt(role.titleAr, ragContext),
      maxTokens: 6000,
    });

    // Parse and validate the JSON report
    const parseResult = parseModelJson<Record<string, unknown>>(aiResult.text);
    if (!parseResult.ok) {
      req.log.error({ raw: parseResult.raw }, "Failed to parse legal-os JSON");
      res.status(500).json({ error: "Failed to parse AI response. Please try again." }); return;
    }
    const report = parseResult.data;

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
router.post("/legal-os/followup", requireSupervisorOrOwner, aiAnalysisLimit, async (req, res): Promise<void> => {
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

  let ragContext: string;
  let sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>;
  try {
    ({ context: ragContext, sourceIndex } = await buildContext(message, uid, [], []));
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to retrieve legal context. Please try again." }); return;
  }

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
