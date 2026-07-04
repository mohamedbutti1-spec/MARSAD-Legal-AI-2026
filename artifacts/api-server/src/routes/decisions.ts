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
  decisionJdpTable,
  decisionCarTable,
  auditLogsTable,
  DECISION_STAGE_KEYS,
  recordCustodyEvent,
  createOrUpdateMemory,
  recordMemoryEvent,
  recordEvidenceEvent,
  type CustodyEventInput,
  type DecisionStageKey,
  type DciVersion,
  type QvaRunResult,
  type FactualEvent,
  type LegalBasisSection,
  type LegislationItem,
  type EvidenceSection,
  type ProportionalitySection,
  type DiscretionarySection,
  type AiParticipationSection,
  type HumanOversightSection,
  type ConstitutionalValidationSection,
  type DciSummarySection,
  type AuditChainSection,
  type JdpVersionHistorySection,
  type JudicialQuestion,
  type ExplainabilitySection,
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

/** Phase 3 — Extract custody context from request headers. Fire-and-forget safe. */
function getCustodyCtx(req: import("express").Request): Pick<CustodyEventInput, "userId" | "userRole" | "organization" | "deviceInfo" | "ipAddress"> {
  const role = Array.isArray(req.headers["x-user-role"])
    ? req.headers["x-user-role"][0]
    : req.headers["x-user-role"];
  const org = Array.isArray(req.headers["x-user-org"])
    ? req.headers["x-user-org"][0]
    : req.headers["x-user-org"];
  const ip = Array.isArray(req.headers["x-forwarded-for"])
    ? req.headers["x-forwarded-for"][0]
    : req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress;
  return {
    userId:       getUserId(req),
    userRole:     role ?? null,
    organization: org ?? null,
    deviceInfo:   { userAgent: req.headers["user-agent"] ?? "" },
    ipAddress:    ip ?? null,
  };
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
    humanInfluenceIndex: "pending",
    aiActualInfluence: "pending",
    lsiStatus: "pending",
    qvaVarianceLevel: "pending",
    qvaRunCount: 0,
    qvaResults: [],
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
      // Derive human oversight level from the binary gate
      const oversightPassed = Boolean(analysis.passed);
      const humanJudgmentDoc = Boolean(analysis.humanJudgmentDocumented);
      const aiContribAcknowledged = Boolean(analysis.aiContributionAcknowledged);
      update.humanOversightLevel = oversightPassed ? "full" : humanJudgmentDoc ? "substantial" : "partial";

      // ── Human Influence Index (HII) ────────────────────────────────────────
      // Compare what the human added vs. what AI recommended.
      // Field 'humanJudgmentAdditions' captures any independent human additions.
      // Field 'aiRecommendationAdopted' captures extent of AI adoption.
      const humanAdditions = (data.humanJudgmentAdditions as string) ?? "";
      const aiAdopted = (data.aiRecommendationAdopted as string) ?? "";
      const hasHumanAdditions = humanAdditions.trim().length > 15;
      const aiFullyAdopted =
        aiAdopted.includes("جميع") || aiAdopted.includes("كل") ||
        aiAdopted.toLowerCase().includes("all") || aiAdopted.toLowerCase().includes("fully");

      if (hasHumanAdditions) {
        // Human independently added content beyond what AI recommended.
        // Both human and AI shaped the outcome — genuine joint deliberation.
        update.humanInfluenceIndex = "joint_decision";
        update.aiActualInfluence = "modified_human_direction"; // AI analysis influenced but didn't fully determine
      } else if (aiFullyAdopted && aiContribAcknowledged && !hasHumanAdditions) {
        // Human adopted all AI recommendations without independent additions.
        // AI materially shaped the direction the human took — this is the
        // highest measurable AI influence without an explicit human override.
        update.humanInfluenceIndex = "ai_recommendation";
        update.aiActualInfluence = "materially_changed_outcome"; // AI recommendations were the primary driver
      } else {
        // Human exercised independent judgment; AI was advisory/confirmatory.
        // The human's outcome would likely have been the same without AI.
        update.humanInfluenceIndex = "human_will";
        update.aiActualInfluence = "confirmed_human_direction"; // AI confirmed rather than changed
      }
      break;
    }
    case "constitutional_validation": {
      const overallPassed = Boolean(analysis.overallPassed);
      update.constitutionalValidationStatus = overallPassed ? "passed" : "failed";
      // Derive explainability and transparency from gate-based principle results (no scores)
      const pr = analysis.principleResults as
        Record<string, { passed: boolean }> | undefined;
      // Gate-based: passed principle = high/adequate, failed = partial/insufficient
      update.explainabilityLevel = pr?.explainability?.passed ? "high" : "insufficient";
      update.transparencyLevel = pr?.transparency?.passed ? "high" : "insufficient";
      // Al-Shamsi compliance — gate-based: count passing principles
      if (pr) {
        const principleKeys = [
          "ai_serves_law", "legality", "transparency", "human_oversight",
          "explainability", "proportionality", "due_process",
          "accountability", "judicial_reviewability", "continuous_legitimacy",
        ];
        const passingCount = principleKeys.filter((k) => pr[k]?.passed).length;
        update.alShamsiFrameworkCompliance =
          passingCount === 10 ? "full" :
          passingCount >= 8 ? "substantial" :
          passingCount >= 6 ? "partial" : "non_compliant";
      } else {
        update.alShamsiFrameworkCompliance = overallPassed ? "full" : "non_compliant";
      }
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
    "ai_serves_law": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "legality": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "transparency": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "human_oversight": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "explainability": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "proportionality": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "due_process": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "accountability": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "judicial_reviewability": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string },
    "continuous_legitimacy": { "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string }
  },
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

    // Phase 3 — Chain of Custody: genesis record
    recordCustodyEvent({
      ...getCustodyCtx(req),
      decisionId:     decision.id,
      action:         "decision.created",
      actionCategory: "decision",
      previousValue:  null,
      newValue:       { caseNumber: decision.caseNumber, titleAr: decision.titleAr, status: decision.status, jurisdiction: decision.jurisdiction },
      legalJustification: `إنشاء قرار إداري جديد تحت إطار الشامسي الدستوري — ${decision.caseNumber}`,
      aiRecommendation: null,
      humanModification: null,
    }).catch((e: unknown) => console.error("[custody.create]", e));

    // Phase 3 — Constitutional Memory: bootstrap record
    const custodyCtx = getCustodyCtx(req);
    createOrUpdateMemory({
      decisionId:       decision.id,
      createdBy:        String(custodyCtx.userId ?? "system"),
      governmentEntity: custodyCtx.organization ?? null,
      issuerRole:       custodyCtx.userRole ?? null,
      decisionStatus:   "draft",
      constitutionalStatus: "valid",
      complianceStatus: "pending",
      appealStatus:     "none",
    }).catch((e: unknown) => console.error("[memory.create]", e));

    recordMemoryEvent({
      decisionId: decision.id,
      eventType:  "decision.created",
      eventSummaryAr: `إنشاء قرار إداري جديد — ${decision.caseNumber}`,
      eventSummaryEn: `Administrative decision created — ${decision.caseNumber}`,
      actorId:   String(custodyCtx.userId ?? "system"),
      actorRole: custodyCtx.userRole ?? undefined,
      actorOrg:  custodyCtx.organization ?? undefined,
      payload:   { caseNumber: decision.caseNumber, jurisdiction: decision.jurisdiction, status: decision.status },
    }).catch((e: unknown) => console.error("[memory.event.create]", e));

    // Phase 4 — Evidence Ledger: decision created
    recordEvidenceEvent({
      decisionId:         decision.id,
      action:             "decision.created",
      eventCategory:      "creation",
      actor:              String(custodyCtx.userId ?? "system"),
      actorRole:          custodyCtx.userRole ?? null,
      actorOrg:           custodyCtx.organization ?? null,
      affectedObject:     `decision:${decision.id}`,
      affectedObjectType: "decision",
      evidenceSummaryAr:  `إنشاء قرار إداري جديد — ${decision.caseNumber}`,
      evidenceSummaryEn:  `Administrative decision created — ${decision.caseNumber}`,
      metadata:           { caseNumber: decision.caseNumber, jurisdiction: decision.jurisdiction, status: decision.status },
    }).catch((e: unknown) => console.error("[evidence.create]", e));

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

    // Phase 3 — Chain of Custody: stage completion
    recordCustodyEvent({
      ...getCustodyCtx(req),
      decisionId,
      action:         `stage.completed.${stageKey}`,
      actionCategory: "stage",
      previousValue:  null,
      newValue:       { stageKey, nextStage: next, stagesCompleted: updatedDecision?.stagesCompleted },
      legalJustification: `استكمال المرحلة "${stageKey}" وفق المسار الدستوري للقرار الإداري`,
      aiRecommendation: null,
      humanModification: null,
    }).catch((e: unknown) => console.error("[custody.stage]", e));

    // Phase 3 — Constitutional Memory: stage event
    recordMemoryEvent({
      decisionId,
      eventType:      "stage.completed",
      eventSummaryAr: `استكمال المرحلة: ${stageKey}`,
      eventSummaryEn: `Stage completed: ${stageKey}`,
      actorId:   String(getUserId(req)),
      actorRole: String(getCustodyCtx(req).userRole ?? ""),
      payload:   { stageKey, nextStage: next },
    }).catch((e: unknown) => console.error("[memory.event.stage]", e));

    // Phase 4 — Evidence Ledger: stage completed
    recordEvidenceEvent({
      decisionId,
      action:             "stage.completed",
      eventCategory:      "stage",
      actor:              String(getUserId(req)),
      actorRole:          getCustodyCtx(req).userRole ?? null,
      affectedObject:     `stage:${stageKey}`,
      affectedObjectType: "stage",
      evidenceSummaryAr:  `استكمال المرحلة: ${stageKey}`,
      evidenceSummaryEn:  `Stage completed: ${stageKey}`,
      metadata:           { stageKey, nextStage: next },
    }).catch((e: unknown) => console.error("[evidence.stage]", e));

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

// ─── JDP Service ──────────────────────────────────────────────────────────────

/** Extract a compact summary of stage form data to keep the AI prompt within token bounds. */
function summarizeStageData(stage: typeof decisionStagesTable.$inferSelect): Record<string, unknown> {
  const data = (stage.stageData as Record<string, unknown>) ?? {};
  return Object.fromEntries(Object.entries(data).slice(0, 12));
}

/**
 * Call the AI to generate all 14 JDP sections as a structured JSON object.
 * The prompt passes the full decision context: metadata, sealed DCI, and all stages.
 */
async function generateJdpContent(
  decision: typeof decisionsTable.$inferSelect,
  dci: typeof decisionDciTable.$inferSelect,
  stages: (typeof decisionStagesTable.$inferSelect)[],
): Promise<Record<string, unknown>> {
  const legalBasisList = ((dci.applicableLegalBasis as string[]) ?? []).join("; ") || "غير محدد";
  const sealedAtStr = dci.sealedAt instanceof Date ? dci.sealedAt.toISOString() : (dci.sealedAt as string | null) ?? "N/A";

  const stagesContext = stages
    .map((s) => {
      const data = JSON.stringify(summarizeStageData(s)).substring(0, 350);
      const analysis = JSON.stringify((s.aiAnalysis as Record<string, unknown>) ?? {}).substring(0, 350);
      return `[${s.stageNumber}] ${s.stageKey} (completed: ${s.completedAt ?? "pending"})
  data: ${data}
  analysis: ${analysis}
  hash: ${s.auditHash ?? "N/A"}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a senior constitutional law expert and administrative law specialist for the UAE government.
You generate precise, court-ready Judicial Defense Packages (JDP) for administrative decisions under the M. Al-Shamsi Framework for Intelligent Administrative Decision-Making.
Narrative text must be in Arabic. Technical identifiers (hashes, stage keys, ISO dates) remain in Latin script.
Return ONLY valid JSON — no markdown fences, no explanation, no text before or after the JSON object.`;

  const userPrompt = `Generate a complete Judicial Defense Package (JDP) for this administrative decision.

=== DECISION IDENTITY ===
Case Number: ${decision.caseNumber}
Title (Arabic): ${decision.titleAr}
Type: ${decision.decisionType}
Jurisdiction: ${decision.jurisdiction}
Issuing Authority: ${decision.issuingAuthority ?? "غير محدد"}
Organization: ${decision.organizationUnit ?? "غير محدد"}
Created: ${decision.createdAt}

=== SEALED CONSTITUTIONAL IDENTITY (DCI) ===
Competent Authority: ${dci.competentAuthority ?? "pending"}
Legal Basis: ${legalBasisList}
Purpose: ${dci.purposeOfDecision ?? "pending"}
Human Decision Owner: ${dci.humanDecisionOwner ?? "pending"}
AI Participation Level: ${dci.aiParticipationLevel}
Human Oversight Level: ${dci.humanOversightLevel}
Explainability Level: ${dci.explainabilityLevel}
Transparency Level: ${dci.transparencyLevel}
Evidence Completeness: ${dci.evidenceCompleteness}
Proportionality Status: ${dci.proportionalityStatus}
Legality Status: ${dci.legalityStatus}
Constitutional Validation Status: ${dci.constitutionalValidationStatus}
Al-Shamsi Framework Compliance: ${dci.alShamsiFrameworkCompliance}
Complete Audit Hash: ${dci.completeAuditHash ?? "N/A"}
DCI Version: ${dci.currentVersion} | Sealed: ${sealedAtStr}

=== COMPLETED DECISION STAGES (${stages.length} stages) ===
${stagesContext}

Return a single JSON object with EXACTLY these 14 keys. Use real data from the decision context above.

{
  "factualChronology": [{"stageNumber":1,"stage":"stage_key","stageName":"Arabic stage name","date":"ISO date or null","description":"Detailed Arabic narrative of what occurred in this stage and its constitutional significance","actor":"Name/role of who performed this","aiContribution":"What MARSAD AI system contributed in this stage"}],
  "legalBasis": {"overview":"Arabic overview of entire legal basis","grounds":[{"law":"Law or decree name","article":"Article number or null","relevance":"Arabic relevance to this decision"}],"conclusion":"Arabic legal basis conclusion"},
  "applicableLegislation": [{"title":"Full legislation title","reference":"Official reference number","applicableArticles":["Art. X","Art. Y"],"relevance":"Arabic relevance statement"}],
  "evidenceSummary": {"overview":"Arabic evidence overview","items":[{"type":"Type of evidence","description":"Arabic description","weight":"high","admissibility":"Why this evidence is admissible"}],"completenessAssessment":"Arabic assessment of evidence completeness","conclusion":"Arabic evidence conclusion"},
  "proportionalityAnalysis": {"legitimateAimTest":{"result":"passed","reasoning":"Arabic reasoning"},"necessityTest":{"result":"passed","reasoning":"Arabic reasoning"},"strictProportionalityTest":{"result":"passed","reasoning":"Arabic reasoning"},"overallConclusion":"Arabic proportionality conclusion"},
  "discretionaryReasoning": {"overview":"Arabic overview of administrative discretion exercised","factorsConsidered":["Arabic factor 1","Arabic factor 2","Arabic factor 3"],"alternativesEvaluated":"Arabic description of alternatives considered and why rejected","publicInterestBalance":"Arabic public interest analysis","conclusion":"Arabic discretionary reasoning conclusion"},
  "aiParticipationExplanation": {"overview":"Arabic overview of AI participation throughout the decision lifecycle","totalStagesWithAiAssistance":11,"participationLevel":"comprehensive","stageContributions":[{"stage":"stage_key","stageName":"Arabic stage name","contribution":"Arabic description of AI contribution","humanVerification":"Arabic description of how human verified AI output","reviewedBy":"Role of the human reviewer"}],"overallAssessment":"Arabic overall assessment of AI participation appropriateness"},
  "humanOversightRecord": {"authorizedOfficer":"Full name and official title","position":"Official position","organization":"Organization name","oversightLevel":"full","verificationSteps":[{"stage":"stage_key","stageName":"Arabic stage name","humanAction":"Arabic description of human action taken","outcome":"Arabic outcome of that action"}],"conclusion":"Arabic human oversight conclusion"},
  "constitutionalValidationResults": {"overallResult":"passed","validationDate":"ISO date or null","alShamsiScore":95,"principleResults":[{"principle":"Arabic principle name","passed":true,"score":90,"notes":"Arabic notes on this principle"}],"conclusion":"Arabic constitutional validation conclusion"},
  "dciSummary": {"decisionId":"${decision.caseNumber}","decisionType":"${decision.decisionType}","competentAuthority":"${dci.competentAuthority ?? ""}","constitutionalValidationStatus":"${dci.constitutionalValidationStatus}","alShamsiFrameworkCompliance":"${dci.alShamsiFrameworkCompliance}","sealedAt":"${sealedAtStr}","completeAuditHash":"${dci.completeAuditHash ?? ""}","currentVersion":${dci.currentVersion}},
  "auditChain": {"overview":"Arabic audit chain integrity overview","stages":[{"stageNumber":1,"stage":"stage_key","stageName":"Arabic stage name","auditHash":"hash or null","completedAt":"ISO date or null"}],"completeHash":"${dci.completeAuditHash ?? ""}","integrityStatus":"verified"},
  "versionHistoryRecord": {"currentVersion":${dci.currentVersion},"isSealed":${dci.isSealed},"sealedAt":"${sealedAtStr}","amendments":[]},
  "anticipatedJudicialReviewQuestions": [{"category":"Legal Authority","question":"Arabic question a court would ask","legalGrounding":"Legal basis for this challenge","preparedAnswer":"Complete Arabic answer with specific evidence citations from this decision's record","relevantEvidence":"Which specific evidence supports this answer"}],
  "explainabilityReport": {"overview":"Arabic high-level overview","decisionRationale":"Complete Arabic rationale for why this decision was taken and why it is the appropriate response","alternativesConsidered":"Arabic description of alternatives evaluated and specific reasons they were rejected","impactAssessment":"Arabic assessment of who is affected by this decision and how","publicInterestJustification":"Arabic justification of the public interest served by this decision","minorityInterestConsiderations":"Arabic description of how affected party interests were considered or null","conclusion":"Arabic explainability conclusion"}
}

CRITICAL REQUIREMENTS:
1. Generate ALL 11 stages in factualChronology and aiParticipationExplanation.stageContributions
2. Generate at LEAST 6 anticipatedJudicialReviewQuestions covering: Legal Authority, Proportionality, Evidence Quality, Procedural Compliance, Constitutional Validity, and AI Accountability
3. All narrative fields must be substantive Arabic text, not placeholders
4. Use actual data from the provided decision context — do not invent facts not present in the context
5. Return ONLY the JSON object, nothing else`;

  const provider = await aiRouter.routeFor(TaskType.RAG);
  const result = await provider.complete({
    taskType: TaskType.RAG,
    systemPrompt,
    prompt: userPrompt,
    maxTokens: 8000,
  });

  const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const jsonStr = cleaned
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();

  const parseResult = parseModelJson<Record<string, unknown>>(jsonStr);
  if (!parseResult.ok) {
    throw new Error(`JDP JSON parse failed — raw: ${parseResult.raw?.slice(0, 200) ?? "empty"}`);
  }
  return parseResult.data;
}

// ─── JDP Endpoints ────────────────────────────────────────────────────────────

// POST /decisions/:id/jdp/generate — generate (or regenerate) the Judicial Defense Package
// Requires a sealed DCI. Blocks until AI generation completes (≈30–60 s).
// Non-fatal regeneration: existing JDP is set to "generating" first so the UI can show progress.
router.post("/decisions/:id/jdp/generate", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const userId = getUserId(req);

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const [dci] = await db.select().from(decisionDciTable)
      .where(eq(decisionDciTable.decisionId, decisionId));
    if (!dci) {
      res.status(404).json({ error: "DCI not found — the decision must complete constitutional validation first" });
      return;
    }
    if (!dci.isSealed) {
      res.status(422).json({
        error: "The Decision Constitutional Identity (DCI) has not been sealed. The Judicial Defense Package can only be generated after constitutional validation passes.",
      });
      return;
    }

    // Guard: reject if generation is already in progress
    const [before] = await db.select({ status: decisionJdpTable.status })
      .from(decisionJdpTable)
      .where(eq(decisionJdpTable.decisionId, decisionId));
    if (before?.status === "generating") {
      res.status(409).json({ error: "JDP generation is already in progress for this decision. Please wait for the current run to complete." });
      return;
    }

    // Atomic upsert to "generating" — handles both first-create and re-generate cases
    await db.insert(decisionJdpTable)
      .values({ decisionId, status: "generating" })
      .onConflictDoUpdate({
        target: decisionJdpTable.decisionId,
        set: { status: "generating", errorMessage: null, updatedAt: new Date() },
      });

    // 14 required section keys — validated before any DB write
    const REQUIRED_JDP_SECTIONS = [
      "factualChronology", "legalBasis", "applicableLegislation", "evidenceSummary",
      "proportionalityAnalysis", "discretionaryReasoning", "aiParticipationExplanation",
      "humanOversightRecord", "constitutionalValidationResults", "dciSummary",
      "auditChain", "versionHistoryRecord", "anticipatedJudicialReviewQuestions", "explainabilityReport",
    ] as const;

    const startMs = Date.now();
    try {
      const stages = await db.select().from(decisionStagesTable)
        .where(eq(decisionStagesTable.decisionId, decisionId))
        .orderBy(decisionStagesTable.stageNumber);

      const sections = await generateJdpContent(decision, dci, stages);
      const durationMs = Date.now() - startMs;

      // Runtime section integrity check — all 14 sections must be present and non-null
      const missingSections = REQUIRED_JDP_SECTIONS.filter((k) => !sections[k]);
      if (missingSections.length > 0) {
        throw new Error(`AI output is missing required sections: ${missingSections.join(", ")}. The model may have truncated its response.`);
      }

      await db.update(decisionJdpTable).set({
        status: "ready",
        generatedAt: new Date(),
        generatedBy: userId,
        generationDurationMs: durationMs,
        factualChronology:               sections.factualChronology as FactualEvent[],
        legalBasis:                      sections.legalBasis as LegalBasisSection,
        applicableLegislation:           sections.applicableLegislation as LegislationItem[],
        evidenceSummary:                 sections.evidenceSummary as EvidenceSection,
        proportionalityAnalysis:         sections.proportionalityAnalysis as ProportionalitySection,
        discretionaryReasoning:          sections.discretionaryReasoning as DiscretionarySection,
        aiParticipationExplanation:      sections.aiParticipationExplanation as AiParticipationSection,
        humanOversightRecord:            sections.humanOversightRecord as HumanOversightSection,
        constitutionalValidationResults: sections.constitutionalValidationResults as ConstitutionalValidationSection,
        dciSummary:                      sections.dciSummary as DciSummarySection,
        auditChain:                      sections.auditChain as AuditChainSection,
        versionHistoryRecord:            sections.versionHistoryRecord as JdpVersionHistorySection,
        anticipatedJudicialReviewQuestions: sections.anticipatedJudicialReviewQuestions as JudicialQuestion[],
        explainabilityReport:            sections.explainabilityReport as ExplainabilitySection,
        errorMessage: null,
        updatedAt: new Date(),
      }).where(eq(decisionJdpTable.decisionId, decisionId));

      logAudit(req, "jdp.generate", {
        entityType: "decision",
        entityId: decisionId,
        details: { durationMs, sectionCount: Object.keys(sections).length },
      });

      const [jdp] = await db.select().from(decisionJdpTable)
        .where(eq(decisionJdpTable.decisionId, decisionId));
      res.json({ jdp });
    } catch (genErr) {
      const errMsg = genErr instanceof Error ? genErr.message : "Unknown generation error";
      await db.update(decisionJdpTable)
        .set({ status: "error", errorMessage: errMsg, updatedAt: new Date() })
        .where(eq(decisionJdpTable.decisionId, decisionId));
      console.error("[jdp.generate]", genErr);
      res.status(500).json({ error: `JDP generation failed: ${errMsg}` });
    }
  } catch (err) {
    console.error("[jdp.generate.outer]", err);
    res.status(500).json({ error: "Failed to initiate JDP generation" });
  }
});

// GET /decisions/:id/jdp — retrieve the Judicial Defense Package
router.get("/decisions/:id/jdp", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const [jdp] = await db.select().from(decisionJdpTable)
      .where(eq(decisionJdpTable.decisionId, decisionId));
    if (!jdp) { res.status(404).json({ error: "JDP not found" }); return; }

    res.json({ jdp });
  } catch (err) {
    console.error("[jdp.get]", err);
    res.status(500).json({ error: "Failed to load JDP" });
  }
});

// GET /decisions/:id/jdp/export — structured JSON export for court submission
// Returns a self-describing envelope suitable for archiving or printing.
router.get("/decisions/:id/jdp/export", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const [jdp] = await db.select().from(decisionJdpTable)
      .where(eq(decisionJdpTable.decisionId, decisionId));
    if (!jdp || jdp.status !== "ready") {
      res.status(404).json({ error: "JDP not ready for export" });
      return;
    }

    logAudit(req, "jdp.export", {
      entityType: "decision",
      entityId: decisionId,
      details: { caseNumber: decision.caseNumber },
    });

    const exportPayload = {
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      marsadVersion: "1.0",
      framework: "M. Al-Shamsi Framework for Intelligent Administrative Decision-Making",
      decision: {
        caseNumber: decision.caseNumber,
        titleAr: decision.titleAr,
        decisionType: decision.decisionType,
        jurisdiction: decision.jurisdiction,
      },
      packageMeta: {
        generatedAt: jdp.generatedAt,
        generationDurationMs: jdp.generationDurationMs,
        sectionCount: 14,
      },
      sections: {
        factualChronology:               jdp.factualChronology,
        legalBasis:                      jdp.legalBasis,
        applicableLegislation:           jdp.applicableLegislation,
        evidenceSummary:                 jdp.evidenceSummary,
        proportionalityAnalysis:         jdp.proportionalityAnalysis,
        discretionaryReasoning:          jdp.discretionaryReasoning,
        aiParticipationExplanation:      jdp.aiParticipationExplanation,
        humanOversightRecord:            jdp.humanOversightRecord,
        constitutionalValidationResults: jdp.constitutionalValidationResults,
        dciSummary:                      jdp.dciSummary,
        auditChain:                      jdp.auditChain,
        versionHistoryRecord:            jdp.versionHistoryRecord,
        anticipatedJudicialReviewQuestions: jdp.anticipatedJudicialReviewQuestions,
        explainabilityReport:            jdp.explainabilityReport,
      },
    };

    const filename = `JDP-${decision.caseNumber.replace(/[/\\]/g, "-")}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(exportPayload);
  } catch (err) {
    console.error("[jdp.export]", err);
    res.status(500).json({ error: "Failed to export JDP" });
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
  humanInfluenceIndex:         new Set(["pending", "human_will", "ai_recommendation", "joint_decision"]),
  aiActualInfluence:           new Set(["pending", "confirmed_human_direction", "modified_human_direction", "materially_changed_outcome"]),
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

    // Phase 3 — Chain of Custody: DCI amendment
    recordCustodyEvent({
      ...getCustodyCtx(req),
      decisionId,
      action:         "dci.amended",
      actionCategory: "dci",
      previousValue:  null,
      newValue:       { reason: body.reason, fieldsChanged: Object.keys(safeChanges), newVersion: updated.currentVersion },
      legalJustification: body.reason ?? null,
      aiRecommendation:   null,
      humanModification:  Object.keys(safeChanges).join(", "),
    }).catch((e: unknown) => console.error("[custody.dci]", e));

    // Phase 3 — Constitutional Memory: new version on DCI amendment
    const dciCtx = getCustodyCtx(req);
    createOrUpdateMemory({
      decisionId,
      createdBy:  String(dciCtx.userId ?? "system"),
      issuerRole: dciCtx.userRole ?? null,
      decisionStatus: "draft",
      constitutionalStatus: "valid",
      complianceStatus: "pending",
    }).catch((e: unknown) => console.error("[memory.dci.version]", e));

    recordMemoryEvent({
      decisionId,
      eventType:      "dci.generated",
      eventSummaryAr: `تعديل الهوية الدستورية — الإصدار ${updated.currentVersion}`,
      eventSummaryEn: `DCI amended — version ${updated.currentVersion}`,
      actorId:   String(dciCtx.userId ?? "system"),
      actorRole: dciCtx.userRole ?? undefined,
      payload:   { reason: body.reason, fieldsChanged: Object.keys(safeChanges), newVersion: updated.currentVersion },
    }).catch((e: unknown) => console.error("[memory.event.dci]", e));

    // Phase 4 — Evidence Ledger: DCI amended
    recordEvidenceEvent({
      decisionId,
      action:             "dci.amended",
      eventCategory:      "identity",
      actor:              String(dciCtx.userId ?? "system"),
      actorRole:          dciCtx.userRole ?? null,
      affectedObject:     `dci:${decisionId}`,
      affectedObjectType: "dci",
      evidenceSummaryAr:  `تعديل الهوية الدستورية — الإصدار ${updated.currentVersion}`,
      evidenceSummaryEn:  `DCI amended — version ${updated.currentVersion}`,
      metadata:           { reason: body.reason, fieldsChanged: Object.keys(safeChanges), newVersion: updated.currentVersion },
    }).catch((e: unknown) => console.error("[evidence.dci]", e));

    res.json({ dci: updated });
  } catch (err: unknown) {
    const typed = err as { statusCode?: number; message?: string };
    if (typed.statusCode === 404) { res.status(404).json({ error: typed.message }); return; }
    if (typed.statusCode === 422) { res.status(422).json({ error: typed.message }); return; }
    console.error("[dci.amend]", err);
    res.status(500).json({ error: "Failed to amend DCI" });
  }
});

// ─── QVA — Quantitative Variance Analysis ─────────────────────────────────────

/**
 * POST /decisions/:id/qva/run
 * Run the constitutional validation prompt three independent times and measure
 * variance in principle-level gate outcomes. Populates QVA and LSI fields on DCI.
 * Requires a sealed DCI (constitutional validation must have passed first).
 */
router.post("/decisions/:id/qva/run", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const [dci] = await db.select().from(decisionDciTable)
      .where(eq(decisionDciTable.decisionId, decisionId));
    if (!dci?.isSealed) {
      res.status(422).json({ error: "QVA requires a sealed DCI. Complete constitutional validation first." });
      return;
    }

    const allStages = await db.select().from(decisionStagesTable)
      .where(eq(decisionStagesTable.decisionId, decisionId))
      .orderBy(decisionStagesTable.stageNumber);

    const prompt = buildStagePrompt("constitutional_validation", {}, decision, allStages);
    const QVA_RUN_COUNT = 3;
    const runs: QvaRunResult[] = [];

    const provider = await aiRouter.routeFor(TaskType.RAG);

    for (let i = 0; i < QVA_RUN_COUNT; i++) {
      try {
        const result = await provider.complete({
          taskType: TaskType.RAG,
          prompt,
          systemPrompt: STAGE_SYSTEM_PROMPT,
          maxTokens: 3000,
        });
        const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        const parseResult = parseModelJson<Record<string, unknown>>(cleaned);
        if (parseResult.ok && parseResult.data.principleResults) {
          const pr = parseResult.data.principleResults as Record<string, { passed: boolean; gateStatus?: string; notes?: string }>;
          runs.push({
            runIndex: i,
            ranAt: new Date().toISOString(),
            principleResults: Object.fromEntries(
              Object.entries(pr).map(([k, v]) => [k, {
                passed: Boolean(v.passed),
                gateStatus: v.passed ? "مستوفٍ" : "غير مستوفٍ",
                notes: String(v.notes ?? ""),
              }]),
            ),
          });
        }
      } catch (runErr) {
        console.error(`[qva.run] run ${i} failed:`, runErr);
      }
    }

    if (runs.length < 2) {
      res.status(500).json({ error: "Insufficient QVA runs to compute variance — AI parse failures on most runs." });
      return;
    }

    // Count principles where not all runs agree on passed/failed.
    // Only include principles that are present in ALL runs to avoid
    // AI parse incompleteness artificially inflating disagreement count.
    const PRINCIPLE_KEYS = [
      "ai_serves_law", "legality", "transparency", "human_oversight",
      "explainability", "proportionality", "due_process",
      "accountability", "judicial_reviewability", "continuous_legitimacy",
    ];
    let disagreements = 0;
    for (const p of PRINCIPLE_KEYS) {
      const presentInAll = runs.every((r) => p in r.principleResults);
      if (!presentInAll) continue; // skip principle if any run failed to parse it
      const votes = runs.map((r) => r.principleResults[p].passed);
      if (!votes.every((v) => v === votes[0])) disagreements++;
    }

    const qvaVarianceLevel: string =
      disagreements === 0 ? "low" : disagreements <= 2 ? "moderate" : "high";
    const lsiStatus: string =
      qvaVarianceLevel === "low" ? "stable" :
      qvaVarianceLevel === "moderate" ? "variable" : "highly_variable";

    await db.update(decisionDciTable).set({
      qvaResults: runs,
      qvaRunCount: runs.length,
      qvaVarianceLevel,
      lsiStatus,
      updatedAt: new Date(),
    }).where(eq(decisionDciTable.decisionId, decisionId));

    logAudit(req, "qva.run", {
      entityType: "decision",
      entityId: decisionId,
      details: { runCount: runs.length, disagreements, qvaVarianceLevel, lsiStatus },
    });

    // Phase 3 — Chain of Custody: QVA analysis
    recordCustodyEvent({
      ...getCustodyCtx(req),
      decisionId,
      action:         "qva.run",
      actionCategory: "qva",
      previousValue:  null,
      newValue:       { runCount: runs.length, disagreements, qvaVarianceLevel, lsiStatus },
      legalJustification: `تشغيل تحليل التباين الكمي — ${runs.length} دورة تحليل`,
      aiRecommendation:   `مستوى التباين: ${qvaVarianceLevel} | حالة المشروعية: ${lsiStatus}`,
      humanModification:  null,
    }).catch((e: unknown) => console.error("[custody.qva]", e));

    // Phase 3 — Constitutional Memory: QVA event + update scores
    createOrUpdateMemory({
      decisionId,
      qva: typeof qvaVarianceLevel === "number" ? qvaVarianceLevel : null,
      lsi: null,
      complianceStatus: lsiStatus === "compliant" ? "compliant" : "pending",
    }).catch((e: unknown) => console.error("[memory.qva.version]", e));

    recordMemoryEvent({
      decisionId,
      eventType:      "stage.completed",
      eventSummaryAr: `تحليل التباين الكمي — ${qvaVarianceLevel}`,
      eventSummaryEn: `QVA analysis — variance level: ${qvaVarianceLevel}`,
      actorId:   String(getUserId(req)),
      payload:   { qvaVarianceLevel, lsiStatus, runCount: runs.length, disagreements },
    }).catch((e: unknown) => console.error("[memory.event.qva]", e));

    // Phase 4 — Evidence Ledger: QVA executed
    recordEvidenceEvent({
      decisionId,
      action:             "qva.executed",
      eventCategory:      "validation",
      actor:              String(getUserId(req)),
      actorRole:          getCustodyCtx(req).userRole ?? null,
      affectedObject:     `qva:${decisionId}`,
      affectedObjectType: "qva",
      evidenceSummaryAr:  `تحليل التباين الكمي — المستوى: ${qvaVarianceLevel}`,
      evidenceSummaryEn:  `QVA analysis — variance level: ${qvaVarianceLevel}`,
      metadata:           { qvaVarianceLevel, lsiStatus, runCount: runs.length, disagreements },
    }).catch((e: unknown) => console.error("[evidence.qva]", e));

    res.json({ qvaVarianceLevel, lsiStatus, runCount: runs.length, disagreements, runs });
  } catch (err) {
    console.error("[qva.run]", err);
    res.status(500).json({ error: "QVA analysis failed" });
  }
});

// ─── CAR — Constitutional Answer Record ────────────────────────────────────────

async function generateCarContent(
  decision: typeof decisionsTable.$inferSelect,
  dci: typeof decisionDciTable.$inferSelect,
  stages: (typeof decisionStagesTable.$inferSelect)[],
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are an administrative transparency officer preparing a Constitutional Answer Record (سجل المساءلة الدستورية — CAR) for an affected party.
Write in clear, accessible Modern Standard Arabic that any educated adult can understand. Avoid legal jargon where possible.
The CAR is NOT a legal defense document. It explains to the affected party WHY a decision was made and WHAT RIGHTS they have.
Return ONLY valid JSON. No markdown fences. No explanations outside the JSON.`;

  const stageContext = stages
    .filter((s) => ["administrative_request", "facts_evidence", "legal_basis", "proportionality", "human_oversight"].includes(s.stageKey))
    .map((s) => {
      const data = JSON.stringify((s.stageData as Record<string, unknown>) ?? {}).substring(0, 500);
      return `[${s.stageKey}]: ${data}`;
    }).join("\n\n");

  const userPrompt = `Generate a Constitutional Answer Record (CAR) for this administrative decision.

Decision: ${decision.titleAr}
Reference: ${decision.caseNumber}
Type: ${decision.decisionType}
Issuing Authority: ${decision.issuingAuthority ?? "—"}
Organization: ${decision.organizationUnit}

Legal Basis: ${((dci.applicableLegalBasis as string[]) ?? []).join("; ")}
Purpose: ${(dci.purposeOfDecision as string | null) ?? "—"}
Human Decision Owner: ${(dci.humanDecisionOwner as string | null) ?? "—"}
Completed Stages: ${stages.length} of 11

Stage Context:
${stageContext}

Return a JSON object with EXACTLY these keys. All values must be in clear Arabic:
{
  "factsReliedUpon": "Clear Arabic narrative of key facts leading to this decision — what happened, when, and by whom",
  "legalBasisSummary": "Plain-language Arabic explanation of legal authority — which law, which article, and why it applies",
  "evidenceConsidered": ["Arabic description of first evidence item", "second evidence item"],
  "alternativesConsidered": ["Alternative considered and why rejected (Arabic)", "..."],
  "aiRoleSummary": "Plain Arabic explanation of how MARSAD AI system was used — what it analyzed, what it recommended, and that a human official made the final decision",
  "humanReviewSummary": "Who reviewed this decision, their official position, and how they exercised independent judgment",
  "reasonsForDecision": "Main reasons in plain Arabic why this specific decision was taken — 2–3 paragraphs of core justification",
  "affectedPartyRights": "Rights of the affected party: right to receive this document, right to request clarification, right to legal representation, right to appeal",
  "appealInformation": "How to appeal: deadline, correct court or body (e.g., المحكمة الاتحادية الإدارية), and what the appeal should contain",
  "aiSystemDisclosure": "نظام MARSAD للذكاء الاصطناعي الإداري ساعد في تحليل هذا الملف عبر [N] مراحل. القرار النهائي اتخذه مسؤول بشري مُخوَّل. للاستفسار عن دور الذكاء الاصطناعي، تواصل مع [اسم الجهة]."
}`;

  const provider = await aiRouter.routeFor(TaskType.RAG);
  const result = await provider.complete({
    taskType: TaskType.RAG,
    systemPrompt,
    prompt: userPrompt,
    maxTokens: 4000,
  });

  const cleaned = result.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const jsonStr = cleaned.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  const parseResult = parseModelJson<Record<string, unknown>>(jsonStr);
  if (!parseResult.ok) {
    throw new Error(`CAR JSON parse failed — raw: ${String(jsonStr).slice(0, 200)}`);
  }
  return parseResult.data;
}

/**
 * POST /decisions/:id/car/generate
 * Generate the Constitutional Answer Record (CAR) for the affected party.
 * Requires a sealed DCI.
 */
router.post("/decisions/:id/car/generate", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const userId = getUserId(req);
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const [dci] = await db.select().from(decisionDciTable)
      .where(eq(decisionDciTable.decisionId, decisionId));
    if (!dci?.isSealed) {
      res.status(422).json({ error: "CAR requires a sealed DCI. Complete constitutional validation first." });
      return;
    }

    const stages = await db.select().from(decisionStagesTable)
      .where(eq(decisionStagesTable.decisionId, decisionId))
      .orderBy(decisionStagesTable.stageNumber);

    // Upsert to "generating" first so client can poll
    await db.insert(decisionCarTable)
      .values({ decisionId, status: "generating" })
      .onConflictDoUpdate({
        target: decisionCarTable.decisionId,
        set: { status: "generating", errorMessage: null, updatedAt: new Date() },
      });

    try {
      const content = await generateCarContent(decision, dci, stages);
      await db.update(decisionCarTable).set({
        status: "ready",
        factsReliedUpon: String(content.factsReliedUpon ?? ""),
        legalBasisSummary: String(content.legalBasisSummary ?? ""),
        evidenceConsidered: (content.evidenceConsidered as string[]) ?? [],
        alternativesConsidered: (content.alternativesConsidered as string[]) ?? [],
        aiRoleSummary: String(content.aiRoleSummary ?? ""),
        humanReviewSummary: String(content.humanReviewSummary ?? ""),
        reasonsForDecision: String(content.reasonsForDecision ?? ""),
        affectedPartyRights: String(content.affectedPartyRights ?? ""),
        appealInformation: String(content.appealInformation ?? ""),
        aiSystemDisclosure: String(content.aiSystemDisclosure ?? ""),
        generatedAt: new Date(),
        generatedBy: userId,
        errorMessage: null,
        updatedAt: new Date(),
      }).where(eq(decisionCarTable.decisionId, decisionId));

      logAudit(req, "car.generate", {
        entityType: "decision",
        entityId: decisionId,
        details: { generatedBy: userId },
      });

      // Phase 3 — Chain of Custody: CAR generation
      recordCustodyEvent({
        ...getCustodyCtx(req),
        decisionId,
        action:         "car.generated",
        actionCategory: "car",
        previousValue:  null,
        newValue:       { generatedBy: userId, generatedAt: new Date().toISOString() },
        legalJustification: "إنشاء سجل الإجابة الدستورية بموجب إطار الإفصاح المدني والشفافية الإدارية",
        aiRecommendation:   "أُنشئ بمساعدة الذكاء الاصطناعي وراجعه مسؤولون بشريون",
        humanModification:  null,
      }).catch((e: unknown) => console.error("[custody.car]", e));

      // Phase 3 — Constitutional Memory: CAR event + update decision status to issued
      createOrUpdateMemory({
        decisionId,
        decisionStatus: "issued",
        complianceStatus: "compliant",
        constitutionalStatus: "valid",
      }).catch((e: unknown) => console.error("[memory.car.version]", e));

      recordMemoryEvent({
        decisionId,
        eventType:      "car.generated",
        eventSummaryAr: "إنشاء سجل الإجابة الدستورية — القرار صالح للإفصاح المدني",
        eventSummaryEn: "Constitutional Answer Record generated — decision ready for public disclosure",
        actorId:   String(userId),
        payload:   { generatedAt: new Date().toISOString() },
      }).catch((e: unknown) => console.error("[memory.event.car]", e));

      // Phase 4 — Evidence Ledger: CAR generated
      recordEvidenceEvent({
        decisionId,
        action:             "car.generated",
        eventCategory:      "accountability",
        actor:              String(userId),
        actorRole:          getCustodyCtx(req).userRole ?? null,
        affectedObject:     `car:${decisionId}`,
        affectedObjectType: "car",
        evidenceSummaryAr:  "إنشاء سجل الإجابة الدستورية",
        evidenceSummaryEn:  "Constitutional Answer Record generated",
        metadata:           { generatedAt: new Date().toISOString() },
      }).catch((e: unknown) => console.error("[evidence.car]", e));

      const [car] = await db.select().from(decisionCarTable)
        .where(eq(decisionCarTable.decisionId, decisionId));
      res.json({ car });
    } catch (genErr) {
      const errMsg = genErr instanceof Error ? genErr.message : "Unknown error";
      await db.update(decisionCarTable).set({ status: "error", errorMessage: errMsg.slice(0, 500), updatedAt: new Date() })
        .where(eq(decisionCarTable.decisionId, decisionId));
      console.error("[car.generate]", genErr);
      res.status(500).json({ error: `CAR generation failed: ${errMsg}` });
    }
  } catch (err) {
    console.error("[car.generate.outer]", err);
    res.status(500).json({ error: "Failed to initiate CAR generation" });
  }
});

/**
 * GET /decisions/:id/car
 * Retrieve the Constitutional Answer Record for a decision.
 */
router.get("/decisions/:id/car", requireAnyRole, async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.id as string, 10);
    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { res.status(403).json({ error: "Access denied" }); return; }

    const [car] = await db.select().from(decisionCarTable)
      .where(eq(decisionCarTable.decisionId, decisionId));
    if (!car) { res.status(404).json({ error: "CAR not found" }); return; }

    res.json({ car });
  } catch (err) {
    console.error("[car.get]", err);
    res.status(500).json({ error: "Failed to load CAR" });
  }
});

export default router;
