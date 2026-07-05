/**
 * Phase 42 — Constitutional Intelligence Layer (CIL) API Routes
 * ─────────────────────────────────────────────────────────────
 * All routes under /cil/...
 *
 * The CIL evaluates every administrative decision against 12 constitutional
 * principles and produces 6 structured scores with full legal backing.
 * AI runs entirely inside this route; the service layer is pure DB.
 */

import { Router } from "express";
import { createHash } from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionDciTable,
  decisionReplayEventsTable,
  constitutionalAssessmentsTable,
  constitutionalWarningsTable,
  PERMISSIONS,
  collectCilDecisionData,
  getCilAssessment,
  markCilRunning,
  saveCilAssessment,
  markCilFailed,
  acknowledgeCilAssessment,
  getDecisionWarnings,
  resolveWarning,
  getCilDashboardStats,
  buildCilReport,
  type CilAnalysisResult,
  type CilPrincipleResult,
  type CilWarning,
  CONSTITUTIONAL_PRINCIPLE_KEYS,
  CONSTITUTIONAL_PRINCIPLE_LABELS_AR,
  CONSTITUTIONAL_PRINCIPLE_LABELS_EN,
} from "@workspace/db";
import { requireGovernanceRead, requirePermission } from "../middlewares/roleAuth";
import { e400, e403, e500 } from "../lib/sendError";
import { aiRouter, TaskType, parseModelJson } from "../ai";

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

type DecisionWithSeal = typeof decisionsTable.$inferSelect & { dciIsSealed: boolean };

async function assertCilAccess(
  req: import("express").Request,
  decisionId: number,
): Promise<DecisionWithSeal | null> {
  const [[decision], [dci]] = await Promise.all([
    db.select().from(decisionsTable).where(eq(decisionsTable.id, decisionId)).limit(1),
    db.select({ isSealed: decisionDciTable.isSealed })
      .from(decisionDciTable)
      .where(eq(decisionDciTable.decisionId, decisionId))
      .limit(1),
  ]);
  if (!decision) return null;

  const { role, org } = getUserInfo(req);
  const perms = getPerms(role);
  const dciIsSealed = dci?.isSealed ?? false;

  if (perms.sealedOnly && !dciIsSealed) return null;
  if (perms.seeOwnOrgOnly && decision.organizationUnit !== org) return null;

  return { ...decision, dciIsSealed };
}

// ─── Trim helper — keeps AI context under 28k chars ──────────────────────────

function trimDecisionData(data: Record<string, unknown>): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length <= 28_000) return json;
  const truncation = `\n\n[... ${json.length - 28_000} characters truncated for context limit ...]`;
  return json.slice(0, 28_000) + truncation;
}

// ─── CIL AI Prompt ────────────────────────────────────────────────────────────

function buildCilPrompt(decisionData: string): string {
  return `You are the Constitutional Intelligence Layer (CIL) of the MARSAD Administrative Decision Platform.

Analyse the following UAE administrative decision data against the Al-Shamsi Constitutional Framework™.

DECISION DATA:
${decisionData}

Evaluate the decision against ALL 12 constitutional principles and produce a complete JSON response.

PRINCIPLES TO EVALUATE (all 12 are mandatory):
1. legality — المشروعية (Does the decision have proper legal authorisation?)
2. jurisdiction — الاختصاص (Does the issuing authority have competent jurisdiction?)
3. due_process — ضمانات المحاكمة العادلة (Were proper procedural guarantees observed?)
4. equality — المساواة (Does the decision treat all affected parties equally and without discrimination?)
5. proportionality — التناسب (Is the decision proportionate to the objective pursued?)
6. transparency — الشفافية (Is the decision-making process sufficiently transparent?)
7. explainability — قابلية التفسير (Is the reasoning of the decision adequately explained?)
8. human_rights — حقوق الإنسان (Does the decision respect fundamental human rights?)
9. legitimate_expectation — التوقع المشروع (Does the decision honour reasonable expectations of affected parties?)
10. legal_certainty — اليقين القانوني (Does the decision provide clarity and predictability of law?)
11. abuse_of_power — إساءة استخدام السلطة (Is there evidence of improper motive or excess of power?)
12. administrative_justice — العدالة الإدارية (Does the decision conform with principles of administrative justice?)

UAE CONSTITUTIONAL REFERENCES TO APPLY WHERE RELEVANT:
- UAE Constitution Art. 25 (Equality before law)
- UAE Constitution Art. 26 (Personal freedom)
- UAE Constitution Art. 27 (Human dignity)
- UAE Constitution Art. 34 (Freedom of movement)
- UAE Constitution Art. 40 (Rights of foreign nationals)
- Federal Law No. 6 of 2012 (General Administrative Procedure)
- Federal Law No. 10 of 1973 (Supreme Court — jurisdiction)
- Federal Law No. 11 of 1992 (Civil Procedure Law — due process)
- UAE Administrative Justice principles (Supreme Court precedents)

AL-SHAMSI THEORY DIMENSIONS TO CROSS-REFERENCE:
- jurisdiction, procedure, form, cause, subject, purpose
- human_influence, ai_influence, constitutional_compliance
- transparency, explainability, proportionality
- algorithmic_bias, due_process, equality, fundamental_rights

SCORING RULES:
- constitutionalComplianceScore: 0-100 (100 = fully compliant across all 12 principles)
- constitutionalRiskIndex: 100 - constitutionalComplianceScore (roughly)
- equalityIndex: derived primarily from the "equality" principle score (0-100)
- dueProcessIndex: derived primarily from "due_process" principle score (0-100)
- rightsImpactScore: derived from "human_rights" + "legitimate_expectation" (0-100)
- judicialSurvivalProbability: 0-100 (probability this decision survives judicial review in UAE courts)

WARNING GENERATION RULES — generate a warning for each issue found:
- equality_concern → when equality score < 70
- weak_reasoning → when explainability score < 65 or transparency score < 65
- abuse_of_discretion → when abuse_of_power score < 70
- high_annulment_probability → when judicialSurvivalProbability < 50
- due_process_gap → when due_process score < 70
- rights_at_risk → when human_rights score < 65
- legality_defect → when legality score < 70
- proportionality_breach → when proportionality score < 70
- transparency_failure → when transparency score < 60
- legal_certainty_risk → when legal_certainty score < 65
- jurisdiction_gap → when jurisdiction score < 70
- legitimate_expectation_violated → when legitimate_expectation score < 60

WARNING SEVERITY:
- critical: score < 50 for any blocking principle (legality, jurisdiction, due_process, abuse_of_power)
- warning: score 50-70 for any principle
- advisory: score 70-80 with minor concerns

RESPOND WITH EXACTLY THIS JSON STRUCTURE (no markdown, no code fences, pure JSON):
{
  "constitutionalComplianceScore": <integer 0-100>,
  "constitutionalRiskIndex": <integer 0-100>,
  "equalityIndex": <integer 0-100>,
  "dueProcessIndex": <integer 0-100>,
  "rightsImpactScore": <integer 0-100>,
  "judicialSurvivalProbability": <integer 0-100>,
  "overallRiskLevel": <"low"|"moderate"|"high"|"critical">,
  "overallReasoningAr": "<200-400 word Arabic constitutional narrative>",
  "recommendedActionAr": "<100-200 word Arabic recommended action for the issuing authority>",
  "principleResults": [
    {
      "principleKey": "<one of the 12 keys>",
      "labelAr": "<Arabic label>",
      "labelEn": "<English label>",
      "complianceScore": <integer 0-100>,
      "status": <"compliant"|"minor_concern"|"significant_concern"|"deficient"|"not_assessed">,
      "findingAr": "<Arabic finding 50-150 words>",
      "legalReasoning": "<English legal reasoning 50-150 words>",
      "constitutionalReferences": [
        { "article": "<UAE Constitution Art. N>", "titleAr": "<title>", "relevance": "<why cited>" }
      ],
      "uaeLegalReferences": [
        { "law": "<law name>", "article": "<article>", "titleAr": "<title>", "relevance": "<why cited>" }
      ],
      "alShamsiDimensions": [
        { "dimension": "<dimension key>", "score": <0-100>, "finding": "<finding>" }
      ],
      "evidenceReferences": [
        { "sequenceNumber": <n>, "action": "<action>", "relevance": "<why relevant>" }
      ],
      "replayReferences": [
        { "stageKey": "<replay stage key>", "stageLabel": "<Arabic label>", "relevance": "<why relevant>" }
      ],
      "remedyAr": "<Arabic remedy if needed, or null>",
      "isBlockingApproval": <true|false>
    }
  ],
  "warnings": [
    {
      "warningCode": "<code>",
      "severity": <"advisory"|"warning"|"critical">,
      "principleKey": "<principle key>",
      "titleAr": "<Arabic warning title>",
      "titleEn": "<English warning title>",
      "descriptionAr": "<Arabic description 50-100 words>",
      "constitutionalRef": "<constitutional article or principle>",
      "remedyAr": "<Arabic remedy>"
    }
  ],
  "nrmeIntegration": {
    "constitutionalImpactScore": <integer 0-100 — maps to NRME constitutionalImpact index>,
    "riskIndexAlignment": <integer 0-100 — degree of alignment with NRME risk scores>,
    "recommendation": "<how CIL findings should adjust NRME risk calculus>"
  },
  "replayIntegration": {
    "stagesAnalysed": <number>,
    "criticalStages": ["<stage keys where constitutional issues were found>"],
    "replayHash": "<sha256 of the principleResults JSON>"
  }
}

Ensure ALL 12 principleResults are included. Be thorough, accurate, and grounded in UAE administrative law.`;
}

// ─── POST /cil/assess/:decisionId — Trigger CIL Assessment ───────────────────

router.post(
  "/cil/assess/:decisionId",
  requirePermission("canRunCilAssessment"),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const decision = await assertCilAccess(req, decisionId);
      if (!decision) { e403(res, "لا توجد صلاحية الوصول لهذا القرار"); return; }

      const { role } = getUserInfo(req);

      // Collect all decision data for the AI prompt
      const decisionData = await collectCilDecisionData(decisionId);
      const { assessmentId, assessmentVersion } = await markCilRunning(decisionId, role);

      // Run AI analysis asynchronously — return immediately so the caller can poll
      (async () => {
        try {
          const prompt = buildCilPrompt(trimDecisionData(decisionData));
          const provider = await aiRouter.routeFor(TaskType.CONSTITUTIONAL_ASSESSMENT);
          const aiResult = await provider.complete({
            taskType: TaskType.CONSTITUTIONAL_ASSESSMENT,
            prompt,
            systemPrompt: "You are the Constitutional Intelligence Layer (CIL) of MARSAD — a UAE administrative governance platform. Respond ONLY with valid JSON. No markdown, no code fences, no commentary.",
            maxTokens: 8000,
          });

          const parseResult = parseModelJson<CilAnalysisResult>(aiResult.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim());
          const raw = parseResult.ok ? parseResult.data : {};

          // Validate and sanitise the AI response
          const validated = validateCilResult(raw, decisionId);

          await saveCilAssessment(decisionId, assessmentId, validated);

          // Write CIL virtual replay stage (non-fatal)
          ;(async () => {
            try {
              const existing = await db
                .select({ id: decisionReplayEventsTable.id })
                .from(decisionReplayEventsTable)
                .where(eq(decisionReplayEventsTable.decisionId, decisionId))
                .limit(1);
              if (existing.length === 0) return; // Skip if no replay events yet

              const replayHash = createHash("sha256")
                .update(JSON.stringify({
                  decisionId,
                  assessmentId,
                  constitutionalComplianceScore: validated.constitutionalComplianceScore,
                  constitutionalRiskIndex:       validated.constitutionalRiskIndex,
                  judicialSurvivalProbability:   validated.judicialSurvivalProbability,
                  overallRiskLevel:              validated.overallRiskLevel,
                  activeWarningCount:            validated.activeWarningCount,
                }))
                .digest("hex");

              await db
                .insert(decisionReplayEventsTable)
                .values({
                  decisionId,
                  replayStageKey:      "replay_15_cil_assessment",
                  sourceStageKey:      "constitutional_validation",
                  actor:               role,
                  actorRole:           role,
                  aiModelName:         "claude",
                  reasoningNarrative:  validated.overallReasoningAr?.slice(0, 500) ?? null,
                  constitutionalReferences: validated.principleResults
                    ?.flatMap((p) => p.constitutionalReferences.map((r) => r.article))
                    .slice(0, 10) ?? [],
                  riskIndicators: validated.warnings.map((w) => w.warningCode),
                  auditHash: replayHash,
                })
                .onConflictDoNothing();
            } catch (err) {
              console.error("[cil.replay.write]", err);
            }
          })();

        } catch (err) {
          console.error("[cil.assess.ai]", err);
          await markCilFailed(decisionId, err instanceof Error ? err.message : "AI assessment failed");
        }
      })();

      res.status(202).json({
        message:           "تم بدء تقييم الذكاء الدستوري",
        assessmentId,
        assessmentVersion,
        status:            "running",
        pollUrl:           `/api/cil/assess/${decisionId}`,
      });
    } catch (err) {
      console.error("[cil.assess.post]", err);
      e500(res, "فشل بدء تقييم الذكاء الدستوري");
    }
  },
);

// ─── GET /cil/assess/:decisionId — Fetch Current Assessment ──────────────────

router.get(
  "/cil/assess/:decisionId",
  requirePermission("canReadConstitutionalAssessment"),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const decision = await assertCilAccess(req, decisionId);
      if (!decision) { e403(res, "لا توجد صلاحية الوصول لهذا القرار"); return; }

      const assessment = await getCilAssessment(decisionId);
      if (!assessment) {
        res.json({ assessment: null, status: "not_started" });
        return;
      }

      res.json({ assessment, status: assessment.status });
    } catch (err) {
      console.error("[cil.assess.get]", err);
      e500(res, "فشل تحميل تقييم الذكاء الدستوري");
    }
  },
);

// ─── GET /cil/warnings/:decisionId — Get Constitutional Warnings ──────────────

router.get(
  "/cil/warnings/:decisionId",
  requirePermission("canReadConstitutionalAssessment"),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const decision = await assertCilAccess(req, decisionId);
      if (!decision) { e403(res, "لا توجد صلاحية الوصول لهذا القرار"); return; }

      const warnings = await getDecisionWarnings(decisionId);
      const criticalCount = warnings.filter((w) => w.severity === "critical" && !w.isResolved).length;
      const blockingApproval = criticalCount > 0;

      res.json({
        warnings,
        summary: {
          total:           warnings.length,
          critical:        warnings.filter((w) => w.severity === "critical").length,
          warning:         warnings.filter((w) => w.severity === "warning").length,
          advisory:        warnings.filter((w) => w.severity === "advisory").length,
          resolved:        warnings.filter((w) => w.isResolved).length,
          unresolved:      warnings.filter((w) => !w.isResolved).length,
          blockingApproval,
        },
      });
    } catch (err) {
      console.error("[cil.warnings.get]", err);
      e500(res, "فشل تحميل التحذيرات الدستورية");
    }
  },
);

// ─── POST /cil/warnings/:warningId/resolve — Resolve a Warning ───────────────
// Hardened: load the warning first, then enforce decision-level scope via assertCilAccess

router.post(
  "/cil/warnings/:warningId/resolve",
  requirePermission("canAcknowledgeCilWarnings"),
  async (req, res): Promise<void> => {
    try {
      const warningId = parseInt(req.params.warningId as string, 10);
      if (isNaN(warningId)) { e400(res, "Invalid warning ID"); return; }

      // Load the warning to find which decision it belongs to (IDOR guard)
      const [warning] = await db
        .select({ id: constitutionalWarningsTable.id, decisionId: constitutionalWarningsTable.decisionId })
        .from(constitutionalWarningsTable)
        .where(eq(constitutionalWarningsTable.id, warningId))
        .limit(1);

      if (!warning) { e400(res, "التحذير غير موجود"); return; }

      // Enforce org/sealed scope on the parent decision
      const decision = await assertCilAccess(req, warning.decisionId);
      if (!decision) { e403(res, "لا توجد صلاحية الوصول لهذا القرار"); return; }

      const body = req.body as { resolutionNote?: string };
      const { role } = getUserInfo(req);

      await resolveWarning(warningId, role, body.resolutionNote?.trim() ?? "");
      res.json({ message: "تم حل التحذير الدستوري" });
    } catch (err) {
      console.error("[cil.warning.resolve]", err);
      e500(res, "فشل حل التحذير");
    }
  },
);

// ─── POST /cil/assess/:decisionId/acknowledge — Acknowledge Assessment ────────

router.post(
  "/cil/assess/:decisionId/acknowledge",
  requirePermission("canAcknowledgeCilWarnings"),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const decision = await assertCilAccess(req, decisionId);
      if (!decision) { e403(res, "لا توجد صلاحية الوصول لهذا القرار"); return; }

      const assessment = await getCilAssessment(decisionId);
      if (!assessment || assessment.status !== "completed") {
        e400(res, "لا يوجد تقييم مكتمل للإقرار به");
        return;
      }

      const { role } = getUserInfo(req);
      await acknowledgeCilAssessment(decisionId, role);
      res.json({ message: "تم الإقرار بالتقييم الدستوري" });
    } catch (err) {
      console.error("[cil.acknowledge]", err);
      e500(res, "فشل الإقرار بالتقييم");
    }
  },
);

// ─── GET /cil/report/:decisionId — Full CIL Report (for ADP / export) ────────

router.get(
  "/cil/report/:decisionId",
  requirePermission("canReadConstitutionalAssessment"),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const decision = await assertCilAccess(req, decisionId);
      if (!decision) { e403(res, "لا توجد صلاحية الوصول لهذا القرار"); return; }

      const report = await buildCilReport(decisionId);
      res.json(report);
    } catch (err) {
      console.error("[cil.report.get]", err);
      if (err instanceof Error && err.message.includes("not yet completed")) {
        e400(res, err.message);
        return;
      }
      e500(res, "فشل توليد تقرير الذكاء الدستوري");
    }
  },
);

// ─── GET /cil/dashboard — Aggregate Dashboard Stats (org/sealed scoped) ──────

router.get(
  "/cil/dashboard",
  requirePermission("canViewCilDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);
      const stats = await getCilDashboardStats({
        organizationUnit: perms.seeOwnOrgOnly && org ? org : undefined,
        sealedOnly:       perms.sealedOnly ? true : undefined,
      });
      res.json(stats);
    } catch (err) {
      console.error("[cil.dashboard.get]", err);
      e500(res, "فشل تحميل لوحة الذكاء الدستوري");
    }
  },
);

// ─── GET /cil/decisions — Decisions with CIL assessment status ───────────────

router.get(
  "/cil/decisions",
  requirePermission("canViewCilDashboard"),
  async (req, res): Promise<void> => {
    try {
      const { role, org } = getUserInfo(req);
      const perms = getPerms(role);

      // Join decisions with assessments
      const rows = await db
        .select({
          decisionId:                    decisionsTable.id,
          caseNumber:                    decisionsTable.caseNumber,
          titleAr:                       decisionsTable.titleAr,
          organizationUnit:              decisionsTable.organizationUnit,
          decisionStatus:                decisionsTable.status,
          dciIsSealed:                   decisionDciTable.isSealed,
          assessmentStatus:              sql<string>`COALESCE(${constitutionalAssessmentsTable.status}, 'not_started')`,
          constitutionalComplianceScore: constitutionalAssessmentsTable.constitutionalComplianceScore,
          constitutionalRiskIndex:       constitutionalAssessmentsTable.constitutionalRiskIndex,
          judicialSurvivalProbability:   constitutionalAssessmentsTable.judicialSurvivalProbability,
          overallRiskLevel:              constitutionalAssessmentsTable.overallRiskLevel,
          hasCriticalWarning:            constitutionalAssessmentsTable.hasCriticalWarning,
          activeWarningCount:            constitutionalAssessmentsTable.activeWarningCount,
          acknowledged:                  constitutionalAssessmentsTable.acknowledged,
        })
        .from(decisionsTable)
        .leftJoin(decisionDciTable, eq(decisionDciTable.decisionId, decisionsTable.id))
        .leftJoin(
          constitutionalAssessmentsTable,
          eq(constitutionalAssessmentsTable.decisionId, decisionsTable.id),
        )
        .orderBy(desc(decisionsTable.createdAt));

      // Apply scoping filters
      const filtered = rows.filter((r) => {
        if (perms.sealedOnly && !r.dciIsSealed) return false;
        if (perms.seeOwnOrgOnly && r.organizationUnit !== org) return false;
        return true;
      });

      res.json({ decisions: filtered, total: filtered.length });
    } catch (err) {
      console.error("[cil.decisions.get]", err);
      e500(res, "فشل تحميل قائمة القرارات");
    }
  },
);

// ─── Validation Helper ────────────────────────────────────────────────────────

function validateCilResult(raw: unknown, decisionId: number): CilAnalysisResult {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const clamp = (v: unknown, def: number): number => {
    const n = typeof v === "number" ? v : parseInt(String(v ?? def), 10);
    return isNaN(n) ? def : Math.max(0, Math.min(100, n));
  };

  const riskLevel = (v: unknown): "low" | "moderate" | "high" | "critical" => {
    if (v === "low" || v === "moderate" || v === "high" || v === "critical") return v;
    const cri = clamp(r.constitutionalRiskIndex, 50);
    if (cri >= 75) return "critical";
    if (cri >= 55) return "high";
    if (cri >= 35) return "moderate";
    return "low";
  };

  const complianceScore = clamp(r.constitutionalComplianceScore, 50);
  const riskIndex       = clamp(r.constitutionalRiskIndex,       100 - complianceScore);
  const equalityIdx     = clamp(r.equalityIndex,                 complianceScore);
  const dueProcessIdx   = clamp(r.dueProcessIndex,               complianceScore);
  const rightsImpact    = clamp(r.rightsImpactScore,             complianceScore);
  const survival        = clamp(r.judicialSurvivalProbability,   complianceScore);

  const rawPrinciples = Array.isArray(r.principleResults) ? r.principleResults : [];
  const principleResults: CilPrincipleResult[] = CONSTITUTIONAL_PRINCIPLE_KEYS.map((key) => {
    const existing = rawPrinciples.find(
      (p: unknown) => typeof p === "object" && p !== null && (p as Record<string, unknown>).principleKey === key,
    ) as Record<string, unknown> | undefined;

    if (existing) {
      return {
        principleKey:             key,
        labelAr:                  CONSTITUTIONAL_PRINCIPLE_LABELS_AR[key],
        labelEn:                  CONSTITUTIONAL_PRINCIPLE_LABELS_EN[key],
        complianceScore:          clamp(existing.complianceScore, 50),
        status:                   validateStatus(existing.status),
        findingAr:                String(existing.findingAr ?? ""),
        legalReasoning:           String(existing.legalReasoning ?? ""),
        constitutionalReferences: Array.isArray(existing.constitutionalReferences) ? existing.constitutionalReferences as CilPrincipleResult["constitutionalReferences"] : [],
        uaeLegalReferences:       Array.isArray(existing.uaeLegalReferences) ? existing.uaeLegalReferences as CilPrincipleResult["uaeLegalReferences"] : [],
        alShamsiDimensions:       Array.isArray(existing.alShamsiDimensions) ? existing.alShamsiDimensions as CilPrincipleResult["alShamsiDimensions"] : [],
        evidenceReferences:       Array.isArray(existing.evidenceReferences) ? existing.evidenceReferences as CilPrincipleResult["evidenceReferences"] : [],
        replayReferences:         Array.isArray(existing.replayReferences) ? existing.replayReferences as CilPrincipleResult["replayReferences"] : [],
        remedyAr:                 typeof existing.remedyAr === "string" ? existing.remedyAr : null,
        isBlockingApproval:       Boolean(existing.isBlockingApproval),
      };
    }

    return {
      principleKey:             key,
      labelAr:                  CONSTITUTIONAL_PRINCIPLE_LABELS_AR[key],
      labelEn:                  CONSTITUTIONAL_PRINCIPLE_LABELS_EN[key],
      complianceScore:          50,
      status:                   "not_assessed",
      findingAr:                "لم يتم تقييم هذا المبدأ",
      legalReasoning:           "Not assessed",
      constitutionalReferences: [],
      uaeLegalReferences:       [],
      alShamsiDimensions:       [],
      evidenceReferences:       [],
      replayReferences:         [],
      remedyAr:                 null,
      isBlockingApproval:       false,
    };
  });

  const rawWarnings = Array.isArray(r.warnings) ? r.warnings as CilWarning[] : [];
  const hasCriticalWarning = rawWarnings.some((w) => w.severity === "critical");
  const activeWarningCount = rawWarnings.length;

  const replayHash = createHash("sha256")
    .update(JSON.stringify(principleResults))
    .digest("hex");

  const nrmeInt = (typeof r.nrmeIntegration === "object" && r.nrmeIntegration !== null)
    ? r.nrmeIntegration as CilAnalysisResult["nrmeIntegration"]
    : { constitutionalImpactScore: riskIndex, riskIndexAlignment: 70, recommendation: "CIL constitutional risk index should inform NRME constitutional impact score." };

  return {
    constitutionalComplianceScore: complianceScore,
    constitutionalRiskIndex:       riskIndex,
    equalityIndex:                 equalityIdx,
    dueProcessIndex:               dueProcessIdx,
    rightsImpactScore:             rightsImpact,
    judicialSurvivalProbability:   survival,
    overallRiskLevel:              riskLevel(r.overallRiskLevel),
    principleResults,
    warnings:         rawWarnings,
    activeWarningCount,
    hasCriticalWarning,
    overallReasoningAr:  String(r.overallReasoningAr ?? ""),
    recommendedActionAr: String(r.recommendedActionAr ?? ""),
    nrmeIntegration:  nrmeInt,
    replayIntegration: {
      stagesAnalysed: principleResults.length,
      criticalStages: principleResults
        .filter((p) => p.isBlockingApproval || p.status === "deficient")
        .map((p) => p.principleKey),
      replayHash,
    },
  };
}

function validateStatus(v: unknown): CilPrincipleResult["status"] {
  const valid = ["compliant", "minor_concern", "significant_concern", "deficient", "not_assessed"];
  return valid.includes(v as string) ? (v as CilPrincipleResult["status"]) : "not_assessed";
}

export default router;
