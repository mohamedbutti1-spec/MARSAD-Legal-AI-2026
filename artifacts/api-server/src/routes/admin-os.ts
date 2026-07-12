/**
 * Al-Shamsi Administrative Decision Operating System
 *
 * Phase 1 endpoints:
 *   GET    /admin-os/decision-types          — list/filter the UAE decision type catalog
 *   GET    /admin-os/sessions                — list current user's assessment sessions
 *   GET    /admin-os/sessions/:id            — single session detail
 *   DELETE /admin-os/sessions/:id            — delete a session (owner/supervisor only)
 *   POST   /admin-os/assess                  — run full Al-Shamsi 12-dimension assessment
 *   POST   /admin-os/followup                — follow-up question on a saved session
 *
 * Phase 2 additions:
 *   GET    /admin-os/roles                           — list all 7 role definitions
 *   GET    /admin-os/roles/:roleKey                  — single role detail
 *   GET    /admin-os/interview-template/:id          — merged interview template for a decision type + role
 */

import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import {
  db,
  adminDecisionTypesTable,
  adminDecisionSessionsTable,
  adminDecisionBriefsTable,
  adminDecisionRolesTable,
  adminJurisdictionsTable,
  auditLogsTable,
} from "@workspace/db";
import { generateAdminBriefPdf } from "../utils/admin-brief-pdf";
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
  DIMENSION_KEYS,
  type AdminDecisionBriefData,
  type DimensionResult,
  type RolePromptContext,
} from "../utils/admin-os-evaluator";
import {
  buildInterviewTemplate,
  getRoleRelationship,
  getRoleInvolvementContext,
  ROLE_LABELS_AR,
  ROLE_LABELS_EN,
} from "../utils/admin-os-interview";
import { getJurisdictionPlugin } from "../ai/jurisdictions";
import type { InterviewModifiers } from "@workspace/db";
import { getUserId, getValidatedRole } from "../lib/route-helpers";

const router: IRouter = Router();

// ─── GET /admin-os/jurisdictions ──────────────────────────────────────────────
/**
 * Returns all active jurisdictions available in the frontend selector.
 * Inactive GCC stubs are excluded (active = false).
 */
router.get("/admin-os/jurisdictions", requireAnyRole, async (_req, res): Promise<void> => {
  const jurisdictions = await db
    .select({
      id: adminJurisdictionsTable.id,
      jurisdictionKey: adminJurisdictionsTable.jurisdictionKey,
      nameAr: adminJurisdictionsTable.nameAr,
      nameEn: adminJurisdictionsTable.nameEn,
      legalSystem: adminJurisdictionsTable.legalSystem,
      active: adminJurisdictionsTable.active,
    })
    .from(adminJurisdictionsTable)
    .where(eq(adminJurisdictionsTable.active, true))
    .orderBy(adminJurisdictionsTable.id);

  res.json({ jurisdictions });
});

// ─── GET /admin-os/roles ───────────────────────────────────────────────────────
/**
 * Returns all 7 Al-Shamsi role definitions.
 * Each role includes: titleAr/En, descriptionAr/En, competenceCeiling,
 * permittedDomains, actionCapabilities, legalBasisAr/En.
 * interviewModifiers are omitted from the list view (full detail on /roles/:key).
 */
router.get("/admin-os/roles", requireAnyRole, async (_req, res): Promise<void> => {
  const roles = await db
    .select({
      id: adminDecisionRolesTable.id,
      roleKey: adminDecisionRolesTable.roleKey,
      titleAr: adminDecisionRolesTable.titleAr,
      titleEn: adminDecisionRolesTable.titleEn,
      descriptionAr: adminDecisionRolesTable.descriptionAr,
      descriptionEn: adminDecisionRolesTable.descriptionEn,
      competenceCeiling: adminDecisionRolesTable.competenceCeiling,
      permittedDomains: adminDecisionRolesTable.permittedDomains,
      actionCapabilities: adminDecisionRolesTable.actionCapabilities,
      preferredLanguage: adminDecisionRolesTable.preferredLanguage,
      legalBasisAr: adminDecisionRolesTable.legalBasisAr,
      legalBasisEn: adminDecisionRolesTable.legalBasisEn,
    })
    .from(adminDecisionRolesTable)
    .orderBy(adminDecisionRolesTable.id);

  res.json({ roles });
});

// ─── GET /admin-os/roles/:roleKey ──────────────────────────────────────────────
/**
 * Returns full detail for a single role, including interviewModifiers.
 */
router.get("/admin-os/roles/:roleKey", requireAnyRole, async (req, res): Promise<void> => {
  const { roleKey } = req.params as { roleKey: string };

  const [role] = await db
    .select()
    .from(adminDecisionRolesTable)
    .where(eq(adminDecisionRolesTable.roleKey, roleKey));

  if (!role) {
    res.status(404).json({ error: `Role not found: ${roleKey}` });
    return;
  }

  res.json({ role });
});

// ─── GET /admin-os/decision-types ──────────────────────────────────────────────
/**
 * Query params:
 *   jurisdiction  — filter by jurisdiction (default: uae)
 *   domain        — filter by domain
 *   risk_level    — filter by inherentRiskLevel
 *   role          — Phase 2: annotate each type with role's relationship to it
 *                   (can_issue / can_review / can_challenge / none)
 */
router.get("/admin-os/decision-types", requireAnyRole, async (req, res): Promise<void> => {
  const { jurisdiction = "uae", domain, risk_level, role: roleParam } = req.query as Record<string, string | undefined>;

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

  // Phase 2: annotate with role relationship if role param provided
  let roleRecord: typeof adminDecisionRolesTable.$inferSelect | null = null;
  if (roleParam && VALID_ROLES.has(roleParam)) {
    const [found] = await db
      .select()
      .from(adminDecisionRolesTable)
      .where(eq(adminDecisionRolesTable.roleKey, roleParam));
    roleRecord = found ?? null;
  }

  type AnnotatedType = (typeof filtered)[0] & { roleRelationship?: string };
  const annotated: AnnotatedType[] = filtered.map((dt) => {
    if (!roleRecord) return dt;

    const relationship = getRoleRelationship({
      roleKey: roleRecord.roleKey,
      competenceCeiling: roleRecord.competenceCeiling,
      permittedDomains: roleRecord.permittedDomains as string[],
      actionCapabilities: roleRecord.actionCapabilities as { canIssue: boolean; canReview: boolean; canChallenge: boolean },
      decisionDomain: dt.domain,
      requiredCompetenceLevel: dt.requiredCompetenceLevel,
    });

    return { ...dt, roleRelationship: relationship };
  });

  // Group by domain for easy frontend consumption
  const grouped: Record<string, typeof annotated> = {};
  for (const row of annotated) {
    if (!grouped[row.domain]) grouped[row.domain] = [];
    grouped[row.domain].push(row);
  }

  res.json({ decisionTypes: annotated, grouped, role: roleRecord ? {
    roleKey: roleRecord.roleKey,
    titleAr: roleRecord.titleAr,
    titleEn: roleRecord.titleEn,
    competenceCeiling: roleRecord.competenceCeiling,
    actionCapabilities: roleRecord.actionCapabilities,
  } : null });
});

// ─── GET /admin-os/interview-template/:decisionTypeId ─────────────────────────
/**
 * Returns the merged interview template for a decision type + optional role.
 * Query params:
 *   role        — role key (optional; returns base template if omitted)
 *   jurisdiction — jurisdiction (default: uae)
 */
router.get("/admin-os/interview-template/:decisionTypeId", requireAnyRole, async (req, res): Promise<void> => {
  const decisionTypeId = parseInt(req.params.decisionTypeId as string, 10);
  if (isNaN(decisionTypeId)) {
    res.status(400).json({ error: "Invalid decisionTypeId" });
    return;
  }

  const { role: roleParam } = req.query as { role?: string };

  const [decisionType] = await db
    .select({
      id: adminDecisionTypesTable.id,
      decisionTypeAr: adminDecisionTypesTable.decisionTypeAr,
      decisionTypeEn: adminDecisionTypesTable.decisionTypeEn,
      domain: adminDecisionTypesTable.domain,
      interviewTemplate: adminDecisionTypesTable.interviewTemplate,
    })
    .from(adminDecisionTypesTable)
    .where(eq(adminDecisionTypesTable.id, decisionTypeId));

  if (!decisionType) {
    res.status(404).json({ error: "Decision type not found" });
    return;
  }

  // If a valid role key is supplied, merge with role modifiers
  let mergedTemplate = decisionType.interviewTemplate;
  let roleInfo: { roleKey: string; titleAr: string; titleEn: string } | null = null;

  if (roleParam && VALID_ROLES.has(roleParam)) {
    const [roleRecord] = await db
      .select({
        roleKey: adminDecisionRolesTable.roleKey,
        titleAr: adminDecisionRolesTable.titleAr,
        titleEn: adminDecisionRolesTable.titleEn,
        interviewModifiers: adminDecisionRolesTable.interviewModifiers,
      })
      .from(adminDecisionRolesTable)
      .where(eq(adminDecisionRolesTable.roleKey, roleParam));

    if (roleRecord) {
      mergedTemplate = buildInterviewTemplate(
        decisionType.interviewTemplate,
        roleRecord.interviewModifiers as InterviewModifiers,
      );
      roleInfo = { roleKey: roleRecord.roleKey, titleAr: roleRecord.titleAr, titleEn: roleRecord.titleEn };
    }
  }

  res.json({
    decisionTypeId,
    decisionTypeAr: decisionType.decisionTypeAr,
    decisionTypeEn: decisionType.decisionTypeEn,
    domain: decisionType.domain,
    role: roleInfo,
    questionCount: mergedTemplate.length,
    questions: mergedTemplate,
  });
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

  // Phase 2: load role record for context injection
  const [roleRecord] = await db
    .select()
    .from(adminDecisionRolesTable)
    .where(eq(adminDecisionRolesTable.roleKey, role));

  // Build role context block for the evaluator prompt
  const roleContext: RolePromptContext | undefined = roleRecord
    ? {
        roleKey: roleRecord.roleKey,
        titleAr: roleRecord.titleAr,
        titleEn: roleRecord.titleEn,
        competenceCeiling: roleRecord.competenceCeiling,
        involvementAr: getRoleInvolvementContext(roleRecord.roleKey, roleRecord.competenceCeiling),
        legalBasisAr: roleRecord.legalBasisAr,
        isChallenging: roleRecord.competenceCeiling === "challenge_only",
        isJudicialReview: roleRecord.competenceCeiling === "judicial_review",
      }
    : undefined;

  // Fallback role labels for backward compat (if role not yet in DB)
  const roleAr = roleRecord?.titleAr ?? ROLE_LABELS_AR[role] ?? role;

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

  // Phase 4: Build jurisdiction context from the registered plugin
  const jurisdictionPlugin = getJurisdictionPlugin(jurisdiction);
  const jurisdictionContext = jurisdictionPlugin?.active
    ? jurisdictionPlugin.buildJurisdictionContext({
        decisionTypeAr: decisionType.decisionTypeAr,
        decisionTypeEn: decisionType.decisionTypeEn,
        domain: decisionType.domain,
        role,
        answers,
        applicableLaws: (decisionType.applicableLaws ?? []) as Array<{ lawAr: string; referenceNumber: string; articles?: string[] }>,
      })
    : undefined;

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
    roleContext,
    jurisdictionContext,
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

  // Extract dimension results for score computation (16 pillars)
  const dims: Record<string, DimensionResult> = {
    jurisdiction:            brief.jurisdiction,
    competence:              brief.competence,
    form:                    brief.form,
    cause:                   brief.cause,
    subjectMatter:           brief.subjectMatter,
    purpose:                 brief.purpose,
    humanWill:               brief.humanWill,
    digitalWillFormation:    brief.digitalWillFormation,
    algorithmicWeight:       brief.algorithmicWeight,
    algorithmicBias:         brief.algorithmicBias,
    explainability:          brief.explainability,
    humanOversight:          brief.humanOversight,
    judicialReviewReadiness: brief.judicialReviewReadiness,
    proportionality:         brief.proportionality,
    transparency:            brief.transparency,
    accountability:          brief.accountability,
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

  // Phase 5 — compute tamper-detection hash before logging
  const briefHash = createHash("sha256").update(JSON.stringify(brief)).digest("hex");

  logAudit(req, "admin-os.assess", {
    entityType: "admin_decision_session",
    entityId: savedSession.id,
    details: {
      briefHash,
      legalityScore,
      riskScore,
      canIssueToday: brief.canIssueToday,
      jurisdiction,
      role,
    },
  });

  res.json({
    session: savedSession,
    brief: { ...brief, legalityScore, riskScore },
    briefHash,
    citations,
    roleContext: roleContext ? {
      roleKey: roleContext.roleKey,
      titleAr: roleContext.titleAr,
      titleEn: roleContext.titleEn,
      isChallenging: roleContext.isChallenging,
      isJudicialReview: roleContext.isJudicialReview,
    } : null,
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

  // Include role context in follow-up prompt
  const roleLabel = ROLE_LABELS_AR[session.role ?? ""] ?? session.role ?? "";
  const systemPrompt = `أنت خبير قانوني متخصص في القانون الإداري الإماراتي ونظرية الشامسي.
تُجيب على أسئلة متابعة بعد تقييم قرار إداري اكتمل.
دور المستخدم: ${roleLabel}

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

    // Phase 5 — audit followup for per-session trail
    logAudit(req, "admin-os.followup", {
      entityType: "admin_decision_session",
      entityId: sessionId,
      details: { preview: message.slice(0, 120) },
    });
    res.json({ text: aiResult.text, citations });
  } catch (err) {
    req.log.error({ err }, "Admin OS followup failed");
    res.status(500).json({ error: "AI response failed. Please try again." });
  }
});

// ─── POST /admin-os/compare ────────────────────────────────────────────────────
/**
 * Cross-jurisdiction comparison: takes an existing session brief (evaluated under
 * one jurisdiction) and produces a second brief under a target jurisdiction,
 * then returns a per-dimension diff with an overall compatibility summary.
 *
 * Uses the existing stored brief to provide context to the AI — no answers
 * need to be re-submitted.
 */
router.post("/admin-os/compare", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const { sessionId, targetJurisdiction } = req.body;
  const uid = getUserId(req);

  if (!sessionId || !targetJurisdiction) {
    res.status(400).json({ error: "sessionId and targetJurisdiction are required" });
    return;
  }

  const [session] = await db
    .select()
    .from(adminDecisionSessionsTable)
    .where(and(eq(adminDecisionSessionsTable.id, sessionId), eq(adminDecisionSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const originalBrief = session.brief as unknown as AdminDecisionBriefData;
  if (!originalBrief) { res.status(400).json({ error: "Session has no brief to compare" }); return; }

  const targetPlugin = getJurisdictionPlugin(targetJurisdiction);
  if (!targetPlugin?.active) {
    res.status(400).json({ error: `Jurisdiction '${targetJurisdiction}' is not active` });
    return;
  }

  // Load decision type for domain context (needed for jurisdiction plugin)
  let domainCtx = "general";
  let lawsCtx: Array<{ lawAr: string; referenceNumber: string; articles?: string[] }> = [];
  if (session.decisionTypeId) {
    const [dt] = await db
      .select({ domain: adminDecisionTypesTable.domain, applicableLaws: adminDecisionTypesTable.applicableLaws })
      .from(adminDecisionTypesTable)
      .where(eq(adminDecisionTypesTable.id, session.decisionTypeId));
    if (dt) {
      domainCtx = dt.domain;
      lawsCtx = (dt.applicableLaws ?? []) as Array<{ lawAr: string; referenceNumber: string; articles?: string[] }>;
    }
  }

  const jurisdictionContext = targetPlugin.buildJurisdictionContext({
    decisionTypeAr: session.decisionTypeAr ?? "",
    decisionTypeEn: session.decisionTypeEn ?? "",
    domain: domainCtx,
    role: session.role ?? "",
    answers: {},
    applicableLaws: lawsCtx,
  });

  // Summarise the original brief for the comparison prompt
  const originalAsRecord = originalBrief as unknown as Record<string, DimensionResult>;
  const originalDimsSummary = DIMENSION_KEYS.map((key) => {
    const dim = originalAsRecord[key];
    if (!dim) return `• ${key}: غير متاح`;
    return `• ${key}: ${dim.status} (${dim.score}/100) — ${(dim.explanationAr ?? "").slice(0, 120)}`;
  }).join("\n");

  const systemPrompt = `أنت خبير قانوني متخصص في القانون الإداري المقارن ونظرية الشامسي للقرارات الإدارية.
مهمتك: بالاستناد إلى ملخص تقييم قانوني في نظام قانوني أول، تحليل نفس القرار الإداري وإنتاج تقييم كامل اثني عشر بُعداً وفق نظام قانوني ثانٍ.

${jurisdictionContext}

قواعد الإجابة:
- أجب حصراً بـJSON دقيق ومكتمل وفق هيكل التقرير الإداري القياسي
- اربط كل بُعد بنص قانوني دقيق من نظام النطاق القضائي المطلوب
- لا تنسخ التقييم الأصلي — أعد التحليل وفق الإطار القانوني الجديد بالكامل`;

  const roleAr = ROLE_LABELS_AR[session.role ?? ""] ?? session.role ?? "";
  const userPrompt = `القرار الإداري: ${session.decisionTypeAr} (${session.decisionTypeEn})
دور المستخدم: ${roleAr}
النطاق القضائي الجديد للتقييم: ${targetPlugin.nameAr} (${targetPlugin.nameEn})

ملخص التقييم الأصلي (${session.jurisdiction ?? "uae"}):
${originalDimsSummary}

قيّم هذا القرار الإداري وفق ${targetPlugin.nameAr} وأنتج تقرير اثني عشر بُعداً بنفس هيكل JSON القياسي المُحدَّد للتقارير الإدارية.`;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  let aiResult;
  try {
    aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 6000,
    });
  } catch (err) {
    req.log.error({ err }, "Admin OS compare AI call failed");
    res.status(500).json({ error: "AI comparison failed. Please try again." });
    return;
  }

  // Strip <think> block before parsing (same as /assess endpoint)
  const cleanedCompare = aiResult.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  const compareParseResult = parseModelJson<Record<string, unknown>>(cleanedCompare);
  if (!compareParseResult.ok) {
    req.log.error({ raw: compareParseResult.raw.slice(0, 500) }, "Compare: failed to parse AI JSON");
    res.status(500).json({ error: "Failed to parse comparison response. Please try again." });
    return;
  }

  const compareValidationError = validateAdminBrief(compareParseResult.data);
  if (compareValidationError) {
    req.log.warn({ compareValidationError }, "Compare brief failed validation");
    res.status(422).json({
      error: "Comparison AI response is missing required sections. Please try again.",
      detail: compareValidationError,
    });
    return;
  }

  const parsed = compareParseResult.data as unknown as AdminDecisionBriefData;

  // ── Compute per-dimension diff ────────────────────────────────────────────────
  const DIMENSION_LABELS_AR: Record<string, string> = {
    jurisdiction: "الاختصاص",
    form: "الشكل",
    cause: "السبب",
    subjectMatter: "المحل",
    purpose: "الغاية",
    humanWill: "الإرادة البشرية",
    digitalWillFormation: "تكوين الإرادة الرقمية",
    algorithmicWeight: "الوزن الخوارزمي",
    algorithmicBias: "التحيز الخوارزمي",
    explainability: "قابلية التفسير",
    humanOversight: "الرقابة البشرية",
    judicialReviewReadiness: "الجاهزية للمراجعة القضائية",
  };

  const parsedAsRecord = parsed as unknown as Record<string, DimensionResult>;

  const diff: Record<string, {
    key: string; labelAr: string;
    originalScore: number; originalStatus: string;
    targetScore: number; targetStatus: string;
    scoreDelta: number; differenceAr: string;
  }> = {};

  for (const key of DIMENSION_KEYS) {
    const orig = originalAsRecord[key];
    const tgt = parsedAsRecord[key];
    const originalScore = orig?.score ?? 0;
    const targetScore = tgt?.score ?? 0;
    const delta = targetScore - originalScore;

    let differenceAr = "متسقان بشكل عام";
    if (delta >= 15) differenceAr = `أقل تقييداً في ${targetPlugin.nameAr}`;
    else if (delta <= -15) differenceAr = `أكثر صرامة في ${targetPlugin.nameAr}`;
    else if (Math.abs(delta) >= 8) {
      differenceAr = `فارق طفيف لصالح ${delta > 0 ? targetPlugin.nameAr : (session.jurisdiction === "france" ? "الجمهورية الفرنسية" : "الإمارات")}`;
    }

    diff[key] = {
      key,
      labelAr: DIMENSION_LABELS_AR[key] ?? key,
      originalScore,
      originalStatus: orig?.status ?? "unknown",
      targetScore,
      targetStatus: tgt?.status ?? "unknown",
      scoreDelta: delta,
      differenceAr,
    };
  }

  const originalLegalityScore = computeLegalityScore(originalAsRecord);
  const targetLegalityScore = computeLegalityScore(parsedAsRecord);
  const stricterJurisdiction = targetLegalityScore < originalLegalityScore ? targetJurisdiction : (session.jurisdiction ?? "uae");

  const keyDifferencesAr = DIMENSION_KEYS
    .filter((k) => Math.abs(diff[k]?.scoreDelta ?? 0) >= 15)
    .map((k) => `${diff[k].labelAr}: ${diff[k].differenceAr} (${diff[k].originalScore} → ${diff[k].targetScore})`);

  const commonPrinciplesAr = DIMENSION_KEYS
    .filter((k) => diff[k]?.originalStatus === "compliant" && diff[k]?.targetStatus === "compliant")
    .map((k) => `${diff[k].labelAr} — مستوفٍ في كلا النظامين`);

  const scoreDiff = Math.abs(targetLegalityScore - originalLegalityScore);
  const overallCompatibilityAr =
    keyDifferencesAr.length === 0
      ? "القرار متوافق بشكل عالٍ مع كلا النظامين القانونيين. لا توجد فجوات جوهرية في درجات الامتثال."
      : `القرار يُسجّل فارقاً في درجة الشرعية الكلية بمقدار ${scoreDiff} نقطة. النظام الأكثر صرامة هو ${stricterJurisdiction === targetJurisdiction ? targetPlugin.nameAr : (session.jurisdiction === "france" ? "الجمهورية الفرنسية" : "الإمارات")}. أبرز الفجوات في: ${keyDifferencesAr.slice(0, 3).join("؛ ")}.`;

  res.json({
    originalJurisdiction: session.jurisdiction ?? "uae",
    targetJurisdiction,
    originalJurisdictionNameAr: session.jurisdiction === "france" ? "الجمهورية الفرنسية" : "الإمارات العربية المتحدة",
    targetJurisdictionNameAr: targetPlugin.nameAr,
    originalLegalityScore,
    targetLegalityScore,
    stricterJurisdiction,
    diff,
    overallCompatibilityAr,
    keyDifferencesAr,
    commonPrinciplesAr,
  });
});

// ─── GET /admin-os/sessions/:id/audit ─────────────────────────────────────────
/**
 * Phase 5 — Returns the full audit trail for an administrative decision session.
 * Includes: initial assessment, follow-up messages, and PDF exports.
 */
router.get("/admin-os/sessions/:id/audit", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db
    .select({ id: adminDecisionSessionsTable.id })
    .from(adminDecisionSessionsTable)
    .where(and(eq(adminDecisionSessionsTable.id, id), eq(adminDecisionSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const logs = await db.select()
    .from(auditLogsTable)
    .where(
      sql`(${auditLogsTable.entityType} = 'admin_decision_session' AND ${auditLogsTable.entityId} = ${id})
          OR (${auditLogsTable.action} IN ('admin-os.followup', 'admin-os.pdf-export') AND ${auditLogsTable.entityId} = ${id})`
    )
    .orderBy(auditLogsTable.createdAt);

  res.json({ sessionId: id, auditEntries: logs });
});

// ─── GET /admin-os/stats ──────────────────────────────────────────────────────
/**
 * Phase 5 — Aggregate compliance statistics for the legal compliance dashboard.
 * Owners see all sessions; supervisors see their own.
 */
router.get("/admin-os/stats", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const userRole = getValidatedRole(req);
  const isOwner = userRole === "owner";

  const sessions = isOwner
    ? await db.select().from(adminDecisionSessionsTable)
    : await db.select().from(adminDecisionSessionsTable).where(eq(adminDecisionSessionsTable.userId, uid));

  const totalSessions = sessions.length;
  const avgLegalityScore = totalSessions > 0
    ? Math.round(sessions.reduce((a, s) => a + (s.legalityScore ?? 0), 0) / totalSessions)
    : 0;

  // canIssueToday breakdown
  const issueCounts: Record<string, number> = {};
  for (const s of sessions) { const k = s.canIssueToday ?? "unknown"; issueCounts[k] = (issueCounts[k] ?? 0) + 1; }
  const issueLabels: Record<string, string> = { yes: "يمكن الإصدار", no: "لا يمكن الإصدار", conditional: "مشروط" };
  const canIssueTodayBreakdown = Object.entries(issueCounts)
    .filter(([, c]) => c > 0)
    .map(([value, count]) => ({ value, labelAr: issueLabels[value] ?? value, count }));

  // Average legality score by day (last 30 days)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const byDay: Record<string, { total: number; count: number }> = {};
  for (const s of sessions) {
    if (new Date(s.createdAt) < cutoff) continue;
    const dk = new Date(s.createdAt).toISOString().slice(0, 10);
    if (!byDay[dk]) byDay[dk] = { total: 0, count: 0 };
    byDay[dk].total += s.legalityScore ?? 0;
    byDay[dk].count += 1;
  }
  const avgLegalityByDay = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, count }]) => ({ date, avgScore: Math.round(total / count), count }));

  // Non-compliant dimension counts (from stored brief JSON)
  const DIMS = ["jurisdiction","cause","form","subjectMatter","purpose","humanWill","digitalWillFormation","algorithmicWeight","algorithmicBias","explainability","humanOversight","judicialReviewReadiness"];
  const DIMS_AR: Record<string, string> = { jurisdiction:"الاختصاص", cause:"السبب", form:"الشكل", subjectMatter:"المحل", purpose:"الغاية", humanWill:"الإرادة البشرية", digitalWillFormation:"تكوين الإرادة الرقمية", algorithmicWeight:"الوزن الخوارزمي", algorithmicBias:"التحيز الخوارزمي", explainability:"قابلية التفسير", humanOversight:"الرقابة البشرية", judicialReviewReadiness:"الجاهزية القضائية" };
  const dimCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.brief) continue;
    const b = s.brief as Record<string, { status?: string }>;
    for (const key of DIMS) { if (b[key]?.status === "non-compliant") dimCounts[key] = (dimCounts[key] ?? 0) + 1; }
  }
  const mostNonCompliantDimensions = Object.entries(dimCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 7)
    .map(([key, nonCompliantCount]) => ({ key, labelAr: DIMS_AR[key] ?? key, nonCompliantCount }));

  // High-risk decision types
  const byType: Record<string, { total: number; count: number }> = {};
  for (const s of sessions) {
    const k = s.decisionTypeAr ?? "غير محدد";
    if (!byType[k]) byType[k] = { total: 0, count: 0 };
    byType[k].total += s.riskScore ?? 0;
    byType[k].count += 1;
  }
  const highRiskDecisionTypes = Object.entries(byType)
    .map(([decisionTypeAr, { total, count }]) => ({ decisionTypeAr, avgRiskScore: Math.round(total / count), sessionCount: count }))
    .sort((a, b) => b.avgRiskScore - a.avgRiskScore).slice(0, 10);

  // PDF export count and recent exports — scoped to user's sessions for non-owners
  const ownedSessionIds = sessions.map((s) => s.id);
  const pdfExportWhere = isOwner
    ? eq(auditLogsTable.action, "admin-os.pdf-export")
    : ownedSessionIds.length > 0
      ? and(
          eq(auditLogsTable.action, "admin-os.pdf-export"),
          inArray(auditLogsTable.entityId, ownedSessionIds),
        )
      : sql`false`;

  const [totalPdfExportsRow] = await db.select({ count: sql<number>`count(*)::int` })
    .from(auditLogsTable).where(pdfExportWhere);
  const totalPdfExports = totalPdfExportsRow?.count ?? 0;

  const exportLogs = await db.select({ entityId: auditLogsTable.entityId, createdAt: auditLogsTable.createdAt })
    .from(auditLogsTable).where(pdfExportWhere)
    .orderBy(desc(auditLogsTable.createdAt)).limit(10);

  const recentPdfExports = (await Promise.all(exportLogs.map(async (log) => {
    if (!log.entityId) return null;
    const [s] = await db.select({ decisionTypeAr: adminDecisionSessionsTable.decisionTypeAr })
      .from(adminDecisionSessionsTable).where(eq(adminDecisionSessionsTable.id, log.entityId));
    return { sessionId: log.entityId, decisionTypeAr: s?.decisionTypeAr ?? "غير محدد", exportedAt: log.createdAt.toISOString() };
  }))).filter(Boolean);

  res.json({ totalSessions, avgLegalityScore, totalPdfExports, canIssueTodayBreakdown, avgLegalityByDay, mostNonCompliantDimensions, highRiskDecisionTypes, recentPdfExports });
});

// ─── GET /admin-os/sessions/:id/export.pdf ────────────────────────────────────
/**
 * Phase 5 — Generates and streams a court-grade bilingual PDF brief.
 * Requires Puppeteer/Chromium (auto-downloaded on first use).
 */
router.get("/admin-os/sessions/:id/export.pdf", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [session] = await db.select()
    .from(adminDecisionSessionsTable)
    .where(and(eq(adminDecisionSessionsTable.id, id), eq(adminDecisionSessionsTable.userId, uid)));

  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (!session.brief) { res.status(400).json({ error: "No brief found for this session" }); return; }

  const brief = session.brief as unknown as AdminDecisionBriefData;

  // Phase 5 — use the *original* briefHash from the assess audit entry, not a recomputed one.
  // This guarantees the hash in the PDF footer matches the audit reference shown to the user.
  const [assessAudit] = await db
    .select({ details: auditLogsTable.details })
    .from(auditLogsTable)
    .where(and(eq(auditLogsTable.action, "admin-os.assess"), eq(auditLogsTable.entityId, id)))
    .orderBy(auditLogsTable.createdAt)
    .limit(1);

  let briefHash: string;
  try {
    const parsedDetails = assessAudit?.details
      ? (JSON.parse(assessAudit.details) as { briefHash?: string })
      : {};
    briefHash = parsedDetails.briefHash ?? createHash("sha256").update(JSON.stringify(brief)).digest("hex");
  } catch {
    briefHash = createHash("sha256").update(JSON.stringify(brief)).digest("hex");
  }

  try {
    const pdfBuffer = await generateAdminBriefPdf(session, brief, briefHash);

    logAudit(req, "admin-os.pdf-export", {
      entityType: "admin_decision_session",
      entityId: id,
      details: { hashSuffix: briefHash.slice(-8) },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="decision-brief-${id}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: unknown) {
    req.log.error({ err }, "PDF generation failed");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `PDF generation failed: ${msg}` });
  }
});

export default router;
