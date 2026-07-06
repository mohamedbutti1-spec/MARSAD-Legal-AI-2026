/**
 * Judicial Reasoning Engine (JRE)
 *
 * Simulates how a UAE Federal Administrative Court judge analyses an
 * administrative dispute step by step, producing a fully-reasoned draft
 * judgment with verified UAE authorities.
 *
 * Pipeline (6 stages):
 *   Stage 1 — Facts & Issues extraction (AI)
 *   Stage 2 — KB retrieval: legislation + case law (parallel buildKbContext calls)
 *   Stage 3 — Legal analysis: applicable law, principles, proportionality (AI + RAG)
 *   Stage 4 — AI-decision review (conditional AI, only when hasAiDecision=true)
 *   Stage 5 — Theory Mode isolated analysis (conditional AI, non-binding)
 *   Stage 6 — Draft judgment synthesis: holding, order, authority hierarchy (AI)
 *
 * Anti-hallucination rules enforced at the prompt level:
 *   • Every AI stage explicitly forbids citing any law or case not in the RAG context.
 *   • All [SRC:N] tokens are validated against the sourceIndex via resolveCitations().
 *   • Theory Mode runs in a completely isolated AI call and is always labelled
 *     non-binding; it never merges into the binding legal analysis.
 */

import { aiRouter, TaskType } from "../ai/index.js";
import { parseModelJson } from "../ai/providers/interface.js";
import { buildKbContext } from "../kb/retrieval.js";
import { extractCitationTokens, resolveCitations, KB_ID_OFFSET } from "./rag.js";
import { computeLegalityScore, computeRiskScore } from "./admin-os-evaluator.js";
import type { DimensionResult } from "./admin-os-evaluator.js";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface JreParties {
  applicant:    string;
  respondent:   string;
  applicantAr:  string;
  respondentAr: string;
}

export interface JreLegislationItem {
  titleAr:          string;
  documentNumber:   string | null;
  year:             number | null;
  relevantArticles: string[];
  authorityClass:   "binding" | "persuasive";
  hierarchyLevel:   string;
  ragTag:           string | null;
  isAmended:        boolean;
  amendedBy?:       string;
}

export interface JrePrecedentItem {
  caseRef:        string;
  court:          string;
  year:           string;
  principleAr:    string;
  relevance:      string;
  authorityClass: "binding" | "persuasive";
  ragTag:         string | null;
}

export interface JrePrinciple {
  nameAr:         string;
  nameEn:         string;
  applicationAr:  string;
  legalBasis:     string;
  authorityClass: "binding" | "persuasive";
}

export interface JreProportionality {
  applicable:         boolean;
  legitimateAim:      string | null;
  necessity:          { finding: string; compliant: boolean } | null;
  proportionalitySS: { finding: string; compliant: boolean } | null;
  overallFinding:     "proportionate" | "disproportionate" | "not_applicable";
}

export interface JreAiDimensionFinding {
  dimension:   string;
  dimensionAr: string;
  finding:     string;
  compliant:   boolean;
  basis:       string;
}

export interface JreAiDecisionReview {
  applicable:  boolean;
  dimensions:  JreAiDimensionFinding[] | null;
  overallNote: string | null;
}

export interface JreTheoryAnalysis {
  applied:     boolean;
  lensName:    string | null;
  analysisAr:  string | null;
  disclaimer:  string;
}

/**
 * Per-stage inline theory — one object per major analytical stage.
 * UAE binding analysis is always listed first; theory is non-binding and
 * can never modify the legal conclusion.
 */
export interface JreStageTheory {
  stageId:   "legislation" | "precedents" | "principles" | "proportionality" | "ai_review";
  stageNameAr: string;
  /** Concise summary of what UAE binding law found for this stage (always shown first). */
  uaeBindingAnalysis: string;
  /** Non-binding theory-lens perspective on this stage. Always labelled [غير مُلزِم]. */
  theoryLensAnalysis: string | null;
  /** Optional French administrative law parallel (populated for proportionality stages
   *  and when the active lens is comparative_french). */
  frenchComparative:  string | null;
  /** One sentence: where UAE law and the theory framework agree. */
  agreement:  string;
  /** One sentence: key divergence or nuance the theory adds. */
  difference: string;
  /** One sentence: academic insight not surfaced by UAE analysis alone. */
  addedValue: string;
  disclaimer: string;
}

export interface JreAuthorityEntry {
  rank:           number;
  authorityClass: "binding" | "persuasive" | "non_binding";
  titleAr:        string;
  hierarchyLevel: string;
  ragTag:         string | null;
  role:           "primary" | "supporting" | "contextual";
}

export interface JreVerificationStatus {
  allAuthoritiesVerified:      boolean;
  verifiedCount:               number;
  unverifiedCount:             number;
  fabricatedCitationsFiltered: number;
  message:                     string;
}

export interface JudgmentOutput {
  caseTitle: string;

  facts: {
    summary:             string;
    keyFacts:            Array<{ factAr: string; significance: string }>;
    applicant:           string;
    respondent:          string;
    applicantAr:         string;
    respondentAr:        string;
    disputeType:         string;
    hasAiSystemInvolved: boolean;
  };

  legalIssues: Array<{
    issueAr:        string;
    issueEn:        string;
    classification: "procedural" | "substantive" | "competence" | "form" | "proportionality";
  }>;

  legislation:      JreLegislationItem[];
  precedents:       JrePrecedentItem[];
  principles:       JrePrinciple[];
  proportionality:  JreProportionality;
  aiDecisionReview: JreAiDecisionReview;
  theoryAnalysis:   JreTheoryAnalysis;  // backward-compat derived field
  /** Inline per-stage theory — populated when a theory lens is active. */
  stageTheory: JreStageTheory[];

  reasons:  string;
  holding:  string;
  order:    string;
  orderEn:  string;

  authorityHierarchy: JreAuthorityEntry[];
  verificationStatus: JreVerificationStatus;

  legalityScore?: number;
  riskScore?:     number;
}

export interface JreStageData {
  stage1Facts?:     unknown;
  stage2Retrieval?: { ragContext: string };
  stage3Analysis?:  unknown;
  stage4AiReview?:  unknown;
  stage5Theory?:    JreStageTheory[];
  stage6Judgment?:  unknown;
}

// ─── Theory lens definitions ──────────────────────────────────────────────────

export const THEORY_LENSES: Record<string, { nameAr: string; promptBlock: string }> = {
  al_shamsi: {
    nameAr: "نظرية الشامسي",
    promptBlock: `
الإطار: نظرية الشامسي للقرارات الإدارية — الأبعاد الاثنا عشر
1. الاختصاص — هل الجهة المُصدِرة تملك الصلاحية القانونية الكاملة؟
2. الشكل — هل القرار استوفى شروط الشكل القانوني (كتابة، توقيع، تسبيب، إشعار)؟
3. السبب — هل ثمة واقعة قانونية تُسوّغ القرار؟
4. المحل — هل موضوع القرار مشروع وممكن التنفيذ؟
5. الغاية — هل القرار يستهدف المصلحة العامة لا غايات شخصية؟
6. الإرادة الإنسانية — هل القرار صادر عن إرادة إنسانية حرة وواعية؟
7. تكوين الإرادة الرقمية — هل الأنظمة الرقمية المستخدمة معتمدة قانونياً؟
8. الوزن القانوني الخوارزمي — ما مقدار تأثير الخوارزمية على القرار؟
9. التحيز الخوارزمي — هل الخوارزمية خضعت للتقييم والمراجعة؟
10. قابلية التفسير — هل يمكن شرح القرار للمتأثر بوضوح؟
11. الإشراف البشري — هل ثمة رقابة بشرية كافية على تنفيذ القرار؟
12. الجاهزية للمراجعة القضائية — هل القرار قادر على الصمود أمام الرقابة القضائية؟`,
  },
  comparative_french: {
    nameAr: "القانون الإداري الفرنسي المقارن",
    promptBlock: `
الإطار: مبادئ القانون الإداري الفرنسي المقارن
• مبدأ التناسب (Proportionnalité) — مجلس الدولة الفرنسي، Benjamin 1933
• الانحراف بالسلطة (Détournement de pouvoir) — الغاية غير المشروعة
• الخطأ الواضح في التقدير (Erreur manifeste d'appréciation)
• مبدأ المشروعية (Légalité) — التسلسل الهرمي للمعايير القانونية
• حقوق الدفاع (Droits de la défense) — الإجراءات الواجبة
• الثقة المشروعة (Confiance légitime) — حماية توقعات أصحاب المصلحة`,
  },
};

// ─── RAG context builder ──────────────────────────────────────────────────────

async function buildJreRagContext(legQuery: string, caseQuery: string): Promise<{
  ragContext:  string;
  sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>;
}> {
  // Run parallel KB retrievals for legislation and case law
  const [legResult, caseResult] = await Promise.all([
    buildKbContext(legQuery, { topK: 6, excludeRepealed: true }).catch(() => null),
    buildKbContext(caseQuery, { topK: 5 }).catch(() => null),
  ]);

  const sourceIndex = new Map<string, { title: string; type: "document" | "legal_source" }>();
  const parts: string[] = [];

  const processResult = (result: typeof legResult, prefix: string) => {
    if (!result || result.entries.length === 0) return;
    if (result.inventory) {
      parts.push(`[${prefix} Authority Inventory]\n${result.inventory}`);
    }
    for (const entry of result.entries) {
      const offsetId  = entry.documentId + KB_ID_OFFSET;
      const offsetTag = `SRC:${offsetId}`;
      const contextLine = entry.contextLine.replace(
        new RegExp(`\\[${entry.tag}\\]`, "g"),
        `[${offsetTag}]`,
      );
      sourceIndex.set(offsetTag, { title: entry.titleAr, type: "legal_source" });
      parts.push(contextLine);
    }
    if (result.legalContextChain) {
      parts.push(result.legalContextChain);
    }
  };

  processResult(legResult,  "LEGISLATION");
  processResult(caseResult, "CASE LAW");

  return {
    ragContext:  parts.join("\n\n─────────────────────────────────────\n\n"),
    sourceIndex,
  };
}

// ─── AI system prompts ────────────────────────────────────────────────────────

const STAGE1_SYSTEM = `أنت مساعد قضائي متخصص في المحاكم الإدارية الاتحادية الإماراتية.
مهمتك: استخراج وهيكلة الوقائع والمسائل القانونية من ملخص النزاع المُقدَّم.

قواعد:
- لا تُضِف وقائع لم تُذكر صراحةً في الملخص.
- صنِّف كل مسألة قانونية بدقة: procedural | substantive | competence | form | proportionality
- حدِّد ما إذا كان القرار المطعون فيه يتضمن نظاماً رقمياً أو خوارزمياً.
- أنشئ استعلامَي بحث مناسبَين لاسترداد المصادر القانونية.

أجب حصراً بـJSON:
{
  "caseTitle": "وصف موجز",
  "facts": {
    "summary": "ملخص الوقائع في 3-5 جمل",
    "keyFacts": [{ "factAr": "الواقعة", "significance": "أثرها القانوني" }],
    "hasAiSystemInvolved": false
  },
  "legalIssues": [
    { "issueAr": "المسألة بالعربية", "issueEn": "Issue in English", "classification": "procedural|substantive|competence|form|proportionality" }
  ],
  "disputeClassification": "annulment|compensation|disciplinary|licensing|procurement|civil_service|expropriation|other",
  "legQuery": "استعلام بحث عن التشريعات الإدارية الإماراتية المنطبقة",
  "caseQuery": "استعلام بحث عن السوابق القضائية الإدارية الإماراتية ذات الصلة"
}`;

const STAGE3_SYSTEM = `أنت قاضٍ إداري اتحادي إماراتي تُجري تحليلاً قانونياً شاملاً.

⚠️ قواعد مكافحة الاختراع — إلزامية:
• لا تستشهد بأي قانون أو قضية أو مادة غير موجودة في السياق القانوني المُقدَّم أدناه.
• إذا لم تجد سلطة كافية في السياق، صرِّح بذلك: "لا توجد سلطة كافية في قاعدة البيانات حول هذه المسألة".
• صنِّف كل سلطة: [مُلزِم — UAE Binding] أو [مرجعي مقارن — Persuasive].
• استخدم وسوم [SRC:N] للاستشهاد فقط بمصادر موجودة في السياق.

مهمتك: باستخدام السياق القانوني الموثَّق فقط، حلِّل:
1. التشريعات الإماراتية المنطبقة وتسلسلها الهرمي
2. السوابق القضائية الإدارية ذات الصلة
3. مبادئ القانون الإداري الإماراتي المُستخلَصة
4. مراجعة التناسب (إن كانت مطلوبة)

أجب حصراً بـJSON:
{
  "applicableLegislation": [
    {
      "titleAr": "اسم القانون",
      "documentNumber": "رقم القانون أو null",
      "year": 2024,
      "relevantArticles": ["المادة X: ..."],
      "authorityClass": "binding|persuasive",
      "hierarchyLevel": "1|2|3|4|5|6",
      "ragTag": "[SRC:N] أو null",
      "isAmended": false,
      "amendedBy": null
    }
  ],
  "precedents": [
    {
      "caseRef": "رقم الطعن والسنة",
      "court": "اسم المحكمة",
      "year": "السنة",
      "principleAr": "المبدأ القانوني المُستخلَص",
      "relevance": "وجه الارتباط بالقضية",
      "authorityClass": "binding|persuasive",
      "ragTag": "[SRC:N] أو null"
    }
  ],
  "principles": [
    {
      "nameAr": "اسم المبدأ",
      "nameEn": "Principle Name",
      "applicationAr": "تطبيق المبدأ على القضية",
      "legalBasis": "السلطة القانونية الداعمة",
      "authorityClass": "binding|persuasive"
    }
  ],
  "proportionality": {
    "applicable": true,
    "legitimateAim": "الهدف المشروع أو null",
    "necessity": { "finding": "...", "compliant": true },
    "proportionalitySS": { "finding": "...", "compliant": true },
    "overallFinding": "proportionate|disproportionate|not_applicable"
  },
  "reasons": "التحليل التفصيلي بأسلوب قضائي رسمي (3-5 فقرات)"
}`;

const STAGE4_SYSTEM = `أنت قاضٍ إداري اتحادي إماراتي تُراجع قراراً اتخذه نظام ذكاء اصطناعي أو خوارزمي.

⚠️ لا تستشهد بأي قانون أو قضية غير موجودة في السياق القانوني المُقدَّم.
⚠️ صنِّف كل استشهاد: [مُلزِم] أو [مرجعي مقارن — غير مُلزِم].

حلِّل القرار وفق الأبعاد السبعة الخاصة بالقرارات الرقمية. أجب بـJSON:
{
  "dimensions": [
    { "dimension": "humanWill", "dimensionAr": "الإرادة الإنسانية", "finding": "...", "compliant": true, "basis": "السلطة القانونية أو 'لا توجد سلطة مباشرة'" },
    { "dimension": "digitalWillFormation", "dimensionAr": "تكوين الإرادة الرقمية", "finding": "...", "compliant": true, "basis": "..." },
    { "dimension": "algorithmicWeight", "dimensionAr": "الوزن القانوني الخوارزمي", "finding": "...", "compliant": true, "basis": "..." },
    { "dimension": "algorithmicBias", "dimensionAr": "التحيز الخوارزمي", "finding": "...", "compliant": true, "basis": "..." },
    { "dimension": "explainability", "dimensionAr": "قابلية التفسير", "finding": "...", "compliant": true, "basis": "..." },
    { "dimension": "humanOversight", "dimensionAr": "الإشراف البشري", "finding": "...", "compliant": true, "basis": "..." },
    { "dimension": "judicialReviewReadiness", "dimensionAr": "الجاهزية للمراجعة القضائية", "finding": "...", "compliant": true, "basis": "..." }
  ],
  "overallNote": "تقييم موجز لمدى مشروعية القرار الرقمي"
}`;

function buildStage6System(): string {
  return `أنت قاضٍ إداري اتحادي إماراتي تُصدر حكمك القضائي. اكتب الحكم كاملاً باللغة العربية بأسلوب قضائي رسمي مع ترجمة الجزء الحُكمي للإنجليزية.

هيكل الحكم الإلزامي:
1. ديباجة (المحكمة، الأطراف، موضوع النزاع)
2. الأسباب — تحليل قانوني تفصيلي يستوعب التشريعات والسوابق والمبادئ
3. المنطوق — "حكمت المحكمة بما يلي:"

أسلوب قضائي:
- صيغة الغائب الرسمية: "ثبت لدى المحكمة"، "استناداً إلى"، "تُقرِّر المحكمة"
- كل استشهاد يُعلَّم [مُلزِم] أو [مرجعي مقارن — غير مُلزِم]
- لا تستشهد بسلطات غير واردة في التحليل المُقدَّم

⚠️ القانون الإماراتي الملزم فحسب: اكتب الأسباب والمنطوق استناداً إلى التشريعات والسوابق والمبادئ الإماراتية الملزمة الواردة في التحليل. لا يُدرَج أي تحليل نظري مقارن في نص الحكم — التحليل النظري يُعرَض بصورة مستقلة خارج الحكم القضائي ولا يُعدِّل خلاصته أبداً.

أجب بـJSON:
{
  "reasons": "الأسباب القانونية التفصيلية بأسلوب قضائي (4-7 فقرات بالعربية)",
  "holding": "خلاصة الحكم في 2-3 جمل (بالعربية)",
  "order": "منطوق الحكم: حكمت المحكمة بما يلي: ... (بالعربية)",
  "orderEn": "Operative order in English",
  "authorityHierarchy": [
    {
      "rank": 1,
      "authorityClass": "binding|persuasive|non_binding",
      "titleAr": "اسم السلطة",
      "hierarchyLevel": "1|2|3|4|5|6",
      "ragTag": "[SRC:N] أو null",
      "role": "primary|supporting|contextual"
    }
  ]
}`;
}

// ─── Main engine function ─────────────────────────────────────────────────────

export async function runJudicialAnalysis(params: {
  disputeSummary:  string;
  parties:         JreParties;
  disputeType:     string;
  hasAiDecision:   boolean;
  theoryLensId:    string | null;
  theoryLensName:  string | null;
  customTheoryText: string | null;
  userId:          number;
}): Promise<{ judgment: JudgmentOutput; stageData: JreStageData; legalityScore?: number; riskScore?: number }> {
  const { disputeSummary, parties, disputeType, hasAiDecision, theoryLensId, theoryLensName, customTheoryText, userId } = params;

  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err) {
    throw new Error(`AI provider unavailable: ${(err as Error).message}`);
  }

  const stageData: JreStageData = {};

  // ── Stage 1: Facts & Issues ─────────────────────────────────────────────────
  const s1User = `ملخص النزاع الإداري:
${disputeSummary}

المدعي (المتظلم): ${parties.applicantAr || parties.applicant}
المدعى عليه (الجهة الإدارية): ${parties.respondentAr || parties.respondent}
نوع النزاع: ${disputeType}`;

  const s1Raw = await provider.complete({
    taskType:     TaskType.RAG,
    systemPrompt: STAGE1_SYSTEM,
    prompt:       s1User,
    maxTokens:    2500,
  });

  const s1Cleaned = s1Raw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const s1Parse = parseModelJson<{
    caseTitle:              string;
    facts:                  { summary: string; keyFacts: Array<{ factAr: string; significance: string }>; hasAiSystemInvolved: boolean };
    legalIssues:            Array<{ issueAr: string; issueEn: string; classification: string }>;
    disputeClassification:  string;
    legQuery:               string;
    caseQuery:              string;
  }>(s1Cleaned);

  if (!s1Parse.ok) throw new Error(`Stage 1 (facts) parse failed: ${s1Parse.raw?.slice(0, 200)}`);
  const s1 = s1Parse.data;
  stageData.stage1Facts = s1;

  // ── Stage 2: KB Retrieval ───────────────────────────────────────────────────
  const legQuery  = s1.legQuery  || `${disputeType} قانون إداري إماراتي اختصاص تسبيب`;
  const caseQuery = s1.caseQuery || `مبادئ قضائية إدارية ${disputeType} إماراتية`;

  const { ragContext, sourceIndex } = await buildJreRagContext(legQuery, caseQuery);
  stageData.stage2Retrieval = { ragContext };

  // ── Stage 3: Legal Analysis + Proportionality ───────────────────────────────
  const contextBlock = ragContext
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nالسياق القانوني من قاعدة البيانات (المصادر المُتاحة فقط):\n${ragContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "⚠️ لا توجد مصادر قانونية مُفهرَسة متاحة لهذا الاستعلام. قيِّد تحليلك على ما هو موثَّق بشكل عام في القانون الإداري الإماراتي وأشِر إلى غياب السلطات المحددة.";

  const s3User = `الوقائع والمسائل القانونية:
${JSON.stringify({ facts: s1.facts, legalIssues: s1.legalIssues, disputeType }, null, 2)}

أطراف النزاع:
المدعي: ${parties.applicantAr || parties.applicant}
المدعى عليه: ${parties.respondentAr || parties.respondent}

${contextBlock}`;

  const s3Raw = await provider.complete({
    taskType:     TaskType.RAG,
    systemPrompt: STAGE3_SYSTEM,
    prompt:       s3User,
    maxTokens:    6000,
  });

  const s3Cleaned = s3Raw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const s3Parse = parseModelJson<{
    applicableLegislation: JreLegislationItem[];
    precedents:            JrePrecedentItem[];
    principles:            JrePrinciple[];
    proportionality:       JreProportionality;
    reasons:               string;
  }>(s3Cleaned);

  if (!s3Parse.ok) throw new Error(`Stage 3 (legal analysis) parse failed`);
  const s3 = s3Parse.data;
  stageData.stage3Analysis = s3;

  // ── Stage 4: AI-Decision Review (conditional) ───────────────────────────────
  let s4: { dimensions: JreAiDimensionFinding[]; overallNote: string } | null = null;
  let legalityScore: number | undefined;
  let riskScore:     number | undefined;

  if (hasAiDecision || s1.facts.hasAiSystemInvolved) {
    const s4User = `وقائع القضية:
${s1.facts.summary}

التشريعات المنطبقة:
${(s3.applicableLegislation ?? []).map((l) => `• ${l.titleAr}${l.ragTag ? ` ${l.ragTag}` : ""}`).join("\n") || "لم تُحدَّد"}

السياق القانوني:
${ragContext || "غير متوفر"}`;

    const s4Raw = await provider.complete({
      taskType:     TaskType.RAG,
      systemPrompt: STAGE4_SYSTEM,
      prompt:       s4User,
      maxTokens:    4000,
    });

    const s4Cleaned = s4Raw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const s4Parse = parseModelJson<{ dimensions: JreAiDimensionFinding[]; overallNote: string }>(s4Cleaned);

    if (s4Parse.ok && Array.isArray(s4Parse.data.dimensions) && s4Parse.data.dimensions.length > 0) {
      s4 = s4Parse.data;
      stageData.stage4AiReview = s4;

      // Convert to DimensionResult map for score computation
      const dimMap: Record<string, DimensionResult> = {};
      for (const d of s4.dimensions) {
        dimMap[d.dimension] = {
          status:               d.compliant ? "compliant" : "non-compliant",
          score:                d.compliant ? 80 : 30,
          explanationAr:        d.finding,
          explanationEn:        d.finding,
          missingRequirements:  [],
          applicableLaw:        [d.basis],
        };
      }
      legalityScore = computeLegalityScore(dimMap);
      riskScore     = computeRiskScore(dimMap, "high", legalityScore);
    }
  }

  // ── Stage 5: Inline Per-Stage Theory (isolated, non-binding) ────────────────
  // Generates one JreStageTheory object per analytical stage.
  // The synthesis (Stage 6) receives ZERO theory input — hard guarantee that
  // theory can never modify the legal conclusion.
  let stageTheory: JreStageTheory[] = [];
  const THEORY_DISCLAIMER = "⚠️ هذا التحليل النظري غير مُلزِم قانونياً ولا يُشكِّل سلطة قضائية ملزمة. أحكام القانون الإماراتي الواردة في أسباب الحكم تسود دائماً عند التعارض.";

  let theoryAnalysis: JreTheoryAnalysis = {
    applied:    false,
    lensName:   null,
    analysisAr: null,
    disclaimer: "هذا القسم غير مُفعَّل في الجلسة الراهنة.",
  };

  if (theoryLensId) {
    const lensConfig  = THEORY_LENSES[theoryLensId];
    const lensName    = theoryLensName ?? lensConfig?.nameAr ?? theoryLensId;
    const promptBlock = lensConfig?.promptBlock ?? customTheoryText ?? "";
    const isFrenchLens   = theoryLensId === "comparative_french";

    const includeProportionality = s3.proportionality?.applicable === true;
    const includeAiReview        = !!(s4 && s4.dimensions?.length);

    const stagesRequested = [
      "- legislation (التشريعات المنطبقة) — إلزامي",
      "- precedents (السوابق القضائية) — إلزامي",
      "- principles (مبادئ القانون الإداري) — إلزامي",
      ...(includeProportionality ? ["- proportionality (التناسب) — مطلوب: المحكمة طبَّقت مراجعة التناسب"] : []),
      ...(includeAiReview        ? ["- ai_review (القرار الرقمي/الخوارزمي) — مطلوب: القرار يتضمن نظاماً رقمياً"] : []),
    ].join("\n");

    const stage5System = `أنت باحث قانوني أكاديمي متخصص في القانون الإداري المقارن. مهمتك تحليل قضية إدارية إماراتية عبر منظور "${lensName}".

⚠️ تحذير إلزامي: هذا التحليل أكاديمي نظري غير مُلزِم تماماً. لا يُعدِّل الحكم القانوني الإماراتي الملزم ولا يُمثِّل سلطة قضائية. ضَع علامة [غير مُلزِم] في كل موضع.

الإطار النظري:
${promptBlock}

لكل مرحلة من المراحل المطلوبة أدناه، أنتِج كائن JSON يحتوي على:
1. stageId — المعرِّف المُحدَّد أدناه (بالإنجليزية)
2. stageNameAr — اسم المرحلة بالعربية
3. uaeBindingAnalysis — ملخص موجز (2-3 جمل) لما يقوله القانون الإماراتي الملزم في هذه المرحلة استناداً إلى التحليل المُقدَّم
4. theoryLensAnalysis — منظور "${lensName}" النظري في هذه المرحلة [غير مُلزِم] (2-3 جمل)
5. frenchComparative — ${isFrenchLens ? "المقارن الفرنسي لهذه المرحلة [غير مُلزِم] (2-3 جمل)" : "المقارن الفرنسي لمرحلة التناسب فحسب (إن وُجدت)، أو null لبقية المراحل"} 
6. agreement — جملة واحدة: نقطة التوافق بين القانون الإماراتي و"${lensName}"
7. difference — جملة واحدة: نقطة الاختلاف أو الإضافة النظرية
8. addedValue — جملة واحدة: القيمة الأكاديمية التي لا يكشفها التحليل الإماراتي وحده [غير مُلزِم]
9. disclaimer — "هذا التحليل النظري غير مُلزِم قانونياً"

المراحل المطلوبة:
${stagesRequested}

أجب حصراً بـJSON:
{
  "stageTheory": [
    {
      "stageId": "legislation|precedents|principles|proportionality|ai_review",
      "stageNameAr": "...",
      "uaeBindingAnalysis": "...",
      "theoryLensAnalysis": "... [غير مُلزِم]",
      "frenchComparative": "... [غير مُلزِم]" ,
      "agreement": "...",
      "difference": "...",
      "addedValue": "... [غير مُلزِم]",
      "disclaimer": "هذا التحليل النظري غير مُلزِم قانونياً"
    }
  ]
}`;

    const stage5User = `تحليل المرحلة الثالثة (القانوني الإماراتي الملزم):

التشريعات المنطبقة:
${JSON.stringify(s3.applicableLegislation ?? [], null, 2)}

السوابق القضائية:
${JSON.stringify(s3.precedents ?? [], null, 2)}

مبادئ القانون الإداري:
${JSON.stringify(s3.principles ?? [], null, 2)}

${includeProportionality ? `مراجعة التناسب:\n${JSON.stringify(s3.proportionality, null, 2)}\n` : ""}
${includeAiReview ? `مراجعة القرار الرقمي:\n${JSON.stringify(s4, null, 2)}\n` : ""}
الأسباب القانونية (المرحلة 3):
${s3.reasons ?? ""}

وقائع القضية:
${s1.facts.summary}`;

    try {
      const stage5Raw = await provider.complete({
        taskType:     TaskType.RAG,
        systemPrompt: stage5System,
        prompt:       stage5User,
        maxTokens:    4000,
      });

      const stage5Cleaned = stage5Raw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      const stage5Parse   = parseModelJson<{ stageTheory: JreStageTheory[] }>(stage5Cleaned);

      if (stage5Parse.ok && Array.isArray(stage5Parse.data.stageTheory)) {
        stageTheory = stage5Parse.data.stageTheory;
        stageData.stage5Theory = stageTheory;
      }
    } catch {
      // Theory enrichment failure is non-fatal; stageTheory stays []
    }

    // Backward-compat: derive JreTheoryAnalysis from stageTheory
    theoryAnalysis = {
      applied:    stageTheory.length > 0,
      lensName,
      analysisAr: stageTheory.length > 0
        ? stageTheory.map((s) =>
            `## ${s.stageNameAr}\n${s.theoryLensAnalysis ?? ""}\n\n` +
            (s.frenchComparative ? `### القانون الفرنسي المقارن\n${s.frenchComparative}\n\n` : "") +
            `توافق: ${s.agreement}\nاختلاف: ${s.difference}\nقيمة مضافة: ${s.addedValue}`
          ).join("\n\n---\n\n")
        : null,
      disclaimer: THEORY_DISCLAIMER,
    };
  }

  // ── Stage 6: Draft Judgment Synthesis ──────────────────────────────────────
  const s6User = `الوقائع:
${JSON.stringify(s1.facts, null, 2)}

المسائل القانونية:
${JSON.stringify(s1.legalIssues, null, 2)}

التشريعات المنطبقة:
${JSON.stringify(s3.applicableLegislation ?? [], null, 2)}

السوابق القضائية:
${JSON.stringify(s3.precedents ?? [], null, 2)}

المبادئ القانونية:
${JSON.stringify(s3.principles ?? [], null, 2)}

مراجعة التناسب:
${JSON.stringify(s3.proportionality, null, 2)}

${s4 ? `مراجعة القرار الرقمي:\n${JSON.stringify(s4, null, 2)}\n` : ""}
المدعي: ${parties.applicantAr || parties.applicant}
المدعى عليه: ${parties.respondentAr || parties.respondent}
نوع النزاع: ${disputeType}`;

  const s6Raw = await provider.complete({
    taskType:     TaskType.RAG,
    systemPrompt: buildStage6System(),
    prompt:       s6User,
    maxTokens:    8000,
  });

  const s6Cleaned = s6Raw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const s6Parse = parseModelJson<{
    reasons:            string;
    holding:            string;
    order:              string;
    orderEn:            string;
    authorityHierarchy: JreAuthorityEntry[];
  }>(s6Cleaned);

  if (!s6Parse.ok) throw new Error(`Stage 6 (judgment) parse failed`);
  const s6 = s6Parse.data;
  stageData.stage6Judgment = s6;

  // ── Citation verification & filtering ──────────────────────────────────────
  const allText    = JSON.stringify({ s3, s4, s6 });
  const rawTokens  = extractCitationTokens(allText);
  const resolvedCitations = await resolveCitations(rawTokens, sourceIndex, userId);

  const verifiedSet  = new Set(resolvedCitations.map((c) => c.token));
  const fabricated   = rawTokens.filter((t) => !verifiedSet.has(t.token));

  // Build regex that strips bracketed fabricated tokens from text
  // token shape is e.g. "SRC:100034" → we strip "[SRC:100034]"
  const fabricatedTagSet = new Set(fabricated.map((t) => t.token));
  const stripFabricated = (text: string): string => {
    if (fabricatedTagSet.size === 0) return text;
    return text.replace(/\[([A-Z]+:[^\]]+)\]/g, (match, inner) =>
      fabricatedTagSet.has(inner) ? "" : match
    ).replace(/\s{2,}/g, " ").trim();
  };

  // ── Filter fabricated tags from all citation-bearing structured arrays ──────
  const filterByRagTag = <T extends { ragTag?: string | null }>(arr: T[]): T[] =>
    arr.filter((item) => {
      if (!item.ragTag) return true; // no tag → structural entry, keep
      const inner = item.ragTag.replace(/^\[|\]$/g, "");
      return !fabricatedTagSet.has(inner);
    });

  const filteredHierarchy   = filterByRagTag(s6.authorityHierarchy ?? []);
  const filteredLegislation = filterByRagTag(s3.applicableLegislation ?? []);
  const filteredPrecedents  = filterByRagTag(s3.precedents ?? []);
  // JrePrinciple has no ragTag; keep principles as-is (no fabrication risk)
  const filteredPrinciples  = s3.principles ?? [];

  const verificationStatus: JreVerificationStatus = {
    allAuthoritiesVerified:      fabricated.length === 0,
    verifiedCount:               resolvedCitations.length,
    unverifiedCount:             fabricated.length,
    fabricatedCitationsFiltered: fabricated.length,
    message: fabricated.length === 0
      ? "جميع الاستشهادات تمَّت مطابقتها مع مصادر موثَّقة في قاعدة البيانات."
      : `تمَّ حذف ${fabricated.length} استشهاد(ات) غير موثَّق(ة) من المخرجات.`,
  };

  // ── Assemble JudgmentOutput ─────────────────────────────────────────────────
  const classOrder: Record<string, number> = { binding: 0, persuasive: 1, non_binding: 2 };
  const sortedHierarchy = filteredHierarchy.slice().sort((a, b) => {
    const diff = (classOrder[a.authorityClass] ?? 2) - (classOrder[b.authorityClass] ?? 2);
    return diff !== 0 ? diff : a.rank - b.rank;
  });

  const judgment: JudgmentOutput = {
    caseTitle: s1.caseTitle || `نزاع إداري — ${disputeType}`,

    facts: {
      summary:             s1.facts.summary,
      keyFacts:            s1.facts.keyFacts ?? [],
      applicant:           parties.applicant,
      respondent:          parties.respondent,
      applicantAr:         parties.applicantAr,
      respondentAr:        parties.respondentAr,
      disputeType:         s1.disputeClassification || disputeType,
      hasAiSystemInvolved: s1.facts.hasAiSystemInvolved || hasAiDecision,
    },

    legalIssues: (s1.legalIssues ?? []) as JudgmentOutput["legalIssues"],

    legislation:  filteredLegislation,
    precedents:   filteredPrecedents,
    principles:   filteredPrinciples,

    proportionality: s3.proportionality ?? {
      applicable: false, legitimateAim: null,
      necessity: null, proportionalitySS: null, overallFinding: "not_applicable",
    },

    aiDecisionReview: {
      applicable:  !!(s4 && s4.dimensions?.length),
      dimensions:  s4?.dimensions  ?? null,
      overallNote: s4?.overallNote ?? null,
    },

    theoryAnalysis,
    stageTheory,

    reasons: stripFabricated(s6.reasons),
    holding: stripFabricated(s6.holding),
    order:   stripFabricated(s6.order),
    orderEn: stripFabricated(s6.orderEn ?? ""),

    authorityHierarchy: sortedHierarchy,
    verificationStatus,

    ...(legalityScore !== undefined ? { legalityScore } : {}),
    ...(riskScore     !== undefined ? { riskScore }     : {}),
  };

  return { judgment, stageData, legalityScore, riskScore };
}
