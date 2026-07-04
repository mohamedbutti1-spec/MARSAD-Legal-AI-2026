/**
 * Phase 5 — Constitutional Judicial Intelligence (CJI) API
 *
 * AI-powered constitutional review engine. Judge-only. Read-only.
 *
 *   GET  /judicial-review/:decisionId          — retrieve latest review
 *   POST /judicial-review/:decisionId/run      — trigger AI review generation
 *   GET  /judicial-review/:decisionId/report   — court-ready judicial report
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq } from "drizzle-orm";
import { db, decisionsTable } from "@workspace/db";
import { getPermissions, ALL_ROLES } from "@workspace/db/permissions";
import {
  getJudicialReview,
  markJudicialReviewRunning,
  saveJudicialReview,
  markJudicialReviewFailed,
  buildJudicialReport,
  collectDecisionData,
  type CjiAnalysisResult,
  type JudicialDimension,
  type ConstitutionalDefect,
  type OutcomePrediction,
  type RemedyRecommendation,
  type RiskLevel,
} from "@workspace/db/judicial-review-service";
import { logAudit } from "../middlewares/auditLog";

const router: IRouter = Router();

// ─── Anthropic client (lazy) ──────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRole(req: Request): string {
  const h = req.headers["x-user-role"];
  const r = (Array.isArray(h) ? (h[0] ?? "citizen") : (h ?? "citizen")) as string;
  return ALL_ROLES.includes(r as never) ? r : "citizen";
}

/** Judicial Intelligence is strictly judge-only. */
function requireJudge(req: Request, res: Response, next: NextFunction): void {
  if (getRole(req) !== "judge") {
    res.status(403).json({
      error: "الذكاء القضائي الدستوري — الوصول مقتصر على القضاة فقط",
    });
    return;
  }
  next();
}

async function resolveDecision(
  req: Request,
  res: Response,
): Promise<{ id: number } | null> {
  const raw = parseInt(String(req.params.decisionId ?? ""), 10);
  if (isNaN(raw)) {
    res.status(400).json({ error: "رقم القرار غير صالح" });
    return null;
  }
  const rows = await db
    .select({ id: decisionsTable.id })
    .from(decisionsTable)
    .where(eq(decisionsTable.id, raw))
    .limit(1);
  if (!rows.length) {
    res.status(404).json({ error: "القرار غير موجود" });
    return null;
  }
  return rows[0]!;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/** Trim large fields so the prompt stays within Claude's context limit.
 *  Hard budget: serialised data must not exceed ~20 000 characters. */
const MAX_DATA_CHARS = 20_000;

function truncateStr(s: unknown, max = 400): string | null {
  if (s == null) return null;
  const str = String(s);
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function trimDecisionData(raw: Record<string, unknown>): Record<string, unknown> {
  const stages   = (raw.stages   as Array<Record<string, unknown>> | undefined) ?? [];
  const dci      = (raw.dci      as Record<string, unknown> | null) ?? null;
  const jdp      = (raw.jdp      as Record<string, unknown> | null) ?? null;
  const car      = (raw.car      as Record<string, unknown> | null) ?? null;
  const evChain  = (raw.evidenceChain as Record<string, unknown> | null) ?? null;
  const custody  = (raw.custodyChain  as Record<string, unknown> | null) ?? null;
  const memory   = (raw.constitutionalMemory as Record<string, unknown> | null) ?? null;

  const trimmedDci = dci ? {
    decisionType:                 dci.decisionType,
    competentAuthority:           dci.competentAuthority,
    purposeOfDecision:            truncateStr(dci.purposeOfDecision, 300),
    humanDecisionOwner:           dci.humanDecisionOwner,
    aiParticipationLevel:         dci.aiParticipationLevel,
    humanOversightLevel:          dci.humanOversightLevel,
    explainabilityLevel:          dci.explainabilityLevel,
    transparencyLevel:            dci.transparencyLevel,
    evidenceCompleteness:         dci.evidenceCompleteness,
    proportionalityStatus:        dci.proportionalityStatus,
    legalityStatus:               dci.legalityStatus,
    constitutionalValidationStatus: dci.constitutionalValidationStatus,
    alShamsiFrameworkCompliance:  dci.alShamsiFrameworkCompliance,
    humanInfluenceIndex:          dci.humanInfluenceIndex,
    aiActualInfluence:            dci.aiActualInfluence,
    lsiStatus:                    dci.lsiStatus,
    qvaVarianceLevel:             dci.qvaVarianceLevel,
    qvaRunCount:                  dci.qvaRunCount,
    // qvaResults omitted (can be large); only include summary level
    isSealed:                     dci.isSealed,
    currentVersion:               dci.currentVersion,
    // versionHistory omitted (can be large)
    completeAuditHash:            dci.completeAuditHash ? "[present]" : null,
    applicableLegalBasis:         (dci.applicableLegalBasis as string[] | null)?.slice(0, 5) ?? [],
  } : null;

  const trimmedEvidence = evChain ? {
    totalEvents:  evChain.totalEvents,
    verification: evChain.verification,
    // Only first 10 event summaries
    events: ((evChain.events as Array<Record<string, unknown>>) ?? [])
      .slice(0, 10)
      .map((e) => ({
        sequenceNumber: e.sequenceNumber,
        action:         e.action,
        eventCategory:  e.eventCategory,
        actorRole:      e.actorRole,
        timestamp:      e.timestamp,
      })),
  } : null;

  const trimmedCustody = custody ? {
    totalRecords: custody.totalRecords,
    verification: custody.verification,
  } : null;

  const trimmedMemory = memory ? {
    archiveStatus: memory.archiveStatus,
    sealedAt:      memory.sealedAt,
    decisionHash:  memory.decisionHash,
  } : null;

  const result = {
    decision: raw.decision,
    stages: stages.map((s) => ({
      stageKey:         s.stageKey,
      stageNumber:      s.stageNumber,
      completedAt:      s.completedAt,
      validationStatus: s.validationStatus,
      hasAuditHash:     s.hasAuditHash,
    })),
    dci: trimmedDci,
    jdp: jdp ? {
      status:               jdp.status,
      proportionalityResult: (jdp.proportionalityAnalysis as Record<string, unknown> | null)?.overallConclusion ?? null,
      aiParticipationLevel: (jdp.aiParticipationExplanation as Record<string, unknown> | null)?.participationLevel ?? null,
      humanOversightLevel:  (jdp.humanOversightRecord as Record<string, unknown> | null)?.oversightLevel ?? null,
      constitutionalResult: (jdp.constitutionalValidationResults as Record<string, unknown> | null)?.overallResult ?? null,
    } : null,
    car: car ? {
      status:             car.status,
      factsReliedUpon:    truncateStr(car.factsReliedUpon),
      legalBasisSummary:  truncateStr(car.legalBasisSummary),
      reasonsForDecision: truncateStr(car.reasonsForDecision, 600),
      aiRoleSummary:      truncateStr(car.aiRoleSummary),
      humanReviewSummary: truncateStr(car.humanReviewSummary),
    } : null,
    evidenceChain:        trimmedEvidence,
    custodyChain:         trimmedCustody,
    constitutionalMemory: trimmedMemory,
  };

  // Hard budget: if still too large, strip optional prose fields further
  let serialised = JSON.stringify(result);
  if (serialised.length > MAX_DATA_CHARS) {
    // Drop car and jdp entirely as last resort
    const minimal = { ...result, car: car ? { status: car.status } : null, jdp: jdp ? { status: jdp.status } : null };
    serialised = JSON.stringify(minimal);
    if (serialised.length > MAX_DATA_CHARS) {
      // Absolute fallback: decision + DCI summary only
      return { decision: raw.decision, dci: trimmedDci, stages: result.stages.slice(0, 5), tooLargeForFullAnalysis: true };
    }
    return minimal;
  }

  return result;
}

function buildReviewPrompt(data: Record<string, unknown>): string {
  const trimmed = trimDecisionData(data);

  return `You are a UAE administrative court judge performing constitutional review of an AI-assisted decision. Apply UAE administrative law and the Al-Shamsi Framework™.

Return ONLY a raw JSON object — no markdown, no commentary outside JSON.

== DECISION DATA ==
${JSON.stringify(trimmed)}

== OUTPUT JSON SCHEMA ==
{
  "constitutionalRiskScore": <0-100 integer>,
  "riskLevel": <"low"|"moderate"|"high"|"critical">,
  "dimensions": [
    { "dimension": <one of 16 keys below>, "labelAr": <str>, "labelEn": <str>, "status": <"compliant"|"minor_concern"|"significant_concern"|"deficient"|"not_assessed">, "riskScore": <0-100>, "finding": <1-2 concise sentences>, "legalReference": <str|null> }
  ],
  "detectedDefects": [
    { "defectType": <"missing_reasons"|"proportionality_defect"|"procedural_defect"|"competence_defect"|"constitutional_conflict"|"ai_overreach"|"unlawful_delegation"|"hidden_algorithmic_influence"|"other">, "severity": <"critical"|"major"|"minor"|"advisory">, "titleAr": <str>, "titleEn": <str>, "description": <1-2 sentences>, "affectedDimension": <str|null>, "remedyHint": <1 sentence> }
  ],
  "findingsOfFact": [<3-5 concise strings>],
  "findingsOfLaw": [<3-5 concise strings>],
  "constitutionalObservations": [<2-4 strings>],
  "aiObservations": [<2-3 strings>],
  "humanOversightObservations": [<2-3 strings>],
  "suggestedJudicialReasoning": <150-250 word formal judicial prose string>,
  "outcomePrediction": { "outcome": <"likely_lawful"|"likely_partially_unlawful"|"likely_void"|"requires_further_review">, "confidencePercentage": <0-100>, "reasoning": <2-3 sentences>, "primaryRisk": <str|null> },
  "remedyRecommendation": { "remedy": <"uphold"|"annul"|"partial_annulment"|"remit_for_reconsideration"|"request_further_evidence">, "urgency": <"immediate"|"standard"|"advisory">, "explanation": <2-3 sentences>, "conditions": [<0-3 strings>] }
}

16 dimension keys (ALL must appear): jurisdiction, procedure, form, cause, subject, purpose, human_influence, ai_influence, constitutional_compliance, transparency, explainability, proportionality, algorithmic_bias, due_process, equality, fundamental_rights

RULES: constitutionalRiskScore = avg of dimension riskScores. Pending data lowers confidence. Return ONLY the raw JSON.`;
}

// ─── AI Review Runner ─────────────────────────────────────────────────────────

async function runAiReview(
  decisionId: number,
  triggeredBy: string,
): Promise<Awaited<ReturnType<typeof saveJudicialReview>>> {
  // Mark running in DB
  await markJudicialReviewRunning(decisionId, triggeredBy);

  try {
    // Collect all decision data
    const data = await collectDecisionData(decisionId);

    // Call Claude
    const anthropic = getAnthropic();
    const message   = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: buildReviewPrompt(data) }],
    });

    const rawText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Strip accidental markdown fences
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText) as CjiAnalysisResult;

    // Persist and return
    return saveJudicialReview(decisionId, parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markJudicialReviewFailed(decisionId, msg);
    throw err;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /judicial-review/:decisionId
 * Returns the latest stored review, or { status: "not_run" } if none exists.
 */
router.get(
  "/judicial-review/:decisionId",
  requireJudge,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const decision = await resolveDecision(req, res);
      if (!decision) return;

      const review = await getJudicialReview(decision.id);
      if (!review) {
        res.status(200).json({
          status:    "not_run",
          decisionId: decision.id,
          message:   "لم يتم تشغيل المراجعة بعد. استخدم POST /run لبدء التحليل.",
        });
        return;
      }

      res.json({
        decisionId:              review.decisionId,
        status:                  review.status,
        reviewVersion:           review.reviewVersion,
        generatedAt:             review.generatedAt,
        triggeredBy:             review.triggeredBy,
        constitutionalRiskScore: review.constitutionalRiskScore,
        riskLevel:               review.riskLevel,
        dimensions:              review.dimensions,
        detectedDefects:         review.detectedDefects,
        findingsOfFact:          review.findingsOfFact,
        findingsOfLaw:           review.findingsOfLaw,
        constitutionalObservations: review.constitutionalObservations,
        aiObservations:          review.aiObservations,
        humanOversightObservations: review.humanOversightObservations,
        suggestedJudicialReasoning: review.suggestedJudicialReasoning,
        outcomePrediction:       review.outcomePrediction,
        remedyRecommendation:    review.remedyRecommendation,
        errorMessage:            review.errorMessage,
        acknowledged:            review.acknowledged,
        acknowledgedAt:          review.acknowledgedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
      res.status(500).json({ error: msg });
    }
  },
);

/**
 * POST /judicial-review/:decisionId/run
 * Triggers the AI constitutional review engine.
 * Returns 409 if already running. Awaits the full generation.
 */
router.post(
  "/judicial-review/:decisionId/run",
  requireJudge,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const decision = await resolveDecision(req, res);
      if (!decision) return;

      const existing = await getJudicialReview(decision.id);
      if (existing?.status === "running") {
        res.status(409).json({
          error:  "المراجعة قيد التشغيل بالفعل",
          status: "running",
        });
        return;
      }

      const role   = getRole(req);
      const review = await runAiReview(decision.id, role);

      // Audit: judicial review triggered (fire-and-forget)
      logAudit(req, "judicial_review.run", {
        entityType: "decision",
        entityId:   decision.id,
        details: {
          reviewVersion:           review.reviewVersion,
          constitutionalRiskScore: review.constitutionalRiskScore,
          riskLevel:               review.riskLevel,
          totalDefects:            (review.detectedDefects ?? []).length,
        },
      });

      res.json({
        success:                 true,
        status:                  review.status,
        reviewVersion:           review.reviewVersion,
        generatedAt:             review.generatedAt,
        constitutionalRiskScore: review.constitutionalRiskScore,
        riskLevel:               review.riskLevel,
        outcomePrediction:       review.outcomePrediction,
        remedyRecommendation:    review.remedyRecommendation,
        totalDefects:            (review.detectedDefects ?? []).length,
        criticalDefects:         (review.detectedDefects ?? []).filter((d: ConstitutionalDefect) => d.severity === "critical").length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
      res.status(500).json({ error: msg, status: "failed" });
    }
  },
);

/**
 * GET /judicial-review/:decisionId/report
 * Returns the court-ready judicial intelligence report.
 * Requires a completed review (424 if not yet run).
 */
router.get(
  "/judicial-review/:decisionId/report",
  requireJudge,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const decision = await resolveDecision(req, res);
      if (!decision) return;

      const report = await buildJudicialReport(decision.id);
      res.json(report);
    } catch (err) {
      const msg    = err instanceof Error ? err.message : "خطأ غير متوقع";
      const status = msg.includes("not yet completed") ? 424 : 500;
      res.status(status).json({ error: msg });
    }
  },
);

export default router;
