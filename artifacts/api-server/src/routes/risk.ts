/**
 * NRME — National Risk Modeling Engine API Routes
 * ─────────────────────────────────────────────────
 * All routes under /risk/...
 * Every write triggers a full risk recalculation via calculateRiskScores().
 */

import { Router } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import {
  db,
  decisionsTable,
  riskAssessmentsTable,
  riskScenariosTable,
  riskTreatmentsTable,
  riskOwnersTable,
  riskMonitoringTable,
  riskReviewsTable,
  riskHistoryTable,
  riskCategoriesTable,
  PERMISSIONS,
  getRiskAssessment,
  initializeRiskAssessment,
} from "@workspace/db";
import {
  requirePermission,
  requireGovernanceRead,
} from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { e400, e403, e404, e500 } from "../lib/sendError";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserInfo(req: import("express").Request) {
  const role   = String(req.headers["x-user-role"] || "viewer");
  const userId = String(req.headers["x-user-id"]   || "system");
  const org    = String(req.headers["x-user-org"]   || "");
  return { role, userId, org };
}

function getPermissions(role: string) {
  return PERMISSIONS[role as keyof typeof PERMISSIONS] ?? PERMISSIONS.citizen;
}

async function assertDecisionAccess(
  req: import("express").Request,
  decisionId: number,
): Promise<typeof decisionsTable.$inferSelect | null> {
  const [decision] = await db
    .select()
    .from(decisionsTable)
    .where(eq(decisionsTable.id, decisionId))
    .limit(1);
  if (!decision) return null;

  const { role, org } = getUserInfo(req);
  const perms = getPermissions(role);
  // sealedOnly roles (e.g. external_auditor) can only read sealed decisions
  if (perms.sealedOnly && decision.status !== "sealed") return null;
  if (perms.seeOwnOrgOnly && decision.organizationUnit !== org) return null;

  return decision;
}

// ─── GET /risk/categories ─────────────────────────────────────────────────────

router.get("/risk/categories", requireGovernanceRead, async (req, res): Promise<void> => {
  try {
    const categories = await db
      .select()
      .from(riskCategoriesTable)
      .where(eq(riskCategoriesTable.isActive, true))
      .orderBy(riskCategoriesTable.sortOrder);
    res.json({ categories });
  } catch (err) {
    console.error("[risk.categories.get]", err);
    e500(res, "Failed to load risk categories");
  }
});

// ─── GET /risk/assessment/:decisionId ─────────────────────────────────────────
// Returns the current risk assessment. If status=pending, triggers calculation.

router.get("/risk/assessment/:decisionId", requirePermission("canReadRiskAssessment"), async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { e404(res, "Decision not found or access denied"); return; }

    let assessment = await getRiskAssessment(decisionId);

    // Auto-initialise if missing (shouldn't happen after hook is live)
    if (!assessment) {
      await initializeRiskAssessment(decisionId, decision);
      assessment = await getRiskAssessment(decisionId);
    }

    // Trigger lazy calculation for pending assessments
    if (assessment && (assessment.status === "pending" || assessment.status === "stale")) {
      const { role, userId } = getUserInfo(req);
      // Fire async — don't await (response returns pending status immediately)
      const { calculateRiskScores } = await import("../lib/risk-engine.js");
      calculateRiskScores(decisionId, {
        triggeredBy: userId,
        triggeredByRole: role,
        triggerReason: "lazy_load",
        logAuditFn: (action, details) =>
          logAudit(req, action, { entityType: "decision", entityId: decisionId, details }),
      }).catch((e) => console.error("[risk.assessment.lazy]", e));
    }

    // Fetch scenarios and treatments in parallel
    const [scenarios, treatments, history] = await Promise.all([
      db.select().from(riskScenariosTable).where(eq(riskScenariosTable.decisionId, decisionId)),
      db.select().from(riskTreatmentsTable).where(eq(riskTreatmentsTable.decisionId, decisionId))
        .orderBy(desc(riskTreatmentsTable.createdAt)),
      db.select().from(riskHistoryTable).where(eq(riskHistoryTable.decisionId, decisionId))
        .orderBy(desc(riskHistoryTable.createdAt)).limit(10),
    ]);

    res.json({ assessment, scenarios, treatments, history });
  } catch (err) {
    console.error("[risk.assessment.get]", err);
    e500(res, "Failed to load risk assessment");
  }
});

// ─── POST /risk/assessment/:decisionId/recalculate ───────────────────────────

router.post("/risk/assessment/:decisionId/recalculate", requirePermission("canRecalculateRisk"), async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { e404(res, "Decision not found or access denied"); return; }

    const { role, userId } = getUserInfo(req);

    logAudit(req, "risk.assessment.recalculate", {
      entityType: "decision",
      entityId: decisionId,
      details: { caseNumber: decision.caseNumber, triggeredBy: userId, role },
    });

    const { calculateRiskScores } = await import("../lib/risk-engine.js");
    const result = await calculateRiskScores(decisionId, {
      triggeredBy: userId,
      triggeredByRole: role,
      triggerReason: "manual_recalculate",
    });

    res.json({ result, message: "تم إعادة احتساب مؤشرات المخاطر بنجاح" });
  } catch (err) {
    console.error("[risk.assessment.recalculate]", err);
    e500(res, (err instanceof Error) ? err.message : "Recalculation failed");
  }
});

// ─── GET /risk/scenarios/:decisionId ──────────────────────────────────────────

router.get("/risk/scenarios/:decisionId", requirePermission("canReadRiskAssessment"), async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { e404(res, "Decision not found or access denied"); return; }

    const scenarios = await db
      .select()
      .from(riskScenariosTable)
      .where(eq(riskScenariosTable.decisionId, decisionId))
      .orderBy(desc(riskScenariosTable.createdAt));

    res.json({ scenarios });
  } catch (err) {
    console.error("[risk.scenarios.get]", err);
    e500(res, "Failed to load risk scenarios");
  }
});

// ─── POST /risk/treatment ─────────────────────────────────────────────────────

router.post("/risk/treatment", requirePermission("canWriteRiskTreatment"), async (req, res): Promise<void> => {
  try {
    const {
      decisionId, titleAr, titleEn, treatmentType, descriptionAr, descriptionEn,
      responsibleParty, targetDate, expectedReduction, legalBasis, riskId,
    } = req.body as {
      decisionId: number; titleAr: string; titleEn?: string; treatmentType?: string;
      descriptionAr?: string; descriptionEn?: string; responsibleParty?: string;
      targetDate?: string; expectedReduction?: number; legalBasis?: string; riskId?: number;
    };

    if (!decisionId || !titleAr) { e400(res, "decisionId and titleAr are required"); return; }

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { e404(res, "Decision not found or access denied"); return; }

    const { userId } = getUserInfo(req);

    const [treatment] = await db
      .insert(riskTreatmentsTable)
      .values({
        decisionId,
        riskId: riskId ?? null,
        titleAr,
        titleEn: titleEn ?? null,
        treatmentType: treatmentType ?? "reduce",
        descriptionAr: descriptionAr ?? null,
        descriptionEn: descriptionEn ?? null,
        responsibleParty: responsibleParty ?? null,
        targetDate: targetDate ? new Date(targetDate) : null,
        expectedReduction: expectedReduction ?? null,
        legalBasis: legalBasis ?? null,
        status: "planned",
        createdBy: userId,
      })
      .returning();

    logAudit(req, "risk.treatment.add", {
      entityType: "decision",
      entityId: decisionId,
      details: { treatmentId: treatment.id, titleAr, caseNumber: decision.caseNumber },
    });

    // Trigger recalculation (async — don't await)
    const { calculateRiskScores } = await import("../lib/risk-engine.js");
    calculateRiskScores(decisionId, {
      triggeredBy: userId,
      triggerReason: "treatment_added",
    }).catch((e) => console.error("[risk.treatment.add.recalc]", e));

    res.status(201).json({ treatment, message: "تمت إضافة إجراء المعالجة وبدء إعادة احتساب المخاطر" });
  } catch (err) {
    console.error("[risk.treatment.add]", err);
    e500(res, "Failed to add risk treatment");
  }
});

// ─── PUT /risk/treatment/:id ──────────────────────────────────────────────────

router.put("/risk/treatment/:id", requirePermission("canWriteRiskTreatment"), async (req, res): Promise<void> => {
  try {
    const treatmentId = parseInt(req.params.id as string, 10);
    if (isNaN(treatmentId)) { e400(res, "Invalid treatment ID"); return; }

    const [existing] = await db
      .select()
      .from(riskTreatmentsTable)
      .where(eq(riskTreatmentsTable.id, treatmentId))
      .limit(1);
    if (!existing) { e404(res, "Treatment not found"); return; }

    const decision = await assertDecisionAccess(req, existing.decisionId);
    if (!decision) { e403(res, "Access denied for this decision"); return; }

    const {
      titleAr, titleEn, treatmentType, descriptionAr, descriptionEn,
      responsibleParty, targetDate, status, expectedReduction, actualReduction, legalBasis,
    } = req.body as {
      titleAr?: string; titleEn?: string; treatmentType?: string;
      descriptionAr?: string; descriptionEn?: string; responsibleParty?: string;
      targetDate?: string; status?: string; expectedReduction?: number;
      actualReduction?: number; legalBasis?: string;
    };

    const completedAt = status === "completed" ? new Date() : undefined;

    const [updated] = await db
      .update(riskTreatmentsTable)
      .set({
        ...(titleAr != null && { titleAr }),
        ...(titleEn != null && { titleEn }),
        ...(treatmentType != null && { treatmentType }),
        ...(descriptionAr != null && { descriptionAr }),
        ...(descriptionEn != null && { descriptionEn }),
        ...(responsibleParty != null && { responsibleParty }),
        ...(targetDate != null && { targetDate: new Date(targetDate) }),
        ...(status != null && { status }),
        ...(expectedReduction != null && { expectedReduction }),
        ...(actualReduction != null && { actualReduction }),
        ...(legalBasis != null && { legalBasis }),
        ...(completedAt && { completedAt }),
        updatedAt: new Date(),
      })
      .where(eq(riskTreatmentsTable.id, treatmentId))
      .returning();

    const { userId } = getUserInfo(req);

    logAudit(req, "risk.treatment.update", {
      entityType: "decision",
      entityId: existing.decisionId,
      details: { treatmentId, status, caseNumber: decision.caseNumber },
    });

    // Trigger recalculation (async)
    const { calculateRiskScores } = await import("../lib/risk-engine.js");
    calculateRiskScores(existing.decisionId, {
      triggeredBy: userId,
      triggerReason: "treatment_updated",
    }).catch((e) => console.error("[risk.treatment.update.recalc]", e));

    res.json({ treatment: updated, message: "تم تحديث إجراء المعالجة وبدء إعادة احتساب المخاطر" });
  } catch (err) {
    console.error("[risk.treatment.update]", err);
    e500(res, "Failed to update risk treatment");
  }
});

// ─── DELETE /risk/treatment/:id ───────────────────────────────────────────────

router.delete("/risk/treatment/:id", requirePermission("canWriteRiskTreatment"), async (req, res): Promise<void> => {
  try {
    const treatmentId = parseInt(req.params.id as string, 10);
    if (isNaN(treatmentId)) { e400(res, "Invalid treatment ID"); return; }

    const [existing] = await db
      .select()
      .from(riskTreatmentsTable)
      .where(eq(riskTreatmentsTable.id, treatmentId))
      .limit(1);
    if (!existing) { e404(res, "Treatment not found"); return; }

    const decision = await assertDecisionAccess(req, existing.decisionId);
    if (!decision) { e403(res, "Access denied for this decision"); return; }

    await db.delete(riskTreatmentsTable).where(eq(riskTreatmentsTable.id, treatmentId));

    const { userId } = getUserInfo(req);
    logAudit(req, "risk.treatment.delete", {
      entityType: "decision",
      entityId: existing.decisionId,
      details: { treatmentId, caseNumber: decision.caseNumber },
    });

    // Trigger recalculation (async)
    const { calculateRiskScores } = await import("../lib/risk-engine.js");
    calculateRiskScores(existing.decisionId, {
      triggeredBy: userId,
      triggerReason: "treatment_deleted",
    }).catch((e) => console.error("[risk.treatment.delete.recalc]", e));

    res.json({ message: "تم حذف إجراء المعالجة وبدء إعادة احتساب المخاطر" });
  } catch (err) {
    console.error("[risk.treatment.delete]", err);
    e500(res, "Failed to delete risk treatment");
  }
});

// ─── POST /risk/review/:decisionId ────────────────────────────────────────────

router.post("/risk/review/:decisionId", requirePermission("canReadRiskAssessment"), async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { e404(res, "Decision not found or access denied"); return; }

    const {
      reviewOutcome, reviewNarrativeAr, reviewNarrativeEn, nextReviewDate,
    } = req.body as {
      reviewOutcome?: string; reviewNarrativeAr?: string; reviewNarrativeEn?: string;
      nextReviewDate?: string;
    };

    const { role, userId } = getUserInfo(req);
    const assessment = await getRiskAssessment(decisionId);

    const [review] = await db
      .insert(riskReviewsTable)
      .values({
        decisionId,
        reviewOutcome: reviewOutcome ?? null,
        reviewNarrativeAr: reviewNarrativeAr ?? null,
        reviewNarrativeEn: reviewNarrativeEn ?? null,
        nriAtReview: assessment?.nationalRiskIndex ?? null,
        aliAtReview: assessment?.administrativeLegitimacyIndex ?? null,
        dcsAtReview: assessment?.decisionConfidenceScore ?? null,
        reviewedBy: userId,
        reviewedByRole: role,
        nextReviewDate: nextReviewDate ? new Date(nextReviewDate) : null,
      })
      .returning();

    logAudit(req, "risk.review.submit", {
      entityType: "decision",
      entityId: decisionId,
      details: { reviewId: review.id, reviewOutcome, caseNumber: decision.caseNumber },
    });

    res.status(201).json({ review, message: "تم تسجيل المراجعة بنجاح" });
  } catch (err) {
    console.error("[risk.review.submit]", err);
    e500(res, "Failed to submit risk review");
  }
});

// ─── GET /risk/history/:decisionId ────────────────────────────────────────────

router.get("/risk/history/:decisionId", requirePermission("canReadRiskAssessment"), async (req, res): Promise<void> => {
  try {
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

    const decision = await assertDecisionAccess(req, decisionId);
    if (!decision) { e404(res, "Decision not found or access denied"); return; }

    const history = await db
      .select()
      .from(riskHistoryTable)
      .where(eq(riskHistoryTable.decisionId, decisionId))
      .orderBy(desc(riskHistoryTable.createdAt))
      .limit(50);

    const reviews = await db
      .select()
      .from(riskReviewsTable)
      .where(eq(riskReviewsTable.decisionId, decisionId))
      .orderBy(desc(riskReviewsTable.createdAt));

    res.json({ history, reviews });
  } catch (err) {
    console.error("[risk.history.get]", err);
    e500(res, "Failed to load risk history");
  }
});

// ─── GET /risk/dashboard ──────────────────────────────────────────────────────
// Role-based executive dashboard: aggregated stats across accessible decisions

router.get("/risk/dashboard", requirePermission("canViewRiskDashboard"), async (req, res): Promise<void> => {
  try {
    const { role, org } = getUserInfo(req);
    const perms = getPermissions(role);

    // Build decision filter based on role scope
    const assessmentRows = await db
      .select({
        decisionId:            riskAssessmentsTable.decisionId,
        nationalRiskIndex:     riskAssessmentsTable.nationalRiskIndex,
        administrativeLegitimacyIndex: riskAssessmentsTable.administrativeLegitimacyIndex,
        decisionConfidenceScore:       riskAssessmentsTable.decisionConfidenceScore,
        riskLevel:             riskAssessmentsTable.riskLevel,
        status:                riskAssessmentsTable.status,
        assessmentVersion:     riskAssessmentsTable.assessmentVersion,
        topRiskDrivers:        riskAssessmentsTable.topRiskDrivers,
        caseNumber:            decisionsTable.caseNumber,
        titleAr:               decisionsTable.titleAr,
        organizationUnit:      decisionsTable.organizationUnit,
        decisionStatus:        decisionsTable.status,
        decisionType:          decisionsTable.decisionType,
        updatedAt:             riskAssessmentsTable.updatedAt,
      })
      .from(riskAssessmentsTable)
      .innerJoin(decisionsTable, eq(riskAssessmentsTable.decisionId, decisionsTable.id))
      .where(
        perms.sealedOnly
          ? and(
              eq(decisionsTable.status, "sealed"),
              perms.seeOwnOrgOnly && org ? eq(decisionsTable.organizationUnit, org) : undefined,
            )
          : perms.seeOwnOrgOnly && org
          ? eq(decisionsTable.organizationUnit, org)
          : undefined,
      )
      .orderBy(desc(riskAssessmentsTable.nationalRiskIndex))
      .limit(200);

    const ready = assessmentRows.filter((r) => r.status === "ready");

    // Distribution by risk level
    const distribution = {
      critical: ready.filter((r) => r.riskLevel === "critical").length,
      high:     ready.filter((r) => r.riskLevel === "high").length,
      moderate: ready.filter((r) => r.riskLevel === "moderate").length,
      low:      ready.filter((r) => r.riskLevel === "low").length,
    };

    // Top 10 highest-risk decisions
    const topRisk = ready.slice(0, 10).map((r) => ({
      decisionId: r.decisionId,
      caseNumber: r.caseNumber,
      titleAr: r.titleAr,
      organizationUnit: r.organizationUnit,
      nationalRiskIndex: r.nationalRiskIndex,
      riskLevel: r.riskLevel,
      topRiskDrivers: r.topRiskDrivers,
    }));

    // Averages
    const avgNri = ready.length > 0
      ? ready.reduce((s, r) => s + (r.nationalRiskIndex ?? 0), 0) / ready.length : null;
    const avgAli = ready.length > 0
      ? ready.reduce((s, r) => s + (r.administrativeLegitimacyIndex ?? 0), 0) / ready.length : null;
    const avgDcs = ready.length > 0
      ? ready.reduce((s, r) => s + (r.decisionConfidenceScore ?? 0), 0) / ready.length : null;

    // Build a reusable scope filter that mirrors the assessmentRows filter
    // so ALL aggregates honour sealedOnly + seeOwnOrgOnly consistently.
    function decisionScopeFilter() {
      if (perms.sealedOnly) {
        return and(
          eq(decisionsTable.status, "sealed"),
          perms.seeOwnOrgOnly && org ? eq(decisionsTable.organizationUnit, org) : undefined,
        );
      }
      if (perms.seeOwnOrgOnly && org) {
        return eq(decisionsTable.organizationUnit, org);
      }
      return undefined;
    }

    // Pending treatments count — scoped to accessible decisions
    const pendingTreatments = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(riskTreatmentsTable)
      .innerJoin(decisionsTable, eq(riskTreatmentsTable.decisionId, decisionsTable.id))
      .where(
        and(
          eq(riskTreatmentsTable.status, "planned"),
          decisionScopeFilter(),
        ),
      );

    // Overdue reviews — join decisions so scope filter can be applied
    const overdueReviews = await db
      .select({ cnt: sql<number>`count(distinct ${riskReviewsTable.decisionId})::int` })
      .from(riskReviewsTable)
      .innerJoin(decisionsTable, eq(riskReviewsTable.decisionId, decisionsTable.id))
      .where(
        and(
          sql`${riskReviewsTable.nextReviewDate} < now()`,
          sql`${riskReviewsTable.nextReviewDate} is not null`,
          decisionScopeFilter(),
        ),
      );

    res.json({
      summary: {
        totalDecisions: assessmentRows.length,
        readyAssessments: ready.length,
        avgNationalRiskIndex: avgNri ? Math.round(avgNri * 10) / 10 : null,
        avgAdministrativeLegitimacyIndex: avgAli ? Math.round(avgAli * 10) / 10 : null,
        avgDecisionConfidenceScore: avgDcs ? Math.round(avgDcs * 10) / 10 : null,
        pendingTreatments: pendingTreatments[0]?.cnt ?? 0,
        overdueReviews: overdueReviews[0]?.cnt ?? 0,
      },
      distribution,
      topRisk,
      role,
    });
  } catch (err) {
    console.error("[risk.dashboard.get]", err);
    e500(res, "Failed to load risk dashboard");
  }
});

export default router;
