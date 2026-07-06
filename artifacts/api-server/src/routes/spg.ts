/**
 * SPG — Smart Professional Guidance routes
 *
 * GET    /spg/sessions           — list user's SPG sessions
 * GET    /spg/sessions/:id       — single session detail
 * POST   /spg/sessions           — create session (draft, no AI yet)
 * POST   /spg/sessions/:id/run   — submit wizard answers and run AI guidance
 * DELETE /spg/sessions/:id       — delete (owner only)
 */

import { Router, type IRouter } from "express";
import { eq, desc, and }        from "drizzle-orm";
import { db, spgSessionsTable } from "@workspace/db";
import { requireAnyRole }       from "../middlewares/roleAuth";
import { runSpgGuidance }       from "../utils/spg-engine";

// ─── Allowed sector / role catalogue (mirrors frontend types/spg.ts) ──────────
const VALID_SECTORS = new Map<string, Set<string>>([
  ["law_judiciary",          new Set(["judge","prosecutor","lawyer","legal_advisor","legal_researcher"])],
  ["security_investigation", new Set(["police_officer","judicial_officer","forensic_investigator","forensic_evidence","crime_scene"])],
  ["government_admin",       new Set(["admin_decision_maker","admin_investigator","hr","legal_affairs"])],
  ["governance_oversight",   new Set(["internal_audit","risk_management","compliance","anti_corruption"])],
  ["strategy_development",   new Set(["strategic_planning","kpi_management","project_management","change_management"])],
  ["quality_standards",      new Set(["iso","efqm","six_sigma"])],
  ["finance_economy",        new Set(["government_finance","taxation","procurement","contracts"])],
  ["ai_digital",             new Set(["ai_governance","algorithm_review","data_protection","cybersecurity"])],
  ["academics",              new Set(["researcher","scientific_supervisor","masters_student","phd_student"])],
]);

function validateSectorRole(sectorId: string, roleId: string): boolean {
  const roles = VALID_SECTORS.get(sectorId);
  return !!roles && roles.has(roleId);
}

const router: IRouter = Router();

function getUserId(req: import("express").Request): number {
  const h  = req.headers["x-user-id"];
  if (!h) return -1;
  const id = parseInt(Array.isArray(h) ? h[0] : h, 10);
  return Number.isFinite(id) ? id : -1;
}

function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

// ─── GET /spg/sessions ────────────────────────────────────────────────────────
router.get("/spg/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid      = getUserId(req);
  const sessions = await db
    .select({
      id:           spgSessionsTable.id,
      title:        spgSessionsTable.title,
      sectorId:     spgSessionsTable.sectorId,
      sectorNameAr: spgSessionsTable.sectorNameAr,
      roleId:       spgSessionsTable.roleId,
      roleNameAr:   spgSessionsTable.roleNameAr,
      status:       spgSessionsTable.status,
      createdAt:    spgSessionsTable.createdAt,
      updatedAt:    spgSessionsTable.updatedAt,
    })
    .from(spgSessionsTable)
    .where(eq(spgSessionsTable.userId, uid))
    .orderBy(desc(spgSessionsTable.createdAt))
    .limit(50);

  res.json({ sessions });
});

// ─── GET /spg/sessions/:id ────────────────────────────────────────────────────
router.get("/spg/sessions/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [session] = await db
    .select()
    .from(spgSessionsTable)
    .where(and(eq(spgSessionsTable.id, id), eq(spgSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  res.json({
    session: {
      ...session,
      answers: safeJsonParse(session.answers, null),
      output:  safeJsonParse(session.output,  null),
    },
  });
});

// ─── POST /spg/sessions ───────────────────────────────────────────────────────
router.post("/spg/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const {
    sectorId,
    sectorNameAr,
    roleId,
    roleNameAr,
  } = req.body as {
    sectorId:     string;
    sectorNameAr: string;
    roleId:       string;
    roleNameAr:   string;
  };

  if (!sectorId || !roleId) {
    res.status(400).json({ error: "sectorId and roleId are required" });
    return;
  }
  if (!validateSectorRole(sectorId, roleId)) {
    res.status(400).json({ error: "Invalid sectorId or roleId — must be from the allowed catalogue" });
    return;
  }

  const title = `إرشاد ${roleNameAr} — ${new Date().toLocaleDateString("ar-AE")}`;

  const [session] = await db.insert(spgSessionsTable).values({
    userId:       uid,
    title,
    sectorId,
    sectorNameAr,
    roleId,
    roleNameAr,
    status:       "draft",
    updatedAt:    new Date(),
  }).returning();

  res.status(201).json({ session: { ...session, answers: null, output: null } });
});

// ─── POST /spg/sessions/:id/run ───────────────────────────────────────────────
router.post("/spg/sessions/:id/run", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [session] = await db
    .select()
    .from(spgSessionsTable)
    .where(and(eq(spgSessionsTable.id, id), eq(spgSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const { answers } = req.body as {
    answers: {
      incident:  string;
      stage:     string;
      documents: string;
      action:    string;
      risks:     string;
      nextStep:  string;
    };
  };

  if (!answers?.incident || answers.incident.trim().length < 20) {
    res.status(400).json({ error: "answers.incident is required (min 20 chars)" });
    return;
  }

  // Mark as analyzing and persist answers
  await db.update(spgSessionsTable).set({
    status:    "analyzing",
    answers:   JSON.stringify(answers),
    updatedAt: new Date(),
  }).where(eq(spgSessionsTable.id, id));

  try {
    const output = await runSpgGuidance({
      sectorId:     session.sectorId,
      sectorNameAr: session.sectorNameAr,
      roleId:       session.roleId,
      roleNameAr:   session.roleNameAr,
      answers,
    });

    const [updated] = await db.update(spgSessionsTable).set({
      status:    "complete",
      output:    JSON.stringify(output),
      updatedAt: new Date(),
    }).where(eq(spgSessionsTable.id, id)).returning();

    res.json({
      session: {
        ...updated,
        answers,
        output,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "SPG analysis failed");
    await db.update(spgSessionsTable).set({ status: "error", updatedAt: new Date() })
      .where(eq(spgSessionsTable.id, id));
    res.status(500).json({ error: "Guidance generation failed. Please try again." });
  }
});

// ─── DELETE /spg/sessions/:id ─────────────────────────────────────────────────
router.delete("/spg/sessions/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [deleted] = await db
    .delete(spgSessionsTable)
    .where(and(eq(spgSessionsTable.id, id), eq(spgSessionsTable.userId, uid)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Session not found" }); return; }
  res.json({ ok: true });
});

export default router;
