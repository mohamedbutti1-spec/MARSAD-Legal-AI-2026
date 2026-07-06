/**
 * PGF AI Engine — Phase 61: Professional Mentor Engine
 *
 * Runs the final AI assessment after all workflow stages are complete.
 * Produces a PgfAssessmentOutput with all mentor fields including
 * expertReasoning and verificationStatus.
 *
 * Rules:
 *   1. Never fabricates legislation references.
 *   2. Uses only the profession's legalBasis as reference sources.
 *   3. Clearly marks binding vs. best-practice requirements.
 *   4. Confidence score reflects answer completeness and triggered risk flags.
 *   5. Arabic is the primary language throughout.
 *   6. Never replaces the competent authority or issues binding decisions.
 *   7. Distinguish legal requirements from best practices at all times.
 */

import { aiRouter, TaskType }       from "../ai/index.js";
import { parseModelJson }           from "../ai/providers/interface.js";
import type { ProfessionConfig,
  PgfAssessmentOutput, PgfSessionAnswers } from "./types.js";

// ─── Build human-readable answers summary ────────────────────────────────────

function buildAnswersSummary(
  config:  ProfessionConfig,
  answers: PgfSessionAnswers,
): string {
  const lines: string[] = [];
  for (const stage of config.workflowStages) {
    const stageAnswers = answers[stage.id];
    if (!stageAnswers) continue;
    lines.push(`\n## ${stage.title}`);
    for (const q of stage.questions) {
      const ans = stageAnswers[q.id];
      if (ans === undefined || ans === null || ans === "") continue;
      const displayAns = Array.isArray(ans) ? ans.join("، ") : String(ans);
      lines.push(`**${q.text}**\n${displayAns}`);
    }
  }
  return lines.join("\n\n");
}

// ─── Build stage mentor context ───────────────────────────────────────────────

function buildMentorContext(config: ProfessionConfig): string {
  const parts: string[] = [];
  for (const stage of config.workflowStages) {
    if (stage.expertReasoning || stage.commonMistakesAtStage?.length || stage.warningSigns?.length) {
      parts.push(`### مرحلة: ${stage.title}`);
      if (stage.expertReasoning) parts.push(`تفكير الخبير: ${stage.expertReasoning}`);
      if (stage.warningSigns?.length) parts.push(`تحذيرات: ${stage.warningSigns.join(" / ")}`);
      if (stage.commonMistakesAtStage?.length) parts.push(`أخطاء شائعة: ${stage.commonMistakesAtStage.join(" / ")}`);
    }
  }
  return parts.length > 0 ? `\n## إرشاد الخبير عبر المراحل\n${parts.join("\n")}` : "";
}

// ─── Main engine function ─────────────────────────────────────────────────────

export async function runPgfAssessment(params: {
  config:         ProfessionConfig;
  answers:        PgfSessionAnswers;
  triggeredFlags: string[];
}): Promise<PgfAssessmentOutput> {
  const { config, answers, triggeredFlags } = params;

  const ai = await aiRouter.routeFor(TaskType.RAG);

  // Build profession context
  const responsibilitiesText = config.responsibilities.join("\n- ");
  const thinkingModelText = config.thinkingModel
    .map((t) => `${t.step}: ${t.question}`)
    .join("\n");
  const riskIndicatorsText = config.riskIndicators
    .map((r) => `[${r.severity.toUpperCase()}] ${r.indicator} (flag: ${r.flag})`)
    .join("\n");
  const triggeredFlagsText = triggeredFlags.length > 0
    ? triggeredFlags.join("، ")
    : "لا توجد علامات مخاطر مُثارة";
  const legalBasisText = config.legalBasis
    .map((r) => `• ${r.title} — ${r.reference} [${r.binding ? "ملزم" : "استرشادي"}]`)
    .join("\n");
  const checklistText = config.finalChecklist
    .map((c) => `[${c.category}] ${c.item} — ${c.mandatory ? "إلزامي" : "اختياري"}`)
    .join("\n");
  const commonMistakesText = config.commonMistakes
    .map((m) => `• الخطأ: ${m.mistake}\n  العواقب: ${m.consequence}\n  العلاج: ${m.remedy}`)
    .join("\n");
  const mentorContext = buildMentorContext(config);

  const systemPrompt = `أنت مستشار مهني خبير يُقدم تقييماً احترافياً شاملاً ودقيقاً للمتخصصين الإماراتيين.

## دور المستخدم
**المهنة**: ${config.professionNameAr} (${config.professionNameEn})
**القطاع**: ${config.sectorNameAr} (${config.sectorNameEn})

**السياق المهني**: ${config.assessmentContext}

## المسؤوليات الأساسية
- ${responsibilitiesText}

## النموذج التفكيري المهني
${thinkingModelText}

## الإطار القانوني والتنظيمي
${legalBasisText}

## مؤشرات المخاطر
${riskIndicatorsText}

## الأخطاء الشائعة في هذه المهنة
${commonMistakesText}
${mentorContext}

## قائمة التحقق النهائية
${checklistText}

## قواعد صارمة لا استثناء فيها
1. لا تُلفق أرقام مواد أو قوانين أو أحكام قضائية — استند فقط للمراجع المذكورة أعلاه.
2. ميّز بوضوح بين المتطلبات الإلزامية (binding: true) والممارسات الموصى بها (binding: false).
3. درجة الثقة المهنية (0-100) تعكس: اكتمال الإجابات، المخاطر المُثارة، وسلامة الإجراءات.
4. درجة ثقة عالية (>80) = موقف واضح وإجراءات سليمة. متوسطة (60-80) = بعض الفجوات. منخفضة (<60) = مخاطر جوهرية.
5. العربية هي اللغة الأساسية لجميع المحتوى.
6. هذا التقييم إرشادي فقط ولا يُعدّ قراراً مهنياً ملزماً ولا يحلّ محل الجهة المختصة.
7. ميّز دائماً بين المتطلبات القانونية الإلزامية وأفضل الممارسات الاختيارية.
8. إذا كانت الصلاحية غائبة أو غير واضحة — قلها صراحةً ولا تتجاهلها.`;

  const answersSummary = buildAnswersSummary(config, answers);

  const userPrompt = `## إجابات الاستبيان المهني

${answersSummary}

## علامات المخاطر المُثارة خلال سير العمل
${triggeredFlagsText}

---

أَنتج كائن JSON واحداً يلتزم بهذا المخطط بدقة. لا تضف أي نص خارج JSON:

{
  "summary": "ملخص احترافي شامل (300-500 كلمة) يصف الموقف المهني، التقييم، والتوجيه العام",
  "requiredActions": [
    "الإجراء المطلوب 1 — محدد وقابل للتنفيذ",
    "الإجراء المطلوب 2"
  ],
  "missingActions": [
    "الإجراء الغائب أو الناقص 1",
    "الإجراء الغائب أو الناقص 2"
  ],
  "risks": [
    {
      "risk": "وصف الخطر",
      "severity": "high|medium|low",
      "mitigation": "خطة تخفيف الخطر"
    }
  ],
  "applicableLegislation": [
    {
      "title": "اسم التشريع",
      "reference": "الرقم والمرجع — استخدم فقط المراجع المذكورة في الإطار القانوني أعلاه",
      "type": "law|regulation|decree|principle|standard|policy|guideline",
      "binding": true
    }
  ],
  "applicableRegulations": [
    {
      "title": "اسم اللائحة أو المعيار",
      "reference": "مرجعه الدقيق",
      "type": "law|regulation|decree|principle|standard|policy|guideline",
      "binding": false
    }
  ],
  "bestPractices": [
    "الممارسة الفضلى 1 المحددة لهذا الموقف",
    "الممارسة الفضلى 2"
  ],
  "commonMistakes": [
    {
      "mistake": "الخطأ الشائع الأكثر صلة بهذا الموقف",
      "consequence": "العواقب",
      "remedy": "العلاج"
    }
  ],
  "escalationRecommendation": "متى ولمن ينبغي تصعيد هذا الأمر — أو null إذا لم يكن ضرورياً",
  "confidenceScore": 85,
  "confidenceRationale": "شرح موجز لدرجة الثقة: ما يدعمها وما يخفضها",
  "expertReasoning": "كيف يُحلل الخبير المتمرس هذا الموقف المهني بعيون ناقدة — ما القوة في الموقف وأين تكمن الثغرات وما الرأي المهني الشامل",
  "verificationStatus": "أحد ثلاثة قيم فقط: verified (الإجراءات صحيحة ومكتملة) أو needs_review (ثمة فجوات تحتاج معالجة) أو flagged (مخاطر جوهرية تستدعي انتباهاً فورياً)",
  "finalChecklist": [
    {
      "id": "fc1",
      "item": "عنصر قائمة التحقق",
      "category": "legal|procedural|documentation|risk|quality",
      "mandatory": true,
      "status": "complete|incomplete|not_applicable",
      "note": "ملاحظة اختيارية"
    }
  ],
  "disclaimer": "هذا التقييم المهني لأغراض توجيهية فقط ولا يُعدّ قراراً مهنياً أو قانونياً ملزماً ولا يحلّ محل الجهة المختصة أو المستشار المتخصص. المتطلبات الملزمة مُحددة بوضوح في التقييم."
}`;

  const raw = await ai.complete({
    taskType:     TaskType.RAG,
    prompt:       userPrompt,
    systemPrompt: systemPrompt,
    maxTokens:    7000,
  });

  const parsed = parseModelJson<PgfAssessmentOutput>(raw.text);

  if (!parsed.ok) {
    throw new Error(`PGF engine: AI returned non-JSON. Raw: ${parsed.raw.slice(0, 300)}`);
  }

  const output = parsed.data;

  // Enforce final checklist from config if AI omits items
  if (!output.finalChecklist || output.finalChecklist.length === 0) {
    output.finalChecklist = config.finalChecklist.map((item) => ({
      ...item,
      status: "incomplete" as const,
    }));
  }

  // Always present disclaimer
  if (!output.disclaimer) {
    output.disclaimer = "هذا التقييم لأغراض توجيهية فقط ولا يُعدّ قراراً مهنياً ملزماً.";
  }

  // Clamp confidence score
  if (typeof output.confidenceScore === "number") {
    output.confidenceScore = Math.max(0, Math.min(100, Math.round(output.confidenceScore)));
  } else {
    output.confidenceScore = 50;
  }

  return output;
}
