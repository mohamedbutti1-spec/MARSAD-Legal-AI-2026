/**
 * Beta Programme — reviewer feedback routes
 *
 * POST /api/beta/feedback        — submit feedback (any authenticated role)
 * GET  /api/beta/feedback        — list all feedback (owner only)
 * GET  /api/beta/feedback/stats  — category + severity breakdown (owner only)
 *
 * NOTE: requireRole() returns an array [authenticate, checkFn]. In Express 5
 * array middleware passed to router.get() is registered method-agnostically and
 * bleeds into POST handlers on the same path. All guards here are therefore
 * inlined as single functions to avoid that pitfall.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUserId, getValidatedRole } from "../lib/route-helpers.js";
import { migrateBeta } from "../beta/migration.js";

// ─── Lazy migration guard ─────────────────────────────────────────────────────
let _migrated = false;
async function ensureMigrated() {
  if (_migrated) return;
  await migrateBeta();
  _migrated = true;
}

// ─── Inline owner guard (avoids Express-5 array-middleware bleed) ─────────────
function requireOwner(req: Request, res: Response): boolean {
  if (req.user?.role === "owner") return true;
  res.status(403).json({ error: "Owner access required." });
  return false;
}

const router: IRouter = Router();

// ─── POST /api/beta/feedback ─────────────────────────────────────────────────
// Global app.ts authenticate already ran — req.user is set for all 14 roles.
router.post(
  "/beta/feedback",
  async (req, res): Promise<void> => {
    await ensureMigrated();
    const userId   = getUserId(req);
    const role     = getValidatedRole(req);

    const { pagePath, pageTitle, category, description, severity, browserInfo } =
      req.body as Record<string, string>;

    if (!description || description.trim().length < 5) {
      res.status(400).json({ error: "Description must be at least 5 characters" });
      return;
    }

    const VALID_CATEGORIES = ["bug","ui_ux","performance","feature_request","security","content","other"] as const;
    const VALID_SEVERITIES = ["low","medium","high","critical"] as const;

    const cat = VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])
      ? category : "other";
    const sev = VALID_SEVERITIES.includes(severity as typeof VALID_SEVERITIES[number])
      ? severity : "medium";

    try {
      await db.execute(sql`
        INSERT INTO beta_feedback
          (reviewer_user_id, reviewer_role, page_path, page_title,
           category, description, severity, browser_info)
        VALUES (
          ${userId},
          ${role},
          ${pagePath  ?? ""},
          ${pageTitle ?? ""},
          ${cat},
          ${description.trim()},
          ${sev},
          ${browserInfo ?? null}
        )
      `);
      res.status(201).json({ ok: true, message: "Feedback recorded — thank you." });
    } catch {
      res.status(500).json({ error: "Failed to save feedback" });
    }
  },
);

// ─── GET /api/beta/feedback ───────────────────────────────────────────────────
router.get(
  "/beta/feedback",
  async (req, res): Promise<void> => {
    if (!requireOwner(req, res)) return;
    await ensureMigrated();
    try {
      const rows = await db.execute(sql`
        SELECT
          f.id,
          f.reviewer_user_id,
          f.reviewer_role,
          f.page_path,
          f.page_title,
          f.category,
          f.description,
          f.severity,
          f.browser_info,
          f.created_at
        FROM beta_feedback f
        ORDER BY f.created_at DESC
        LIMIT 500
      `);
      res.json({ feedback: rows.rows, total: rows.rows.length });
    } catch {
      res.status(500).json({ error: "Failed to retrieve feedback" });
    }
  },
);

// ─── GET /api/beta/feedback/stats ────────────────────────────────────────────
router.get(
  "/beta/feedback/stats",
  async (req, res): Promise<void> => {
    if (!requireOwner(req, res)) return;
    await ensureMigrated();
    try {
      const byCat = await db.execute(sql`
        SELECT category, COUNT(*)::int AS count
        FROM   beta_feedback
        GROUP  BY category
        ORDER  BY count DESC
      `);
      const bySev = await db.execute(sql`
        SELECT severity, COUNT(*)::int AS count
        FROM   beta_feedback
        GROUP  BY severity
        ORDER  BY CASE severity
          WHEN 'critical' THEN 1 WHEN 'high' THEN 2
          WHEN 'medium'   THEN 3 WHEN 'low'  THEN 4
          ELSE 5 END
      `);
      const total = await db.execute(sql`SELECT COUNT(*)::int AS count FROM beta_feedback`);
      res.json({
        total:      total.rows[0]?.count ?? 0,
        byCategory: byCat.rows,
        bySeverity: bySev.rows,
      });
    } catch {
      res.status(500).json({ error: "Failed to retrieve stats" });
    }
  },
);

export default router;
