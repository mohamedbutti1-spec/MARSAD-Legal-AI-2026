/**
 * Module 1 — Intelligent Administrative Decision
 * Constitutional administrative decision lifecycle API.
 * Every endpoint is audited, AI-assisted, and constitutionally validated.
 */
import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionStagesTable,
  decisionDciTable,
  auditLogsTable,
  DECISION_STAGE_KEYS,
  type DecisionStageKey,
  type DciVersion,
} from "@workspace/db";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";
import { parseModelJson } from "../ai/providers/interface";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h, 10) || 1;
}

function stageIndex(key: string): number {
  return DECISION_STAGE_KEYS.indexOf(key as DecisionStageKey);
}

function nextStage(key: string): DecisionStageKey | null {
  const idx = stageIndex(key);
  return idx >= 0 && idx < DECISION_STAGE_KEYS.length - 1
    ? DECISION_STAGE_KEYS[idx + 1]
    : null;
}

function computeAuditHash(
  decisionId: number,
  stageKey: string,
  stageData: unknown,
  userId: number,
  timestamp: string,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ decisionId, stageKey, stageData, userId, timestamp }))
    .digest("hex");
}

/**
 * Verify that the requesting user owns the decision or has supervisor/owner role.
 * Returns the decision row if authorized, or null if access is denied.
 */
async function assertDecisionAccess(
  req: import("express").Request,
  decisionId: number,
): Promise<typeof decisionsTable.$inferSelect | null> {
  const [decision] = await db
    .select()
    .from(decisionsTable)
    .where(eq(decisionsTable.id, decisionId));
  if (!decision) return null;

  const role = Array.isArray(req.headers["x-user-role"])
    ? req.headers["x-user-role"][0]
    : (req.headers["x-user-role"] ?? "viewer");
  const userId = getUserId(req);

  // Owners and supervisors can access all decisions; viewers only their own
  if (role === "owner" || role === "supervisor") return decision;
  if (decision.createdBy === userId) return decision;
  return null; // access denied — caller must return 403
}

// ─── DCI Service ──────────────────────────────────────────────────────────────

/**
 * Auto-create the Decision Constitutional Identity when a decision is first created.
 * All assessment fields start as "pending" and are populated as stages complete.
 */
async function initializeDci(
  decisionId: number,
  decision: typeof decisionsTable.$inferSelect,
): Promise<void> {
  const authority = [decision.organizationUnit, decision.issuingAuthority]
    .filter(Boolean)
    .join(" — ") || null;
  await db.insert(decisionDciTable).values({
    decisionId,
    decisionType: decision.decisionType,
    competentAuthority: authority,
    applicableLegalBasis: [],
    aiParticipationLevel: "pending",
    humanOversightLevel: "pending",
    explainabilityLevel: "pending",
    transparencyLevel: "pending",
    evidenceCompleteness: "pending",
    proportionalityStatus: "pending",
    legalityStatus: "pending",
    constitutionalValidationStatus: "pending",
    alShamsiFrameworkCompliance: "pending",
    currentVersion: 1,
    versionHistory: [],
    isSealed: false,
  });
}

/**
 * Extract DCI-relevant data from a completed stage and update the DCI record.
 * Called automatically after each stage is marked complete.
 * Stage 9 (constitutional_validation) also seals the DCI when passed.
 */
async function updateDciFromStage(
  decisionId: number,
  stageKey: string,
  stageRecord: typeof decisionStagesTable.$inferSelect,
  userId: number,
): Promise<void> {
  const analysis = (stageRecord.aiAnalysis as Record<string, unknown>) ?? {};
  const data = (stageRecord.stageData as Record<string, unknown>) ?? {};
  type DciUpdate = Partial<typeof decisionDciTable.$inferInsert> & { updatedAt: Date };
  const update: DciUpdate = { updatedAt: new Date() };

  switch (stageKey) {
    case "legal_authority": {
      const name = (data.issuingAuthorityName as string) || null;
      const pos = (data.authorityPosition as string) || null;
      update.competentAuthority = [name, pos].filter(Boolean).join(" · ") || null;
      break;
    }
    case "facts_evidence": {
      const quality = analysis.evidenceQuality as string | undefined;
      update.evidenceCompleteness =
        quality === "high" ? "complete" :
        quality === "adequate" ? "substantial" :
        quality === "low" ? "partial" : "insufficient";
      break;
    }
    case "legal_basis": {
      const bases: string[] = [];
      if (data.primaryLaw) bases.push(data.primaryLaw as string);
      if (data.specificArticles) bases.push(data.specificArticles as string);
      const cited = analysis.citedInstruments as string[] | undefined;
      if (Array.isArray(cited)) bases.push(...cited);
      update.applicableLegalBasis = [...new Set(bases)];
      const passed = Boolean(analysis.passed);
      const strength = analysis.legalBasisStrength as string | undefined;
      update.legalityStatus = passed ? "confirmed" :
        strength === "weak" ? "questionable" : "violated";
      break;
    }
    case "administrative_objective": {
      update.purposeOfDecision = (data.primaryObjective as string) || null;
      break;
    }
    case "proportionality": {
      const overall = analysis.overallProportionality as string | undefined;
      update.proportionalityStatus =
        overall === "proportionate" ? "proportionate" :
        overall === "marginally_proportionate" ? "marginally_proportionate" :
        "disproportionate";
      break;
    }
    case "human_oversight": {
      const name = (data.officialName as string) || null;
      const pos = (data.officialPosition as string) || null;
      const org = (data.officialOrganization as string) || null;
      update.humanDecisionOwner = [name, pos, org].filter(Boolean).join(" · ") || null;
      // MARSAD AI assists all 11 stages — always "comprehensive"
      update.aiParticipationLevel = "comprehensive";
      const score = analysis.oversightComplianceScore as number | undefined;
      update.humanOversightLevel =
        score == null ? "pending" :
        score >= 90 ? "full" :
        score >= 70 ? "substantial" :
        score >= 50 ? "partial" : "minimal";
      break;
    }
    case "constitutional_validation": {
      const overallPassed = Boolean(analysis.overallPassed);
      update.constitutionalValidationStatus = overallPassed ? "passed" : "failed";
      // Derive explainability and transparency from the 10-principle results
      const pr = analysis.principleResults as
        Record<string, { passed: boolean; score: number }> | undefined;
      const expScore = pr?.explainability?.score ?? (pr?.explainability?.passed ? 85 : 40);
      update.explainabilityLevel =
        expScore >= 90 ? "high" : expScore >= 70 ? "adequate" :
        expScore >= 50 ? "partial" : "insufficient";
      const transScore = pr?.transparency?.score ?? (pr?.transparency?.passed ? 85 : 40);
      update.transparencyLevel =
        transScore >= 90 ? "high" : transScore >= 70 ? "adequate" :
        transScore >= 50 ? "partial" : "insufficient";
      // Al-Shamsi compliance from the ASLI pre-score
      const asli = analysis.asliPreScore as number | undefined;
      update.alShamsiFrameworkCompliance =
        asli == null ? "pending" :
        asli >= 95 ? "full" :
        asli >= 80 ? "substantial" :
        asli >= 60 ? "partial" : "non_compliant";
      // Seal the DCI when constitutional validation passes
      if (overallPassed) {
        const allStages = await db
          .select()
          .from(decisionStagesTable)
          .where(eq(decisionStagesTable.decisionId, decisionId))
          .orderBy(decisionStagesTable.stageNumber);
        const hashInput = allStages.map((s) => s.auditHash ?? "").join("|");
        update.completeAuditHash = createHash("sha256").update(hashInput).digest("hex");
        update.isSealed = true;
        update.sealedAt = new Date();
        update.sealedBy = userId;
      }
      break;
    }
  }

  if (Object.keys(update).length > 1) {
    await db
      .update(decisionDciTable)
      .set(update)
      .where(eq(decisionDciTable.decisionId, decisionId));
  }
}

// ─── Stage Sequence Guard ─────────────────────────────────────────────────────

/**
 * Enforce that the current operation targets the decision's currentStage.
 * The constitutional lifecycle must proceed sequentially.
 */
function assertCurrentStage(
  decision: typeof decisionsTable.$inferSelect,
  stageKey: string,
): { ok: true } | { ok: false; error: string } {
  if (decision.currentStage !== stageKey) {
    return {
      ok: false,
      error: `Stage '${stageKey}' is not the active stage. Current stage is '${decision.currentStage}'. Constitutional lifecycle must proceed sequentially.`,
    };
  }
  return { ok: true };
}

// ─── Stage AI Prompts ─────────────────────────────────────────────────────────

const STAGE_SYSTEM_PROMPT = `You are an expert in UAE Administrative Law, GCC administrative governance, 
French Droit Administratif, and the M. Al-Shamsi Framework for Intelligent Administrative Decision Legitimacy.
You assist government officials in creating constitutionally compliant administrative decisions.
You must always return valid JSON only — no markdown, no explanations outside the JSON structure.
Every "aiContribution" field must be a formal Arabic statement describing what AI contributed.
Every "stageSummary" must be a single concise Arabic sentence summarizing the stage outcome.`;

function buildStagePrompt(
  stageKey: DecisionStageKey,
  stageData: Record<string, unknown>,
  decisionContext: { titleAr: string; jurisdiction: string; decisionType: string },
  allStages: Array<{ stageKey: string; stageData: unknown; aiAnalysis: unknown }>,
): string {
  const ctx = `القرار: "${decisionContext.titleAr}" | الاختصاص: ${decisionContext.jurisdiction} | النوع: ${decisionContext.decisionType}`;
  const stageDataStr = JSON.stringify(stageData, null, 2);

  switch (stageKey) {
    case "administrative_request":
      return `
${ctx}

تحليل الطلب الإداري — Administrative Request Analysis

بيانات المرحلة:
${stageDataStr}

حلل هذا الطلب الإداري وفق مبادئ القانون الإداري الإماراتي وإطار الشامسي. أعد كائن JSON:
{
  "passed": boolean,
  "requestClassification": "appointment|promotion|dismissal|license|revocation|penalty|confiscation|expropriation|other",
  "urgencyAssessment": "routine|urgent|emergency",
  "constitutionalFlags": [string],
  "issues": [string],
  "recommendations": [string],
  "aiContribution": "جملة عربية رسمية تصف ما أسهم به الذكاء الاصطناعي",
  "stageSummary": "جملة عربية واحدة موجزة"
}`;

    case "legal_authority":
      return `
${ctx}

التحقق من الاختصاص — Legal Authority Verification

بيانات المرحلة:
${stageDataStr}

طبّق اختبار الاختصاص الرباعي وفق القانون الإداري الإماراتي:
1. الاختصاص الموضوعي — 2. الاختصاص المكاني — 3. الاختصاص الزمني — 4. الاختصاص الدرجي

أعد كائن JSON:
{
  "passed": boolean,
  "competenceAnalysis": {
    "material": { "passed": boolean, "notes": string },
    "territorial": { "passed": boolean, "notes": string },
    "temporal": { "passed": boolean, "notes": string },
    "hierarchical": { "passed": boolean, "notes": string }
  },
  "delegationValid": null,
  "issues": [string],
  "recommendations": [string],
  "aiContribution": string,
  "stageSummary": string
}`;

    case "facts_evidence":
      return `
${ctx}

تقييم الوقائع والأدلة — Facts & Evidence Assessment

بيانات المرحلة:
${stageDataStr}

قيّم الركن المادي (وجود الوقائع وصحتها واكتمال السجل الإثباتي والترابط المنطقي).

أعد كائن JSON:
{
  "passed": boolean,
  "factualStrength": "strong|adequate|weak|insufficient",
  "evidenceQuality": "high|adequate|low|insufficient",
  "keyGaps": [string],
  "issues": [string],
  "recommendations": [string],
  "aiContribution": string,
  "stageSummary": string
}`;

    case "legal_basis":
      return `
${ctx}

التحقق من السند القانوني — Legal Basis Validation

بيانات المرحلة:
${stageDataStr}

تحقق من الوجود والانطباق والسريان والكفاية والتحديد.

أعد كائن JSON:
{
  "passed": boolean,
  "legalBasisStrength": "strong|adequate|weak|insufficient",
  "citedInstruments": [string],
  "additionalRecommendedBases": [string],
  "issues": [string],
  "recommendations": [string],
  "aiContribution": string,
  "stageSummary": string
}`;

    case "administrative_objective":
      return `
${ctx}

تقييم الهدف الإداري — Administrative Objective Evaluation

بيانات المرحلة:
${stageDataStr}

تحقق من مشروعية الغاية ودرأ خطر الانحراف بالسلطة (détournement de pouvoir).

أعد كائن JSON:
{
  "passed": boolean,
  "purposeLegitimacy": "legitimate|questionable|illegitimate",
  "publicInterestScore": 0,
  "purposeDeviationRisk": "low|medium|high",
  "indicators": [string],
  "issues": [string],
  "recommendations": [string],
  "aiContribution": string,
  "stageSummary": string
}`;

    case "discretionary_power":
      return `
${ctx}

تحليل السلطة التقديرية — Discretionary Power Analysis

بيانات المرحلة:
${stageDataStr}

حلل طبيعة القرار ونطاق السلطة التقديرية ومؤشرات الانحراف والتعسف والغلو.

أعد كائن JSON:
{
  "passed": boolean,
  "decisionNature": "fully_bound|limited_discretion|wide_discretion",
  "discretionScope": string,
  "abuseRisk": "low|medium|high",
  "abuseIndicators": [string],
  "issues": [string],
  "recommendations": [string],
  "aiContribution": string,
  "stageSummary": string
}`;

    case "proportionality":
      return `
${ctx}

اختبار مبدأ التناسب — Proportionality Test

بيانات المرحلة:
${stageDataStr}

طبّق الاختبار الثلاثي: 1. الملاءمة 2. الضرورة 3. التناسب الدقيق.

أعد كائن JSON:
{
  "passed": boolean,
  "suitabilityTest": { "passed": boolean, "analysis": string },
  "necessityTest": { "passed": boolean, "analysis": string, "alternatives": [string] },
  "proportionalityTest": { "passed": boolean, "analysis": string },
  "overallProportionality": "proportionate|marginally_proportionate|disproportionate",
  "issues": [string],
  "recommendations": [string],
  "aiContribution": string,
  "stageSummary": string
}`;

    case "human_oversight":
      return `
${ctx}

التحقق من الرقابة البشرية — Human Oversight Verification

بيانات المرحلة:
${stageDataStr}

تحقق من المبدأ الدستوري الرابع: تحديد مسؤول بشري، إقرار بإسهام الذكاء الاصطناعي، توثيق الحكم البشري.

أعد كائن JSON:
{
  "passed": boolean,
  "officialIdentified": boolean,
  "aiContributionAcknowledged": boolean,
  "humanJudgmentDocumented": boolean,
  "oversightStatement": string,
  "aiContributionSummary": string,
  "oversightComplianceScore": 0,
  "issues": [string],
  "aiContribution": string,
  "stageSummary": string
}`;

    case "constitutional_validation": {
      const stagesStr = allStages
        .filter((s) => s.stageKey !== "constitutional_validation")
        .map((s) => `\n=== ${s.stageKey} ===\n${JSON.stringify(s.stageData, null, 2)}`)
        .join("\n");
      return `
${ctx}

التحقق الدستوري الشامل — Comprehensive Constitutional Validation
إطار الشامسي · MARSAD Constitutional Standard v1.0

بيانات جميع المراحل السابقة:
${stagesStr}

قيّم هذا القرار مقابل المبادئ الدستورية العشرة لمنصة مرصد. أعد كائن JSON:
{
  "overallPassed": boolean,
  "principleResults": {
    "ai_serves_law": { "passed": boolean, "score": 0, "notes": string },
    "legality": { "passed": boolean, "score": 0, "notes": string },
    "transparency": { "passed": boolean, "score": 0, "notes": string },
    "human_oversight": { "passed": boolean, "score": 0, "notes": string },
    "explainability": { "passed": boolean, "score": 0, "notes": string },
    "proportionality": { "passed": boolean, "score": 0, "notes": string },
    "due_process": { "passed": boolean, "score": 0, "notes": string },
    "accountability": { "passed": boolean, "score": 0, "notes": string },
    "judicial_reviewability": { "passed": boolean, "score": 0, "notes": string },
    "continuous_legitimacy": { "passed": boolean, "score": 0, "notes": string }
  },
  "asliPreScore": 0,
  "criticalFailures": [string],
  "remediationRequired": [string],
  "constitutionalSummary": string,
  "aiContribution": string,
  "stageSummary": string
}`;
    }

    case "decision_drafting": {
      const stagesStr = allStages
        .filter((s) =>
          ["administrative_request","legal_authority","legal_basis","administrative_objective",
            "proportionality","human_oversight"].includes(s.stageKey),
        )
        .map((s) => `\n=== ${s.stageKey} ===\n${JSON.stringify(s.stageData, null, 2)}`)
        .join("\n");
      return `
${ctx}

صياغة القرار الإداري الرسمي — Formal Administrative Decision Drafting

المراحل المكتملة:
${stagesStr}

بيانات مرحلة الصياغة:
${stageDataStr}

اصغ قراراً إدارياً رسمياً باللغة العربية. أعد كائن JSON:
{
  "preamble": string,
  "recitals": string,
  "operativeClauses": string,
  "reasons": string,
  "appealRights": string,
  "fullDecisionText": string,
  "aiContribution": string,
  "stageSummary": string
}`;
    }

    case "final_review": {
      const stagesStr = allStages
        .map((s) => {
          const analysis = s.aiAnalysis as Record<string, unknown> | null;
          return `=== ${s.stageKey}: ${analysis?.stageSummary ?? "مكتمل"} ===`;
        })
        .join("\n");
      return `
${ctx}

المراجعة النهائية — Final Review

ملخص المراحل:
${stagesStr}

بيانات المراجعة:
${stageDataStr}

أعد ملخصاً نهائياً شاملاً. أعد كائن JSON:
{
  "passed": boolean,
  "readinessScore": 0,
  "constitutionalCompliance": "full|substantial|partial|insufficient",
  "executiveSummaryAr": string,
  "executiveSummaryEn": string,
  "keyStrengths": [string],
  "remainingRisks": [string],
  "recommendedActions": [string],
  "certificationStatement": string,
  "aiContribution": string,
  "stageSummary": string
}`;
    }

    default:
      return `Analyze stage ${stageKey} and return JSON with passed, issues, recommendations, aiContribution, stageSummary.\nData: ${stageDataStr}`;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /decisions — list all decisions
router.get("/decisions", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const userId = getUserId(req);
    const role = Array.isArray(req.headers["x-user-role"])
      ? req.headers["x-user-role"][0]
      : (req.headers["x-user-role"] ?? "viewer");

    const rows =
      role === "owner"
        ? await db.select().from(decisionsTable).orderBy(desc(decisionsTable.createdAt))
        : await db
            .select()
            .from(decisionsTable)
            .where(eq(decisionsTable.createdBy, userId))
            .orderBy(desc(decisionsTable.createdAt));

    res.json({ decisions: rows });
  } catch (err) {
    console.error("[decisions.list]", err);
    res.status(500).json({ error: "Failed to load decisions" });
  }
});

// POST /decisions — create a new decision case
router.post("/decisions", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const body = req.body as Record<string, string>;
    const { titleAr, titleEn, jurisdiction, decisionType, organizationUnit, issuingAuthority } = body;

    if (!titleAr || !jurisdiction || !decisionType || !organizationUnit) {
      res.status(400).json({ error: "titleAr, jurisdiction, decisionType, organizationUnit are required" });
      return;
    }

    const userId = getUserId(req);
    const year = new Date().getFullYear();
    const [countRow] = await db.select({ cnt: sql<number>`count(*)::int` }).from(decisionsTable);
    const seq = String((countRow?.cnt ?? 0) + 1).padStart(4, "0");
    const caseNumber = `MARSAD-${year}-${seq}`;

    const [decision] = await db
      .insert(decisionsTable)
      .values({
        caseNumber,
        titleAr,
        titleEn: titleEn ?? null,
        jurisdiction,
        decisionType,
        organizationUnit,
        issuingAuthority: issuingAuthority ?? null,
        status: "in_progress",
        currentStage: "administrative_request",
        stagesCompleted: [],
        createdBy: userId,
      })
      .returning();

    logAudit(req, "decision.create", {
      entityType: "decision",
      entityId: decision.id,
      details: { caseNumber, titleAr, jurisdiction, decisionType },
    });

    // Auto-create the Decision Constitutional Identity (DCI) — constitutional passport
    await initializeDci(decision.id, decision);

    res.status(201).json({ decision });
  } catch (err) {
    console.error("[decisions.create]", err);
    res.status(500).json({ error: "Failed to create decision" });
  }
});

// GET /decisions/:id — get full decision with all stages
router.get("/decisions/:id", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const decision = await assertDecisionAccess(req, id);
    if (!decision) { res.status(404).json({ error: "Decision not found or access denied" }); return; }

    const stages = await db
      .select()
      .from(decisionStagesTable)
      .where(eq(decisionStagesTable.decisionId, id))
      .orderBy(decisionStagesTable.stageNumber, decisionStagesTable.createdAt);

    res.json({ decision, stages });
  } catch (err) {
    console.error("[decisions.get]", err);
    res.status(500).json({ error: "Failed to load decision" });
  }
});

// PUT /decisions/:id/stages/:stageKey — save (upsert) stage form data
// No auditHash here — hash is only computed at validation time (after data is final)
router.put("/decisions/:id/stages/:stageKey", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const stageKey = req.params.stageKey as DecisionStageKey;

    if (!DECISION_STAGE_KEYS.includes(stageKey)) {
      res.status(400).json({ error: "Invalid stage key" }); return;
    }

    // Ownership check
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const stageData = req.body as Record<string, unknown>;
    const idx = stageIndex(stageKey);

    const existing = await db
      .select()
      .from(decisionStagesTable)
      .where(
        and(
          eq(decisionStagesTable.decisionId, decisionId),
          eq(decisionStagesTable.stageKey, stageKey),
        ),
      );

    if (existing.length > 0) {
      // In-place update is acceptable for draft saves; auditHash stays null until validation
      await db
        .update(decisionStagesTable)
        .set({ stageData, validationStatus: "pending", auditHash: null })
        .where(eq(decisionStagesTable.id, existing[0].id));
    } else {
      await db.insert(decisionStagesTable).values({
        decisionId,
        stageKey,
        stageNumber: idx + 1,
        stageData,
        validationStatus: "pending",
        // auditHash intentionally omitted — will be set at validation time
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[decisions.saveStage]", err);
    res.status(500).json({ error: "Failed to save stage data" });
  }
});

// POST /decisions/:id/stages/:stageKey/ai-assist — AI analysis for this stage
router.post("/decisions/:id/stages/:stageKey/ai-assist", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const stageKey = req.params.stageKey as DecisionStageKey;

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const allStages = await db
      .select()
      .from(decisionStagesTable)
      .where(eq(decisionStagesTable.decisionId, decisionId))
      .orderBy(decisionStagesTable.stageNumber);

    const stageData = req.body as Record<string, unknown>;
    const prompt = buildStagePrompt(stageKey, stageData, decision, allStages);

    const provider = await aiRouter.routeFor(TaskType.RAG);
    const result = await provider.complete({
      taskType: TaskType.RAG,
      prompt,
      systemPrompt: STAGE_SYSTEM_PROMPT,
      maxTokens: 2500,
    });

    const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const parseResult = parseModelJson<Record<string, unknown>>(cleaned);

    if (!parseResult.ok) {
      res.status(500).json({ error: "AI analysis could not be parsed", raw: cleaned.slice(0, 500) });
      return;
    }

    const analysis = parseResult.data;

    // Store AI analysis in the stage record
    await db
      .update(decisionStagesTable)
      .set({
        aiAnalysis: analysis,
        aiContribution: (analysis.aiContribution as string) || null,
      })
      .where(
        and(
          eq(decisionStagesTable.decisionId, decisionId),
          eq(decisionStagesTable.stageKey, stageKey),
        ),
      );

    res.json({ analysis });
  } catch (err) {
    console.error("[decisions.aiAssist]", err);
    res.status(500).json({ error: "AI assistance failed" });
  }
});

// POST /decisions/:id/stages/:stageKey/validate — constitutional validation
// Restricted to supervisor/owner — viewers cannot trigger validation
router.post("/decisions/:id/stages/:stageKey/validate", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const stageKey = req.params.stageKey as DecisionStageKey;
    const userId = getUserId(req);

    // Ownership check
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    // Enforce sequential constitutional progression
    const sequenceCheck = assertCurrentStage(decision, stageKey);
    if (!sequenceCheck.ok) { res.status(422).json({ error: sequenceCheck.error }); return; }

    const allStages = await db
      .select()
      .from(decisionStagesTable)
      .where(eq(decisionStagesTable.decisionId, decisionId))
      .orderBy(decisionStagesTable.stageNumber);

    const stageData = req.body as Record<string, unknown>;
    const prompt = buildStagePrompt(stageKey, stageData, decision, allStages);

    const provider = await aiRouter.routeFor(TaskType.RAG);
    const result = await provider.complete({
      taskType: TaskType.RAG,
      prompt,
      systemPrompt: STAGE_SYSTEM_PROMPT,
      maxTokens: 3000,
    });

    const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const parseResult = parseModelJson<Record<string, unknown>>(cleaned);

    if (!parseResult.ok) {
      res.status(500).json({ error: "Validation could not be parsed" }); return;
    }

    const analysis = parseResult.data;
    const passed = stageKey === "constitutional_validation"
      ? Boolean(analysis.overallPassed)
      : Boolean(analysis.passed);

    const validationStatus = passed ? "passed" : "failed";
    const timestamp = new Date().toISOString();
    const hash = computeAuditHash(decisionId, stageKey, stageData, userId, timestamp);

    const existing = await db
      .select()
      .from(decisionStagesTable)
      .where(
        and(
          eq(decisionStagesTable.decisionId, decisionId),
          eq(decisionStagesTable.stageKey, stageKey),
        ),
      );

    if (existing.length > 0) {
      await db
        .update(decisionStagesTable)
        .set({
          validationStatus,
          validationDetails: analysis,
          aiAnalysis: analysis,
          aiContribution: (analysis.aiContribution as string) || null,
          validatedAt: new Date(),
          validatedBy: userId,
          auditHash: hash,
        })
        .where(eq(decisionStagesTable.id, existing[0].id));
    } else {
      await db.insert(decisionStagesTable).values({
        decisionId,
        stageKey,
        stageNumber: stageIndex(stageKey) + 1,
        stageData,
        validationStatus,
        validationDetails: analysis,
        aiAnalysis: analysis,
        aiContribution: (analysis.aiContribution as string) || null,
        validatedAt: new Date(),
        validatedBy: userId,
        auditHash: hash,
      });
    }

    logAudit(req, "decision.stage.validate", {
      entityType: "decision",
      entityId: decisionId,
      details: { stageKey, passed, hash },
    });

    res.json({ passed, analysis, validationStatus });
  } catch (err) {
    console.error("[decisions.validate]", err);
    res.status(500).json({ error: "Validation failed" });
  }
});

// POST /decisions/:id/stages/:stageKey/complete — mark stage complete and advance
router.post("/decisions/:id/stages/:stageKey/complete", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const stageKey = req.params.stageKey as DecisionStageKey;
    const userId = getUserId(req);

    // Ownership check
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    // Enforce sequential constitutional progression
    const sequenceCheck = assertCurrentStage(decision, stageKey);
    if (!sequenceCheck.ok) { res.status(422).json({ error: sequenceCheck.error }); return; }

    const stageRecords = await db
      .select()
      .from(decisionStagesTable)
      .where(
        and(
          eq(decisionStagesTable.decisionId, decisionId),
          eq(decisionStagesTable.stageKey, stageKey),
        ),
      );

    if (stageRecords.length === 0 || stageRecords[0].validationStatus !== "passed") {
      res.status(422).json({
        error: "Stage must pass constitutional validation before completion",
        validationStatus: stageRecords[0]?.validationStatus ?? "pending",
      });
      return;
    }

    await db
      .update(decisionStagesTable)
      .set({ completedAt: new Date() })
      .where(eq(decisionStagesTable.id, stageRecords[0].id));

    const next = nextStage(stageKey);
    const currentCompleted = (decision.stagesCompleted as string[]) ?? [];
    if (!currentCompleted.includes(stageKey)) currentCompleted.push(stageKey);

    await db
      .update(decisionsTable)
      .set({
        currentStage: next ?? "final_review",
        stagesCompleted: currentCompleted,
        status: next == null ? "complete" : "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(decisionsTable.id, decisionId));

    logAudit(req, "decision.stage.complete", {
      entityType: "decision",
      entityId: decisionId,
      details: { stageKey, nextStage: next, completedBy: userId },
    });

    // Auto-update the Decision Constitutional Identity from this completed stage
    try {
      const [completedStageRecord] = await db
        .select()
        .from(decisionStagesTable)
        .where(
          and(
            eq(decisionStagesTable.decisionId, decisionId),
            eq(decisionStagesTable.stageKey, stageKey),
          ),
        );
      if (completedStageRecord) {
        await updateDciFromStage(decisionId, stageKey, completedStageRecord, userId);
      }
    } catch (dciErr) {
      // Non-fatal — DCI update failure must never block stage completion
      console.error("[dci.update.failed]", dciErr);
    }

    const [updatedDecision] = await db.select().from(decisionsTable).where(eq(decisionsTable.id, decisionId));

    res.json({ success: true, nextStage: next, decision: updatedDecision });
  } catch (err) {
    console.error("[decisions.complete]", err);
    res.status(500).json({ error: "Failed to complete stage" });
  }
});

// GET /decisions/:id/audit — full audit trail (supervisor/owner only)
router.get("/decisions/:id/audit", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);

    // Ownership check
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const logs = await db
      .select()
      .from(auditLogsTable)
      .where(
        and(
          eq(auditLogsTable.entityType, "decision"),
          eq(auditLogsTable.entityId, decisionId),
        ),
      )
      .orderBy(auditLogsTable.createdAt);

    const stages = await db
      .select()
      .from(decisionStagesTable)
      .where(eq(decisionStagesTable.decisionId, decisionId))
      .orderBy(decisionStagesTable.stageNumber, decisionStagesTable.createdAt);

    res.json({ auditLogs: logs, stages });
  } catch (err) {
    console.error("[decisions.audit]", err);
    res.status(500).json({ error: "Failed to load audit trail" });
  }
});

// ─── DCI Endpoints ────────────────────────────────────────────────────────────

// GET /decisions/:id/dci — retrieve the Decision Constitutional Identity
router.get("/decisions/:id/dci", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const [dci] = await db
      .select()
      .from(decisionDciTable)
      .where(eq(decisionDciTable.decisionId, decisionId));
    if (!dci) { res.status(404).json({ error: "DCI not found" }); return; }

    res.json({ dci });
  } catch (err) {
    console.error("[dci.get]", err);
    res.status(500).json({ error: "Failed to load DCI" });
  }
});

// POST /decisions/:id/dci/amend — recorded amendment to a sealed DCI
// Supervisors/owners only. Creates a version snapshot before applying any change.
// Only fields in AMENDABLE_FIELDS are permitted; each field has a constrained value-set
// or is marked 'text'. The read-modify-write runs inside a transaction to prevent
// concurrent amendments from racing. completeAuditHash is a hash chain that includes
// the full amendment payload, so every amendment is cryptographically attested.
const AMENDABLE_FIELDS: Record<string, Set<string> | "text"> = {
  competentAuthority:          "text",
  purposeOfDecision:           "text",
  humanDecisionOwner:          "text",
  aiParticipationLevel:        new Set(["pending", "none", "advisory", "analytical", "drafting", "comprehensive"]),
  humanOversightLevel:         new Set(["pending", "full", "substantial", "partial", "minimal"]),
  explainabilityLevel:         new Set(["pending", "high", "adequate", "partial", "insufficient"]),
  transparencyLevel:           new Set(["pending", "high", "adequate", "partial", "insufficient"]),
  evidenceCompleteness:        new Set(["pending", "complete", "substantial", "partial", "insufficient"]),
  proportionalityStatus:       new Set(["pending", "proportionate", "marginally_proportionate", "disproportionate"]),
  legalityStatus:              new Set(["pending", "confirmed", "questionable", "violated"]),
  alShamsiFrameworkCompliance: new Set(["pending", "full", "substantial", "partial", "non_compliant"]),
};

router.post("/decisions/:id/dci/amend", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const userId = getUserId(req);

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const body = req.body as { reason?: string; changes?: Record<string, unknown> };
    if (!body.reason?.trim() || !body.changes || Object.keys(body.changes).length === 0) {
      res.status(400).json({ error: "reason (non-empty string) and changes (non-empty object) are required" });
      return;
    }

    // Validate and sanitise the incoming changes against the explicit allowlist
    const validationErrors: string[] = [];
    const safeChanges: Record<string, string | null> = {};
    for (const [key, raw] of Object.entries(body.changes)) {
      const rule = AMENDABLE_FIELDS[key];
      if (!rule) {
        validationErrors.push(`'${key}' is not an amendable field`);
        continue;
      }
      if (raw !== null && typeof raw !== "string") {
        validationErrors.push(`'${key}' must be a string or null`);
        continue;
      }
      if (rule !== "text" && raw !== null && !rule.has(raw as string)) {
        validationErrors.push(`'${key}' value '${raw}' is not allowed; permitted: ${[...rule].join(", ")}`);
        continue;
      }
      safeChanges[key] = raw as string | null;
    }
    if (validationErrors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: validationErrors });
      return;
    }
    if (Object.keys(safeChanges).length === 0) {
      res.status(400).json({ error: "No valid amendable fields provided" });
      return;
    }

    // Run as a transaction to prevent concurrent amendment races on currentVersion/versionHistory
    const updated = await db.transaction(async (tx) => {
      const [dci] = await tx
        .select()
        .from(decisionDciTable)
        .where(eq(decisionDciTable.decisionId, decisionId))
        .for("update"); // row-level lock

      if (!dci) throw Object.assign(new Error("DCI not found"), { statusCode: 404 });
      if (!dci.isSealed) {
        throw Object.assign(
          new Error("DCI has not been sealed yet. Amendments are only permitted after constitutional validation passes."),
          { statusCode: 422 },
        );
      }

      // Snapshot the fields being changed before overwriting them
      const snapshot: Record<string, unknown> = {};
      for (const key of Object.keys(safeChanges)) {
        snapshot[key] = (dci as Record<string, unknown>)[key];
      }

      const changedAt = new Date().toISOString();
      const versionEntry: DciVersion = {
        version: dci.currentVersion,
        changedAt,
        changedBy: userId,
        reason: body.reason!.trim(),
        snapshot,
      };
      const history = [...((dci.versionHistory as DciVersion[]) ?? []), versionEntry];

      // Hash chain: SHA-256 over (previousHash | canonicalized amendment payload)
      // This cryptographically attests both the amendment content and its position in the chain.
      const canonicalPayload = JSON.stringify({
        reason: versionEntry.reason,
        changedAt,
        changedBy: userId,
        changes: safeChanges,
      });
      const prevHash = dci.completeAuditHash ?? "genesis";
      const newHash = createHash("sha256")
        .update(`${prevHash}|amendment:${canonicalPayload}`)
        .digest("hex");

      await tx
        .update(decisionDciTable)
        .set({
          ...safeChanges,
          completeAuditHash: newHash,
          currentVersion: dci.currentVersion + 1,
          versionHistory: history,
          updatedAt: new Date(),
        })
        .where(eq(decisionDciTable.decisionId, decisionId));

      const [result] = await tx
        .select()
        .from(decisionDciTable)
        .where(eq(decisionDciTable.decisionId, decisionId));
      return result;
    });

    logAudit(req, "dci.amend", {
      entityType: "decision",
      entityId: decisionId,
      details: {
        reason: body.reason,
        newVersion: updated.currentVersion,
        fieldsChanged: Object.keys(safeChanges),
      },
    });

    res.json({ dci: updated });
  } catch (err: unknown) {
    const typed = err as { statusCode?: number; message?: string };
    if (typed.statusCode === 404) { res.status(404).json({ error: typed.message }); return; }
    if (typed.statusCode === 422) { res.status(422).json({ error: typed.message }); return; }
    console.error("[dci.amend]", err);
    res.status(500).json({ error: "Failed to amend DCI" });
  }
});

export default router;
