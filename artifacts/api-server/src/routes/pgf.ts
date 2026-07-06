/**
 * PGF — Professional Guidance Framework routes
 *
 * GET    /pgf/catalogue              — all sectors + profession summaries
 * GET    /pgf/professions/:sid/:pid  — full profession config (stages, checklist, etc.)
 * POST   /pgf/sessions               — create new session
 * GET    /pgf/sessions               — list user sessions
 * GET    /pgf/sessions/:id           — session detail
 * POST   /pgf/sessions/:id/answer    — submit stage answers → returns next stage
 * POST   /pgf/sessions/:id/finalize  — run AI final assessment
 * DELETE /pgf/sessions/:id           — delete session
 */

import { Router, type IRouter }  from "express";
import { eq, desc, and }         from "drizzle-orm";
import { db, pgfSessionsTable }  from "@workspace/db";
import { requireAnyRole }        from "../middlewares/roleAuth.js";
import {
  getSectorSummaries,
  findProfession,
  resolveNextStage,
  isLastStage,
  toProfessionSummary,
} from "../pgf/config/index.js";
import { runPgfAssessment }      from "../pgf/engine.js";
import type { PgfSessionAnswers } from "../pgf/types.js";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return -1;
  const id = parseInt(Array.isArray(h) ? h[0] : h, 10);
  return Number.isFinite(id) ? id : -1;
}

function safe<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function sessionToApi(s: typeof pgfSessionsTable.$inferSelect) {
  return {
    id:               s.id,
    userId:           s.userId,
    title:            s.title,
    sectorId:         s.sectorId,
    sectorNameAr:     s.sectorNameAr,
    professionId:     s.professionId,
    professionNameAr: s.professionNameAr,
    status:           s.status,
    answers:          safe<PgfSessionAnswers>(s.answers, null as unknown as PgfSessionAnswers),
    triggeredFlags:   safe<string[]>(s.triggeredFlags, []),
    currentStageId:   s.currentStageId,
    completedStages:  safe<string[]>(s.completedStages, []),
    output:           safe(s.output, null),
    createdAt:        s.createdAt,
    updatedAt:        s.updatedAt,
  };
}

// ─── GET /pgf/catalogue ───────────────────────────────────────────────────────
router.get("/pgf/catalogue", requireAnyRole, (_req, res) => {
  res.json({ sectors: getSectorSummaries() });
});

// ─── GET /pgf/professions/:sectorId/:professionId ─────────────────────────────
router.get("/pgf/professions/:sectorId/:professionId", requireAnyRole, (req, res): void => {
  const { sectorId, professionId } = req.params as { sectorId: string; professionId: string };
  const config = findProfession(sectorId, professionId);
  if (!config) { res.status(404).json({ error: "Profession not found" }); return; }
  res.json({
    profession: toProfessionSummary(config),
    stages:     config.workflowStages,
    checklist:  config.finalChecklist,
    legalBasis: config.legalBasis,
    riskIndicators: config.riskIndicators,
  });
});

// ─── POST /pgf/sessions ───────────────────────────────────────────────────────
router.post("/pgf/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const { sectorId, professionId } = req.body as { sectorId: string; professionId: string };

  if (!sectorId || !professionId) {
    res.status(400).json({ error: "sectorId and professionId are required" });
    return;
  }

  const config = findProfession(sectorId, professionId);
  if (!config) {
    res.status(400).json({ error: "Invalid sectorId or professionId" });
    return;
  }

  const firstStageId = config.workflowStages[0]?.id ?? null;
  const title = `${config.professionNameAr} — ${new Date().toLocaleDateString("ar-AE")}`;

  const [session] = await db.insert(pgfSessionsTable).values({
    userId:           uid,
    title,
    sectorId:         config.sectorId,
    sectorNameAr:     config.sectorNameAr,
    professionId:     config.professionId,
    professionNameAr: config.professionNameAr,
    status:           "draft",
    currentStageId:   firstStageId,
    completedStages:  JSON.stringify([]),
    triggeredFlags:   JSON.stringify([]),
    updatedAt:        new Date(),
  }).returning();

  res.status(201).json({ session: sessionToApi(session) });
});

// ─── GET /pgf/sessions ────────────────────────────────────────────────────────
router.get("/pgf/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid      = getUserId(req);
  const sessions = await db
    .select({
      id:               pgfSessionsTable.id,
      title:            pgfSessionsTable.title,
      sectorId:         pgfSessionsTable.sectorId,
      sectorNameAr:     pgfSessionsTable.sectorNameAr,
      professionId:     pgfSessionsTable.professionId,
      professionNameAr: pgfSessionsTable.professionNameAr,
      status:           pgfSessionsTable.status,
      currentStageId:   pgfSessionsTable.currentStageId,
      completedStages:  pgfSessionsTable.completedStages,
      createdAt:        pgfSessionsTable.createdAt,
      updatedAt:        pgfSessionsTable.updatedAt,
    })
    .from(pgfSessionsTable)
    .where(eq(pgfSessionsTable.userId, uid))
    .orderBy(desc(pgfSessionsTable.createdAt))
    .limit(100);

  res.json({
    sessions: sessions.map((s) => ({
      ...s,
      completedStages: safe<string[]>(s.completedStages, []),
    })),
  });
});

// ─── GET /pgf/sessions/:id ────────────────────────────────────────────────────
router.get("/pgf/sessions/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [row] = await db.select().from(pgfSessionsTable)
    .where(and(eq(pgfSessionsTable.id, id), eq(pgfSessionsTable.userId, uid)));

  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  res.json({ session: sessionToApi(row) });
});

// ─── POST /pgf/sessions/:id/answer ───────────────────────────────────────────
router.post("/pgf/sessions/:id/answer", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [row] = await db.select().from(pgfSessionsTable)
    .where(and(eq(pgfSessionsTable.id, id), eq(pgfSessionsTable.userId, uid)));
  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  if (row.status !== "draft") {
    res.status(400).json({ error: "Session is not in draft status" }); return;
  }

  const { stageId, stageAnswers } = req.body as {
    stageId:      string;
    stageAnswers: Record<string, string | string[] | boolean>;
  };
  if (!stageId || !stageAnswers) {
    res.status(400).json({ error: "stageId and stageAnswers are required" }); return;
  }

  // Ensure client is advancing the correct current stage (not an arbitrary stage id)
  if (row.currentStageId && stageId !== row.currentStageId) {
    res.status(400).json({ error: "stageId does not match the current stage" }); return;
  }

  const config = findProfession(row.sectorId, row.professionId);
  if (!config) { res.status(500).json({ error: "Profession config not found" }); return; }

  // Merge answers
  const existingAnswers: PgfSessionAnswers = safe<PgfSessionAnswers>(row.answers, {});
  existingAnswers[stageId] = stageAnswers;

  // Update completed stages
  const completedStages: string[] = safe<string[]>(row.completedStages, []);
  if (!completedStages.includes(stageId)) completedStages.push(stageId);

  // Update triggered flags
  const triggeredFlags: string[] = safe<string[]>(row.triggeredFlags, []);

  // Resolve next stage via decision tree
  const { nextStageId: rawNextId, addedFlag } = resolveNextStage(config, stageId, stageAnswers);
  if (addedFlag && !triggeredFlags.includes(addedFlag)) triggeredFlags.push(addedFlag);

  // Determine true next stage: skip already-completed stages
  let effectiveNextId = rawNextId;
  while (effectiveNextId && completedStages.includes(effectiveNextId)) {
    const nextConfig = config.workflowStages.find((s) => s.id === effectiveNextId);
    effectiveNextId = nextConfig?.defaultNextStageId ?? null;
  }

  // Check if all stages are done
  const allStageIds = config.workflowStages.map((s) => s.id);
  const allComplete = allStageIds.every((sid) => completedStages.includes(sid));
  const isComplete  = allComplete || effectiveNextId === null;

  const [updated] = await db.update(pgfSessionsTable).set({
    answers:         JSON.stringify(existingAnswers),
    completedStages: JSON.stringify(completedStages),
    triggeredFlags:  JSON.stringify(triggeredFlags),
    currentStageId:  isComplete ? null : (effectiveNextId ?? rawNextId),
    updatedAt:       new Date(),
  }).where(eq(pgfSessionsTable.id, id)).returning();

  res.json({
    nextStageId: isComplete ? null : (effectiveNextId ?? rawNextId),
    isComplete,
    addedFlag,
    session:     sessionToApi(updated),
  });
});

// ─── POST /pgf/sessions/:id/finalize ─────────────────────────────────────────
router.post("/pgf/sessions/:id/finalize", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [row] = await db.select().from(pgfSessionsTable)
    .where(and(eq(pgfSessionsTable.id, id), eq(pgfSessionsTable.userId, uid)));
  if (!row) { res.status(404).json({ error: "Session not found" }); return; }

  // Already complete — return cached output without re-running AI
  if (row.status === "complete") {
    res.json({ session: sessionToApi(row) }); return;
  }
  // Reject if not in a finalizable state
  if (row.status !== "draft") {
    res.status(400).json({ error: `Session cannot be finalized in status: ${row.status}` }); return;
  }
  // Require that all workflow stages have been answered
  const config = findProfession(row.sectorId, row.professionId);
  if (!config) { res.status(500).json({ error: "Profession config not found" }); return; }
  const completedStages: string[] = safe<string[]>(row.completedStages, []);
  const allStageIds = config.workflowStages.map((s) => s.id);
  if (!allStageIds.every((sid) => completedStages.includes(sid))) {
    res.status(400).json({ error: "All workflow stages must be completed before finalizing" }); return;
  }

  const answers:        PgfSessionAnswers = safe<PgfSessionAnswers>(row.answers, {});
  const triggeredFlags: string[]          = safe<string[]>(row.triggeredFlags, []);

  await db.update(pgfSessionsTable).set({ status: "finalizing", updatedAt: new Date() })
    .where(eq(pgfSessionsTable.id, id));

  try {
    const output = await runPgfAssessment({ config, answers, triggeredFlags });

    const [updated] = await db.update(pgfSessionsTable).set({
      status:    "complete",
      output:    JSON.stringify(output),
      updatedAt: new Date(),
    }).where(eq(pgfSessionsTable.id, id)).returning();

    res.json({ session: sessionToApi(updated) });
  } catch (err) {
    req.log?.error({ err }, "PGF finalize failed");
    await db.update(pgfSessionsTable).set({ status: "error", updatedAt: new Date() })
      .where(eq(pgfSessionsTable.id, id));
    res.status(500).json({ error: "Assessment generation failed. Please try again." });
  }
});

// ─── DELETE /pgf/sessions/:id ─────────────────────────────────────────────────
router.delete("/pgf/sessions/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [deleted] = await db.delete(pgfSessionsTable)
    .where(and(eq(pgfSessionsTable.id, id), eq(pgfSessionsTable.userId, uid)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Session not found" }); return; }
  res.json({ ok: true });
});

export default router;
