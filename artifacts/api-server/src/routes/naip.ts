/**
 * NAIP — National Administrative Intelligence Platform API Routes
 * ───────────────────────────────────────────────────────────────
 * All routes under /naip/...
 *
 * The NAIP is the unified executive intelligence layer of MARSAD, aggregating
 * data from all modules (NRME, CIL, Replay, Governance) into a single
 * cross-ministry/cross-emirate intelligence view.
 */

import { Router } from "express";
import { eq, desc, sql, and, or, ilike, count, avg, isNotNull } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionDciTable,
  decisionReplayEventsTable,
  riskAssessmentsTable,
  constitutionalAssessmentsTable,
  constitutionalWarningsTable,
  PERMISSIONS,
} from "@workspace/db";
import { requirePermission } from "../middlewares/roleAuth";
import { e400, e403, e500 } from "../lib/sendError";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserInfo(req: import("express").Request) {
  const role   = String(req.headers["x-user-role"] || "viewer");
  const userId = String(req.headers["x-user-id"]   || "system");
  const org    = String(req.headers["x-user-org"]   || "");
  return { role, userId, org };
}

function getPerms(role: string) {
  return PERMISSIONS[role as keyof typeof PERMISSIONS] ?? PERMISSIONS.citizen;
}

/**
 * Build a WHERE condition array for scoping decisions to what the user can see.
 * Returns drizzle condition fragments (may be empty = no scope restriction).
 */
function buildDecisionScope(perms: ReturnType<typeof getPerms>, org: string) {
  const conditions: ReturnType<typeof eq>[] = [];
  if (perms.seeOwnOrgOnly && org) {
    conditions.push(eq(decisionsTable.organizationUnit, org));
  }
  return conditions;
}

/**
 * Get decision IDs accessible to the current user.
 * If sealedOnly, join DCI to restrict to sealed decisions.
 * Returns an array of decision IDs (or null = all).
 */
async function getAccessibleDecisionIds(
  perms: ReturnType<typeof getPerms>,
  org: string,
): Promise<number[] | null> {
  const scopeConditions = buildDecisionScope(perms, org);

  if (!perms.sealedOnly && scopeConditions.length === 0) {
    return null; // No restriction — all decisions accessible
  }

  if (perms.sealedOnly) {
    // Must join DCI to filter sealed decisions
    const rows = await db
      .select({ id: decisionsTable.id })
      .from(decisionsTable)
      .innerJoin(decisionDciTable, and(
        eq(decisionDciTable.decisionId, decisionsTable.id),
        eq(decisionDciTable.isSealed, true),
      ))
      .where(scopeConditions.length > 0 ? and(...scopeConditions) : undefined);
    return rows.map((r) => Math.floor(Number(r.id))).filter(n => !isNaN(n) && n > 0);
  }

  // seeOwnOrgOnly but not sealedOnly
  const rows = await db
    .select({ id: decisionsTable.id })
    .from(decisionsTable)
    .where(and(...scopeConditions));
  return rows.map((r) => Math.floor(Number(r.id))).filter(n => !isNaN(n) && n > 0);
}

// ─── GET /naip/overview ───────────────────────────────────────────────────────

router.get(
  "/naip/overview",
  requirePermission("canViewNaipDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);
      const accessibleIds = await getAccessibleDecisionIds(perms, org);

      // Build base condition for accessible decisions
      const decisionsCond =
        accessibleIds !== null
          ? sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      // ── Decisions stats ──────────────────────────────────────────────────
      const [decisionStats] = await db
        .select({
          total:              sql<number>`COUNT(*)::int`,
          active:             sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.status} = 'in_progress')::int`,
          pending:            sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.status} = 'draft')::int`,
          humanOversightQueue: sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.currentStage} = 'human_oversight')::int`,
        })
        .from(decisionsTable)
        .where(decisionsCond);

      // Count sealed: join DCI
      const [sealedRow] = await db
        .select({ sealed: sql<number>`COUNT(*)::int` })
        .from(decisionsTable)
        .innerJoin(decisionDciTable, and(
          eq(decisionDciTable.decisionId, decisionsTable.id),
          eq(decisionDciTable.isSealed, true),
        ))
        .where(decisionsCond);

      // ── Risk stats ───────────────────────────────────────────────────────
      const riskCond =
        accessibleIds !== null
          ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const [riskStats] = await db
        .select({
          avgNri:    sql<number | null>`AVG(CAST(${riskAssessmentsTable.nationalRiskIndex} AS NUMERIC))`,
          avgAli:    sql<number | null>`AVG(CAST(${riskAssessmentsTable.administrativeLegitimacyIndex} AS NUMERIC))`,
          avgDcs:    sql<number | null>`AVG(CAST(${riskAssessmentsTable.decisionConfidenceScore} AS NUMERIC))`,
          critCount: sql<number>`COUNT(*) FILTER (WHERE ${riskAssessmentsTable.riskLevel} = 'critical')::int`,
        })
        .from(riskAssessmentsTable)
        .where(riskCond);

      // ── Constitutional stats ──────────────────────────────────────────────
      const cilCond =
        accessibleIds !== null
          ? sql`${constitutionalAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const [cilStats] = await db
        .select({
          avgCcs:           sql<number | null>`AVG(CAST(${constitutionalAssessmentsTable.constitutionalComplianceScore} AS NUMERIC))`,
          assessedCount:    sql<number>`COUNT(*) FILTER (WHERE ${constitutionalAssessmentsTable.status} = 'completed')::int`,
        })
        .from(constitutionalAssessmentsTable)
        .where(cilCond);

      const warnCond =
        accessibleIds !== null
          ? sql`${constitutionalWarningsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const [warnStats] = await db
        .select({
          activeWarnings:   sql<number>`COUNT(*) FILTER (WHERE ${constitutionalWarningsTable.isResolved} = false)::int`,
          criticalWarnings: sql<number>`COUNT(*) FILTER (WHERE ${constitutionalWarningsTable.severity} = 'critical' AND ${constitutionalWarningsTable.isResolved} = false)::int`,
        })
        .from(constitutionalWarningsTable)
        .where(warnCond);

      // ── Replay stats ──────────────────────────────────────────────────────
      const replayCond =
        accessibleIds !== null
          ? sql`${decisionReplayEventsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const [replayStats] = await db
        .select({ totalEvents: sql<number>`COUNT(*)::int` })
        .from(decisionReplayEventsTable)
        .where(replayCond);

      res.json({
        decisions: {
          total:               decisionStats?.total ?? 0,
          active:              decisionStats?.active ?? 0,
          sealed:              sealedRow?.sealed ?? 0,
          pending:             decisionStats?.pending ?? 0,
          humanOversightQueue: decisionStats?.humanOversightQueue ?? 0,
        },
        risk: {
          avgNationalRiskIndex:              riskStats?.avgNri ?? null,
          avgAdministrativeLegitimacyIndex:  riskStats?.avgAli ?? null,
          avgDecisionConfidenceScore:        riskStats?.avgDcs ?? null,
          criticalRiskCount:                 riskStats?.critCount ?? 0,
        },
        constitutional: {
          avgComplianceScore:  cilStats?.avgCcs ?? null,
          activeWarnings:      warnStats?.activeWarnings ?? 0,
          criticalWarnings:    warnStats?.criticalWarnings ?? 0,
          assessedDecisions:   cilStats?.assessedCount ?? 0,
        },
        replay: {
          totalEvents: replayStats?.totalEvents ?? 0,
        },
        modules: {
          nrme:       true,
          cil:        true,
          replay:     true,
          governance: true,
        },
      });
    } catch (err) {
      console.error("[naip.overview]", err);
      e500(res, "Failed to load NAIP overview");
    }
  },
);

// ─── GET /naip/global-search ──────────────────────────────────────────────────

router.get(
  "/naip/global-search",
  requirePermission("canViewNaipSearch"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);

      const q      = String(req.query.q ?? "").trim();
      const domain = String(req.query.domain ?? "all");

      if (q.length < 2) {
        e400(res, "Query parameter 'q' must be at least 2 characters");
        return;
      }

      const accessibleIds = await getAccessibleDecisionIds(perms, org);
      const likeQ = `%${q}%`;

      // Helper to build accessible IDs condition for a given table column
      function accessCondition(col: import("drizzle-orm").Column) {
        if (accessibleIds === null) return sql`1=1`;
        if (accessibleIds.length === 0) return sql`1=0`;
        return sql`${col} = ANY(ARRAY[${sql.raw(accessibleIds.join(","))}]::int[])`;
      }

      const results: Array<Record<string, unknown>> = [];

      // ── a. Decisions ───────────────────────────────────────────────────────
      if (domain === "all" || domain === "decisions") {
        const decisionAccess =
          accessibleIds !== null
            ? sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
            : sql`1=1`;

        const decisionRows = await db
          .select({
            id:               decisionsTable.id,
            caseNumber:       decisionsTable.caseNumber,
            titleAr:          decisionsTable.titleAr,
            titleEn:          decisionsTable.titleEn,
            organizationUnit: decisionsTable.organizationUnit,
            status:           decisionsTable.status,
          })
          .from(decisionsTable)
          .where(and(
            decisionAccess,
            or(
              ilike(decisionsTable.caseNumber, likeQ),
              ilike(decisionsTable.titleAr, likeQ),
              decisionsTable.titleEn ? ilike(decisionsTable.titleEn, likeQ) : sql`false`,
            ),
          ))
          .limit(20);

        for (const row of decisionRows) {
          results.push({
            type:             "decision",
            id:               row.id,
            caseNumber:       row.caseNumber,
            title:            row.titleAr,
            organizationUnit: row.organizationUnit,
            status:           row.status,
            href:             `/decisions/${row.id}`,
          });
        }
      }

      // ── b. Risk assessments ────────────────────────────────────────────────
      if (domain === "all" || domain === "risk") {
        if (accessibleIds === null || accessibleIds.length > 0) {
          const riskRows = await db
            .select({
              decisionId: riskAssessmentsTable.decisionId,
              riskLevel:  riskAssessmentsTable.riskLevel,
            })
            .from(riskAssessmentsTable)
            .where(and(
              accessibleIds !== null
                ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.join(","))}]::int[])`
                : sql`1=1`,
              ilike(riskAssessmentsTable.riskLevel, likeQ),
            ))
            .limit(10);

          for (const row of riskRows) {
            results.push({
              type:       "risk",
              decisionId: row.decisionId,
              riskLevel:  row.riskLevel,
              href:       `/decisions/${row.decisionId}?tab=risk`,
            });
          }
        }
      }

      // ── c. Constitutional assessments ─────────────────────────────────────
      if (domain === "all" || domain === "constitutional") {
        if (accessibleIds === null || accessibleIds.length > 0) {
          const cilRows = await db
            .select({
              decisionId:    constitutionalAssessmentsTable.decisionId,
              overallRiskLevel: constitutionalAssessmentsTable.overallRiskLevel,
            })
            .from(constitutionalAssessmentsTable)
            .where(and(
              eq(constitutionalAssessmentsTable.status, "completed"),
              accessibleIds !== null
                ? sql`${constitutionalAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.join(","))}]::int[])`
                : sql`1=1`,
            ))
            .limit(10);

          for (const row of cilRows) {
            results.push({
              type:            "constitutional",
              decisionId:      row.decisionId,
              overallRiskLevel: row.overallRiskLevel,
              href:            `/decisions/${row.decisionId}?tab=cil`,
            });
          }
        }
      }

      // ── d. Replay events ──────────────────────────────────────────────────
      if (domain === "all" || domain === "replay") {
        if (accessibleIds === null || accessibleIds.length > 0) {
          const replayRows = await db
            .select({
              decisionId:         decisionReplayEventsTable.decisionId,
              replayStageKey:     decisionReplayEventsTable.replayStageKey,
              reasoningNarrative: decisionReplayEventsTable.reasoningNarrative,
            })
            .from(decisionReplayEventsTable)
            .where(and(
              accessibleIds !== null
                ? sql`${decisionReplayEventsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.join(","))}]::int[])`
                : sql`1=1`,
              ilike(decisionReplayEventsTable.reasoningNarrative, likeQ),
            ))
            .limit(10);

          for (const row of replayRows) {
            results.push({
              type:       "replay",
              decisionId: row.decisionId,
              stageKey:   row.replayStageKey,
              href:       `/decisions/${row.decisionId}?tab=replay`,
            });
          }
        }
      }

      // Cap at 50 results total (decisions already prioritized, inserted first)
      const capped = results.slice(0, 50);

      res.json({
        query:   q,
        total:   capped.length,
        results: capped,
      });
    } catch (err) {
      console.error("[naip.global-search]", err);
      e500(res, "Failed to execute NAIP global search");
    }
  },
);

// ─── GET /naip/kpi ────────────────────────────────────────────────────────────

router.get(
  "/naip/kpi",
  requirePermission("canViewNaipDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);
      const accessibleIds = await getAccessibleDecisionIds(perms, org);

      const decisionsCond =
        accessibleIds !== null
          ? sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const riskCond =
        accessibleIds !== null
          ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const cilCond =
        accessibleIds !== null
          ? sql`${constitutionalAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const warnCond =
        accessibleIds !== null
          ? sql`${constitutionalWarningsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      // ── KPI aggregates ───────────────────────────────────────────────────
      const [riskKpi] = await db
        .select({
          avgNri: sql<number | null>`AVG(CAST(${riskAssessmentsTable.nationalRiskIndex} AS NUMERIC))`,
          avgAli: sql<number | null>`AVG(CAST(${riskAssessmentsTable.administrativeLegitimacyIndex} AS NUMERIC))`,
          avgDcs: sql<number | null>`AVG(CAST(${riskAssessmentsTable.decisionConfidenceScore} AS NUMERIC))`,
        })
        .from(riskAssessmentsTable)
        .where(riskCond);

      const [cilKpi] = await db
        .select({
          avgCcs: sql<number | null>`AVG(CAST(${constitutionalAssessmentsTable.constitutionalComplianceScore} AS NUMERIC))`,
          avgJsp: sql<number | null>`AVG(CAST(${constitutionalAssessmentsTable.judicialSurvivalProbability} AS NUMERIC))`,
        })
        .from(constitutionalAssessmentsTable)
        .where(and(cilCond, eq(constitutionalAssessmentsTable.status, "completed")));

      // ── Decision counts by status ─────────────────────────────────────────
      const statusRows = await db
        .select({
          status: decisionsTable.status,
          cnt:    sql<number>`COUNT(*)::int`,
        })
        .from(decisionsTable)
        .where(decisionsCond)
        .groupBy(decisionsTable.status);

      const byStatus: Record<string, number> = {};
      let totalDecisions = 0;
      let activeDecisions = 0;
      let sealedDecisions = 0;

      for (const row of statusRows) {
        byStatus[row.status] = row.cnt;
        totalDecisions += row.cnt;
        if (row.status === "in_progress") activeDecisions = row.cnt;
      }

      // Count sealed via DCI
      const [sealedKpi] = await db
        .select({ sealed: sql<number>`COUNT(*)::int` })
        .from(decisionsTable)
        .innerJoin(decisionDciTable, and(
          eq(decisionDciTable.decisionId, decisionsTable.id),
          eq(decisionDciTable.isSealed, true),
        ))
        .where(decisionsCond);
      sealedDecisions = sealedKpi?.sealed ?? 0;

      // ── Risk by level ─────────────────────────────────────────────────────
      const riskLevelRows = await db
        .select({
          level: riskAssessmentsTable.riskLevel,
          cnt:   sql<number>`COUNT(*)::int`,
        })
        .from(riskAssessmentsTable)
        .where(riskCond)
        .groupBy(riskAssessmentsTable.riskLevel);

      const byRiskLevel: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
      let totalRisk = 0;
      let treatedRisk = 0;
      for (const row of riskLevelRows) {
        if (row.level) {
          byRiskLevel[row.level] = (byRiskLevel[row.level] ?? 0) + row.cnt;
          totalRisk += row.cnt;
        }
      }

      // ── Constitutional by risk level ──────────────────────────────────────
      const cilLevelRows = await db
        .select({
          level: constitutionalAssessmentsTable.overallRiskLevel,
          cnt:   sql<number>`COUNT(*)::int`,
        })
        .from(constitutionalAssessmentsTable)
        .where(and(cilCond, eq(constitutionalAssessmentsTable.status, "completed")))
        .groupBy(constitutionalAssessmentsTable.overallRiskLevel);

      const byCilRiskLevel: Record<string, number> = {};
      for (const row of cilLevelRows) {
        if (row.level) byCilRiskLevel[row.level] = row.cnt;
      }

      const [warnKpi] = await db
        .select({
          criticalWarnings: sql<number>`COUNT(*) FILTER (WHERE ${constitutionalWarningsTable.severity} = 'critical' AND ${constitutionalWarningsTable.isResolved} = false)::int`,
          resolvedWarnings: sql<number>`COUNT(*) FILTER (WHERE ${constitutionalWarningsTable.isResolved} = true)::int`,
        })
        .from(constitutionalWarningsTable)
        .where(warnCond);

      // ── Activity: decisions created in last 7/30 days ─────────────────────
      const [activity] = await db
        .select({
          last7:  sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.createdAt} >= NOW() - INTERVAL '7 days')::int`,
          last30: sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.createdAt} >= NOW() - INTERVAL '30 days')::int`,
        })
        .from(decisionsTable)
        .where(decisionsCond);

      res.json({
        national: {
          nationalRiskIndex:              riskKpi?.avgNri ?? null,
          administrativeLegitimacyIndex:  riskKpi?.avgAli ?? null,
          decisionConfidenceScore:        riskKpi?.avgDcs ?? null,
          constitutionalComplianceScore:  cilKpi?.avgCcs ?? null,
          judicialSurvivalProbability:    cilKpi?.avgJsp ?? null,
        },
        decisions: {
          total:    totalDecisions,
          active:   activeDecisions,
          sealed:   sealedDecisions,
          byStatus,
        },
        risk: {
          byLevel:      byRiskLevel,
          treatmentRate: totalRisk > 0 ? Math.round((treatedRisk / totalRisk) * 100) : 0,
        },
        constitutional: {
          byRiskLevel:      byCilRiskLevel,
          criticalWarnings: warnKpi?.criticalWarnings ?? 0,
          resolvedWarnings: warnKpi?.resolvedWarnings ?? 0,
        },
        activity: {
          last7Days:  activity?.last7  ?? 0,
          last30Days: activity?.last30 ?? 0,
        },
      });
    } catch (err) {
      console.error("[naip.kpi]", err);
      e500(res, "Failed to load NAIP KPI data");
    }
  },
);

// ─── GET /naip/stats/org ──────────────────────────────────────────────────────

router.get(
  "/naip/stats/org",
  requirePermission("canViewNaipDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);
      const accessibleIds = await getAccessibleDecisionIds(perms, org);

      const decisionsCond =
        accessibleIds !== null
          ? sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      // Fetch all accessible decisions with their risk assessments
      const rows = await db
        .select({
          id:               decisionsTable.id,
          organizationUnit: decisionsTable.organizationUnit,
          nri:              riskAssessmentsTable.nationalRiskIndex,
          ccs:              constitutionalAssessmentsTable.constitutionalComplianceScore,
        })
        .from(decisionsTable)
        .leftJoin(riskAssessmentsTable, eq(riskAssessmentsTable.decisionId, decisionsTable.id))
        .leftJoin(constitutionalAssessmentsTable, eq(constitutionalAssessmentsTable.decisionId, decisionsTable.id))
        .where(decisionsCond);

      // Group by organizationUnit in JS
      const orgMap: Record<string, {
        decisionCount: number;
        nriSum: number; nriCount: number;
        ccsSum: number; ccsCount: number;
      }> = {};

      for (const row of rows) {
        const unit = row.organizationUnit || "غير محدد";
        if (!orgMap[unit]) {
          orgMap[unit] = { decisionCount: 0, nriSum: 0, nriCount: 0, ccsSum: 0, ccsCount: 0 };
        }
        orgMap[unit].decisionCount++;
        if (row.nri != null) { orgMap[unit].nriSum += row.nri; orgMap[unit].nriCount++; }
        if (row.ccs != null) { orgMap[unit].ccsSum += row.ccs; orgMap[unit].ccsCount++; }
      }

      // Fetch critical warnings per org
      const warnCond =
        accessibleIds !== null
          ? sql`${constitutionalWarningsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const warnRows = await db
        .select({
          orgUnit: decisionsTable.organizationUnit,
          cnt:     sql<number>`COUNT(*)::int`,
        })
        .from(constitutionalWarningsTable)
        .innerJoin(decisionsTable, eq(decisionsTable.id, constitutionalWarningsTable.decisionId))
        .where(and(
          warnCond,
          eq(constitutionalWarningsTable.severity, "critical"),
          eq(constitutionalWarningsTable.isResolved, false),
        ))
        .groupBy(decisionsTable.organizationUnit);

      const critWarnByOrg: Record<string, number> = {};
      for (const w of warnRows) {
        critWarnByOrg[w.orgUnit || "غير محدد"] = w.cnt;
      }

      const result = Object.entries(orgMap)
        .map(([organizationUnit, data]) => ({
          organizationUnit,
          decisionCount:            data.decisionCount,
          avgNationalRiskIndex:     data.nriCount > 0 ? data.nriSum / data.nriCount : null,
          avgComplianceScore:       data.ccsCount > 0 ? data.ccsSum / data.ccsCount : null,
          criticalWarnings:         critWarnByOrg[organizationUnit] ?? 0,
        }))
        .sort((a, b) => b.decisionCount - a.decisionCount)
        .slice(0, 20);

      res.json(result);
    } catch (err) {
      console.error("[naip.stats.org]", err);
      e500(res, "Failed to load NAIP org stats");
    }
  },
);

// ─── GET /naip/stats/ministry ─────────────────────────────────────────────────

router.get(
  "/naip/stats/ministry",
  requirePermission("canViewNaipDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);
      const accessibleIds = await getAccessibleDecisionIds(perms, org);

      const decisionsCond =
        accessibleIds !== null
          ? sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const rows = await db
        .select({
          id:               decisionsTable.id,
          organizationUnit: decisionsTable.organizationUnit,
          nri:              riskAssessmentsTable.nationalRiskIndex,
          ccs:              constitutionalAssessmentsTable.constitutionalComplianceScore,
        })
        .from(decisionsTable)
        .leftJoin(riskAssessmentsTable, eq(riskAssessmentsTable.decisionId, decisionsTable.id))
        .leftJoin(constitutionalAssessmentsTable, eq(constitutionalAssessmentsTable.decisionId, decisionsTable.id))
        .where(decisionsCond);

      // Group by first segment (before " — ")
      const ministryMap: Record<string, {
        decisionCount: number;
        nriSum: number; nriCount: number;
        ccsSum: number; ccsCount: number;
      }> = {};

      for (const row of rows) {
        const ministry = (row.organizationUnit || "غير محدد").split(" — ")[0].trim();
        if (!ministryMap[ministry]) {
          ministryMap[ministry] = { decisionCount: 0, nriSum: 0, nriCount: 0, ccsSum: 0, ccsCount: 0 };
        }
        ministryMap[ministry].decisionCount++;
        if (row.nri != null) { ministryMap[ministry].nriSum += row.nri; ministryMap[ministry].nriCount++; }
        if (row.ccs != null) { ministryMap[ministry].ccsSum += row.ccs; ministryMap[ministry].ccsCount++; }
      }

      const result = Object.entries(ministryMap)
        .map(([ministry, data]) => ({
          ministry,
          decisionCount:        data.decisionCount,
          avgNationalRiskIndex: data.nriCount > 0 ? data.nriSum / data.nriCount : null,
          avgComplianceScore:   data.ccsCount > 0 ? data.ccsSum / data.ccsCount : null,
        }))
        .sort((a, b) => b.decisionCount - a.decisionCount)
        .slice(0, 20);

      res.json(result);
    } catch (err) {
      console.error("[naip.stats.ministry]", err);
      e500(res, "Failed to load NAIP ministry stats");
    }
  },
);

// ─── GET /naip/stats/emirate ──────────────────────────────────────────────────

router.get(
  "/naip/stats/emirate",
  requirePermission("canViewNaipDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);
      const accessibleIds = await getAccessibleDecisionIds(perms, org);

      const decisionsCond =
        accessibleIds !== null
          ? sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      const rows = await db
        .select({
          id:               decisionsTable.id,
          organizationUnit: decisionsTable.organizationUnit,
          nri:              riskAssessmentsTable.nationalRiskIndex,
          ccs:              constitutionalAssessmentsTable.constitutionalComplianceScore,
        })
        .from(decisionsTable)
        .leftJoin(riskAssessmentsTable, eq(riskAssessmentsTable.decisionId, decisionsTable.id))
        .leftJoin(constitutionalAssessmentsTable, eq(constitutionalAssessmentsTable.decisionId, decisionsTable.id))
        .where(decisionsCond);

      // Extract emirate from organizationUnit:
      // If it contains "إمارة", extract that token.
      // Otherwise use the last segment after " — ".
      function extractEmirate(orgUnit: string): string {
        const parts = orgUnit.split(" — ");
        for (const p of parts) {
          if (p.includes("إمارة")) return p.trim();
        }
        return parts[parts.length - 1].trim();
      }

      const emirateMap: Record<string, {
        decisionCount: number;
        nriSum: number; nriCount: number;
        ccsSum: number; ccsCount: number;
      }> = {};

      for (const row of rows) {
        const emirate = extractEmirate(row.organizationUnit || "غير محدد");
        if (!emirateMap[emirate]) {
          emirateMap[emirate] = { decisionCount: 0, nriSum: 0, nriCount: 0, ccsSum: 0, ccsCount: 0 };
        }
        emirateMap[emirate].decisionCount++;
        if (row.nri != null) { emirateMap[emirate].nriSum += row.nri; emirateMap[emirate].nriCount++; }
        if (row.ccs != null) { emirateMap[emirate].ccsSum += row.ccs; emirateMap[emirate].ccsCount++; }
      }

      const result = Object.entries(emirateMap)
        .map(([emirate, data]) => ({
          emirate,
          decisionCount:        data.decisionCount,
          avgNationalRiskIndex: data.nriCount > 0 ? data.nriSum / data.nriCount : null,
          avgComplianceScore:   data.ccsCount > 0 ? data.ccsSum / data.ccsCount : null,
        }))
        .sort((a, b) => b.decisionCount - a.decisionCount)
        .slice(0, 20);

      res.json(result);
    } catch (err) {
      console.error("[naip.stats.emirate]", err);
      e500(res, "Failed to load NAIP emirate stats");
    }
  },
);

// ─── GET /naip/stats/uae ──────────────────────────────────────────────────────

router.get(
  "/naip/stats/uae",
  requirePermission("canViewNaipDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role } = getUserInfo(req);
      const perms = getPerms(role);

      // UAE-wide stats require national scope.
      // Org-scoped roles (seeOwnOrgOnly) must use /naip/stats/org instead.
      if (perms.seeOwnOrgOnly) {
        return e403(res, "UAE-wide statistics require national-scope access. Use /naip/stats/org for org-level data.");
      }

      // Apply sealedOnly if the role requires it.
      let uaeCond = sql`1=1`;
      if (perms.sealedOnly) {
        // Restrict to sealed decisions only
        const sealedIds = await db
          .select({ id: decisionsTable.id })
          .from(decisionsTable)
          .innerJoin(decisionDciTable, and(
            eq(decisionDciTable.decisionId, decisionsTable.id),
            eq(decisionDciTable.isSealed, true),
          ));
        const ids = sealedIds.map((r) => r.id);
        if (ids.length === 0) {
          uaeCond = sql`1=0`;
        } else {
          uaeCond = sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(ids.join(","))}]::int[])`;
        }
      }

      const riskCond = perms.sealedOnly && uaeCond !== sql`1=0`
        ? sql`${riskAssessmentsTable.decisionId} IN (SELECT id FROM decisions WHERE ${uaeCond})`
        : sql`1=1`;

      // Use simpler UAE-wide aggregation
      const [decisionStats] = await db
        .select({
          total:   sql<number>`COUNT(*)::int`,
          active:  sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.status} = 'in_progress')::int`,
          pending: sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.status} = 'draft')::int`,
        })
        .from(decisionsTable)
        .where(uaeCond);

      const [sealedRow] = await db
        .select({ sealed: sql<number>`COUNT(*)::int` })
        .from(decisionsTable)
        .innerJoin(decisionDciTable, and(
          eq(decisionDciTable.decisionId, decisionsTable.id),
          eq(decisionDciTable.isSealed, true),
        ))
        .where(uaeCond);

      const statusRows = await db
        .select({
          status: decisionsTable.status,
          cnt:    sql<number>`COUNT(*)::int`,
        })
        .from(decisionsTable)
        .where(uaeCond)
        .groupBy(decisionsTable.status);

      const byStatus: Record<string, number> = {};
      for (const row of statusRows) byStatus[row.status] = row.cnt;

      // riskCond always applied to scope risk rows to accessible decisions
      const riskUaeCond = perms.sealedOnly
        ? sql`${riskAssessmentsTable.decisionId} IN (SELECT id FROM ${decisionsTable} WHERE ${uaeCond})`
        : undefined;

      const [riskKpi] = await db
        .select({
          avgNri: sql<number | null>`AVG(CAST(${riskAssessmentsTable.nationalRiskIndex} AS NUMERIC))`,
          avgAli: sql<number | null>`AVG(CAST(${riskAssessmentsTable.administrativeLegitimacyIndex} AS NUMERIC))`,
          avgDcs: sql<number | null>`AVG(CAST(${riskAssessmentsTable.decisionConfidenceScore} AS NUMERIC))`,
        })
        .from(riskAssessmentsTable)
        .where(riskUaeCond);

      const cilUaeCond = perms.sealedOnly
        ? sql`${constitutionalAssessmentsTable.decisionId} IN (SELECT id FROM ${decisionsTable} WHERE ${uaeCond})`
        : undefined;

      const [cilKpi] = await db
        .select({
          avgCcs: sql<number | null>`AVG(CAST(${constitutionalAssessmentsTable.constitutionalComplianceScore} AS NUMERIC))`,
          avgJsp: sql<number | null>`AVG(CAST(${constitutionalAssessmentsTable.judicialSurvivalProbability} AS NUMERIC))`,
        })
        .from(constitutionalAssessmentsTable)
        .where(and(cilUaeCond, eq(constitutionalAssessmentsTable.status, "completed")));

      const riskLevelRows = await db
        .select({
          level: riskAssessmentsTable.riskLevel,
          cnt:   sql<number>`COUNT(*)::int`,
        })
        .from(riskAssessmentsTable)
        .where(riskUaeCond)
        .groupBy(riskAssessmentsTable.riskLevel);

      const byRiskLevel: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
      for (const row of riskLevelRows) {
        if (row.level) byRiskLevel[row.level] = (byRiskLevel[row.level] ?? 0) + row.cnt;
      }

      const warnUaeCond = perms.sealedOnly
        ? sql`${constitutionalWarningsTable.decisionId} IN (SELECT id FROM ${decisionsTable} WHERE ${uaeCond})`
        : undefined;

      const [warnKpi] = await db
        .select({
          criticalWarnings: sql<number>`COUNT(*) FILTER (WHERE ${constitutionalWarningsTable.severity} = 'critical' AND ${constitutionalWarningsTable.isResolved} = false)::int`,
          resolvedWarnings: sql<number>`COUNT(*) FILTER (WHERE ${constitutionalWarningsTable.isResolved} = true)::int`,
        })
        .from(constitutionalWarningsTable)
        .where(warnUaeCond);

      const [activity] = await db
        .select({
          last7:  sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.createdAt} >= NOW() - INTERVAL '7 days')::int`,
          last30: sql<number>`COUNT(*) FILTER (WHERE ${decisionsTable.createdAt} >= NOW() - INTERVAL '30 days')::int`,
        })
        .from(decisionsTable)
        .where(uaeCond);

      const cilLevelRows = await db
        .select({
          level: constitutionalAssessmentsTable.overallRiskLevel,
          cnt:   sql<number>`COUNT(*)::int`,
        })
        .from(constitutionalAssessmentsTable)
        .where(and(cilUaeCond, eq(constitutionalAssessmentsTable.status, "completed")))
        .groupBy(constitutionalAssessmentsTable.overallRiskLevel);

      const byCilRiskLevel: Record<string, number> = {};
      for (const row of cilLevelRows) {
        if (row.level) byCilRiskLevel[row.level] = row.cnt;
      }

      res.json({
        national: {
          nationalRiskIndex:             riskKpi?.avgNri ?? null,
          administrativeLegitimacyIndex: riskKpi?.avgAli ?? null,
          decisionConfidenceScore:       riskKpi?.avgDcs ?? null,
          constitutionalComplianceScore: cilKpi?.avgCcs ?? null,
          judicialSurvivalProbability:   cilKpi?.avgJsp ?? null,
        },
        decisions: {
          total:    decisionStats?.total  ?? 0,
          active:   decisionStats?.active ?? 0,
          sealed:   sealedRow?.sealed     ?? 0,
          byStatus,
        },
        risk: {
          byLevel:      byRiskLevel,
          treatmentRate: 0,
        },
        constitutional: {
          byRiskLevel:      byCilRiskLevel,
          criticalWarnings: warnKpi?.criticalWarnings ?? 0,
          resolvedWarnings: warnKpi?.resolvedWarnings ?? 0,
        },
        activity: {
          last7Days:  activity?.last7  ?? 0,
          last30Days: activity?.last30 ?? 0,
        },
      });
    } catch (err) {
      console.error("[naip.stats.uae]", err);
      e500(res, "Failed to load NAIP UAE-wide stats");
    }
  },
);

// ─── GET /naip/executive-data/:dashboardType ──────────────────────────────────

// owner and supervisor are platform-level admins permitted to view any executive dashboard.
// Individual role checks are enforced for the role-specific governance routes; here
// the intent is to allow platform admins to oversee all executive views without error.
const DASHBOARD_TYPE_ROLE_MAP: Record<string, string[]> = {
  minister:          ["minister",         "owner", "supervisor"],
  undersecretary:    ["undersecretary", "assistant_undersecretary", "owner", "supervisor"],
  director_general:  ["director_general", "owner", "supervisor"],
  risk_officer:      ["owner", "supervisor", "internal_auditor", "constitutional_reviewer"],
  judge:             ["judge",            "owner", "supervisor"],
};

router.get(
  "/naip/executive-data/:dashboardType",
  requirePermission("canViewNaipDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);
      const dashboardType = req.params.dashboardType as string;

      // Validate dashboardType
      const allowedRoles = DASHBOARD_TYPE_ROLE_MAP[dashboardType as keyof typeof DASHBOARD_TYPE_ROLE_MAP];
      if (!allowedRoles) {
        e400(res, `Invalid dashboardType: ${dashboardType}. Must be one of: minister, undersecretary, director_general, risk_officer, judge`);
        return;
      }

      // Check that the user's actual role is allowed for this dashboard
      if (!allowedRoles.includes(role)) {
        e403(res, `Role '${role}' is not permitted to access the '${dashboardType}' executive dashboard`);
        return;
      }

      const accessibleIds = await getAccessibleDecisionIds(perms, org);

      const decisionsCond =
        accessibleIds !== null
          ? sql`${decisionsTable.id} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
          : sql`1=1`;

      // ── minister ──────────────────────────────────────────────────────────
      if (dashboardType === "minister") {
        const decisions = await db
          .select({
            id:               decisionsTable.id,
            caseNumber:       decisionsTable.caseNumber,
            titleAr:          decisionsTable.titleAr,
            status:           decisionsTable.status,
            riskLevel:        riskAssessmentsTable.riskLevel,
            overallRiskLevel: constitutionalAssessmentsTable.overallRiskLevel,
          })
          .from(decisionsTable)
          .leftJoin(riskAssessmentsTable, eq(riskAssessmentsTable.decisionId, decisionsTable.id))
          .leftJoin(constitutionalAssessmentsTable, eq(constitutionalAssessmentsTable.decisionId, decisionsTable.id))
          .where(decisionsCond)
          .orderBy(desc(decisionsTable.createdAt))
          .limit(20);

        const [critWarn] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(constitutionalWarningsTable)
          .where(and(
            accessibleIds !== null
              ? sql`${constitutionalWarningsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
            eq(constitutionalWarningsTable.severity, "critical"),
            eq(constitutionalWarningsTable.isResolved, false),
          ));

        const [avgKpi] = await db
          .select({
            avgNri: sql<number | null>`AVG(CAST(${riskAssessmentsTable.nationalRiskIndex} AS NUMERIC))`,
            avgAli: sql<number | null>`AVG(CAST(${riskAssessmentsTable.administrativeLegitimacyIndex} AS NUMERIC))`,
            avgDcs: sql<number | null>`AVG(CAST(${riskAssessmentsTable.decisionConfidenceScore} AS NUMERIC))`,
          })
          .from(riskAssessmentsTable)
          .where(
            accessibleIds !== null
              ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
          );

        res.json({
          dashboardType,
          decisions,
          criticalWarnings: critWarn?.count ?? 0,
          kpi: {
            avgNationalRiskIndex:             avgKpi?.avgNri ?? null,
            avgAdministrativeLegitimacyIndex: avgKpi?.avgAli ?? null,
            avgDecisionConfidenceScore:       avgKpi?.avgDcs ?? null,
          },
        });
        return;
      }

      // ── undersecretary ────────────────────────────────────────────────────
      if (dashboardType === "undersecretary") {
        const activeDecisions = await db
          .select({
            id:               decisionsTable.id,
            caseNumber:       decisionsTable.caseNumber,
            titleAr:          decisionsTable.titleAr,
            status:           decisionsTable.status,
            organizationUnit: decisionsTable.organizationUnit,
            currentStage:     decisionsTable.currentStage,
          })
          .from(decisionsTable)
          .where(and(decisionsCond, eq(decisionsTable.status, "in_progress")))
          .orderBy(desc(decisionsTable.createdAt))
          .limit(20);

        const [kpiRow] = await db
          .select({
            avgNri: sql<number | null>`AVG(CAST(${riskAssessmentsTable.nationalRiskIndex} AS NUMERIC))`,
            avgAli: sql<number | null>`AVG(CAST(${riskAssessmentsTable.administrativeLegitimacyIndex} AS NUMERIC))`,
            avgDcs: sql<number | null>`AVG(CAST(${riskAssessmentsTable.decisionConfidenceScore} AS NUMERIC))`,
          })
          .from(riskAssessmentsTable)
          .where(
            accessibleIds !== null
              ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
          );

        // Org breakdown
        const orgRows = await db
          .select({
            organizationUnit: decisionsTable.organizationUnit,
            cnt: sql<number>`COUNT(*)::int`,
          })
          .from(decisionsTable)
          .where(decisionsCond)
          .groupBy(decisionsTable.organizationUnit)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(10);

        res.json({
          dashboardType,
          activeDecisions,
          kpi: {
            avgNationalRiskIndex:             kpiRow?.avgNri ?? null,
            avgAdministrativeLegitimacyIndex: kpiRow?.avgAli ?? null,
            avgDecisionConfidenceScore:       kpiRow?.avgDcs ?? null,
          },
          orgBreakdown: orgRows,
        });
        return;
      }

      // ── director_general ──────────────────────────────────────────────────
      if (dashboardType === "director_general") {
        const decisions = await db
          .select({
            id:               decisionsTable.id,
            caseNumber:       decisionsTable.caseNumber,
            titleAr:          decisionsTable.titleAr,
            status:           decisionsTable.status,
            organizationUnit: decisionsTable.organizationUnit,
            riskLevel:        riskAssessmentsTable.riskLevel,
            overallRiskLevel: constitutionalAssessmentsTable.overallRiskLevel,
          })
          .from(decisionsTable)
          .leftJoin(riskAssessmentsTable, eq(riskAssessmentsTable.decisionId, decisionsTable.id))
          .leftJoin(constitutionalAssessmentsTable, eq(constitutionalAssessmentsTable.decisionId, decisionsTable.id))
          .where(decisionsCond)
          .orderBy(desc(decisionsTable.createdAt))
          .limit(20);

        const [riskSum] = await db
          .select({
            avgNri: sql<number | null>`AVG(CAST(${riskAssessmentsTable.nationalRiskIndex} AS NUMERIC))`,
            critCount: sql<number>`COUNT(*) FILTER (WHERE ${riskAssessmentsTable.riskLevel} = 'critical')::int`,
          })
          .from(riskAssessmentsTable)
          .where(
            accessibleIds !== null
              ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
          );

        const [cilSum] = await db
          .select({
            avgCcs: sql<number | null>`AVG(CAST(${constitutionalAssessmentsTable.constitutionalComplianceScore} AS NUMERIC))`,
          })
          .from(constitutionalAssessmentsTable)
          .where(and(
            accessibleIds !== null
              ? sql`${constitutionalAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
            eq(constitutionalAssessmentsTable.status, "completed"),
          ));

        res.json({
          dashboardType,
          org,
          decisions,
          riskSummary: {
            avgNationalRiskIndex: riskSum?.avgNri ?? null,
            criticalRiskCount:   riskSum?.critCount ?? 0,
          },
          cilSummary: {
            avgComplianceScore: cilSum?.avgCcs ?? null,
          },
        });
        return;
      }

      // ── risk_officer ──────────────────────────────────────────────────────
      if (dashboardType === "risk_officer") {
        const byLevelRows = await db
          .select({
            level: riskAssessmentsTable.riskLevel,
            cnt:   sql<number>`COUNT(*)::int`,
          })
          .from(riskAssessmentsTable)
          .where(
            accessibleIds !== null
              ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
          )
          .groupBy(riskAssessmentsTable.riskLevel);

        const byLevel: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 };
        for (const row of byLevelRows) {
          if (row.level) byLevel[row.level] = (byLevel[row.level] ?? 0) + row.cnt;
        }

        const criticalDecisions = await db
          .select({
            id:         decisionsTable.id,
            caseNumber: decisionsTable.caseNumber,
            titleAr:    decisionsTable.titleAr,
            riskLevel:  riskAssessmentsTable.riskLevel,
            nri:        riskAssessmentsTable.nationalRiskIndex,
            ali:        riskAssessmentsTable.administrativeLegitimacyIndex,
            dcs:        riskAssessmentsTable.decisionConfidenceScore,
          })
          .from(decisionsTable)
          .innerJoin(riskAssessmentsTable, eq(riskAssessmentsTable.decisionId, decisionsTable.id))
          .where(and(
            decisionsCond,
            eq(riskAssessmentsTable.riskLevel, "critical"),
          ))
          .orderBy(desc(riskAssessmentsTable.nationalRiskIndex))
          .limit(15);

        const [avgRisk] = await db
          .select({
            avgNri: sql<number | null>`AVG(CAST(${riskAssessmentsTable.nationalRiskIndex} AS NUMERIC))`,
            avgAli: sql<number | null>`AVG(CAST(${riskAssessmentsTable.administrativeLegitimacyIndex} AS NUMERIC))`,
            avgDcs: sql<number | null>`AVG(CAST(${riskAssessmentsTable.decisionConfidenceScore} AS NUMERIC))`,
          })
          .from(riskAssessmentsTable)
          .where(
            accessibleIds !== null
              ? sql`${riskAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
          );

        res.json({
          dashboardType,
          byRiskLevel: byLevel,
          criticalRiskDecisions: criticalDecisions,
          averages: {
            avgNationalRiskIndex:             avgRisk?.avgNri ?? null,
            avgAdministrativeLegitimacyIndex: avgRisk?.avgAli ?? null,
            avgDecisionConfidenceScore:       avgRisk?.avgDcs ?? null,
          },
        });
        return;
      }

      // ── judge ─────────────────────────────────────────────────────────────
      if (dashboardType === "judge") {
        // Sealed decisions with CIL data
        const sealedDecisions = await db
          .select({
            id:                       decisionsTable.id,
            caseNumber:               decisionsTable.caseNumber,
            titleAr:                  decisionsTable.titleAr,
            status:                   decisionsTable.status,
            organizationUnit:         decisionsTable.organizationUnit,
            isSealed:                 decisionDciTable.isSealed,
            constitutionalCompliance: constitutionalAssessmentsTable.constitutionalComplianceScore,
            overallRiskLevel:         constitutionalAssessmentsTable.overallRiskLevel,
            judicialSurvivalProb:     constitutionalAssessmentsTable.judicialSurvivalProbability,
          })
          .from(decisionsTable)
          .innerJoin(decisionDciTable, and(
            eq(decisionDciTable.decisionId, decisionsTable.id),
            eq(decisionDciTable.isSealed, true),
          ))
          .leftJoin(constitutionalAssessmentsTable, eq(constitutionalAssessmentsTable.decisionId, decisionsTable.id))
          .where(decisionsCond)
          .orderBy(desc(decisionsTable.createdAt))
          .limit(20);

        const [jspAvg] = await db
          .select({
            avgJsp: sql<number | null>`AVG(CAST(${constitutionalAssessmentsTable.judicialSurvivalProbability} AS NUMERIC))`,
          })
          .from(constitutionalAssessmentsTable)
          .innerJoin(decisionDciTable, and(
            eq(decisionDciTable.decisionId, constitutionalAssessmentsTable.decisionId),
            eq(decisionDciTable.isSealed, true),
          ))
          .where(and(
            accessibleIds !== null
              ? sql`${constitutionalAssessmentsTable.decisionId} = ANY(ARRAY[${sql.raw(accessibleIds.length > 0 ? accessibleIds.join(",") : "NULL")}]::int[])`
              : sql`1=1`,
            eq(constitutionalAssessmentsTable.status, "completed"),
          ));

        res.json({
          dashboardType,
          sealedDecisions,
          avgJudicialSurvivalProbability: jspAvg?.avgJsp ?? null,
        });
        return;
      }

      // Fallback — should never reach here due to validation above
      e400(res, "Unknown dashboardType");
    } catch (err) {
      console.error("[naip.executive-data]", err);
      e500(res, "Failed to load NAIP executive data");
    }
  },
);

export default router;
