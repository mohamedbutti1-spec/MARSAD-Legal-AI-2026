/**
 * NRME — National Risk Modeling Engine Service
 * ────────────────────────────────────────────
 * Initialises risk assessment records and provides low-level DB helpers.
 * The heavy scoring logic lives in artifacts/api-server/src/lib/risk-engine.ts.
 */
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  riskAssessmentsTable,
  riskCategoriesTable,
  riskHistoryTable,
  NRME_RISK_CATEGORIES,
  type RiskAssessmentStatus,
  type RiskLevel,
  type RiskIndices,
} from "./schema/risk";
import type { Decision } from "./schema/decisions";

// ─── Initialise ───────────────────────────────────────────────────────────────

/**
 * Called immediately after a decision is created (POST /decisions).
 * Writes an initial risk_assessments row with status=pending.
 * Full AI scoring is deferred until the first GET or explicit recalculate call.
 */
export async function initializeRiskAssessment(
  decisionId: number,
  _decision: Decision,
): Promise<void> {
  await db
    .insert(riskAssessmentsTable)
    .values({
      decisionId,
      status: "pending" as RiskAssessmentStatus,
      assessmentVersion: 0,
      triggerReason: "decision.created",
      triggeredBy: "system",
    })
    .onConflictDoNothing();
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getRiskAssessment(decisionId: number) {
  const [row] = await db
    .select()
    .from(riskAssessmentsTable)
    .where(eq(riskAssessmentsTable.decisionId, decisionId))
    .limit(1);
  return row ?? null;
}

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * Snapshot the current assessment scores into risk_history (immutable audit).
 * Called after every successful recalculation.
 */
export async function snapshotRiskHistory(opts: {
  decisionId: number;
  assessmentVersion: number;
  nationalRiskIndex: number;
  administrativeLegitimacyIndex: number;
  decisionConfidenceScore: number;
  riskLevel: RiskLevel;
  indicesSnapshot: RiskIndices;
  triggerReason: string;
  triggeredBy: string;
  triggeredByRole?: string | null;
}): Promise<void> {
  const recordedAt = new Date().toISOString();
  const auditHash = createHash("sha256")
    .update(
      JSON.stringify({
        decisionId: opts.decisionId,
        assessmentVersion: opts.assessmentVersion,
        nationalRiskIndex: opts.nationalRiskIndex,
        triggeredBy: opts.triggeredBy,
        recordedAt,
      }),
    )
    .digest("hex");

  await db.insert(riskHistoryTable).values({
    decisionId: opts.decisionId,
    assessmentVersion: opts.assessmentVersion,
    nationalRiskIndex: opts.nationalRiskIndex,
    administrativeLegitimacyIndex: opts.administrativeLegitimacyIndex,
    decisionConfidenceScore: opts.decisionConfidenceScore,
    riskLevel: opts.riskLevel,
    indicesSnapshot: opts.indicesSnapshot,
    triggerReason: opts.triggerReason,
    triggeredBy: opts.triggeredBy,
    triggeredByRole: opts.triggeredByRole ?? null,
    auditHash,
  });
}

// ─── Category Seeding ─────────────────────────────────────────────────────────

/**
 * Idempotent seed: inserts all 9 UAE government risk categories if they don't exist.
 * Called from the API server seed function.
 */
export async function seedRiskCategories(): Promise<void> {
  for (const cat of NRME_RISK_CATEGORIES) {
    await db
      .insert(riskCategoriesTable)
      .values({
        code:        cat.code,
        nameAr:      cat.nameAr,
        nameEn:      cat.nameEn,
        descriptionAr: cat.descriptionAr,
        descriptionEn: cat.descriptionEn,
        alShamsiDimensions: [...cat.alShamsiDimensions],
        nrmeIndices: [...cat.nrmeIndices],
        sortOrder:   cat.sortOrder,
        isActive:    true,
      })
      .onConflictDoNothing();
  }
}
