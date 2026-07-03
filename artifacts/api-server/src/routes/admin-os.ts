/**
 * Al-Shamsi Administrative Decision Operating System
 *
 * GET    /admin-os/decision-types          — list/filter the UAE decision type catalog
 * GET    /admin-os/sessions                — list current user's assessment sessions
 * DELETE /admin-os/sessions/:id            — delete a session (owner/supervisor only)
 * POST   /admin-os/assess                  — run full Al-Shamsi 12-dimension assessment
 * POST   /admin-os/followup                — follow-up question on a saved session
 */

import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  adminDecisionTypesTable,
  adminDecisionSessionsTable,
  adminDecisionBriefsTable,
} from "@workspace/db";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { aiRouter, TaskType } from "../ai";
import { parseModelJson } from "../ai/providers/interface";
import { buildContext, extractCitationTokens, resolveCitations } from "../utils/rag";
import {
  validateAdminBrief,
  computeLegalityScore,
  computeRiskScore,
  buildEvaluatorPrompt,
  VALID_ROLES,
  type AdminDecisionBriefData,
  type DimensionResult,
} from "../utils/admin-os-evaluator";

const router: IRouter = Router();

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h, 10);
}

// ─── GET /admin-os/decision-types ──────────────────────────────────────────────
/**
 * Query params:
 *   jurisdiction  — filter by jurisdiction (default: uae)
 *   domain        — filter by domain
 *   risk_level    — filter by inherentRiskLevel
 */
router.get("/admin-os/decision-types", requireAnyRole, async (req, res): Promise<void> => {
  const { jurisdiction = "uae", domain, risk_level } = req.query as Record<string, string | undefined>;

  const rows = await db
    .select({
      id: adminDecisionTypesTable.id,
      jurisdiction: adminDecisionTypesTable.jurisdiction,
      domain: adminDecisionTypesTable.domain,
      decisionTypeAr: adminDecisionTypesTable.decisionTypeAr,
      decisionTypeEn: adminDecisionTypesTable.decisionTypeEn,
      descriptionAr: adminDecisionTypesTable.descriptionAr,
      requiredCompetenceLevel: adminDecisionTypesTable.requiredCompetenceLevel,
      inherentRiskLevel: adminDecisionTypesTable.inherentRiskLevel,
      applicableLaws: adminDecisionTypesTable.applicableLaws,
      interviewTemplate: adminDecisionTypesTable.interviewTemplate,
    })
    .from(adminDecisionTypesTable)
    .where(eq(adminDecisionTypesTable.jurisdiction, jurisdiction));

  // Apply optional in-memory filters (small table — no index needed at this stage)
  let filtered = rows;
  if (domain) filtered = filtered.filter((r) => r.domain === domain);
  if (risk_level) filtered = filtered.filter((r) => r.inherentRiskLevel === risk_level);

  // Group by domain for easy frontend consumption
  const grouped: Record<string, typeof filtered> = {};
  for (const row of filtered) {
    if (!grouped[row.domain]) grouped[row.domain] = [];
    grouped[row.domain].push(row);
  }

  res.json({ decisionTypes: filtered, grouped });
});

// ─── GET /admin-os/sessions ────────────────────────────────────────────────────
router.get("/admin-os/sessions", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const sessions = await db
    .select({
      id: adminDecisionSessionsTable.id,
      role: adminDecisionSessionsTable.role,
      decisionTypeAr: adminDecisionSessionsTable.decisionTypeAr,
      decisionTypeEn: adminDecisionSessionsTable.decisionTypeEn,
      jurisdiction: adminDecisionSessionsTable.jurisdiction,
      legalityScore: adminDecisionSessionsTable.legalityScore,
      riskScore: adminDecisionSessionsTable.riskScore,
      canIssueToday: adminDecisionSessionsTable.canIssueToday,
      createdAt: adminDecisionSessionsTable.createdAt,
    })
    .from(adminDecisionSessionsTable)
    .where(eq(adminDecisionSessionsTable.userId, uid))
    .orderBy(desc(adminDecisionSessionsTable.createdAt))
    .limit(50);
  res.json({ sessions });
});

// ─── GET /admin-os/sessions/:id ───────────────────────────────────────────────
router.get("/admin-os/sessions/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select()
    .from(adminDecisionSessionsTable)
    .where(and(eq(adminDecisionSessionsTable.id, id), eq(adminDecisionSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  res.json({ session });
});

// ─── DELETE /admin-os/sessions/:id ────────────────────────────────────────────
router.delete("/admin-os/sessions/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select({ id: adminDecisionSessionsTable.id })
    .from(adminDecisionSessionsTable)
    .where(and(eq(adminDecisionSessionsTable.id, id), eq(adminDecisionSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  // Cascade-delete linked briefs first (no FK cascade in schema)
  await db.delete(adminDecisionBriefsTable).where(eq(adminDecisionBriefsTable.sessionId, id));
  await db.delete(adminDecisionSessionsTable).where(eq(adminDecisionSessionsTable.id, id));
  res.json({ ok: true });
});

// ─── POST /admin-os/assess ─────────────────────────────────────────────────────
/**
 * Body:
 *   role           — one of the 7 Al-Shamsi roles (e.g. "minister", "citizen")
 *   decisionTypeId — id from admin_decision_types
 *   jurisdiction   — "uae" | "france" (default: "uae")
 *   answers        — Record<questionId, string>
 */
router.post("/admin-os/assess", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const { role, decisionTypeId, jurisdiction = "uae", answers } = req.body as {
    role: string;
    decisionTypeId: number;
    jurisdiction?: string;
    answers: Record<string, string>;
  };

  if (!role || !decisionTypeId || !answers) {
    res.status(400).json({ error: "role, decisionTypeId, and answers are required" });
    return;
  }

  if (!VALID_ROLES.has(role)) {
    res.status(400).json({
      error: `Invalid role. Must be one of: ${[...VALID_ROLES].join(", ")}`,
    });
    return;
  }

  // Fetch decision type
  const [decisionType] = await db
    .select()
    .from(adminDecisionTypesTable)
    .where(eq(adminDecisionTypesTable.id, decisionTypeId));

  if (!decisionType) {
    res.status(404).json({ error: "Decision type not found" });
    return;
  }

  // Role display name (Arabic)
  const roleLabels: Record<string, string> = {
    government_official: "مسؤول حكومي",
    minister: "وزير",
    director_general: "مدير عام",
    hr: "قسم الموارد البشرية",
    legal_department: "الإدارة القانونية",
    administrative_court: "محكمة إدارية",
    citizen: "مواطن / مقيم",
  };
  const roleAr = roleLabels[role] ?? role;

  // Build RAG query from decision type + answers
  const semanticQuery = `${decisionType.decisionTypeAr} ${decisionType.domain} ${Object.values(answers).join(" ")}`;
  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  const { context: ragContext, sourceIndex } = await buildContext(semanticQuery, uid, [], []);

  const { systemPrompt, userPrompt } = buildEvaluatorPrompt({
    role,
    roleAr,
    decisionTypeAr: decisionType.decisionTypeAr,
    decisionTypeEn: decisionType.decisionTypeEn,
    jurisdiction,
    inherentRiskLevel: decisionType.inherentRiskLevel,
    applicableLaws: (decisionType.applicableLaws ?? []) as Array<{ lawAr: string; referenceNumber: string; articles?: string[] }>,
    answers,
    ragContext,
  });

  let brief: AdminDecisionBriefData;
  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 8000,
    });

    // Strip <think>...</think> reasoning block if present before JSON parsing
    const cleaned = aiResult.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    const parseResult = parseModelJson<Record<string, unknown>>(cleaned);
    if (!parseResult.ok) {
      req.log.error({ raw: parseResult.raw }, "Failed to parse admin-os JSON");
      res.status(500).json({ error: "Failed to parse AI response. Please try again." });
      return;
    }
    const parsed = parseResult.data;

    const validationError = validateAdminBrief(parsed);
    if (validationError) {
      req.log.warn({ validationError, text: aiResult.text }, "Admin OS brief failed validation");
      res.status(422).json({
        error: "AI response is missing required sections. Please try again.",
        detail: validationError,
      });
      return;
    }

    brief = parsed as unknown as AdminDecisionBriefData;
  } catch (err) {
    req.log.error({ err }, "Admin OS AI call failed");
    res.status(500).json({ error: "AI assessment failed. Please try again." });
    return;
  }

  // Extract dimension results for score computation
  const dims: Record<string, DimensionResult> = {
    jurisdiction:           brief.jurisdiction,
    form:                   brief.form,
    cause:                  brief.cause,
    subjectMatter:          brief.subjectMatter,
    purpose:                brief.purpose,
    humanWill:              brief.humanWill,
    digitalWillFormation:   brief.digitalWillFormation,
    algorithmicWeight:      brief.algorithmicWeight,
    algorithmicBias:        brief.algorithmicBias,
    explainability:         brief.explainability,
    humanOversight:         brief.humanOversight,
    judicialReviewReadiness: brief.judicialReviewReadiness,
  };

  const legalityScore = computeLegalityScore(dims);
  const riskScore = computeRiskScore(dims, decisionType.inherentRiskLevel, legalityScore);

  // Resolve citations
  const allText = JSON.stringify(brief);
  const rawTokens = extractCitationTokens(allText);
  const citations = await resolveCitations(rawTokens, sourceIndex, uid);

  // Persist session
  const [savedSession] = await db.insert(adminDecisionSessionsTable).values({
    userId: uid,
    role,
    decisionTypeId,
    decisionTypeAr: decisionType.decisionTypeAr,
    decisionTypeEn: decisionType.decisionTypeEn,
    jurisdiction,
    answers,
    brief: { ...brief, citations } as unknown as Record<string, unknown>,
    legalityScore,
    riskScore,
    canIssueToday: brief.canIssueToday,
    updatedAt: new Date(),
  }).returning();

  // Persist brief separately for export tracking (Phase 5)
  await db.insert(adminDecisionBriefsTable).values({
    sessionId: savedSession.id,
    briefData: { ...brief, legalityScore, riskScore, citations } as unknown as Record<string, unknown>,
  });

  await logAudit(req, "admin-os.assess", {
    entityType: "admin_decision_session",
    entityId: savedSession.id,
  });

  res.json({
    session: savedSession,
    brief: { ...brief, legalityScore, riskScore },
    citations,
  });
});

// ─── POST /admin-os/followup ───────────────────────────────────────────────────
router.post("/admin-os/followup", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const { sessionId, message } = req.body as { sessionId: number; message: string };

  if (!sessionId || !message?.trim()) {
    res.status(400).json({ error: "sessionId and message are required" });
    return;
  }

  const [session] = await db
    .select()
    .from(adminDecisionSessionsTable)
    .where(and(eq(adminDecisionSessionsTable.id, sessionId), eq(adminDecisionSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  const { context: ragContext, sourceIndex } = await buildContext(message, uid, [], []);

  const brief = session.brief as Record<string, unknown> | null;
  const briefSummary = brief
    ? `القرار الإداري: ${session.decisionTypeAr}
مستوى المشروعية: ${session.legalityScore}/100
مستوى الخطر: ${session.riskScore}/100
هل يمكن إصدار القرار اليوم: ${session.canIssueToday}
الحكم المختصر: ${(brief.canIssueTodayRationale as string ?? "").slice(0, 300)}`
    : "";

  const systemPrompt = `أنت خبير قانوني متخصص في القانون الإداري الإماراتي ونظرية الشمسي.
تُجيب على أسئلة متابعة بعد تقييم قرار إداري اكتمل.

${briefSummary}

${ragContext ? `السياق القانوني المتاح:\n${ragContext}` : ""}

أجب بالعربية بدقة وإيجاز. استشهد بالمصادر باستخدام [SRC:N] أو [DOC:N] عند الاقتضاء.`;

  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: message,
      systemPrompt,
      maxTokens: 2000,
    });

    const rawTokens = extractCitationTokens(aiResult.text);
    const citations = await resolveCitations(rawTokens, sourceIndex, uid);

    res.json({ text: aiResult.text, citations });
  } catch (err) {
    req.log.error({ err }, "Admin OS followup failed");
    res.status(500).json({ error: "AI response failed. Please try again." });
  }
});

export default router;
