/**
 * JRE — Judicial Reasoning Engine routes
 *
 * GET    /jre/sessions           — list user's JRE sessions
 * GET    /jre/sessions/:id       — single session detail
 * POST   /jre/sessions           — create session + run full analysis
 * POST   /jre/sessions/:id/follow-up — follow-up question on a judgment
 * DELETE /jre/sessions/:id       — delete (owner only)
 */

import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, jreSessionsTable } from "@workspace/db";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { aiRouter, TaskType } from "../ai";
import { parseModelJson } from "../ai/providers/interface";
import { runJudicialAnalysis } from "../utils/judicial-reasoning-engine";
import type { JreParties } from "../utils/judicial-reasoning-engine";

const router: IRouter = Router();

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h, 10);
}

// ─── GET /jre/sessions ─────────────────────────────────────────────────────────
router.get("/jre/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const sessions = await db
    .select({
      id:           jreSessionsTable.id,
      title:        jreSessionsTable.title,
      disputeType:  jreSessionsTable.disputeType,
      hasAiDecision: jreSessionsTable.hasAiDecision,
      theoryLensId: jreSessionsTable.theoryLensId,
      theoryLensName: jreSessionsTable.theoryLensName,
      status:       jreSessionsTable.status,
      legalityScore: jreSessionsTable.legalityScore,
      riskScore:    jreSessionsTable.riskScore,
      createdAt:    jreSessionsTable.createdAt,
      updatedAt:    jreSessionsTable.updatedAt,
    })
    .from(jreSessionsTable)
    .where(eq(jreSessionsTable.userId, uid))
    .orderBy(desc(jreSessionsTable.createdAt))
    .limit(50);

  res.json({ sessions });
});

// ─── GET /jre/sessions/:id ─────────────────────────────────────────────────────
router.get("/jre/sessions/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [session] = await db
    .select()
    .from(jreSessionsTable)
    .where(and(eq(jreSessionsTable.id, id), eq(jreSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  // Parse JSON fields
  const parsed = {
    ...session,
    parties:   safeJsonParse(session.parties, {}),
    stageData: safeJsonParse(session.stageData, null),
    judgment:  safeJsonParse(session.judgment,  null),
  };

  res.json({ session: parsed });
});

// ─── POST /jre/sessions ────────────────────────────────────────────────────────
router.post("/jre/sessions", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const {
    title,
    disputeSummary,
    parties = {},
    disputeType = "annulment",
    hasAiDecision = false,
    theoryLensId = null,
    theoryLensName = null,
    customTheoryText = null,
  } = req.body as {
    title?:           string;
    disputeSummary:   string;
    parties?:         Partial<JreParties>;
    disputeType?:     string;
    hasAiDecision?:   boolean;
    theoryLensId?:    string | null;
    theoryLensName?:  string | null;
    customTheoryText?: string | null;
  };

  // Validation
  if (!disputeSummary || disputeSummary.trim().length < 50) {
    res.status(400).json({ error: "disputeSummary is required and must be at least 50 characters" });
    return;
  }
  if (!parties.applicant && !parties.applicantAr) {
    res.status(400).json({ error: "parties.applicant (or applicantAr) is required" });
    return;
  }
  if (!parties.respondent && !parties.respondentAr) {
    res.status(400).json({ error: "parties.respondent (or respondentAr) is required" });
    return;
  }

  const normalizedParties: JreParties = {
    applicant:    parties.applicant    || parties.applicantAr    || "",
    respondent:   parties.respondent   || parties.respondentAr   || "",
    applicantAr:  parties.applicantAr  || parties.applicant      || "",
    respondentAr: parties.respondentAr || parties.respondent     || "",
  };

  const sessionTitle = title?.trim() || `تحليل ${disputeType} — ${new Date().toLocaleDateString("ar-AE")}`;

  // Create session in "analyzing" state
  const [session] = await db.insert(jreSessionsTable).values({
    userId:          uid,
    title:           sessionTitle,
    disputeSummary:  disputeSummary.trim(),
    parties:         JSON.stringify(normalizedParties),
    disputeType,
    hasAiDecision:   hasAiDecision ? "true" : "false",
    theoryLensId:    theoryLensId  || null,
    theoryLensName:  theoryLensName || null,
    customTheoryText: customTheoryText || null,
    status:          "analyzing",
    updatedAt:       new Date(),
  }).returning();

  // Run analysis pipeline
  try {
    const { judgment, stageData, legalityScore, riskScore } = await runJudicialAnalysis({
      disputeSummary:  disputeSummary.trim(),
      parties:         normalizedParties,
      disputeType,
      hasAiDecision,
      theoryLensId:    theoryLensId || null,
      theoryLensName:  theoryLensName || null,
      customTheoryText: customTheoryText || null,
      userId:          uid,
    });

    const [updated] = await db
      .update(jreSessionsTable)
      .set({
        status:    "complete",
        stageData: JSON.stringify(stageData),
        judgment:  JSON.stringify(judgment),
        legalityScore: legalityScore ?? null,
        riskScore:     riskScore     ?? null,
        updatedAt: new Date(),
      })
      .where(eq(jreSessionsTable.id, session.id))
      .returning();

    res.json({
      session: {
        ...updated,
        parties:   normalizedParties,
        stageData,
        judgment,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "JRE analysis failed");

    await db
      .update(jreSessionsTable)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(jreSessionsTable.id, session.id));

    res.status(500).json({
      error:     "Analysis failed. Please try again.",
      sessionId: session.id,
      detail:    (err as Error).message,
    });
  }
});

// ─── POST /jre/sessions/:id/follow-up ─────────────────────────────────────────
router.post("/jre/sessions/:id/follow-up", requireAnyRole, async (req, res): Promise<void> => {
  const id      = parseInt(req.params.id as string, 10);
  const uid     = getUserId(req);
  const { message } = req.body as { message?: string };

  if (isNaN(id))          { res.status(400).json({ error: "Invalid session id" }); return; }
  if (!message?.trim())   { res.status(400).json({ error: "message is required" }); return; }

  const [session] = await db
    .select()
    .from(jreSessionsTable)
    .where(and(eq(jreSessionsTable.id, id), eq(jreSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (session.status !== "complete") {
    res.status(422).json({ error: "Session analysis not yet complete" });
    return;
  }

  const judgment = safeJsonParse(session.judgment, null);
  if (!judgment) { res.status(422).json({ error: "No judgment available" }); return; }

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  const systemPrompt = `أنت قاضٍ إداري إماراتي تُجيب على أسئلة متابعة حول حكم قضائي مسوَّد.
استند إلى الحكم المُقدَّم حصراً. لا تخترع سلطات قانونية غير واردة فيه.
أجب باللغة العربية بأسلوب قانوني رسمي.`;

  const userPrompt = `الحكم المُسوَّد:
${JSON.stringify(judgment, null, 2)}

سؤال المراجع: ${message.trim()}`;

  try {
    const aiResult = await provider.complete({
      taskType:     TaskType.RAG,
      systemPrompt,
      prompt:       userPrompt,
      maxTokens:    2000,
    });

    res.json({ reply: aiResult.text.trim() });
  } catch (err) {
    req.log?.error({ err }, "JRE follow-up AI call failed");
    res.status(500).json({ error: "Follow-up request failed. Please try again." });
  }
});

// ─── DELETE /jre/sessions/:id ──────────────────────────────────────────────────
router.delete("/jre/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id  = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid session id" }); return; }

  const [session] = await db
    .select({ id: jreSessionsTable.id })
    .from(jreSessionsTable)
    .where(and(eq(jreSessionsTable.id, id), eq(jreSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  await db.delete(jreSessionsTable).where(eq(jreSessionsTable.id, id));
  res.json({ ok: true });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export default router;
