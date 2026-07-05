/**
 * Phase 44 — Judicial Digital Twin (JDT) API Routes
 * ──────────────────────────────────────────────────
 * All routes under /jdt/...
 *
 * The JDT simulates how a UAE Administrative Court judge would evaluate
 * an administrative decision across 8 review stages and 16 Al-Shamsi
 * dimensions, computing judicial outcome probabilities with full legal backing.
 * AI runs entirely inside this route; the service layer is pure DB.
 */

import { Router } from "express";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import {
  db,
  decisionsTable,
  decisionDciTable,
  decisionReplayEventsTable,
  jdtSimulationsTable,
  PERMISSIONS,
  collectJdtDecisionData,
  getJdtSimulation,
  markJdtRunning,
  saveJdtSimulation,
  markJdtFailed,
  buildJdtReport,
  type JdtAnalysisResult,
  type JdtReviewStageResult,
  type JdtShamsiDimensionResult,
  JDT_REVIEW_STAGE_KEYS,
  JDT_REVIEW_STAGE_LABELS_AR,
  JDT_REVIEW_STAGE_LABELS_EN,
  JDT_SHAMSI_DIMENSION_KEYS,
  JDT_SHAMSI_DIMENSION_LABELS_AR,
  JDT_SHAMSI_DIMENSION_LABELS_EN,
} from "@workspace/db";
import { requirePermission } from "../middlewares/roleAuth";
import { e400, e403, e404, e500 } from "../lib/sendError";
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

async function assertJdtAccess(
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

// ─── JDT AI Prompt ────────────────────────────────────────────────────────────

function buildJdtPrompt(decisionData: string): string {
  return `You are the Judicial Digital Twin (JDT) of the MARSAD Administrative Decision Platform.

You act as a UAE Administrative Court judge evaluating an administrative decision with full judicial rigour.

DECISION DATA:
${decisionData}

LEGAL FRAMEWORK TO APPLY:
- UAE Federal Law No. 6 of 2018 on Administrative Procedures (القانون الاتحادي رقم 6 لسنة 2018 بشأن الإجراءات الإدارية)
- UAE Constitution Arts. 25 (المساواة أمام القانون), 26 (الحرية الشخصية), 34 (حرية التنقل), 40 (حقوق غير المواطنين)
- Al-Shamsi Administrative Law Theory — 16 dimensions of administrative legality
- Federal Law No. 2 of 2022 on the Organization of the Federal Judiciary (القانون الاتحادي رقم 2 لسنة 2022 بشأن تنظيم القضاء الاتحادي)
- UAE Supreme Court Administrative Precedents
- General Principles of UAE Administrative Law

MANDATORY JUDICIAL REVIEW STAGES (all 8 must be evaluated):
1. admissibility — القبول: Is the decision subject to judicial review? Standing, time limits, exhaustion of remedies.
2. jurisdiction — الاختصاص القضائي: Does the issuing authority have territorial and subject-matter jurisdiction?
3. procedural_legality — المشروعية الإجرائية: Were required procedural steps followed? Notification, consultation, hearings.
4. competence — الاختصاص الوظيفي: Was the decision made by the competent official within their delegated authority?
5. form — الشكل والإجراءات الشكلية: Does the decision satisfy required formal elements (written, reasoned, signed, dated)?
6. reason — السبب القانوني: Is there a valid legal and factual basis for the decision?
7. purpose — الغاية والهدف: Does the decision pursue a legitimate public interest purpose free from detournement de pouvoir?
8. proportionality — التناسب: Is the measure proportionate to the objective, no more restrictive than necessary?

FOR EACH REVIEW STAGE PRODUCE (exact field names — match JSON schema):
- stageKey: one of the 8 exact keys listed above
- labelAr: Arabic label
- labelEn: English label
- score: integer 0-100 (judicial compliance score; 100 = fully compliant)
- outcome: "pass" | "partial" | "fail" | "not_assessed"
- reasoning: Arabic judicial reasoning (100-250 words minimum)
- findings: array of specific Arabic finding strings (minimum 2 items)
- uaeLegalReferences: array of strings — each a short citation e.g. "قانون اتحادي رقم 6/2018 المادة 12"
- remedyAr: Arabic remedy string if outcome is fail or partial, otherwise null
- isBlockingAnnulment: true if this defect alone is sufficient to justify judicial annulment

AL-SHAMSI 16 DIMENSIONS (all must be evaluated, exact dimensionKey values):
1. legal_basis_validity — الأساس القانوني
2. functional_competence — الاختصاص الوظيفي
3. judicial_jurisdiction — الاختصاص القضائي
4. procedural_legality — المشروعية الإجرائية
5. form_and_procedure — الشكل والإجراء
6. legal_cause — السبب القانوني
7. legitimate_purpose — الغاية المشروعة
8. proportionality — التناسب
9. equality_non_discrimination — المساواة وعدم التمييز
10. defense_guarantees — ضمانات الدفاع
11. transparency_reasoning — الشفافية والتسبيب
12. legal_certainty — اليقين القانوني
13. public_interest — المصلحة العامة
14. good_faith — حسن النية
15. non_abuse_of_power — عدم الانحراف بالسلطة
16. legitimate_expectation — التوقع المشروع

FOR EACH SHAMSI DIMENSION PRODUCE (exact field names):
- dimensionKey: one of the 16 exact keys listed above
- labelAr: Arabic label
- labelEn: English label
- score: integer 0-100
- outcome: "pass" | "partial" | "fail" | "not_assessed"
- reasoning: Arabic analysis text (50-150 words)
- constitutionalRef: most relevant UAE Constitution article or law reference string (or null)

JUDICIAL OUTCOME PROBABILITIES (all integers 0-100):
- probabilityAnnulment: probability the court annuls the decision
- probabilityDismissal: probability the court dismisses the challenge (decision stands)
- probabilityCorrection: probability the court orders correction/amendment
- judicialSuccessProbability: overall probability the decision survives full judicial review

JUDICIAL ANALYSIS FIELDS:
- judicialReasoning: full Arabic judicial opinion text (minimum 300 words), written as a UAE judge
- strengths: array of Arabic strings — legal aspects supporting the decision's validity (minimum 2)
- weaknesses: array of Arabic strings — legal vulnerabilities identified (minimum 2)
- missingEvidence: array of Arabic strings — evidence/documentation absent that a court would require
- correctiveActions: array of { priority: "critical"|"high"|"medium"|"low", action: string (Arabic), targetStage: one of the 8 stage keys, deadline: string (Arabic urgency) }

COMPOSITE SCORES:
- shamsiOverallScore: integer 0-100 (arithmetic mean of all 16 Al-Shamsi dimension scores)
- constitutionalScore: integer 0-100 (overall constitutional compliance)
- constitutionalOutcome: "pass" | "partial" | "fail" | "not_assessed"
- constitutionalReasoning: Arabic constitutional analysis paragraph (100-200 words)
- riskIntegrationScore: integer 0-100 (integrated judicial risk index)
- riskReasoning: Arabic explanation of risk calculation
- overallRiskLevel: "low" | "moderate" | "high" | "critical"
- overallAssessment: Arabic executive summary of judicial evaluation (150-300 words)

CROSS-MODULE INTEGRATION:
- cilIntegration: { cilScore: integer|null, cilRiskLevel: string|null, alignmentNote: Arabic string }
- nrmeIntegration: { nriScore: integer|null, riskLevel: string|null, alignmentNote: Arabic string }
- replayIntegration: { stagesAnalysed: integer, criticalStageKeys: array of stage key strings, replayHash: sha256 string }

RESPOND WITH ONLY A VALID JSON OBJECT — no markdown, no code fences, no commentary:
{
  "reviewStages": [ /* exactly 8 objects, one per stage, using field names: stageKey, labelAr, labelEn, score, outcome, reasoning, findings, uaeLegalReferences, remedyAr, isBlockingAnnulment */ ],
  "shamsiDimensions": [ /* exactly 16 objects, one per dimension, using field names: dimensionKey, labelAr, labelEn, score, outcome, reasoning, constitutionalRef */ ],
  "probabilityAnnulment": <integer 0-100>,
  "probabilityDismissal": <integer 0-100>,
  "probabilityCorrection": <integer 0-100>,
  "judicialSuccessProbability": <integer 0-100>,
  "judicialReasoning": "<Arabic judicial opinion, minimum 300 words>",
  "strengths": ["<Arabic>"],
  "weaknesses": ["<Arabic>"],
  "missingEvidence": ["<Arabic>"],
  "correctiveActions": [{ "priority": "critical|high|medium|low", "action": "<Arabic>", "targetStage": "<stage key>", "deadline": "<Arabic>" }],
  "shamsiOverallScore": <integer 0-100>,
  "constitutionalScore": <integer 0-100>,
  "constitutionalOutcome": "pass|partial|fail|not_assessed",
  "constitutionalReasoning": "<Arabic>",
  "riskIntegrationScore": <integer 0-100>,
  "riskReasoning": "<Arabic>",
  "overallRiskLevel": "low|moderate|high|critical",
  "overallAssessment": "<Arabic executive summary>",
  "cilIntegration": { "cilScore": <integer or null>, "cilRiskLevel": "<level or null>", "alignmentNote": "<Arabic>" },
  "nrmeIntegration": { "nriScore": <integer or null>, "riskLevel": "<level or null>", "alignmentNote": "<Arabic>" },
  "replayIntegration": { "stagesAnalysed": <integer>, "criticalStageKeys": ["<key>"], "replayHash": "<sha256>" }
}

CRITICAL: Field names must match EXACTLY. Use "reasoning" not "reasoningAr". Use "outcome" not "isDeficient". Use string[] for uaeLegalReferences. Use "pass|partial|fail|not_assessed" for outcome and constitutionalOutcome.
Ensure ALL 8 reviewStages and ALL 16 shamsiDimensions are included. Apply UAE law rigorously and write all reasoning in formal Arabic.`;
}

// ─── POST /jdt/simulate/:decisionId — Run JDT Simulation ─────────────────────

router.post(
  "/jdt/simulate/:decisionId",
  requirePermission("canRunJdtSimulation" as any),
  async (req, res): Promise<void> => {
    const decisionId = parseInt(req.params.decisionId as string, 10);
    if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

    let aiModel = "claude";
    try {
      const decision = await assertJdtAccess(req, decisionId);
      if (!decision) { e404(res, "القرار غير موجود أو لا توجد صلاحية للوصول إليه"); return; }

      const { userId, role } = getUserInfo(req);

      // Concurrency guard
      const existing = await getJdtSimulation(decisionId);
      if (existing?.status === "running") {
        res.status(409).json({
          message: "المحاكاة القضائية قيد التنفيذ بالفعل لهذا القرار",
          status: "running",
          decisionId,
        });
        return;
      }

      await markJdtRunning(decisionId, userId);

      // Collect decision data
      const data = await collectJdtDecisionData(decisionId);
      const prompt = buildJdtPrompt(trimDecisionData(data));

      // Route to AI — use CONSTITUTIONAL_ASSESSMENT (Claude) until DECISION_ANALYSIS TaskType is added
      const provider = await aiRouter.routeFor(TaskType.CONSTITUTIONAL_ASSESSMENT);
      const aiResult = await provider.complete({
        taskType: TaskType.CONSTITUTIONAL_ASSESSMENT,
        prompt,
        systemPrompt: "You are the Judicial Digital Twin (JDT) of MARSAD — a UAE administrative governance platform. You act as a UAE Administrative Court judge. Respond ONLY with valid JSON. No markdown, no code fences, no commentary.",
        maxTokens: 10000,
      });

      aiModel = aiResult.model ?? "claude";

      const parseResult = parseModelJson<JdtAnalysisResult>(
        aiResult.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim(),
      );
      const raw = parseResult.ok ? parseResult.data : ({} as any);

      // Validate critical fields
      if (
        !Array.isArray(raw.reviewStages) ||
        raw.reviewStages.length !== 8
      ) {
        throw new Error(`JDT AI returned invalid reviewStages (got ${Array.isArray(raw.reviewStages) ? raw.reviewStages.length : "non-array"})`);
      }
      if (
        !Array.isArray(raw.shamsiDimensions) ||
        raw.shamsiDimensions.length !== 16
      ) {
        throw new Error(`JDT AI returned invalid shamsiDimensions (got ${Array.isArray(raw.shamsiDimensions) ? raw.shamsiDimensions.length : "non-array"})`);
      }
      if (typeof raw.judicialSuccessProbability !== "number") {
        throw new Error("JDT AI response missing judicialSuccessProbability");
      }

      const result: JdtAnalysisResult = raw;
      await saveJdtSimulation(decisionId, result, aiModel);

      // Write JDT virtual replay stage (non-fatal) — direct insert, same pattern as CIL
      ;(async () => {
        try {
          const existing = await db
            .select({ id: decisionReplayEventsTable.id })
            .from(decisionReplayEventsTable)
            .where(eq(decisionReplayEventsTable.decisionId, decisionId))
            .limit(1);
          if (existing.length === 0) return; // Skip if no prior replay events exist

          const replayHash = createHash("sha256")
            .update(JSON.stringify({
              decisionId,
              judicialSuccessProbability: result.judicialSuccessProbability,
              probabilityAnnulment:       result.probabilityAnnulment,
              overallRiskLevel:           result.overallRiskLevel,
              shamsiOverallScore:         result.shamsiOverallScore,
              constitutionalScore:        result.constitutionalScore,
            }))
            .digest("hex");

          await db
            .insert(decisionReplayEventsTable)
            .values({
              decisionId,
              replayStageKey:           "replay_16_jdt_simulation",
              sourceStageKey:           "constitutional_validation",
              actor:                    userId,
              actorRole:                role,
              aiModelName:              aiModel,
              confidenceScore:          result.judicialSuccessProbability / 100,
              reasoningNarrative:       result.overallAssessment?.slice(0, 500) ?? null,
              constitutionalReferences: ["المادة 25 من الدستور الاتحادي", "المادة 26 من الدستور الاتحادي"],
              legalReferences:          ["القانون الاتحادي رقم 6 لسنة 2018", "القانون الاتحادي رقم 2 لسنة 2022"],
              adminLawReferences:       ["مبدأ المشروعية الإدارية", "مبدأ الاختصاص الوظيفي", "مبدأ التناسب"],
              riskIndicators:           result.weaknesses?.slice(0, 5) ?? [],
              auditHash:                replayHash,
            })
            .onConflictDoNothing();
        } catch (err) {
          console.error("[jdt.replay.write]", err);
        }
      })();

      const simulation = await getJdtSimulation(decisionId);
      res.json(simulation);
    } catch (err) {
      console.error("[jdt.simulate.post]", err);
      await markJdtFailed(decisionId, String(err)).catch(() => {});
      e500(res, "فشل تشغيل المحاكاة القضائية الرقمية");
    }
  },
);

// ─── GET /jdt/:decisionId — Fetch Current Simulation ─────────────────────────

router.get(
  "/jdt/:decisionId",
  requirePermission("canViewJdtSimulation" as any),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const decision = await assertJdtAccess(req, decisionId);
      if (!decision) { e404(res, "القرار غير موجود أو لا توجد صلاحية للوصول إليه"); return; }

      const simulation = await getJdtSimulation(decisionId);
      if (!simulation) {
        res.json({ status: "not_started", decisionId });
        return;
      }

      res.json(simulation);
    } catch (err) {
      console.error("[jdt.get]", err);
      e500(res, "فشل تحميل المحاكاة القضائية الرقمية");
    }
  },
);

// ─── GET /jdt/:decisionId/report — Full JDT Report ───────────────────────────

router.get(
  "/jdt/:decisionId/report",
  requirePermission("canViewJdtSimulation" as any),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const decision = await assertJdtAccess(req, decisionId);
      if (!decision) { e404(res, "القرار غير موجود أو لا توجد صلاحية للوصول إليه"); return; }

      const report = await buildJdtReport(decisionId);
      if (!report) {
        e404(res, "لم يتم إنشاء تقرير المحاكاة القضائية بعد لهذا القرار");
        return;
      }

      res.json(report);
    } catch (err) {
      console.error("[jdt.report.get]", err);
      e500(res, "فشل توليد تقرير المحاكاة القضائية الرقمية");
    }
  },
);

// ─── DELETE /jdt/:decisionId — Delete Simulation ─────────────────────────────

router.delete(
  "/jdt/:decisionId",
  requirePermission("canRunJdtSimulation" as any),
  async (req, res): Promise<void> => {
    try {
      const decisionId = parseInt(req.params.decisionId as string, 10);
      if (isNaN(decisionId)) { e400(res, "Invalid decision ID"); return; }

      const { role } = getUserInfo(req);
      if (role !== "owner" && role !== "supervisor") {
        e403(res, "يُسمح بحذف المحاكاة القضائية للمالكين والمشرفين فقط");
        return;
      }

      const decision = await assertJdtAccess(req, decisionId);
      if (!decision) { e404(res, "القرار غير موجود أو لا توجد صلاحية للوصول إليه"); return; }

      const simulation = await getJdtSimulation(decisionId);
      if (simulation?.status === "running") {
        res.status(409).json({
          message: "لا يمكن حذف المحاكاة القضائية أثناء تشغيلها",
          status: "running",
          decisionId,
        });
        return;
      }

      await db.delete(jdtSimulationsTable).where(eq(jdtSimulationsTable.decisionId, decisionId));

      res.json({ deleted: true, decisionId });
    } catch (err) {
      console.error("[jdt.delete]", err);
      e500(res, "فشل حذف المحاكاة القضائية الرقمية");
    }
  },
);

export default router;
