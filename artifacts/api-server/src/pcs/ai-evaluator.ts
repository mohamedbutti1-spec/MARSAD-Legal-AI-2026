/**
 * PCS — Professional Case Simulator — AI Step Evaluator
 *
 * Evaluates a single user answer against the expected professional criteria
 * using Claude (via the platform AI router).
 *
 * Returns a structured Arabic evaluation with a score, feedback, missed items,
 * and a recommendation for the next step.
 */

import { aiRouter, TaskType, parseModelJson } from "../ai/index.js";
import type { SimScenario, SimStep }           from "./config.js";

export interface StepEvaluation {
  score:            number;      // 0-100
  evaluation:       string;      // Arabic feedback paragraph
  missedDocuments:  string[];    // documents not mentioned in the answer
  missedApprovals:  string[];    // approvals not mentioned
  recommendation:   string;      // Arabic — what the professional should do next
  /** Computed server-side from step.critical && score < 50 — never trusted from model output */
  criticalError:    boolean;
}

const EVAL_PROMPT = (
  scenario: SimScenario,
  step:     SimStep,
  answer:   string,
): string => `
أنت مُقيِّم تدريب مهني متخصص. مهمتك تقييم إجابة محترف قانوني/إداري على خطوة في محاكاة واقعة حقيقية.

─── سياق المحاكاة ─────────────────────────────────────────────────────────
${scenario.scenarioContext}

─── الخطوة الحالية ────────────────────────────────────────────────────────
السؤال: ${step.question}

معايير الإجابة المثالية (للمُقيِّم فقط — لا تُفصح عنها للمتدرب):
${step.expectedAnswerHint}

المستندات التي كان يجب ذكرها: ${step.requiredDocuments.join("، ") || "لا شيء"}
الموافقات التي كان يجب ذكرها: ${step.requiredApprovals.join("، ") || "لا شيء"}

─── إجابة المتدرب ────────────────────────────────────────────────────────
${answer}

─── المطلوب منك ──────────────────────────────────────────────────────────
قيِّم الإجابة وأعِد JSON بالبنية التالية حصراً:

{
  "score": <رقم من 0 إلى 100>,
  "evaluation": "<فقرة تقييم عربية موضوعية تُبيّن نقاط القوة والضعف>",
  "missedDocuments": ["<مستند لم يذكره المتدرب>", ...],
  "missedApprovals": ["<موافقة لم يذكرها المتدرب>", ...],
  "recommendation": "<جملة أو جملتان بالعربية توجّه المتدرب للخطوة التالية>",

}

قواعد التقييم:
- 90-100: إجابة شاملة تُغطي جميع المعايير بدقة
- 70-89: إجابة جيدة مع ثغرات بسيطة
- 50-69: إجابة مقبولة لكن تُغفل عناصر جوهرية
- 0-49: إجابة قاصرة أو مغلوطة في نقاط أساسية
- أجب باللغة العربية في حقلي evaluation و recommendation
- لا تذكر الدرجات الرقمية في نص التقييم
- أجب بـ JSON فقط دون أي نص إضافي
`.trim();

export async function evaluateStep(
  scenario: SimScenario,
  step:     SimStep,
  answer:   string,
): Promise<StepEvaluation> {
  try {
    const ai  = await aiRouter.routeFor(TaskType.RAG);
    const raw = await ai.complete({
      taskType:  TaskType.RAG,
      prompt:    EVAL_PROMPT(scenario, step, answer),
      maxTokens: 1200,
    });

    const result = parseModelJson<Partial<StepEvaluation>>(raw.text);
    const parsed = result.ok ? result.data : {};

    const score = clamp(parsed?.score ?? 50);
    return {
      score,
      evaluation:      parsed?.evaluation       ?? "تعذّر تقييم الإجابة. يُرجى المحاولة مجدداً.",
      missedDocuments: Array.isArray(parsed?.missedDocuments) ? parsed.missedDocuments : [],
      missedApprovals: Array.isArray(parsed?.missedApprovals) ? parsed.missedApprovals : [],
      recommendation:  parsed?.recommendation   ?? "واصل مع الخطوة التالية.",
      // Server-side canonical rule — never trust model for this boolean
      criticalError:   step.critical && score < 50,
    };
  } catch {
    // Graceful fallback — let the session continue even if AI call fails
    return {
      score:           50,
      evaluation:      "تعذّر الاتصال بمحرك التقييم. الدرجة التقديرية 50 مؤقتاً.",
      missedDocuments: [],
      missedApprovals: [],
      recommendation:  "انتقل للخطوة التالية.",
      criticalError:   false,  // conservative: don't penalise for infra failure
    };
  }
}

function clamp(n: unknown): number {
  const v = Number(n);
  if (!isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// ─── Final Report ────────────────────────────────────────────────────────────

export interface SimFinalReport {
  totalScore:         number;
  grade:              string;
  timeline:           Array<{ stepIdx: number; stepId: string; question: string; score: number; criticalError: boolean }>;
  mistakes:           Array<{ stepIdx: number; question: string; evaluation: string }>;
  missedDocuments:    string[];
  missedApprovals:    string[];
  recommendations:    string[];
  strengths:          string[];
}

interface RawStep {
  stepIdx:         number;
  stepId:          string;
  question:        string;
  aiScore:         number;
  aiEvaluation:    string;
  recommendation:  string;
  missedDocuments: string | null;
  missedApprovals: string | null;
  criticalError:   boolean;
}

function parseArr(v: string | null): string[] {
  if (!v) return [];
  try { return JSON.parse(v) as string[]; } catch { return []; }
}

export function buildFinalReport(steps: RawStep[], scenario: SimScenario): SimFinalReport {
  const stepCount = steps.length;
  const totalSteps = scenario.steps.length;

  // Weight: critical steps count 1.5x in the average
  let weightedSum  = 0;
  let weightTotal  = 0;
  for (const s of steps) {
    const cfg    = scenario.steps.find((c) => c.id === s.stepId);
    const weight = cfg?.critical ? 1.5 : 1;
    weightedSum  += s.aiScore * weight;
    weightTotal  += weight;
  }
  // Steps not answered (skipped) count as 0
  const skippedCount = totalSteps - stepCount;
  weightTotal += skippedCount;

  const totalScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
  const grade = totalScore >= 90 ? "A" : totalScore >= 75 ? "B" : totalScore >= 60 ? "C" : totalScore >= 45 ? "D" : "F";

  const timeline = steps.map((s) => ({
    stepIdx:      s.stepIdx,
    stepId:       s.stepId,
    question:     s.question,
    score:        s.aiScore,
    criticalError: s.criticalError,
  }));

  const mistakes = steps
    .filter((s) => s.aiScore < 60 || s.criticalError)
    .map((s) => ({ stepIdx: s.stepIdx, question: s.question, evaluation: s.aiEvaluation }));

  const missedDocs = [...new Set(steps.flatMap((s) => parseArr(s.missedDocuments)))];
  const missedApps = [...new Set(steps.flatMap((s) => parseArr(s.missedApprovals)))];

  const recommendations = steps
    .map((s) => s.recommendation)
    .filter(Boolean)
    .filter((r, i, a) => a.indexOf(r) === i);

  const strengths = steps
    .filter((s) => s.aiScore >= 80)
    .map((s) => s.aiEvaluation.split("،")[0]?.trim() ?? "")
    .filter(Boolean);

  return { totalScore, grade, timeline, mistakes, missedDocuments: missedDocs, missedApprovals: missedApps, recommendations, strengths };
}
