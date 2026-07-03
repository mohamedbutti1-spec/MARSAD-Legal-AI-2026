/**
 * Dashboard stats route
 * GET /api/dashboard/stats — KPI counts for the dashboard page
 */
import { Router, type IRouter } from "express";
import { sql, and, gte, like } from "drizzle-orm";
import { db, legalSourcesTable, auditLogsTable, usersTable } from "@workspace/db";
import { requireAnyRole } from "../middlewares/roleAuth";
import { cache, TTL } from "../lib/cache";

const router: IRouter = Router();

router.get("/dashboard/stats", requireAnyRole, async (req, res): Promise<void> => {
  const cacheKey = "dashboard:stats";
  const cached = cache.get<unknown>(cacheKey);
  if (cached) { res.json(cached); return; }

  // Start of current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    legalSourcesResult,
    aiQueriesResult,
    activeUsersResult,
    totalUsersResult,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(legalSourcesTable),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogsTable)
      .where(and(
        like(auditLogsTable.action, "ai.%"),
        gte(auditLogsTable.createdAt, new Date(startOfMonth)),
      )),
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable)
      .where(sql`${usersTable.isActive} = true`),
    db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
  ]);

  const payload = {
    legalSourcesCount: legalSourcesResult[0]?.count ?? 0,
    aiQueriesThisMonth: aiQueriesResult[0]?.count ?? 0,
    activeUsers: activeUsersResult[0]?.count ?? 0,
    totalUsers: totalUsersResult[0]?.count ?? 0,
  };

  cache.set(cacheKey, payload, TTL.SHORT);
  res.json(payload);
});

export default router;
