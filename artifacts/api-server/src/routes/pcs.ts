/**
 * PCS — Professional Case Simulator — API Routes
 *
 * All session-mutating routes are scoped to the requesting user via getUserId().
 * IDOR is prevented by AND-ing session.id with session.user_id in every query.
 *
 * GET  /pcs/scenarios/:sectorId/:professionId   — scenario config (no ownership)
 * POST /pcs/sessions                             — start a new simulation session
 * GET  /pcs/sessions                             — list own sessions
 * GET  /pcs/sessions/:id                         — get own session + steps
 * POST /pcs/sessions/:id/answer                  — submit answer to current step
 * GET  /pcs/sessions/:id/report                  — get final report (must be completed)
 */

import { Router, type IRouter } from "express";
import { eq, and, desc }        from "drizzle-orm";
import {
  db, pcsSessionsTable, pcsSessionStepsTable,
} from "@workspace/db";
import { requireAnyRole }                    from "../middlewares/roleAuth.js";
import { findScenario }                      from "../pcs/config.js";
import { evaluateStep, buildFinalReport }    from "../pcs/ai-evaluator.js";
import { migratePcs }                        from "../pcs/migration.js";
import { getUserId }                         from "../lib/route-helpers.js";

const router: IRouter = Router();

// ─── Lazy migration ───────────────────────────────────────────────────────────
let migrated = false;
async function ensureMigrated() {
  if (migrated) return;
  await migratePcs();
  migrated = true;
}

// ─── GET /pcs/scenarios/:sectorId/:professionId ───────────────────────────────
router.get(
  "/pcs/scenarios/:sectorId/:professionId",
  requireAnyRole,
  (req, res): void => {
    const { sectorId, professionId } = req.params as Record<string, string>;
    const scenario = findScenario(sectorId, professionId);
    if (!scenario) {
      res.status(404).json({ error: "No simulation scenario for this profession" });
      return;
    }
    // Return config minus the expectedAnswerHint (training secret)
    res.json({
      scenarioId:      scenario.scenarioId,
      scenarioTitle:   scenario.scenarioTitle,
      scenarioContext: scenario.scenarioContext,
      stepCount:       scenario.steps.length,
      steps: scenario.steps.map((s) => ({
        id:                s.id,
        question:          s.question,
        critical:          s.critical,
        requiredDocuments: s.requiredDocuments,
        requiredApprovals: s.requiredApprovals,
      })),
    });
  },
);

// ─── POST /pcs/sessions ───────────────────────────────────────────────────────
router.post(
  "/pcs/sessions",
  requireAnyRole,
  async (req, res): Promise<void> => {
    await ensureMigrated();
    const uid = getUserId(req);
    const { sectorId, professionId } = req.body as Record<string, string>;

    if (!sectorId || !professionId) {
      res.status(400).json({ error: "sectorId and professionId are required" });
      return;
    }

    const scenario = findScenario(sectorId, professionId);
    if (!scenario) {
      res.status(404).json({ error: "No simulation scenario for this profession" });
      return;
    }

    try {
      const [session] = await db
        .insert(pcsSessionsTable)
        .values({
          userId:         uid,
          sectorId,
          professionId,
          scenarioId:     scenario.scenarioId,
          status:         "in_progress",
          currentStepIdx: 0,
        })
        .returning();

      const firstStep = scenario.steps[0]!;
      res.status(201).json({
        session,
        currentStep: {
          stepIdx:           0,
          id:                firstStep.id,
          question:          firstStep.question,
          critical:          firstStep.critical,
          requiredDocuments: firstStep.requiredDocuments,
          requiredApprovals: firstStep.requiredApprovals,
          totalSteps:        scenario.steps.length,
        },
        scenarioTitle:   scenario.scenarioTitle,
        scenarioContext: scenario.scenarioContext,
      });
    } catch {
      res.status(500).json({ error: "Failed to create simulation session" });
    }
  },
);

// ─── GET /pcs/sessions ────────────────────────────────────────────────────────
router.get(
  "/pcs/sessions",
  requireAnyRole,
  async (req, res): Promise<void> => {
    const uid = getUserId(req);
    const { sectorId, professionId } = req.query as Record<string, string>;
    try {
      const conditions: ReturnType<typeof eq>[] = [eq(pcsSessionsTable.userId, uid)];
      if (sectorId)     conditions.push(eq(pcsSessionsTable.sectorId,     sectorId));
      if (professionId) conditions.push(eq(pcsSessionsTable.professionId, professionId));

      const sessions = await db
        .select()
        .from(pcsSessionsTable)
        .where(and(...(conditions as [ReturnType<typeof eq>])))
        .orderBy(desc(pcsSessionsTable.createdAt))
        .limit(20);

      res.json({ sessions });
    } catch {
      res.status(500).json({ error: "Failed to list sessions" });
    }
  },
);

// ─── GET /pcs/sessions/:id ────────────────────────────────────────────────────
router.get(
  "/pcs/sessions/:id",
  requireAnyRole,
  async (req, res): Promise<void> => {
    const uid = getUserId(req);
    const id  = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    try {
      const [session] = await db
        .select()
        .from(pcsSessionsTable)
        .where(and(eq(pcsSessionsTable.id, id), eq(pcsSessionsTable.userId, uid)));

      if (!session) { res.status(404).json({ error: "Session not found" }); return; }

      const steps = await db
        .select()
        .from(pcsSessionStepsTable)
        .where(eq(pcsSessionStepsTable.sessionId, id))
        .orderBy(pcsSessionStepsTable.stepIdx);

      const scenario = findScenario(session.sectorId, session.professionId);
      let nextStep   = null;
      if (session.status === "in_progress" && scenario) {
        const cfg = scenario.steps[session.currentStepIdx];
        if (cfg) {
          nextStep = {
            stepIdx:           session.currentStepIdx,
            id:                cfg.id,
            question:          cfg.question,
            critical:          cfg.critical,
            requiredDocuments: cfg.requiredDocuments,
            requiredApprovals: cfg.requiredApprovals,
            totalSteps:        scenario.steps.length,
          };
        }
      }

      res.json({
        session,
        steps,
        nextStep,
        scenarioTitle:   scenario?.scenarioTitle,
        scenarioContext: scenario?.scenarioContext,
      });
    } catch {
      res.status(500).json({ error: "Failed to load session" });
    }
  },
);

// ─── POST /pcs/sessions/:id/answer ───────────────────────────────────────────
router.post(
  "/pcs/sessions/:id/answer",
  requireAnyRole,
  async (req, res): Promise<void> => {
    const uid = getUserId(req);
    const id  = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { answer } = req.body as { answer?: string };
    if (!answer || answer.trim().length < 5) {
      res.status(400).json({ error: "Answer is too short" });
      return;
    }

    try {
      const [session] = await db
        .select()
        .from(pcsSessionsTable)
        .where(and(eq(pcsSessionsTable.id, id), eq(pcsSessionsTable.userId, uid)));

      if (!session) { res.status(404).json({ error: "Session not found" }); return; }
      if (session.status === "completed") {
        res.status(409).json({ error: "Session already completed" });
        return;
      }

      const scenario = findScenario(session.sectorId, session.professionId);
      if (!scenario) { res.status(500).json({ error: "Scenario config missing" }); return; }

      const stepIdx = session.currentStepIdx;
      const stepCfg = scenario.steps[stepIdx];
      if (!stepCfg) { res.status(400).json({ error: "No more steps" }); return; }

      // AI evaluation (criticalError is computed server-side inside evaluateStep)
      const evaluation = await evaluateStep(scenario, stepCfg, answer.trim());

      // Persist step record
      await db.insert(pcsSessionStepsTable).values({
        sessionId:       id,
        stepIdx,
        stepId:          stepCfg.id,
        question:        stepCfg.question,
        userAnswer:      answer.trim(),
        aiScore:         evaluation.score,
        aiEvaluation:    evaluation.evaluation,
        recommendation:  evaluation.recommendation,
        missedDocuments: JSON.stringify(evaluation.missedDocuments),
        missedApprovals: JSON.stringify(evaluation.missedApprovals),
        criticalError:   evaluation.criticalError,
      });

      const nextStepIdx = stepIdx + 1;
      const isLastStep  = nextStepIdx >= scenario.steps.length;

      if (isLastStep) {
        const allSteps = await db
          .select()
          .from(pcsSessionStepsTable)
          .where(eq(pcsSessionStepsTable.sessionId, id));

        const report = buildFinalReport(allSteps, scenario);

        await db
          .update(pcsSessionsTable)
          .set({
            status:         "completed",
            currentStepIdx: nextStepIdx,
            totalScore:     report.totalScore,
            grade:          report.grade,
            completedAt:    new Date(),
          })
          .where(and(eq(pcsSessionsTable.id, id), eq(pcsSessionsTable.userId, uid)));

        res.json({ evaluation, isLastStep: true, report, sessionId: id });
      } else {
        await db
          .update(pcsSessionsTable)
          .set({ currentStepIdx: nextStepIdx })
          .where(and(eq(pcsSessionsTable.id, id), eq(pcsSessionsTable.userId, uid)));

        const nextCfg = scenario.steps[nextStepIdx]!;
        res.json({
          evaluation,
          isLastStep: false,
          nextStep: {
            stepIdx:           nextStepIdx,
            id:                nextCfg.id,
            question:          nextCfg.question,
            critical:          nextCfg.critical,
            requiredDocuments: nextCfg.requiredDocuments,
            requiredApprovals: nextCfg.requiredApprovals,
            totalSteps:        scenario.steps.length,
          },
        });
      }
    } catch (err) {
      console.error("PCS answer error:", err);
      res.status(500).json({ error: "Failed to process answer" });
    }
  },
);

// ─── GET /pcs/sessions/:id/report ────────────────────────────────────────────
router.get(
  "/pcs/sessions/:id/report",
  requireAnyRole,
  async (req, res): Promise<void> => {
    const uid = getUserId(req);
    const id  = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    try {
      const [session] = await db
        .select()
        .from(pcsSessionsTable)
        .where(and(eq(pcsSessionsTable.id, id), eq(pcsSessionsTable.userId, uid)));

      if (!session) { res.status(404).json({ error: "Session not found" }); return; }
      if (session.status !== "completed") {
        res.status(409).json({ error: "Session not yet completed" });
        return;
      }

      const steps = await db
        .select()
        .from(pcsSessionStepsTable)
        .where(eq(pcsSessionStepsTable.sessionId, id))
        .orderBy(pcsSessionStepsTable.stepIdx);

      const scenario = findScenario(session.sectorId, session.professionId);
      if (!scenario) { res.status(500).json({ error: "Scenario config missing" }); return; }

      const report = buildFinalReport(steps, scenario);
      res.json({ session, report, scenarioTitle: scenario.scenarioTitle });
    } catch {
      res.status(500).json({ error: "Failed to generate report" });
    }
  },
);

export default router;
