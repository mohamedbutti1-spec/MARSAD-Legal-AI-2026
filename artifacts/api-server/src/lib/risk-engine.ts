/**
 * NRME — National Risk Modeling Engine
 * ─────────────────────────────────────
 * Computes 15 national risk indices + 3 aggregate scores for every
 * administrative decision. Scoring is driven by:
 *   - The 16 Al-Shamsi Theory dimensions from judicial_reviews.dimensions
 *   - DCI constitutional indicators
 *   - Evidence completeness and chain of custody
 *   - Decision lifecycle stage completion
 *   - AI-generated legal reasoning per index (Anthropic Claude)
 *
 * Every recalculation writes to risk_assessments (upsert) + risk_history (append)
 * + audit_logs + a decision_replay_events row for the Replay Engine.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { eq, desc } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionDciTable,
  judicialReviewsTable,
  evidenceLedgerTable,
  chainOfCustodyTable,
  riskAssessmentsTable,
  riskScenariosTable,
  riskTreatmentsTable,
  decisionReplayEventsTable,
  snapshotRiskHistory,
  auditLogsTable,
  type RiskIndices,
  type RiskIndexScore,
  type RiskAssessmentStatus,
  type RiskLevel,
  type AlShamsiRiskMapping,
} from "@workspace/db";
import type { JudicialDimension } from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskCalculationResult {
  nationalRiskIndex: number;
  administrativeLegitimacyIndex: number;
  decisionConfidenceScore: number;
  riskLevel: RiskLevel;
  indices: RiskIndices;
  alShamsiMapping: AlShamsiRiskMapping[];
  executiveSummaryAr: string;
  executiveSummaryEn: string;
  topRiskDrivers: string[];
  immediateRecommendations: string[];
}

interface DecisionRiskData {
  decision: typeof decisionsTable.$inferSelect;
  dci: typeof decisionDciTable.$inferSelect | null;
  dimensions: JudicialDimension[];
  constitutionalRiskScore: number | null;
  evidenceCount: number;
  custodyEventCount: number;
  stagesCompleted: string[];
  treatmentCount: number;
  completedTreatmentCount: number;
}

// ─── Al-Shamsi → Index Mapping ────────────────────────────────────────────────
// Each Al-Shamsi dimension drives one or more NRME indices.
// Weights (0.0–1.0) define contribution strength.

const DIM_TO_INDEX_WEIGHTS: Record<string, Record<string, number>> = {
  jurisdiction:             { judicialChallengeProbability: 0.8, constitutionalImpact: 0.6, likelihood: 0.4 },
  procedure:                { operationalContinuity: 0.7, judicialChallengeProbability: 0.5, detectability: 0.3 },
  form:                     { constitutionalImpact: 0.7, judicialChallengeProbability: 0.5 },
  cause:                    { likelihood: 0.8, impact: 0.5, judicialChallengeProbability: 0.4 },
  subject:                  { impact: 0.7, nationalSecurityImpact: 0.5, financialImpact: 0.4 },
  purpose:                  { publicTrustImpact: 0.7, reputationImpact: 0.5, likelihood: 0.3 },
  human_influence:          { humanRightsImpact: 0.6, controllability: 0.5, detectability: 0.4 },
  ai_influence:             { aiBiasRisk: 0.8, digitalSovereigntyRisk: 0.6, detectability: 0.5 },
  constitutional_compliance:{ constitutionalImpact: 0.9, judicialChallengeProbability: 0.7, likelihood: 0.5 },
  transparency:             { reputationImpact: 0.7, publicTrustImpact: 0.6, detectability: 0.5 },
  explainability:           { publicTrustImpact: 0.6, aiBiasRisk: 0.4, reputationImpact: 0.5 },
  proportionality:          { judicialChallengeProbability: 0.8, constitutionalImpact: 0.6, humanRightsImpact: 0.5 },
  algorithmic_bias:         { aiBiasRisk: 0.9, digitalSovereigntyRisk: 0.7, humanRightsImpact: 0.5 },
  due_process:              { humanRightsImpact: 0.8, judicialChallengeProbability: 0.6, impact: 0.4 },
  equality:                 { humanRightsImpact: 0.7, publicTrustImpact: 0.5, reputationImpact: 0.4 },
  fundamental_rights:       { humanRightsImpact: 0.9, constitutionalImpact: 0.7, nationalSecurityImpact: 0.4 },
};

// ─── Status → Risk Score Mapping ──────────────────────────────────────────────

function dimStatusToRisk(status: string): number {
  const map: Record<string, number> = {
    compliant:           5,
    minor_concern:       35,
    significant_concern: 65,
    deficient:           90,
    not_assessed:        50,
  };
  return map[status] ?? 50;
}

function dciValueToRisk(field: string, value: string | null | undefined): number {
  if (!value || value === "pending") return 40;
  const riskMaps: Record<string, Record<string, number>> = {
    aiParticipationLevel:  { none: 5, advisory: 15, analytical: 25, drafting: 40, comprehensive: 55 },
    humanOversightLevel:   { full: 5, substantial: 20, partial: 45, minimal: 75 },
    explainabilityLevel:   { high: 5, adequate: 20, partial: 50, insufficient: 80 },
    transparencyLevel:     { high: 5, adequate: 20, partial: 50, insufficient: 80 },
    evidenceCompleteness:  { complete: 5, substantial: 20, partial: 50, insufficient: 85 },
    proportionalityStatus: { proportionate: 5, marginally_proportionate: 35, disproportionate: 80 },
    legalityStatus:        { confirmed: 5, questionable: 55, violated: 95 },
    constitutionalValidationStatus: { passed: 5, failed: 85 },
    alShamsiFrameworkCompliance:    { full: 5, substantial: 20, partial: 50, non_compliant: 90 },
    lsiStatus:             { stable: 5, variable: 40, highly_variable: 80 },
    qvaVarianceLevel:      { low: 5, moderate: 40, high: 80 },
  };
  return riskMaps[field]?.[value] ?? 40;
}

// ─── Deterministic Score Computation ─────────────────────────────────────────

function computeRawIndices(data: DecisionRiskData): Record<string, number> {
  const dims = data.dimensions;
  const dci = data.dci;

  // Build dimension risk map
  const dimRisk: Record<string, number> = {};
  for (const d of dims) {
    dimRisk[d.dimension] = d.riskScore ?? dimStatusToRisk(d.status);
  }

  // Helper: weighted average of dimension scores for an index
  function weightedDimScore(indexKey: string): number {
    let total = 0;
    let weight = 0;
    for (const [dim, weights] of Object.entries(DIM_TO_INDEX_WEIGHTS)) {
      if (weights[indexKey]) {
        const score = dimRisk[dim] ?? 40;
        total += score * weights[indexKey];
        weight += weights[indexKey];
      }
    }
    return weight > 0 ? total / weight : 40;
  }

  // Evidence and custody bonuses
  const evidenceBonus = Math.min(20, data.evidenceCount * 2);
  const custodyBonus  = Math.min(15, data.custodyEventCount * 1.5);
  const stageBonus    = Math.min(25, data.stagesCompleted.length * 2.5);
  const treatmentBonus = data.completedTreatmentCount > 0
    ? Math.min(20, data.completedTreatmentCount * 5) : 0;

  // DCI-derived adjustments
  const legalityRisk       = dci ? dciValueToRisk("legalityStatus", dci.legalityStatus) : 50;
  const propRisk           = dci ? dciValueToRisk("proportionalityStatus", dci.proportionalityStatus) : 50;
  const evidenceRisk       = dci ? dciValueToRisk("evidenceCompleteness", dci.evidenceCompleteness) : 50;
  const constitutionRisk   = dci ? dciValueToRisk("constitutionalValidationStatus", dci.constitutionalValidationStatus) : 50;
  const alShamsiRisk       = dci ? dciValueToRisk("alShamsiFrameworkCompliance", dci.alShamsiFrameworkCompliance) : 50;
  const transparencyRisk   = dci ? dciValueToRisk("transparencyLevel", dci.transparencyLevel) : 50;
  const explainabilityRisk = dci ? dciValueToRisk("explainabilityLevel", dci.explainabilityLevel) : 50;
  const humanOversightRisk = dci ? dciValueToRisk("humanOversightLevel", dci.humanOversightLevel) : 50;
  const aiParticipationRisk= dci ? dciValueToRisk("aiParticipationLevel", dci.aiParticipationLevel) : 50;
  const lsiRisk            = dci ? dciValueToRisk("lsiStatus", dci.lsiStatus) : 50;

  const constitutionalBase = data.constitutionalRiskScore ?? constitutionRisk;

  // Compute each of 15 indices
  const raw: Record<string, number> = {
    likelihood: clamp(
      (weightedDimScore("likelihood") * 0.5 + legalityRisk * 0.3 + constitutionalBase * 0.2)
      - (stageBonus * 0.5),
    ),
    impact: clamp(
      (weightedDimScore("impact") * 0.5 + constitutionalBase * 0.3 + evidenceRisk * 0.2)
      - treatmentBonus,
    ),
    velocity: clamp(
      (weightedDimScore("velocity") * 0.6 + (100 - stageBonus * 2) * 0.4)
      - custodyBonus,
    ),
    detectability: clamp(
      (weightedDimScore("detectability") * 0.5 + transparencyRisk * 0.3 + explainabilityRisk * 0.2)
      - evidenceBonus,
    ),
    controllability: clamp(
      (weightedDimScore("controllability") * 0.4 + humanOversightRisk * 0.4 + aiParticipationRisk * 0.2)
      - treatmentBonus * 1.5,
    ),
    nationalSecurityImpact: clamp(
      (weightedDimScore("nationalSecurityImpact") * 0.6 + constitutionalBase * 0.4)
      - stageBonus * 0.3,
    ),
    constitutionalImpact: clamp(
      (constitutionalBase * 0.5 + alShamsiRisk * 0.3 + legalityRisk * 0.2)
      - (dci?.constitutionalValidationStatus === "passed" ? 20 : 0),
    ),
    financialImpact: clamp(
      (weightedDimScore("financialImpact") * 0.7 + evidenceRisk * 0.3)
      - treatmentBonus,
    ),
    reputationImpact: clamp(
      (transparencyRisk * 0.4 + weightedDimScore("reputationImpact") * 0.4 + propRisk * 0.2)
      - custodyBonus * 0.5,
    ),
    publicTrustImpact: clamp(
      (weightedDimScore("publicTrustImpact") * 0.5 + transparencyRisk * 0.3 + explainabilityRisk * 0.2)
      - evidenceBonus * 0.5,
    ),
    humanRightsImpact: clamp(
      (weightedDimScore("humanRightsImpact") * 0.6 + humanOversightRisk * 0.2 + constitutionalBase * 0.2)
      - (dci?.humanOversightLevel === "full" ? 15 : 0),
    ),
    aiBiasRisk: clamp(
      (aiParticipationRisk * 0.5 + weightedDimScore("aiBiasRisk") * 0.5)
      - (dci?.aiActualInfluence === "confirmed_human_direction" ? 20 : 0),
    ),
    digitalSovereigntyRisk: clamp(
      (weightedDimScore("digitalSovereigntyRisk") * 0.6 + aiParticipationRisk * 0.4)
      - stageBonus * 0.2,
    ),
    operationalContinuity: clamp(
      (weightedDimScore("operationalContinuity") * 0.5 + (100 - stageBonus * 3) * 0.3 + legalityRisk * 0.2)
      - custodyBonus,
    ),
    judicialChallengeProbability: clamp(
      (legalityRisk * 0.35 + constitutionalBase * 0.3 + propRisk * 0.2 + lsiRisk * 0.15)
      - (dci?.constitutionalValidationStatus === "passed" ? 25 : 0)
      - treatmentBonus * 0.5,
    ),
  };

  return raw;
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v * 10) / 10));
}

// ─── Aggregate Score Computation ──────────────────────────────────────────────

function computeAggregates(
  raw: Record<string, number>,
  dci: typeof decisionDciTable.$inferSelect | null,
): { nri: number; ali: number; dcs: number; riskLevel: RiskLevel } {
  // NRI: weighted average of all 15 indices (higher = more risky)
  const nriWeights: Record<string, number> = {
    likelihood: 0.10, impact: 0.10, nationalSecurityImpact: 0.10,
    constitutionalImpact: 0.10, judicialChallengeProbability: 0.10,
    humanRightsImpact: 0.08, publicTrustImpact: 0.08, aiBiasRisk: 0.08,
    financialImpact: 0.06, reputationImpact: 0.05, digitalSovereigntyRisk: 0.05,
    velocity: 0.04, detectability: 0.03, controllability: 0.02, operationalContinuity: 0.01,
  };
  let nri = 0;
  for (const [key, w] of Object.entries(nriWeights)) {
    nri += (raw[key] ?? 50) * w;
  }
  nri = Math.round(nri * 10) / 10;

  // ALI: 0–100 (100 = fully legitimate) — inverse of constitutional/legal risks
  let ali = 100
    - (raw.constitutionalImpact ?? 50) * 0.30
    - (raw.judicialChallengeProbability ?? 50) * 0.25
    - (raw.humanRightsImpact ?? 50) * 0.20
    - (raw.likelihood ?? 50) * 0.15
    - (raw.publicTrustImpact ?? 50) * 0.10;
  ali = Math.max(0, Math.min(100, Math.round(ali * 10) / 10));

  // DCS: confidence based on evidence quality, oversight, and constitutional compliance
  const constitutionPass = dci?.constitutionalValidationStatus === "passed" ? 20 : 0;
  const oversightBonus   = dci?.humanOversightLevel === "full" ? 15
                         : dci?.humanOversightLevel === "substantial" ? 8 : 0;
  const sealBonus        = dci?.isSealed ? 10 : 0;
  let dcs = 60
    - (raw.constitutionalImpact ?? 50) * 0.20
    - (raw.aiBiasRisk ?? 50) * 0.10
    - (raw.detectability ?? 50) * 0.10
    + constitutionPass + oversightBonus + sealBonus;
  dcs = Math.max(0, Math.min(100, Math.round(dcs * 10) / 10));

  const riskLevel: RiskLevel =
    nri >= 75 ? "critical" :
    nri >= 55 ? "high" :
    nri >= 35 ? "moderate" : "low";

  return { nri, ali, dcs, riskLevel };
}

// ─── Al-Shamsi Mapping Builder ────────────────────────────────────────────────

function buildAlShamsiMapping(dimensions: JudicialDimension[]): AlShamsiRiskMapping[] {
  return dimensions.map((d) => ({
    dimension: d.dimension,
    riskScore: d.riskScore ?? dimStatusToRisk(d.status),
    status: d.status,
    finding: d.finding,
    drivesIndices: Object.keys(DIM_TO_INDEX_WEIGHTS[d.dimension] ?? {}),
  }));
}

// ─── AI Reasoning Generator ───────────────────────────────────────────────────

async function generateAiReasoning(
  data: DecisionRiskData,
  raw: Record<string, number>,
  aggregates: { nri: number; ali: number; dcs: number; riskLevel: RiskLevel },
): Promise<{
  indexReasons: Record<string, { reason: string; alShamsiDrivers: string[]; legalCitations: string[] }>;
  executiveSummaryAr: string;
  executiveSummaryEn: string;
  immediateRecommendations: string[];
}> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const topIndices = Object.entries(raw)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${v}/100`)
    .join(", ");

  const dimSummary = data.dimensions
    .map((d) => `${d.dimension}(${d.status}, risk=${d.riskScore ?? dimStatusToRisk(d.status)})`)
    .join(", ");

  const systemPrompt = `You are a UAE Government Constitutional Risk Analyst operating within the MARSAD National Risk Modeling Engine (NRME). 
You analyze administrative decisions under the M. Al-Shamsi Constitutional Framework.

DECISION CONTEXT:
- Case: ${data.decision.caseNumber}
- Title: ${data.decision.titleAr}
- Type: ${data.decision.decisionType}
- Organization: ${data.decision.organizationUnit}
- Status: ${data.decision.status}
- Jurisdiction: ${data.decision.jurisdiction}
- DCI Constitutional Validation: ${data.dci?.constitutionalValidationStatus ?? "pending"}
- DCI Al-Shamsi Compliance: ${data.dci?.alShamsiFrameworkCompliance ?? "pending"}
- Al-Shamsi Dimensions: ${dimSummary}
- Evidence Items: ${data.evidenceCount}
- Chain of Custody Events: ${data.custodyEventCount}

COMPUTED SCORES:
- National Risk Index (NRI): ${aggregates.nri}/100 (${aggregates.riskLevel})
- Administrative Legitimacy Index (ALI): ${aggregates.ali}/100
- Decision Confidence Score (DCS): ${aggregates.dcs}/100
- Top Risk Indices: ${topIndices}`;

  const userPrompt = `Generate a structured risk analysis in JSON format for this administrative decision.

Required output format (strict JSON, no markdown):
{
  "indexReasons": {
    "likelihood": { "reason": "<Arabic legal reasoning citing UAE Constitutional articles and administrative law principles, 2-3 sentences>", "alShamsiDrivers": ["dimension_key", ...], "legalCitations": ["UAE Constitution Art. X", ...] },
    "impact": { ... },
    "velocity": { ... },
    "detectability": { ... },
    "controllability": { ... },
    "nationalSecurityImpact": { ... },
    "constitutionalImpact": { ... },
    "financialImpact": { ... },
    "reputationImpact": { ... },
    "publicTrustImpact": { ... },
    "humanRightsImpact": { ... },
    "aiBiasRisk": { ... },
    "digitalSovereigntyRisk": { ... },
    "operationalContinuity": { ... },
    "judicialChallengeProbability": { ... }
  },
  "executiveSummaryAr": "<3-4 sentences in Arabic summarizing the risk profile, citing specific constitutional articles>",
  "executiveSummaryEn": "<3-4 sentences in English summarizing the risk profile>",
  "immediateRecommendations": ["<Arabic recommendation 1>", "<Arabic recommendation 2>", "<Arabic recommendation 3>"]
}

For each reason:
- Cite specific UAE Constitutional articles (e.g., المادة 25، 40، 55 من دستور الإمارات)
- Reference UAE Federal Law No. 11 of 2008 on Administrative Decisions
- Reference UAE Federal Decree-Law No. 37 of 2022 on Governance
- Reference the Al-Shamsi Framework dimensions that drove the score
- Use Arabic for reason fields
- Keep each reason to 2-3 sentences maximum`;

  let parsed: {
    indexReasons: Record<string, { reason: string; alShamsiDrivers: string[]; legalCitations: string[] }>;
    executiveSummaryAr: string;
    executiveSummaryEn: string;
    immediateRecommendations: string[];
  } | null = null;

  try {
    const msg = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    // Strip markdown code fences if present
    const clean = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const candidate = JSON.parse(clean);
    // Validate shape: indexReasons must be a plain object with at least one key
    if (
      candidate &&
      typeof candidate === "object" &&
      candidate.indexReasons &&
      typeof candidate.indexReasons === "object" &&
      !Array.isArray(candidate.indexReasons) &&
      Object.keys(candidate.indexReasons).length > 0 &&
      typeof candidate.executiveSummaryAr === "string" &&
      Array.isArray(candidate.immediateRecommendations)
    ) {
      parsed = candidate as typeof parsed;
    } else {
      console.warn("[risk-engine] AI returned parseable JSON but wrong shape; using fallback");
    }
  } catch (err) {
    console.error("[risk-engine] AI reasoning failed:", err);
  }

  // Fallback if AI fails or returns wrong shape
  if (!parsed) {
    const fallbackReason = (key: string) => ({
      reason: `تم احتساب مؤشر ${key} بناءً على أبعاد نظرية الشامسي وبيانات القرار الإداري وفقاً للمعايير الدستورية الإماراتية.`,
      alShamsiDrivers: Object.keys(DIM_TO_INDEX_WEIGHTS).filter((d) => DIM_TO_INDEX_WEIGHTS[d][key]),
      legalCitations: ["المادة 25 من دستور الإمارات", "قانون اتحادي رقم 11 لسنة 2008 في شأن القرارات الإدارية"],
    });
    parsed = {
      indexReasons: Object.fromEntries(Object.keys(raw).map((k) => [k, fallbackReason(k)])),
      executiveSummaryAr: `يعكس الملف الرئيسي لمخاطر القرار ${data.decision.caseNumber} مستوى خطر ${aggregates.riskLevel} بمؤشر مخاطر وطني قدره ${aggregates.nri}/100. يتطلب هذا القرار مراجعة دقيقة وفق إطار الشامسي الدستوري.`,
      executiveSummaryEn: `Decision ${data.decision.caseNumber} presents a ${aggregates.riskLevel} risk profile with a National Risk Index of ${aggregates.nri}/100. This decision requires careful review under the Al-Shamsi Constitutional Framework.`,
      immediateRecommendations: [
        "مراجعة الأبعاد الدستورية عالية المخاطر وفق إطار الشامسي",
        "تعزيز الرقابة البشرية على مراحل القرار الحرجة",
        "توثيق الإجراءات الاحترازية في سجل إدارة المخاطر",
      ],
    };
  }

  return parsed;
}

// ─── Scenario Generator ───────────────────────────────────────────────────────

async function generateRiskScenarios(
  decisionId: number,
  data: DecisionRiskData,
  raw: Record<string, number>,
): Promise<void> {
  // Only generate scenarios if there are no existing ones (idempotent)
  const existing = await db
    .select({ id: riskScenariosTable.id })
    .from(riskScenariosTable)
    .where(eq(riskScenariosTable.decisionId, decisionId))
    .limit(1);
  if (existing.length > 0) return;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Pick the 3 highest-risk indices for scenario generation
  const top3 = Object.entries(raw)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}/100`);

  try {
    const msg = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: `Generate 3 risk scenarios in JSON for UAE government decision ${data.decision.caseNumber} (${data.decision.titleAr}).
Top risk indices: ${top3.join(", ")}.
Decision type: ${data.decision.decisionType}, Organization: ${data.decision.organizationUnit}.

Output strict JSON array:
[
  {
    "titleAr": "<scenario title in Arabic>",
    "scenarioType": "judicial_challenge|constitutional_defect|public_trust_failure|operational_failure|ai_misuse",
    "probability": <0-100>,
    "severity": "low|moderate|high|critical",
    "descriptionAr": "<2-sentence description in Arabic>",
    "legalImplication": "<specific UAE law/article>",
    "preventiveActionAr": "<1 sentence in Arabic>",
    "primaryDimension": "<Al-Shamsi dimension key>"
  }
]`,
      }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "[]";
    const clean = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const scenarios = JSON.parse(clean) as Array<{
      titleAr: string; scenarioType: string; probability: number;
      severity: string; descriptionAr: string; legalImplication: string;
      preventiveActionAr: string; primaryDimension: string;
    }>;

    for (const s of scenarios) {
      await db.insert(riskScenariosTable).values({
        decisionId,
        titleAr: s.titleAr ?? "سيناريو مخاطر",
        scenarioType: s.scenarioType ?? "operational_failure",
        probability: typeof s.probability === "number" ? s.probability : null,
        severity: s.severity ?? "moderate",
        descriptionAr: s.descriptionAr ?? null,
        legalImplication: s.legalImplication ?? null,
        preventiveActionAr: s.preventiveActionAr ?? null,
        primaryDimension: s.primaryDimension ?? null,
        status: "active",
      }).onConflictDoNothing();
    }
  } catch (err) {
    console.error("[risk-engine] Scenario generation failed:", err);
  }
}

// ─── Data Collector ───────────────────────────────────────────────────────────

async function collectData(decisionId: number): Promise<DecisionRiskData> {
  const [
    decisionRows,
    dciRows,
    judicialRows,
    evidenceRows,
    custodyRows,
    treatmentRows,
  ] = await Promise.all([
    db.select().from(decisionsTable).where(eq(decisionsTable.id, decisionId)).limit(1),
    db.select().from(decisionDciTable).where(eq(decisionDciTable.decisionId, decisionId)).limit(1),
    db.select().from(judicialReviewsTable).where(eq(judicialReviewsTable.decisionId, decisionId)).limit(1),
    db.select({ id: evidenceLedgerTable.id }).from(evidenceLedgerTable).where(eq(evidenceLedgerTable.decisionId, decisionId)),
    db.select({ id: chainOfCustodyTable.id }).from(chainOfCustodyTable).where(eq(chainOfCustodyTable.decisionId, decisionId)),
    db.select({ status: riskTreatmentsTable.status }).from(riskTreatmentsTable).where(eq(riskTreatmentsTable.decisionId, decisionId)),
  ]);

  const decision = decisionRows[0];
  if (!decision) throw new Error(`Decision ${decisionId} not found`);

  const dci = dciRows[0] ?? null;
  const jr  = judicialRows[0] ?? null;

  return {
    decision,
    dci,
    dimensions: (jr?.dimensions ?? []) as JudicialDimension[],
    constitutionalRiskScore: jr?.constitutionalRiskScore ?? null,
    evidenceCount:  evidenceRows.length,
    custodyEventCount: custodyRows.length,
    stagesCompleted: (decision.stagesCompleted as string[]) ?? [],
    treatmentCount: treatmentRows.length,
    completedTreatmentCount: treatmentRows.filter((t) => t.status === "completed").length,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Full risk assessment computation for a decision.
 * 1. Collect decision data from DB
 * 2. Compute 15 raw index scores deterministically
 * 3. Compute 3 aggregate scores
 * 4. Generate AI reasoning (Anthropic)
 * 5. Upsert risk_assessments
 * 6. Snapshot to risk_history
 * 7. Write replay event
 * 8. Generate risk scenarios (idempotent)
 */
export async function calculateRiskScores(
  decisionId: number,
  opts: {
    triggeredBy?: string;
    triggeredByRole?: string;
    triggerReason?: string;
    logAuditFn?: (action: string, details: Record<string, unknown>) => void;
  } = {},
): Promise<RiskCalculationResult> {
  const triggeredBy   = opts.triggeredBy   ?? "system";
  const triggerReason = opts.triggerReason ?? "manual_recalculate";

  // Mark as calculating
  await db
    .update(riskAssessmentsTable)
    .set({ status: "calculating" as RiskAssessmentStatus, updatedAt: new Date() })
    .where(eq(riskAssessmentsTable.decisionId, decisionId));

  let data: DecisionRiskData;
  try {
    data = await collectData(decisionId);
  } catch (err) {
    await db.update(riskAssessmentsTable).set({
      status: "failed" as RiskAssessmentStatus,
      errorMessage: (err instanceof Error) ? err.message : String(err),
      updatedAt: new Date(),
    }).where(eq(riskAssessmentsTable.decisionId, decisionId));
    throw err;
  }

  // Deterministic scoring
  const raw = computeRawIndices(data);
  const { nri, ali, dcs, riskLevel } = computeAggregates(raw, data.dci);

  // AI reasoning
  const aiResult = await generateAiReasoning(data, raw, { nri, ali, dcs, riskLevel });

  // Build full indices structure
  const indices: RiskIndices = {} as RiskIndices;
  for (const key of Object.keys(raw) as Array<keyof RiskIndices>) {
    const aiData = aiResult.indexReasons[key] ?? {
      reason: `تم احتساب المؤشر بناءً على بيانات القرار والأبعاد الدستورية.`,
      alShamsiDrivers: [],
      legalCitations: [],
    };
    const prev = null; // TODO: fetch from history for delta
    (indices as Record<string, RiskIndexScore>)[key] = {
      score:             raw[key] ?? 50,
      reason:            aiData.reason,
      alShamsiDrivers:   aiData.alShamsiDrivers ?? [],
      legalCitations:    aiData.legalCitations ?? [],
      delta:             prev,
    };
  }

  const alShamsiMapping = buildAlShamsiMapping(data.dimensions);
  const topRiskDrivers  = Object.entries(raw).sort(([, a], [, b]) => b - a).slice(0, 3).map(([k]) => k);

  // Fetch current version for incrementing
  const [current] = await db
    .select({ assessmentVersion: riskAssessmentsTable.assessmentVersion })
    .from(riskAssessmentsTable)
    .where(eq(riskAssessmentsTable.decisionId, decisionId))
    .limit(1);
  const nextVersion = (current?.assessmentVersion ?? 0) + 1;

  // Upsert risk_assessments
  await db
    .insert(riskAssessmentsTable)
    .values({
      decisionId,
      status:                       "ready" as RiskAssessmentStatus,
      assessmentVersion:            nextVersion,
      calculatedAt:                 new Date(),
      nationalRiskIndex:            nri,
      riskLevel,
      administrativeLegitimacyIndex: ali,
      decisionConfidenceScore:      dcs,
      indices,
      alShamsiMapping,
      executiveSummaryAr:           aiResult.executiveSummaryAr,
      executiveSummaryEn:           aiResult.executiveSummaryEn,
      topRiskDrivers,
      immediateRecommendations:     aiResult.immediateRecommendations,
      triggerReason,
      triggeredBy,
      errorMessage:                 null,
      updatedAt:                    new Date(),
    })
    .onConflictDoUpdate({
      target: riskAssessmentsTable.decisionId,
      set: {
        status:                       "ready" as RiskAssessmentStatus,
        assessmentVersion:            nextVersion,
        calculatedAt:                 new Date(),
        nationalRiskIndex:            nri,
        riskLevel,
        administrativeLegitimacyIndex: ali,
        decisionConfidenceScore:      dcs,
        indices,
        alShamsiMapping,
        executiveSummaryAr:           aiResult.executiveSummaryAr,
        executiveSummaryEn:           aiResult.executiveSummaryEn,
        topRiskDrivers,
        immediateRecommendations:     aiResult.immediateRecommendations,
        triggerReason,
        triggeredBy,
        errorMessage:                 null,
        updatedAt:                    new Date(),
      },
    });

  // Snapshot to history
  await snapshotRiskHistory({
    decisionId,
    assessmentVersion: nextVersion,
    nationalRiskIndex: nri,
    administrativeLegitimacyIndex: ali,
    decisionConfidenceScore: dcs,
    riskLevel,
    indicesSnapshot: indices,
    triggerReason,
    triggeredBy,
    triggeredByRole: opts.triggeredByRole ?? null,
  });

  // Write to Replay Engine — virtual stage replay_12_legitimacy_index
  // (recordReplayEvent only maps decision stage keys; virtual stages must be written directly)
  (async () => {
    try {
      const recordedAt = new Date().toISOString();
      const content = {
        nationalRiskIndex: nri,
        administrativeLegitimacyIndex: ali,
        decisionConfidenceScore: dcs,
        riskLevel,
        topRiskDrivers,
      };
      const auditHash = createHash("sha256")
        .update(JSON.stringify({ decisionId, replayStageKey: "replay_12_legitimacy_index", actor: triggeredBy, recordedAt, content }))
        .digest("hex");
      await db.insert(decisionReplayEventsTable).values({
        decisionId,
        replayStageKey:        "replay_12_legitimacy_index",
        sourceStageKey:        "nrme_risk_assessment",
        actor:                 triggeredBy,
        actorRole:             opts.triggeredByRole ?? null,
        aiModelName:           "claude-3-5-haiku-20241022",
        reasoningNarrative:    aiResult.executiveSummaryAr,
        legalReferences:       ["قانون اتحادي رقم 11 لسنة 2008", "قانون اتحادي بالمرسوم رقم 37 لسنة 2022"],
        constitutionalReferences: ["المادة 25 من دستور الإمارات", "المادة 40 من دستور الإمارات"],
        riskIndicators:        topRiskDrivers,
        alShamsiDimensions:    Object.fromEntries(data.dimensions.map((d) => [d.dimension, d.status])),
        confidenceScore:       dcs / 100,
        auditHash,
      }).onConflictDoNothing();
    } catch (e) {
      console.error("[risk-engine] replay event write failed:", e);
    }
  })();

  // Generate scenarios (idempotent)
  generateRiskScenarios(decisionId, data, raw).catch((e) =>
    console.error("[risk-engine] scenario gen failed:", e),
  );

  return {
    nationalRiskIndex: nri,
    administrativeLegitimacyIndex: ali,
    decisionConfidenceScore: dcs,
    riskLevel,
    indices,
    alShamsiMapping,
    executiveSummaryAr: aiResult.executiveSummaryAr,
    executiveSummaryEn: aiResult.executiveSummaryEn,
    topRiskDrivers,
    immediateRecommendations: aiResult.immediateRecommendations,
  };
}
