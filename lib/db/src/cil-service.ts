/**
 * Phase 42 — Constitutional Intelligence Layer (CIL) — DB Service
 *
 * Pure data layer: collects decision data for AI analysis and persists results.
 * No AI calls here — AI logic lives in the API route (cil.ts).
 * Never modifies decision data, DCI, JDP, CAR, custody, evidence, or replay records.
 */
import { createHash } from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "./index";
import {
  constitutionalAssessmentsTable,
  constitutionalWarningsTable,
  type ConstitutionalAssessment,
  type ConstitutionalWarningRecord,
  type CilPrincipleResult,
  type CilWarning,
  type CilRiskLevel,
  CONSTITUTIONAL_PRINCIPLE_LABELS_AR,
  CONSTITUTIONAL_PRINCIPLE_LABELS_EN,
} from "./schema/cil";
import {
  decisionsTable,
  decisionStagesTable,
  decisionDciTable,
  decisionJdpTable,
  decisionCarTable,
} from "./schema/decisions";
import { getEvidenceChain, verifyEvidenceChain } from "./evidence-service";
import { getDecisionCustody } from "./custody-service";
import { getConstitutionalMemory } from "./memory-service";
import { getJudicialReview } from "./judicial-review-service";
import { getRiskAssessment } from "./risk-service";

// ─── Re-exported types ────────────────────────────────────────────────────────

export type { ConstitutionalAssessment, ConstitutionalWarningRecord };
export type { CilPrincipleResult, CilWarning, CilRiskLevel };

export type CilAnalysisResult = {
  constitutionalComplianceScore: number;
  constitutionalRiskIndex:       number;
  equalityIndex:                 number;
  dueProcessIndex:               number;
  rightsImpactScore:             number;
  judicialSurvivalProbability:   number;
  overallRiskLevel:              CilRiskLevel;
  principleResults:              CilPrincipleResult[];
  warnings:                      CilWarning[];
  activeWarningCount:            number;
  hasCriticalWarning:            boolean;
  overallReasoningAr:            string;
  recommendedActionAr:           string;
  nrmeIntegration: {
    constitutionalImpactScore: number;
    riskIndexAlignment:        number;
    recommendation:            string;
  };
  replayIntegration: {
    stagesAnalysed: number;
    criticalStages: string[];
    replayHash:     string;
  };
};

// ─── Data Collector (for AI prompt) ──────────────────────────────────────────

export async function collectCilDecisionData(
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
    memory,
    judicialReview,
    riskAssessment,
  ] = await Promise.all([
    db.select().from(decisionsTable).where(eq(decisionsTable.id, decisionId)),
    db.select().from(decisionStagesTable)
       .where(eq(decisionStagesTable.decisionId, decisionId))
       .orderBy(decisionStagesTable.stageNumber),
    db.select().from(decisionDciTable).where(eq(decisionDciTable.decisionId, decisionId)),
    db.select().from(decisionJdpTable).where(eq(decisionJdpTable.decisionId, decisionId)),
    db.select().from(decisionCarTable).where(eq(decisionCarTable.decisionId, decisionId)),
    getEvidenceChain(decisionId).catch(() => []),
    verifyEvidenceChain(decisionId).catch(() => null),
    getDecisionCustody(decisionId).catch(() => []),
    getConstitutionalMemory(decisionId).catch(() => null),
    getJudicialReview(decisionId).catch(() => null),
    getRiskAssessment(decisionId).catch(() => null),
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

    evidenceChain: {
      totalEvents: evidenceChain.length,
      isValid:     evidenceVerification?.valid ?? null,
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

    constitutionalMemory: memory ? {
      archiveStatus: memory.current.archiveStatus,
      sealed:        memory.current.sealed,
    } : null,

    cjiReview: judicialReview ? {
      status:                  judicialReview.status,
      constitutionalRiskScore: judicialReview.constitutionalRiskScore,
      riskLevel:               judicialReview.riskLevel,
      dimensions:              judicialReview.dimensions,
      detectedDefects:         judicialReview.detectedDefects,
      outcomePrediction:       judicialReview.outcomePrediction,
    } : null,

    nrme: riskAssessment ? {
      status:                       riskAssessment.status,
      nationalRiskIndex:            riskAssessment.nationalRiskIndex,
      administrativeLegitimacyIndex:riskAssessment.administrativeLegitimacyIndex,
      decisionConfidenceScore:      riskAssessment.decisionConfidenceScore,
      // These 3 fields live inside the indices JSON column
      constitutionalImpact:         riskAssessment.indices?.constitutionalImpact ?? null,
      humanRightsImpact:            riskAssessment.indices?.humanRightsImpact ?? null,
      judicialChallengeProbability: riskAssessment.indices?.judicialChallengeProbability ?? null,
    } : null,
  };
}

// ─── CRUD Operations ──────────────────────────────────────────────────────────

export async function getCilAssessment(
  decisionId: number,
): Promise<ConstitutionalAssessment | null> {
  const rows = await db
    .select()
    .from(constitutionalAssessmentsTable)
    .where(eq(constitutionalAssessmentsTable.decisionId, decisionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function markCilRunning(
  decisionId: number,
  triggeredBy: string,
): Promise<{ assessmentVersion: number; assessmentId: number }> {
  const existing = await getCilAssessment(decisionId);
  const newVersion = (existing?.assessmentVersion ?? 0) + 1;

  if (existing) {
    await db
      .update(constitutionalAssessmentsTable)
      .set({
        status:            "running",
        triggeredBy,
        assessmentVersion: newVersion,
        errorMessage:      null,
        updatedAt:         new Date(),
      })
      .where(eq(constitutionalAssessmentsTable.decisionId, decisionId));
    return { assessmentVersion: newVersion, assessmentId: existing.id };
  }

  const [inserted] = await db
    .insert(constitutionalAssessmentsTable)
    .values({ decisionId, status: "running", assessmentVersion: newVersion, triggeredBy })
    .returning({ id: constitutionalAssessmentsTable.id });

  return { assessmentVersion: newVersion, assessmentId: inserted!.id };
}

export async function saveCilAssessment(
  decisionId: number,
  assessmentId: number,
  result: CilAnalysisResult,
): Promise<ConstitutionalAssessment> {
  const now = new Date();

  // Build integrity hash over the complete assessment result
  const auditHash = createHash("sha256")
    .update(JSON.stringify({
      decisionId,
      assessmentId,
      completedAt:                   now.toISOString(),
      constitutionalComplianceScore: result.constitutionalComplianceScore,
      constitutionalRiskIndex:       result.constitutionalRiskIndex,
      equalityIndex:                 result.equalityIndex,
      dueProcessIndex:               result.dueProcessIndex,
      rightsImpactScore:             result.rightsImpactScore,
      judicialSurvivalProbability:   result.judicialSurvivalProbability,
    }))
    .digest("hex");

  await db
    .update(constitutionalAssessmentsTable)
    .set({
      status:                        "completed",
      completedAt:                   now,
      constitutionalComplianceScore: result.constitutionalComplianceScore,
      constitutionalRiskIndex:       result.constitutionalRiskIndex,
      equalityIndex:                 result.equalityIndex,
      dueProcessIndex:               result.dueProcessIndex,
      rightsImpactScore:             result.rightsImpactScore,
      judicialSurvivalProbability:   result.judicialSurvivalProbability,
      overallRiskLevel:              result.overallRiskLevel,
      principleResults:              result.principleResults,
      warnings:                      result.warnings,
      activeWarningCount:            result.activeWarningCount,
      hasCriticalWarning:            result.hasCriticalWarning,
      overallReasoningAr:            result.overallReasoningAr,
      recommendedActionAr:           result.recommendedActionAr,
      nrmeIntegration:               result.nrmeIntegration,
      replayIntegration:             result.replayIntegration,
      adpIntegration:                { includedInAdp: false, adpSectionHash: null },
      auditHash,
      errorMessage:                  null,
      updatedAt:                     now,
    })
    .where(eq(constitutionalAssessmentsTable.id, assessmentId));

  // Upsert warning rows (delete old, insert new)
  await db
    .delete(constitutionalWarningsTable)
    .where(eq(constitutionalWarningsTable.assessmentId, assessmentId));

  if (result.warnings.length > 0) {
    await db.insert(constitutionalWarningsTable).values(
      result.warnings.map((w) => ({
        decisionId,
        assessmentId,
        warningCode:      w.warningCode,
        severity:         w.severity,
        principleKey:     w.principleKey,
        titleAr:          w.titleAr,
        titleEn:          w.titleEn,
        descriptionAr:    w.descriptionAr,
        constitutionalRef:w.constitutionalRef,
        remedyAr:         w.remedyAr,
        isResolved:       false,
      })),
    );
  }

  return (await getCilAssessment(decisionId))!;
}

export async function markCilFailed(
  decisionId: number,
  errorMessage: string,
): Promise<void> {
  await db
    .update(constitutionalAssessmentsTable)
    .set({ status: "failed", errorMessage, updatedAt: new Date() })
    .where(eq(constitutionalAssessmentsTable.decisionId, decisionId));
}

export async function acknowledgeCilAssessment(
  decisionId: number,
  acknowledgedBy: string,
): Promise<void> {
  await db
    .update(constitutionalAssessmentsTable)
    .set({ acknowledged: true, acknowledgedAt: new Date(), acknowledgedBy, updatedAt: new Date() })
    .where(eq(constitutionalAssessmentsTable.decisionId, decisionId));
}

export async function getDecisionWarnings(
  decisionId: number,
): Promise<ConstitutionalWarningRecord[]> {
  return db
    .select()
    .from(constitutionalWarningsTable)
    .where(eq(constitutionalWarningsTable.decisionId, decisionId))
    .orderBy(constitutionalWarningsTable.severity, constitutionalWarningsTable.createdAt);
}

export async function resolveWarning(
  warningId: number,
  resolvedBy: string,
  resolutionNote: string,
): Promise<void> {
  await db
    .update(constitutionalWarningsTable)
    .set({ isResolved: true, resolvedAt: new Date(), resolvedBy, resolutionNote })
    .where(eq(constitutionalWarningsTable.id, warningId));
}

// ─── Dashboard Aggregator ─────────────────────────────────────────────────────

export interface CilDashboardFilter {
  /** If set, restrict to assessments whose parent decision belongs to this org unit */
  organizationUnit?: string;
  /** If true, restrict to assessments on sealed decisions only */
  sealedOnly?: boolean;
}

export async function getCilDashboardStats(filter?: CilDashboardFilter): Promise<{
  totalAssessments: number;
  completedAssessments: number;
  criticalWarnings: number;
  avgComplianceScore: number | null;
  avgSurvivalProbability: number | null;
  byRiskLevel: Record<string, number>;
}> {
  // Build a sub-set of decision IDs that satisfy org/sealed filters
  // to scope both assessments and warnings
  let decisionIds: number[] | null = null;
  if (filter?.organizationUnit || filter?.sealedOnly) {
    const decisionQuery = db
      .select({ id: decisionsTable.id })
      .from(decisionsTable)
      .leftJoin(decisionDciTable, eq(decisionDciTable.decisionId, decisionsTable.id));

    const rows = await decisionQuery;
    decisionIds = rows
      .filter((r) => {
        if (filter.organizationUnit && (r as unknown as { organizationUnit: string }).organizationUnit !== filter.organizationUnit) return false;
        if (filter.sealedOnly && !(r as unknown as { isSealed: boolean }).isSealed) return false;
        return true;
      })
      .map((r) => r.id);

    if (decisionIds.length === 0) {
      return {
        totalAssessments: 0, completedAssessments: 0, criticalWarnings: 0,
        avgComplianceScore: null, avgSurvivalProbability: null,
        byRiskLevel: { critical: 0, high: 0, moderate: 0, low: 0 },
      };
    }
  }

  const [assessmentRows, warningRows] = await Promise.all([
    db.select({
      status:                        constitutionalAssessmentsTable.status,
      overallRiskLevel:              constitutionalAssessmentsTable.overallRiskLevel,
      constitutionalComplianceScore: constitutionalAssessmentsTable.constitutionalComplianceScore,
      judicialSurvivalProbability:   constitutionalAssessmentsTable.judicialSurvivalProbability,
      decisionId:                    constitutionalAssessmentsTable.decisionId,
    }).from(constitutionalAssessmentsTable)
      .then((rows) => decisionIds ? rows.filter((r) => decisionIds!.includes(r.decisionId)) : rows),
    db.select({
      severity:   constitutionalWarningsTable.severity,
      isResolved: constitutionalWarningsTable.isResolved,
      decisionId: constitutionalWarningsTable.decisionId,
    }).from(constitutionalWarningsTable)
      .then((rows) => decisionIds ? rows.filter((r) => decisionIds!.includes(r.decisionId)) : rows),
  ]);

  const completed = assessmentRows.filter((r) => r.status === "completed");
  const complianceScores = completed
    .map((r) => r.constitutionalComplianceScore)
    .filter((v): v is number => v !== null);
  const survivalScores = completed
    .map((r) => r.judicialSurvivalProbability)
    .filter((v): v is number => v !== null);

  const byRiskLevel: Record<string, number> = { critical: 0, high: 0, moderate: 0, low: 0 };
  for (const r of completed) {
    if (r.overallRiskLevel && r.overallRiskLevel in byRiskLevel) {
      byRiskLevel[r.overallRiskLevel]++;
    }
  }

  return {
    totalAssessments:       assessmentRows.length,
    completedAssessments:   completed.length,
    criticalWarnings:       warningRows.filter((w) => w.severity === "critical" && !w.isResolved).length,
    avgComplianceScore:     complianceScores.length > 0 ? Math.round(complianceScores.reduce((a, b) => a + b, 0) / complianceScores.length) : null,
    avgSurvivalProbability: survivalScores.length > 0 ? Math.round(survivalScores.reduce((a, b) => a + b, 0) / survivalScores.length) : null,
    byRiskLevel,
  };
}

// ─── Report Builder (for ADP and JSON export) ─────────────────────────────────

export async function buildCilReport(
  decisionId: number,
): Promise<Record<string, unknown>> {
  const assessment = await getCilAssessment(decisionId);
  if (!assessment || assessment.status !== "completed") {
    throw new Error("CIL assessment not yet completed for this decision");
  }

  const warnings = await getDecisionWarnings(decisionId);

  const reportHash = createHash("sha256")
    .update(JSON.stringify({
      decisionId,
      assessmentVersion:             assessment.assessmentVersion,
      completedAt:                   assessment.completedAt?.toISOString(),
      constitutionalComplianceScore: assessment.constitutionalComplianceScore,
      constitutionalRiskIndex:       assessment.constitutionalRiskIndex,
      auditHash:                     assessment.auditHash,
    }))
    .digest("hex");

  return {
    packageType:   "MARSAD-CIL-CONSTITUTIONAL-REPORT-v42",
    framework:     "Al-Shamsi Constitutional Intelligence Layer™ — Phase 42",
    reportGeneratedAt: new Date().toISOString(),
    reportVersion: assessment.assessmentVersion,

    scores: {
      constitutionalComplianceScore: assessment.constitutionalComplianceScore,
      constitutionalRiskIndex:       assessment.constitutionalRiskIndex,
      equalityIndex:                 assessment.equalityIndex,
      dueProcessIndex:               assessment.dueProcessIndex,
      rightsImpactScore:             assessment.rightsImpactScore,
      judicialSurvivalProbability:   assessment.judicialSurvivalProbability,
      overallRiskLevel:              assessment.overallRiskLevel,
    },

    principles: {
      total:    (assessment.principleResults ?? []).length,
      compliant:(assessment.principleResults ?? []).filter((p) => p.status === "compliant").length,
      deficient:(assessment.principleResults ?? []).filter((p) => p.status === "deficient").length,
      results:   assessment.principleResults ?? [],
    },

    warnings: {
      total:    warnings.length,
      critical: warnings.filter((w) => w.severity === "critical").length,
      resolved: warnings.filter((w) => w.isResolved).length,
      items:    warnings,
    },

    narrative: {
      overallReasoningAr:  assessment.overallReasoningAr,
      recommendedActionAr: assessment.recommendedActionAr,
    },

    integration: {
      nrme:   assessment.nrmeIntegration,
      replay: assessment.replayIntegration,
      adp:    assessment.adpIntegration,
    },

    integrityProof: {
      auditHash:  assessment.auditHash,
      reportHash,
    },
  };
}
