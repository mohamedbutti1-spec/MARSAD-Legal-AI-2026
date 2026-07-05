/**
 * Phase 44 — Judicial Digital Twin (JDT) — DB Service
 *
 * Pure data layer: collects decision data for AI analysis and persists results.
 * No AI calls here — AI logic lives in the API route (jdt.ts).
 * Never modifies decision data, DCI, JDP, CAR, custody, evidence, or replay records.
 */
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  jdtSimulationsTable,
  type JdtSimulation,
  type JdtSimulationInsert,
  type JdtReviewStageResult,
  type JdtShamsiDimensionResult,
  type JdtCorrectiveAction,
  type JdtRiskLevel,
  type JdtStageOutcome,
} from "./schema/jdt";
import {
  decisionsTable,
  decisionStagesTable,
  decisionDciTable,
  decisionJdpTable,
  decisionCarTable,
} from "./schema/decisions";
import { constitutionalAssessmentsTable } from "./schema/cil";
import { getEvidenceChain } from "./evidence-service";
import { getDecisionCustody } from "./custody-service";
import { getReplayEvents } from "./replay-service";
import { getRiskAssessment } from "./risk-service";

// ─── Re-exported types ────────────────────────────────────────────────────────

export type { JdtSimulation };
export type { JdtReviewStageResult, JdtShamsiDimensionResult, JdtCorrectiveAction, JdtRiskLevel };

export type JdtAnalysisResult = {
  reviewStages:              JdtReviewStageResult[];
  shamsiDimensions:          JdtShamsiDimensionResult[];
  shamsiOverallScore:        number;
  constitutionalScore:       number;
  constitutionalOutcome:     "pass" | "partial" | "fail";
  constitutionalReasoning:   string;
  riskIntegrationScore:      number;
  riskReasoning:             string;
  probabilityAnnulment:      number;
  probabilityDismissal:      number;
  probabilityCorrection:     number;
  judicialSuccessProbability:number;
  overallRiskLevel:          JdtRiskLevel;
  judicialReasoning:         string;
  strengths:                 string[];
  weaknesses:                string[];
  missingEvidence:           string[];
  correctiveActions:         JdtCorrectiveAction[];
  overallAssessment:         string;
  cilIntegration: {
    cilScore:      number | null;
    cilRiskLevel:  string | null;
    alignmentNote: string;
  };
  nrmeIntegration: {
    nriScore:      number | null;
    riskLevel:     string | null;
    alignmentNote: string;
  };
  replayIntegration: {
    stagesAnalysed:    number;
    criticalStageKeys: string[];
    replayHash:        string;
  };
};

// ─── Data Collector (for AI prompt) ──────────────────────────────────────────

export async function collectJdtDecisionData(
  decisionId: number,
): Promise<Record<string, unknown>> {
  const [
    decisionRows,
    stageRows,
    dciRows,
    jdpRows,
    carRows,
    cilRows,
    riskAssessment,
    replayEvents,
    evidenceChain,
    custodyChain,
  ] = await Promise.all([
    db.select().from(decisionsTable).where(eq(decisionsTable.id, decisionId)),
    db.select().from(decisionStagesTable)
       .where(eq(decisionStagesTable.decisionId, decisionId))
       .orderBy(decisionStagesTable.stageNumber),
    db.select().from(decisionDciTable).where(eq(decisionDciTable.decisionId, decisionId)),
    db.select().from(decisionJdpTable).where(eq(decisionJdpTable.decisionId, decisionId)),
    db.select().from(decisionCarTable).where(eq(decisionCarTable.decisionId, decisionId)),
    db.select().from(constitutionalAssessmentsTable)
       .where(eq(constitutionalAssessmentsTable.decisionId, decisionId))
       .limit(1)
       .catch(() => []),
    getRiskAssessment(decisionId).catch(() => null),
    getReplayEvents(decisionId).catch(() => []),
    getEvidenceChain(decisionId).catch(() => []),
    getDecisionCustody(decisionId).catch(() => []),
  ]);

  const decision = decisionRows[0] ?? null;
  const dci      = dciRows[0]      ?? null;
  const jdp      = jdpRows[0]      ?? null;
  const car      = carRows[0]      ?? null;
  const cil      = cilRows[0]      ?? null;

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
    } : null,

    stages: stageRows.map((s) => ({
      stageKey:         s.stageKey,
      stageNumber:      s.stageNumber,
      completedAt:      s.completedAt?.toISOString() ?? null,
      validationStatus: s.validationStatus,
      stageData:        s.stageData,
    })),

    dci: dci ? {
      decisionType:                   dci.decisionType,
      competentAuthority:             dci.competentAuthority,
      applicableLegalBasis:           dci.applicableLegalBasis,
      purposeOfDecision:              dci.purposeOfDecision,
      humanDecisionOwner:             dci.humanDecisionOwner,
      aiParticipationLevel:           dci.aiParticipationLevel,
      humanOversightLevel:            dci.humanOversightLevel,
      explainabilityLevel:            dci.explainabilityLevel,
      transparencyLevel:              dci.transparencyLevel,
      evidenceCompleteness:           dci.evidenceCompleteness,
      proportionalityStatus:          dci.proportionalityStatus,
      legalityStatus:                 dci.legalityStatus,
      constitutionalValidationStatus: dci.constitutionalValidationStatus,
      alShamsiFrameworkCompliance:    dci.alShamsiFrameworkCompliance,
      humanInfluenceIndex:            dci.humanInfluenceIndex,
      aiActualInfluence:              dci.aiActualInfluence,
      isSealed:                       dci.isSealed,
    } : null,

    jdp: jdp ? {
      status:                             jdp.status,
      legalBasis:                         jdp.legalBasis,
      proportionalityAnalysis:            jdp.proportionalityAnalysis,
      aiParticipationExplanation:         jdp.aiParticipationExplanation,
      constitutionalValidationResults:    jdp.constitutionalValidationResults,
      anticipatedJudicialReviewQuestions: jdp.anticipatedJudicialReviewQuestions,
    } : null,

    car: car ? {
      status:             car.status,
      factsReliedUpon:    car.factsReliedUpon,
      legalBasisSummary:  car.legalBasisSummary,
      reasonsForDecision: car.reasonsForDecision,
      affectedPartyRights:car.affectedPartyRights,
      appealInformation:  car.appealInformation,
    } : null,

    cilAssessment: cil ? {
      status:                        cil.status,
      constitutionalComplianceScore: cil.constitutionalComplianceScore,
      constitutionalRiskIndex:       cil.constitutionalRiskIndex,
      equalityIndex:                 cil.equalityIndex,
      dueProcessIndex:               cil.dueProcessIndex,
      rightsImpactScore:             cil.rightsImpactScore,
      judicialSurvivalProbability:   cil.judicialSurvivalProbability,
      overallRiskLevel:              cil.overallRiskLevel,
      activeWarningCount:            cil.activeWarningCount,
      hasCriticalWarning:            cil.hasCriticalWarning,
      overallReasoningAr:            cil.overallReasoningAr,
    } : null,

    nrme: riskAssessment ? {
      status:                       riskAssessment.status,
      nationalRiskIndex:            riskAssessment.nationalRiskIndex,
      administrativeLegitimacyIndex:riskAssessment.administrativeLegitimacyIndex,
      decisionConfidenceScore:      riskAssessment.decisionConfidenceScore,
      constitutionalImpact:         riskAssessment.indices?.constitutionalImpact ?? null,
      humanRightsImpact:            riskAssessment.indices?.humanRightsImpact ?? null,
      judicialChallengeProbability: riskAssessment.indices?.judicialChallengeProbability ?? null,
    } : null,

    replayEvents: {
      totalEvents: replayEvents.length,
      events: replayEvents.map((e) => ({
        replayStageKey:  e.replayStageKey,
        sourceStageKey:  e.sourceStageKey,
        recordedAt:      e.recordedAt?.toISOString() ?? null,
        actor:           e.actor,
        actorRole:       e.actorRole,
        confidenceScore: e.confidenceScore,
        auditHash:       e.auditHash,
      })),
    },

    evidenceChain: {
      totalEvents: evidenceChain.length,
      events: evidenceChain.map((e) => ({
        sequenceNumber: e.sequenceNumber,
        action:         e.action,
        eventCategory:  e.eventCategory,
        actor:          e.actor,
        actorRole:      e.actorRole,
        summaryAr:      e.evidenceSummaryAr,
      })),
    },

    custodyChain: { totalRecords: custodyChain.length },
  };
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

export async function getJdtSimulation(
  decisionId: number,
): Promise<JdtSimulation | null> {
  const rows = await db
    .select()
    .from(jdtSimulationsTable)
    .where(eq(jdtSimulationsTable.decisionId, decisionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function markJdtRunning(
  decisionId: number,
  triggeredBy: string,
): Promise<void> {
  const existing = await getJdtSimulation(decisionId);
  const newVersion = (existing?.simulationVersion ?? 0) + 1;

  if (existing) {
    await db
      .update(jdtSimulationsTable)
      .set({
        status:            "running",
        triggeredBy,
        simulationVersion: newVersion,
        reviewStages:      null,
        shamsiDimensions:  null,
        shamsiOverallScore:        null,
        constitutionalScore:       null,
        constitutionalOutcome:     null,
        constitutionalReasoning:   null,
        riskIntegrationScore:      null,
        riskReasoning:             null,
        probabilityAnnulment:      null,
        probabilityDismissal:      null,
        probabilityCorrection:     null,
        judicialSuccessProbability:null,
        overallRiskLevel:          null,
        judicialReasoning:         null,
        strengths:                 null,
        weaknesses:                null,
        missingEvidence:           null,
        correctiveActions:         null,
        overallAssessment:         null,
        cilIntegration:            null,
        nrmeIntegration:           null,
        replayIntegration:         null,
        auditHash:                 null,
        errorMessage:              null,
        updatedAt:                 new Date(),
      })
      .where(eq(jdtSimulationsTable.decisionId, decisionId));
    return;
  }

  await db
    .insert(jdtSimulationsTable)
    .values({
      decisionId,
      status:            "running",
      simulationVersion: newVersion,
      triggeredBy,
    });
}

export async function saveJdtSimulation(
  decisionId: number,
  result: JdtAnalysisResult,
  aiModel: string,
): Promise<JdtSimulation> {
  const now = new Date();

  // Build integrity hash over the complete simulation result
  const auditHash = createHash("sha256")
    .update(JSON.stringify(result))
    .digest("hex");

  await db
    .update(jdtSimulationsTable)
    .set({
      status:                    "completed",
      completedAt:               now,
      reviewStages:              result.reviewStages,
      shamsiDimensions:          result.shamsiDimensions,
      shamsiOverallScore:        result.shamsiOverallScore,
      constitutionalScore:       result.constitutionalScore,
      constitutionalOutcome:     result.constitutionalOutcome,
      constitutionalReasoning:   result.constitutionalReasoning,
      riskIntegrationScore:      result.riskIntegrationScore,
      riskReasoning:             result.riskReasoning,
      probabilityAnnulment:      result.probabilityAnnulment,
      probabilityDismissal:      result.probabilityDismissal,
      probabilityCorrection:     result.probabilityCorrection,
      judicialSuccessProbability:result.judicialSuccessProbability,
      overallRiskLevel:          result.overallRiskLevel,
      judicialReasoning:         result.judicialReasoning,
      strengths:                 result.strengths,
      weaknesses:                result.weaknesses,
      missingEvidence:           result.missingEvidence,
      correctiveActions:         result.correctiveActions,
      overallAssessment:         result.overallAssessment,
      cilIntegration:            result.cilIntegration,
      nrmeIntegration:           result.nrmeIntegration,
      replayIntegration:         result.replayIntegration,
      aiModel,
      auditHash,
      errorMessage:              null,
      updatedAt:                 now,
    })
    .where(eq(jdtSimulationsTable.decisionId, decisionId));

  return (await getJdtSimulation(decisionId))!;
}

export async function markJdtFailed(
  decisionId: number,
  errorMessage: string,
): Promise<void> {
  await db
    .update(jdtSimulationsTable)
    .set({ status: "failed", errorMessage, updatedAt: new Date() })
    .where(eq(jdtSimulationsTable.decisionId, decisionId));
}

// ─── Report Builder ────────────────────────────────────────────────────────────

export async function buildJdtReport(
  decisionId: number,
): Promise<Record<string, unknown> | null> {
  const simulation = await getJdtSimulation(decisionId);
  if (!simulation || simulation.status !== "completed") {
    return null;
  }

  const decisionRows = await db
    .select({
      id:               decisionsTable.id,
      caseNumber:       decisionsTable.caseNumber,
      titleAr:          decisionsTable.titleAr,
      titleEn:          decisionsTable.titleEn,
      issuingAuthority: decisionsTable.issuingAuthority,
    })
    .from(decisionsTable)
    .where(eq(decisionsTable.id, decisionId))
    .limit(1);

  const decision = decisionRows[0] ?? null;

  const reportHash = createHash("sha256")
    .update(JSON.stringify({
      decisionId,
      simulationVersion:         simulation.simulationVersion,
      completedAt:               simulation.completedAt?.toISOString(),
      shamsiOverallScore:        simulation.shamsiOverallScore,
      judicialSuccessProbability:simulation.judicialSuccessProbability,
      probabilityAnnulment:      simulation.probabilityAnnulment,
      overallRiskLevel:          simulation.overallRiskLevel,
      auditHash:                 simulation.auditHash,
    }))
    .digest("hex");

  return {
    packageType:         "MARSAD-JDT-JUDICIAL-DIGITAL-TWIN-v44",
    framework:           "Al-Shamsi Judicial Digital Twin™ — Phase 44",
    reportGeneratedAt:   new Date().toISOString(),
    simulationVersion:   simulation.simulationVersion,

    decision: decision ? {
      id:               decision.id,
      caseNumber:       decision.caseNumber,
      titleAr:          decision.titleAr,
      titleEn:          decision.titleEn,
      issuingAuthority: decision.issuingAuthority,
    } : null,

    judicialOutcomeProbabilities: {
      annulment:         simulation.probabilityAnnulment,
      dismissal:         simulation.probabilityDismissal,
      correction:        simulation.probabilityCorrection,
      judicialSuccess:   simulation.judicialSuccessProbability,
      overallRiskLevel:  simulation.overallRiskLevel,
    },

    shamsi: {
      overallScore: simulation.shamsiOverallScore,
      dimensions:   simulation.shamsiDimensions ?? [],
    },

    constitutional: {
      score:      simulation.constitutionalScore,
      outcome:    simulation.constitutionalOutcome,
      reasoning:  simulation.constitutionalReasoning,
    },

    riskIntegration: {
      score:    simulation.riskIntegrationScore,
      reasoning:simulation.riskReasoning,
    },

    reviewStages: {
      total:    (simulation.reviewStages ?? []).length,
      blocking: (simulation.reviewStages ?? []).filter((s) => s.isBlockingAnnulment).length,
      stages:    simulation.reviewStages ?? [],
    },

    qualitativeAnalysis: {
      strengths:        simulation.strengths ?? [],
      weaknesses:       simulation.weaknesses ?? [],
      missingEvidence:  simulation.missingEvidence ?? [],
      correctiveActions:simulation.correctiveActions ?? [],
      overallAssessment:simulation.overallAssessment,
      judicialReasoning:simulation.judicialReasoning,
    },

    integration: {
      cil:    simulation.cilIntegration,
      nrme:   simulation.nrmeIntegration,
      replay: simulation.replayIntegration,
    },

    integrityProof: {
      aiModel:    simulation.aiModel,
      auditHash:  simulation.auditHash,
      reportHash,
    },
  };
}
