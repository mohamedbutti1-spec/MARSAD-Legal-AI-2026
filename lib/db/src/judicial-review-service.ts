/**
 * Phase 5 — Constitutional Judicial Intelligence (CJI) — DB Service
 *
 * Pure data layer: collects decision data and persists review results.
 * No AI calls here — the AI logic lives in the API route.
 * Never modifies decision data, DCI, JDP, CAR, custody, or evidence records.
 */
import { createHash }   from "crypto";
import { eq }           from "drizzle-orm";
import { db }           from "./index";
import {
  judicialReviewsTable,
  type JudicialReview,
  type JudicialDimension,
  type ConstitutionalDefect,
  type OutcomePrediction,
  type RemedyRecommendation,
  type RiskLevel,
} from "./schema/judicial-review";
import {
  decisionsTable,
  decisionStagesTable,
  decisionDciTable,
  decisionJdpTable,
  decisionCarTable,
} from "./schema/decisions";
import { getEvidenceChain, verifyEvidenceChain } from "./evidence-service";
import { getDecisionCustody, verifyCustodyChain } from "./custody-service";
import { getConstitutionalMemory }               from "./memory-service";

// ─── Types exported for API route use ─────────────────────────────────────────

export type { JudicialReview };
export type {
  JudicialDimension,
  ConstitutionalDefect,
  OutcomePrediction,
  RemedyRecommendation,
  RiskLevel,
};

export type CjiAnalysisResult = {
  constitutionalRiskScore:    number;
  riskLevel:                  RiskLevel;
  dimensions:                 JudicialDimension[];
  detectedDefects:            ConstitutionalDefect[];
  findingsOfFact:             string[];
  findingsOfLaw:              string[];
  constitutionalObservations: string[];
  aiObservations:             string[];
  humanOversightObservations: string[];
  suggestedJudicialReasoning: string;
  outcomePrediction:          OutcomePrediction;
  remedyRecommendation:       RemedyRecommendation;
};

// ─── Data Collector ───────────────────────────────────────────────────────────

export async function collectDecisionData(
  decisionId: number,
): Promise<Record<string, unknown>> {
  const [
    decisionRows,
    stageRows,
    dciRows,
    jdpRows,
    carRows,
    evidenceChain,
    evidenceVerification,
    custodyChain,
    custodyVerification,
    memory,
  ] = await Promise.all([
    db.select().from(decisionsTable)
       .where(eq(decisionsTable.id, decisionId)),
    db.select().from(decisionStagesTable)
       .where(eq(decisionStagesTable.decisionId, decisionId))
       .orderBy(decisionStagesTable.stageNumber),
    db.select().from(decisionDciTable)
       .where(eq(decisionDciTable.decisionId, decisionId)),
    db.select().from(decisionJdpTable)
       .where(eq(decisionJdpTable.decisionId, decisionId)),
    db.select().from(decisionCarTable)
       .where(eq(decisionCarTable.decisionId, decisionId)),
    getEvidenceChain(decisionId).catch(() => [] as Awaited<ReturnType<typeof getEvidenceChain>>),
    verifyEvidenceChain(decisionId).catch(() => null),
    getDecisionCustody(decisionId).catch(() => [] as Awaited<ReturnType<typeof getDecisionCustody>>),
    verifyCustodyChain(decisionId).catch(() => null),
    getConstitutionalMemory(decisionId).catch(() => null),
  ]);

  const decision = decisionRows[0] ?? null;
  const dci      = dciRows[0]      ?? null;
  const jdp      = jdpRows[0]      ?? null;
  const car      = carRows[0]      ?? null;

  return {
    decision: decision ? {
      id:               decision.id,
      caseNumber:       decision.caseNumber,
      titleAr:          decision.titleAr,
      titleEn:          decision.titleEn,
      status:           decision.status,
      currentStage:     decision.currentStage,
      stagesCompleted:  decision.stagesCompleted,
      organizationUnit: decision.organizationUnit,
      issuingAuthority: decision.issuingAuthority,
      createdAt:        decision.createdAt?.toISOString(),
      updatedAt:        decision.updatedAt?.toISOString(),
    } : null,

    stages: stageRows.map((s) => ({
      stageKey:         s.stageKey,
      stageNumber:      s.stageNumber,
      completedAt:      s.completedAt?.toISOString() ?? null,
      validationStatus: s.validationStatus,
      hasAuditHash:     Boolean(s.auditHash),
      stageData:        s.stageData,
    })),

    dci: dci ? {
      decisionType:                 dci.decisionType,
      competentAuthority:           dci.competentAuthority,
      applicableLegalBasis:         dci.applicableLegalBasis,
      purposeOfDecision:            dci.purposeOfDecision,
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
      qvaResults:                   dci.qvaResults,
      isSealed:                     dci.isSealed,
      sealedAt:                     dci.sealedAt?.toISOString() ?? null,
      currentVersion:               dci.currentVersion,
      versionHistory:               dci.versionHistory,
      completeAuditHash:            dci.completeAuditHash ? "[present]" : null,
    } : null,

    jdp: jdp ? {
      status:                          jdp.status,
      generatedAt:                     jdp.generatedAt?.toISOString() ?? null,
      legalBasis:                      jdp.legalBasis,
      proportionalityAnalysis:         jdp.proportionalityAnalysis,
      aiParticipationExplanation:      jdp.aiParticipationExplanation,
      humanOversightRecord:            jdp.humanOversightRecord,
      constitutionalValidationResults: jdp.constitutionalValidationResults,
      anticipatedJudicialReviewQuestions: jdp.anticipatedJudicialReviewQuestions,
      explainabilityReport:            jdp.explainabilityReport,
    } : null,

    car: car ? {
      status:               car.status,
      factsReliedUpon:      car.factsReliedUpon,
      legalBasisSummary:    car.legalBasisSummary,
      reasonsForDecision:   car.reasonsForDecision,
      aiRoleSummary:        car.aiRoleSummary,
      humanReviewSummary:   car.humanReviewSummary,
      affectedPartyRights:  car.affectedPartyRights,
      appealInformation:    car.appealInformation,
      aiSystemDisclosure:   car.aiSystemDisclosure,
    } : null,

    evidenceChain: {
      totalEvents: evidenceChain.length,
      events: evidenceChain.map((e) => ({
        sequenceNumber: e.sequenceNumber,
        action:         e.action,
        eventCategory:  e.eventCategory,
        actor:          e.actor,
        actorRole:      e.actorRole,
        timestamp:      e.timestamp?.toISOString(),
        summaryAr:      e.evidenceSummaryAr,
      })),
      verification: evidenceVerification ? {
        valid:          evidenceVerification.valid,
        integrityScore: evidenceVerification.integrityScore,
        brokenLinks:    evidenceVerification.brokenLinks,
        hashErrors:     evidenceVerification.hashErrors,
      } : null,
    },

    custodyChain: {
      totalRecords: custodyChain.length,
      verification: custodyVerification ? {
        valid:          custodyVerification.valid,
        recordsChecked: custodyVerification.recordsChecked,
      } : null,
    },

    constitutionalMemory: memory ? {
      memoryId:      memory.current.memoryId,
      archiveStatus: memory.current.archiveStatus,
      sealedAt:      memory.current.sealedAt?.toISOString() ?? null,
      decisionHash:  memory.current.decisionHash ? "[present]" : null,
    } : null,
  };
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

export async function getJudicialReview(
  decisionId: number,
): Promise<JudicialReview | null> {
  const rows = await db
    .select()
    .from(judicialReviewsTable)
    .where(eq(judicialReviewsTable.decisionId, decisionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function markJudicialReviewRunning(
  decisionId: number,
  triggeredBy: string,
): Promise<{ reviewVersion: number }> {
  const existing = await getJudicialReview(decisionId);
  const newVersion = (existing?.reviewVersion ?? 0) + 1;

  if (existing) {
    await db
      .update(judicialReviewsTable)
      .set({
        status:        "running",
        triggeredBy,
        reviewVersion: newVersion,
        errorMessage:  null,
        updatedAt:     new Date(),
      })
      .where(eq(judicialReviewsTable.decisionId, decisionId));
  } else {
    await db.insert(judicialReviewsTable).values({
      decisionId,
      status:        "running",
      reviewVersion: newVersion,
      triggeredBy,
    });
  }

  return { reviewVersion: newVersion };
}

export async function saveJudicialReview(
  decisionId: number,
  result: CjiAnalysisResult,
): Promise<JudicialReview> {
  const now = new Date();
  await db
    .update(judicialReviewsTable)
    .set({
      status:                     "completed",
      generatedAt:                now,
      constitutionalRiskScore:    result.constitutionalRiskScore,
      riskLevel:                  result.riskLevel,
      dimensions:                 result.dimensions,
      detectedDefects:            result.detectedDefects,
      findingsOfFact:             result.findingsOfFact,
      findingsOfLaw:              result.findingsOfLaw,
      constitutionalObservations: result.constitutionalObservations,
      aiObservations:             result.aiObservations,
      humanOversightObservations: result.humanOversightObservations,
      suggestedJudicialReasoning: result.suggestedJudicialReasoning,
      outcomePrediction:          result.outcomePrediction,
      remedyRecommendation:       result.remedyRecommendation,
      errorMessage:               null,
      updatedAt:                  now,
    })
    .where(eq(judicialReviewsTable.decisionId, decisionId));

  return (await getJudicialReview(decisionId))!;
}

export async function markJudicialReviewFailed(
  decisionId: number,
  errorMessage: string,
): Promise<void> {
  await db
    .update(judicialReviewsTable)
    .set({ status: "failed", errorMessage, updatedAt: new Date() })
    .where(eq(judicialReviewsTable.decisionId, decisionId));
}

// ─── Report Builder ───────────────────────────────────────────────────────────

export async function buildJudicialReport(
  decisionId: number,
): Promise<Record<string, unknown>> {
  const [review, data] = await Promise.all([
    getJudicialReview(decisionId),
    collectDecisionData(decisionId),
  ]);

  if (!review || review.status !== "completed") {
    throw new Error("Judicial review not yet completed for this decision");
  }

  const riskEmoji =
    review.riskLevel === "critical" ? "🔴" :
    review.riskLevel === "high"     ? "🟠" :
    review.riskLevel === "moderate" ? "🟡" : "🟢";

  const outcomeLabel: Record<string, string> = {
    likely_lawful:             "Likely Lawful",
    likely_partially_unlawful: "Likely Partially Unlawful",
    likely_void:               "Likely Void",
    requires_further_review:   "Requires Further Review",
  };

  const remedyLabel: Record<string, string> = {
    uphold:                    "Uphold",
    annul:                     "Annul",
    partial_annulment:         "Partial Annulment",
    remit_for_reconsideration: "Remit for Reconsideration",
    request_further_evidence:  "Request Further Evidence",
  };

  const decisionData = data.decision as Record<string, unknown> | null;
  const evidenceData = data.evidenceChain as Record<string, unknown>;
  const custodyData  = data.custodyChain  as Record<string, unknown>;
  const stages       = data.stages        as unknown[];

  const reviewHash = createHash("sha256")
    .update(JSON.stringify({
      decisionId,
      reviewVersion: review.reviewVersion,
      generatedAt:   review.generatedAt?.toISOString(),
      riskScore:     review.constitutionalRiskScore,
      outcome:       review.outcomePrediction?.outcome,
      remedy:        review.remedyRecommendation?.remedy,
    }))
    .digest("hex");

  return {
    packageType:        "MARSAD-CJI-JUDICIAL-REPORT-v5",
    framework:          "Al-Shamsi Constitutional Decision Framework™ — Phase 5 Judicial Intelligence",
    reportGeneratedAt:  new Date().toISOString(),
    reportVersion:      review.reviewVersion,

    cover: {
      caseNumber:             decisionData?.caseNumber ?? "N/A",
      decisionTitle:          decisionData?.titleAr    ?? "N/A",
      decisionStatus:         decisionData?.status     ?? "N/A",
      constitutionalRiskScore: review.constitutionalRiskScore,
      riskLevel:              `${riskEmoji} ${(review.riskLevel ?? "").toUpperCase()}`,
    },

    executiveSummary: {
      outcomePrediction: outcomeLabel[review.outcomePrediction?.outcome ?? ""] ?? "Unknown",
      confidence:        `${review.outcomePrediction?.confidencePercentage ?? 0}%`,
      remedy:            remedyLabel[review.remedyRecommendation?.remedy ?? ""] ?? "Unknown",
      remedyUrgency:     review.remedyRecommendation?.urgency ?? "standard",
      totalDefects:      (review.detectedDefects ?? []).length,
      criticalDefects:   (review.detectedDefects ?? []).filter((d) => d.severity === "critical").length,
    },

    dimensionalAnalysis: {
      dimensions:          review.dimensions ?? [],
      averageRiskScore:    review.constitutionalRiskScore,
      compliantDimensions: (review.dimensions ?? []).filter((d) => d.status === "compliant").length,
      concernedDimensions: (review.dimensions ?? []).filter((d) => d.status !== "compliant" && d.status !== "not_assessed").length,
    },

    constitutionalDefects: {
      total:   (review.detectedDefects ?? []).length,
      items:   review.detectedDefects ?? [],
      summary: (review.detectedDefects ?? []).length === 0
        ? "No constitutional defects detected."
        : `${(review.detectedDefects ?? []).length} defect(s) detected.`,
    },

    judicialOpinion: {
      findingsOfFact:             review.findingsOfFact             ?? [],
      findingsOfLaw:              review.findingsOfLaw              ?? [],
      constitutionalObservations: review.constitutionalObservations ?? [],
      aiObservations:             review.aiObservations             ?? [],
      humanOversightObservations: review.humanOversightObservations ?? [],
      suggestedJudicialReasoning: review.suggestedJudicialReasoning ?? "",
    },

    outcomePrediction:    review.outcomePrediction,
    remedyRecommendation: review.remedyRecommendation,

    sourceSummary: {
      stagesAnalysed: stages.length,
      evidenceEvents: evidenceData.totalEvents,
      custodyRecords: custodyData.totalRecords,
      memoryPresent:  data.constitutionalMemory !== null,
      dciPresent:     data.dci !== null,
      jdpPresent:     data.jdp !== null,
      carPresent:     data.car !== null,
    },

    integrityProof: { reviewHash },
  };
}
