import { Router, type IRouter } from "express";
import { desc, eq, and, gte, sql, type SQL } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { requireOwner, requireSupervisorOrOwner } from "../middlewares/roleAuth";

const router: IRouter = Router();

function parseListParams(query: Record<string, unknown>) {
  const limit = Math.min(500, Math.max(1, parseInt(String(query.limit || "100"), 10) || 100));
  const offset = Math.max(0, parseInt(String(query.offset || "0"), 10) || 0);
  const action = typeof query.action === "string" ? query.action : undefined;
  const entityType = typeof query.entityType === "string" ? query.entityType : undefined;
  const since = typeof query.since === "string" ? query.since : undefined;
  return { limit, offset, action, entityType, since };
}

// GET /audit — list audit logs
router.get("/audit", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const { limit, offset, action, entityType, since } = parseListParams(
    req.query as Record<string, unknown>,
  );
  const userRole = String(req.headers["x-user-role"] || "viewer");
  const userIdRaw = req.headers["x-user-id"];
  const userId = userIdRaw ? parseInt(String(userIdRaw), 10) : null;

  const conditions: SQL[] = [];

  if (userRole === "supervisor" && userId && !Number.isNaN(userId)) {
    conditions.push(eq(auditLogsTable.userId, userId));
  }
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
  if (since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      conditions.push(gte(auditLogsTable.createdAt, sinceDate));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, countResult] = await Promise.all([
    db.select().from(auditLogsTable).where(whereClause).orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogsTable).where(whereClause),
  ]);

  res.json({ logs, total: countResult[0]?.count ?? 0, limit, offset });
});

// DELETE /audit — purge old entries (owner only)
router.delete("/audit", requireOwner, async (req, res): Promise<void> => {
  const daysRaw = parseInt(String(req.query.olderThanDays || "90"), 10);
  if (Number.isNaN(daysRaw) || daysRaw < 7) {
    res.status(400).json({ error: "olderThanDays must be a number >= 7" });
    return;
  }
  const cutoff = new Date(Date.now() - daysRaw * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(auditLogsTable)
    .where(sql`${auditLogsTable.createdAt} < ${cutoff}`)
    .returning();

  req.log.info({ deletedCount: deleted.length, cutoff }, "Audit log purged");
  res.json({ deleted: deleted.length, cutoff: cutoff.toISOString() });
});

export default router;
