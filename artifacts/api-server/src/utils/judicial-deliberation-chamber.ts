/**
 * Judicial Deliberation Chamber (JDC) — Phase 59
 *
 * Simulates a UAE Federal Administrative Court multi-judge panel.
 * Supports single judge, 3-judge panel, and 5-judge panel configurations.
 *
 * Pipeline:
 *   Phase 1 — Case intake: facts extraction, issue classification, search query generation (AI)
 *   Phase 2 — KB retrieval: legislation + case law (shared across all judges)
 *   Phase 3 — Panel deliberation: each judge independently analyzes (fully parallel AI calls)
 *   Phase 4 — Synthesis: majority opinion, dissent, concurrence, operative order (AI)
 *
 * Anti-hallucination guarantees (same as JRE):
 *   • All [SRC:N] tokens validated against live KB sourceIndex
 *   • Theory Mode runs in an isolated non-binding layer per judge; never merges into binding analysis
 *   • UAE binding law always prevails over comparative/theoretical analysis
 *   • Fabricated citation tags are stripped before final assembly
 */

import { aiRouter, TaskType } from "../ai/index.js";
import { parseModelJson } from "../ai/providers/interface.js";
import { buildKbContext } from "../kb/retrieval.js";
import { extractCitationTokens, resolveCitations, KB_ID_OFFSET } from "./rag.js";
import { computeLegalityScore, computeRiskScore } from "./admin-os-evaluator.js";
import type { DimensionResult } from "./admin-os-evaluator.js";
import type {
  JreParties,
  JreLegislationItem,
  JrePrecedentItem,
  JrePrinciple,
  JreProportionality,
  JreAiDimensionFinding,
  JreAuthorityEntry,
  JreVerificationStatus,
} from "./judicial-reasoning-engine.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PanelSize = 1 | 3 | 5;
export type DisposalPosition = "grant" | "dismiss" | "remand" | "conditional";
export type OpinionType = "majority" | "concurring" | "dissenting";

export interface JudgeProfile {
  judgeId:    number;
  nameAr:     string;
  nameEn:     string;
  role:       "presiding" | "associate";
  personaAr:  string;   // analytical style for system prompt
}

export interface JudgeAnalysis {
  judgeId:   number;
  nameAr:    string;
  nameEn:    string;
  role:      "presiding" | "associate";

  // 8 independent analytical sections
  jurisdictionFinding: {
    hasJurisdiction:       boolean;
    reasoning:             string;
    admissible:            boolean;
    admissibilityGrounds:  string;
  };
  applicableLegislation: JreLegislationItem[];
  precedents:            JrePrecedentItem[];
  principles:            JrePrinciple[];
  proportionality:       JreProportionality;
  aiDecisionAnalysis:    { dimensions: JreAiDimensionFinding[]; overallNote: string } | null;
  theoryNote:            string | null;  // always non-binding

  // Individual conclusion
  legalityAssessment:  { score: number; findingAr: string };
  disposalPosition:    DisposalPosition;
  holding:             string;  // Arabic
  holdingEn:           string;
  reasons:             string;  // Arabic, 3-5 paragraphs

  // Set after majority determination
  opinionType: OpinionType | null;

  // Per-judge citation verification
  verificationStatus: JreVerificationStatus;
}

export interface PanelDeliberation {
  panelSize:  PanelSize;
  judges:     JudgeAnalysis[];

  // Majority determination
  majorityPosition:  DisposalPosition;
  majorityJudgeIds:  number[];
  dissentingJudgeIds: number[];
  concurringJudgeIds: number[];

  // Opinions
  majorityOpinionAr:  string;
  majorityOpinionEn:  string;
  majorityReasonsAr:  string;
  majorityReasonsEn:  string;

  dissentingOpinionAr: string | null;
  dissentingOpinionEn: string | null;

  concurringOpinionAr: string | null;
  concurringOpinionEn: string | null;

  // Final outputs
  finalHoldingAr:    string;
  finalHoldingEn:    string;
  operativeOrderAr:  string;  // "حكمت الدائرة بما يلي:"
  operativeOrderEn:  string;

  // Aggregated authority
  authorityHierarchy: JreAuthorityEntry[];

  // Verification report
  verificationReport: {
    totalVerified:         number;
    totalFabricated:       number;
    allAuthoritiesVerified: boolean;
    perJudge: Array<{ judgeId: number; verified: number; fabricated: number }>;
    overallMessage: string;
  };

  // Scores (averaged over majority position judges with AI decisions)
  legalityScore?: number;
  riskScore?:     number;
}

// ─── Judge Roster ──────────────────────────────────────────────────────────────

const ALL_JUDGES: JudgeProfile[] = [
  {
    judgeId: 1,
    nameAr:  "القاضي الرئيس",
    nameEn:  "Presiding Judge",
    role:    "presiding",
    personaAr: `أنتَ القاضي الرئيس لدائرة الاستئناف الإدارية الاتحادية. أسلوبك نصّي صارم: تتبع الهرمية التشريعية الإماراتية بدقة متناهية، وتُقدِّم النص الصريح على القياس. تمنح الإدارة هامش تقدير معقولاً ما لم يثبت انتهاك صريح. أسلوبك رسمي وموجز.`,
  },
  {
    judgeId: 2,
    nameAr:  "القاضي المنضم الأول",
    nameEn:  "First Associate Judge",
    role:    "associate",
    personaAr: `أنتَ قاضٍ إداري منضم متخصص في قانون الخدمة المدنية وقانون العمل الاتحادي. أسلوبك غائي: تفسِّر النصوص وفق الغاية التشريعية وتُعطي وزناً راجحاً لمبدأ التناسب. تميل إلى حماية الحقوق الإجرائية للأفراد.`,
  },
  {
    judgeId: 3,
    nameAr:  "القاضي المنضم الثاني",
    nameEn:  "Second Associate Judge",
    role:    "associate",
    personaAr: `أنتَ قاضٍ إداري منضم متخصص في قانون المشتريات الحكومية والعقود الإدارية. أسلوبك براغماتي: تُوازن بين كفاءة الإدارة وحقوق الأفراد، وتميل إلى إعادة الإحالة بدلاً من الإلغاء الكلي عند وجود عيب شكلي قابل للإصلاح.`,
  },
  {
    judgeId: 4,
    nameAr:  "القاضي المنضم الثالث",
    nameEn:  "Third Associate Judge",
    role:    "associate",
    personaAr: `أنتَ قاضٍ إداري منضم متخصص في الحقوق الدستورية والحريات العامة. أسلوبك تدقيقي متشدد: تُطبق مبدأ الرقابة الصارمة على أي قرار ينتهك حقوقاً أساسية، وتُحكم قراءتك لأي قيد على الحرية الفردية.`,
  },
  {
    judgeId: 5,
    nameAr:  "القاضي المنضم الرابع",
    nameEn:  "Fourth Associate Judge",
    role:    "associate",
    personaAr: `أنتَ قاضٍ إداري منضم متخصص في الشكليات الإجرائية والاختصاص القضائي. أسلوبك إجرائي دقيق: تُركز على اشتراطات القبول والاختصاص والتسبيب الشكلي قبل النظر في الموضوع. تُصرِّح بعدم القبول عند غياب شرط مسبق جوهري.`,
  },
];

function getPanelJudges(panelSize: PanelSize): JudgeProfile[] {
  if (panelSize === 1) return [ALL_JUDGES[0]];
  if (panelSize === 3) return ALL_JUDGES.slice(0, 3);
  return ALL_JUDGES.slice(0, 5);
}

// ─── Shared KB Retrieval (identical to JRE) ──────────────────────────────────

async function buildChamberRagContext(
  legQuery: string,
  caseQuery: string,
): Promise<{
  ragContext:  string;
  sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>;
}> {
  const [legResult, caseResult] = await Promise.all([
    buildKbContext(legQuery,  { topK: 8, excludeRepealed: true }).catch(() => null),
    buildKbContext(caseQuery, { topK: 6 }).catch(() => null),
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
    if (result.legalContextChain) parts.push(result.legalContextChain);
  };

  processResult(legResult,  "LEGISLATION");
  processResult(caseResult, "CASE LAW");

  return {
    ragContext:  parts.join("\n\n─────────────────────────────────────\n\n"),
    sourceIndex,
  };
}

// ─── Phase 1 System Prompt ────────────────────────────────────────────────────

const INTAKE_SYSTEM = `أنت مساعد قضائي لدائرة قضائية إدارية. مهمتك هيكلة ملف القضية وتحديد محاور التحليل القانوني.

قواعد:
- لا تُضِف وقائع غير واردة في الملخص.
- حدِّد نوع التصرف المطعون فيه بدقة.
- أنشئ استعلامَي بحث دقيقَين يُعطيان أفضل نتائج من قاعدة البيانات.

أجب حصراً بـJSON:
{
  "caseTitle": "وصف موجز للقضية",
  "facts": {
    "summary": "ملخص الوقائع في 3-5 جمل",
    "keyFacts": [{ "factAr": "الواقعة", "significance": "أثرها القانوني" }],
    "hasAiSystemInvolved": false
  },
  "legalIssues": [
    { "issueAr": "المسألة بالعربية", "issueEn": "Issue in English", "classification": "procedural|substantive|competence|form|proportionality" }
  ],
  "disputeClassification": "annulment|compensation|disciplinary|licensing|procurement|civil_service|expropriation|other",
  "legQuery": "استعلام للبحث في قاعدة البيانات — التشريعات الإدارية الإماراتية المنطبقة",
  "caseQuery": "استعلام للبحث في قاعدة البيانات — السوابق القضائية الإدارية الإماراتية"
}`;

// ─── Per-Judge System Prompt Builder ─────────────────────────────────────────

function buildJudgeSystem(judge: JudgeProfile, hasAiDecision: boolean): string {
  return `${judge.personaAr}

أنت عضو في دائرة قضائية إدارية اتحادية إماراتية وتُحلِّل هذه القضية بصورة مستقلة تماماً.

⚠️ قواعد مكافحة الاختراع — إلزامية:
• لا تستشهد بأي قانون أو قضية غير موجودة في السياق القانوني المُقدَّم.
• إذا لم تجد سلطة كافية صرِّح: "لا توجد سلطة كافية في قاعدة البيانات".
• استخدم وسوم [SRC:N] للاستشهاد بمصادر قاعدة البيانات فحسب.
• صنِّف كل سلطة: [مُلزِم — UAE Binding] أو [مرجعي مقارن — Persuasive].
• أي تحليل نظري مقارن يُوضَع في حقل "theoryNote" فحسب ويُعلَّم [غير مُلزِم].

حلِّل القضية في المحاور الثمانية التالية، ثم أصدر حكمك المستقل:

1. الاختصاص والقبول
2. التشريعات المنطبقة وتسلسلها الهرمي
3. السوابق القضائية ذات الصلة
4. مبادئ القانون الإداري
5. مراجعة التناسب${hasAiDecision ? "\n6. تقييم القرار الرقمي/الخوارزمي" : ""}
6. موقفك الفردي (المنطوق)

أجب حصراً بـJSON:
{
  "judgeId": ${judge.judgeId},
  "jurisdictionFinding": {
    "hasJurisdiction": true,
    "reasoning": "تسبيب اختصاص المحكمة",
    "admissible": true,
    "admissibilityGrounds": "شروط القبول المتحققة أو المعيبة"
  },
  "applicableLegislation": [
    {
      "titleAr": "اسم القانون",
      "documentNumber": "الرقم أو null",
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
      "principleAr": "المبدأ القانوني",
      "relevance": "وجه الارتباط",
      "authorityClass": "binding|persuasive",
      "ragTag": "[SRC:N] أو null"
    }
  ],
  "principles": [
    {
      "nameAr": "اسم المبدأ",
      "nameEn": "Principle Name",
      "applicationAr": "تطبيقه على القضية",
      "legalBasis": "السند القانوني",
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
  "aiDecisionAnalysis": ${hasAiDecision ? `{
    "dimensions": [
      { "dimension": "humanWill", "dimensionAr": "الإرادة الإنسانية", "finding": "...", "compliant": true, "basis": "..." },
      { "dimension": "digitalWillFormation", "dimensionAr": "تكوين الإرادة الرقمية", "finding": "...", "compliant": true, "basis": "..." },
      { "dimension": "algorithmicWeight", "dimensionAr": "الوزن القانوني الخوارزمي", "finding": "...", "compliant": true, "basis": "..." },
      { "dimension": "algorithmicBias", "dimensionAr": "التحيز الخوارزمي", "finding": "...", "compliant": true, "basis": "..." },
      { "dimension": "explainability", "dimensionAr": "قابلية التفسير", "finding": "...", "compliant": true, "basis": "..." },
      { "dimension": "humanOversight", "dimensionAr": "الإشراف البشري", "finding": "...", "compliant": true, "basis": "..." },
      { "dimension": "judicialReviewReadiness", "dimensionAr": "الجاهزية للمراجعة القضائية", "finding": "...", "compliant": true, "basis": "..." }
    ],
    "overallNote": "..."
  }` : "null"},
  "theoryNote": "ملاحظة مقارنة غير مُلزِمة أو null — ضع [غير مُلزِم] في كل موضع",
  "legalityAssessment": {
    "score": 75,
    "findingAr": "تقييم مشروعية القرار"
  },
  "disposalPosition": "grant|dismiss|remand|conditional",
  "holding": "رأي القاضي الشخصي المستقل في 2-3 جمل بالعربية",
  "holdingEn": "Judge's individual holding in English",
  "reasons": "الأسباب القانونية التفصيلية بأسلوب قضائي رسمي (3-5 فقرات بالعربية)"
}`;
}

// ─── Phase 4 Synthesis System Prompt ─────────────────────────────────────────

function buildSynthesisSystem(panelSize: PanelSize): string {
  const majorityThreshold = panelSize === 1 ? 1 : panelSize === 3 ? 2 : 3;
  return `أنت كاتب الدائرة القضائية الإدارية الاتحادية. مهمتك صياغة الحكم الجماعي النهائي للدائرة المؤلفة من ${panelSize} قاضٍ.

قواعد التصويت:
- يُعتبر الرأي أغلبية إذا حصل على ${majorityThreshold} أصوات فأكثر.
- الرأي المنضم (المتفق في النتيجة مع الأغلبية بأسباب مختلفة) يُعدَّ رأياً موافقاً.
- الرأي المعارض يُكتب بأسلوب رسمي محترم.

⚠️ قواعد إلزامية:
• القانون الإماراتي الملزم يسود دائماً على أي تحليل نظري مقارن.
• لا تستشهد بمصادر جديدة لم ترد في تحليلات القضاة.
• منطوق الحكم يُكتب بالصيغة الرسمية: "حكمت الدائرة بما يلي:".

أجب حصراً بـJSON:
{
  "majorityPosition": "grant|dismiss|remand|conditional",
  "majorityJudgeIds": [1, 2],
  "dissentingJudgeIds": [3],
  "concurringJudgeIds": [],
  "majorityOpinionAr": "رأي الأغلبية الموجز في 2-3 جمل بالعربية",
  "majorityOpinionEn": "Majority opinion summary in English",
  "majorityReasonsAr": "أسباب الأغلبية القانونية التفصيلية (5-7 فقرات بالعربية، تجمع خلاصة التشريعات والسوابق والمبادئ)",
  "majorityReasonsEn": "Majority reasons summary in English (2-3 paragraphs)",
  "dissentingOpinionAr": "رأي الأقلية المعارض بأسلوب رسمي أو null",
  "dissentingOpinionEn": "Dissenting opinion in English or null",
  "concurringOpinionAr": "الرأي الموافق بأسباب مختلفة بأسلوب رسمي أو null",
  "concurringOpinionEn": "Concurring opinion in English or null",
  "finalHoldingAr": "خلاصة الحكم النهائي للدائرة في 2-3 جمل",
  "finalHoldingEn": "Final holding of the chamber in English",
  "operativeOrderAr": "حكمت الدائرة بما يلي: [المنطوق الكامل بالعربية]",
  "operativeOrderEn": "Operative order in English",
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

// ─── Citation Filtering (mirrors JRE) ────────────────────────────────────────

function buildFabricatedTagSet(
  raw: Array<{ token: string }>,
  verified: Array<{ token: string }>,
): Set<string> {
  const verifiedSet = new Set(verified.map((c) => c.token));
  const fabricated  = raw.filter((t) => !verifiedSet.has(t.token));
  return new Set(fabricated.map((t) => t.token));
}

function stripFabricatedFromText(text: string, fabricatedTagSet: Set<string>): string {
  if (fabricatedTagSet.size === 0) return text;
  return text
    .replace(/\[([A-Z]+:[^\]]+)\]/g, (match, inner) =>
      fabricatedTagSet.has(inner) ? "" : match,
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function filterByRagTag<T extends { ragTag?: string | null }>(
  arr: T[],
  fabricatedTagSet: Set<string>,
): T[] {
  return arr.filter((item) => {
    if (!item.ragTag) return true;
    const inner = item.ragTag.replace(/^\[|\]$/g, "");
    return !fabricatedTagSet.has(inner);
  });
}

// ─── Per-Judge Analysis ───────────────────────────────────────────────────────

async function analyzeAsJudge(
  judge: JudgeProfile,
  caseContext: {
    facts:        unknown;
    legalIssues:  unknown;
    parties:      JreParties;
    disputeType:  string;
    hasAiDecision: boolean;
    ragContext:   string;
    contextBlock: string;
  },
  sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>,
  userId: number,
): Promise<JudgeAnalysis> {
  const provider = await aiRouter.routeFor(TaskType.RAG);

  const userPrompt = `ملف القضية:
الوقائع: ${JSON.stringify(caseContext.facts, null, 2)}
المسائل القانونية: ${JSON.stringify(caseContext.legalIssues, null, 2)}
المدعي: ${caseContext.parties.applicantAr || caseContext.parties.applicant}
المدعى عليه: ${caseContext.parties.respondentAr || caseContext.parties.respondent}
نوع النزاع: ${caseContext.disputeType}

${caseContext.contextBlock}`;

  const raw = await provider.complete({
    taskType:     TaskType.RAG,
    systemPrompt: buildJudgeSystem(judge, caseContext.hasAiDecision),
    prompt:       userPrompt,
    maxTokens:    6000,
  });

  const cleaned = raw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const parsed  = parseModelJson<{
    judgeId:              number;
    jurisdictionFinding:  JudgeAnalysis["jurisdictionFinding"];
    applicableLegislation: JreLegislationItem[];
    precedents:           JrePrecedentItem[];
    principles:           JrePrinciple[];
    proportionality:      JreProportionality;
    aiDecisionAnalysis:   JudgeAnalysis["aiDecisionAnalysis"];
    theoryNote:           string | null;
    legalityAssessment:   JudgeAnalysis["legalityAssessment"];
    disposalPosition:     DisposalPosition;
    holding:              string;
    holdingEn:            string;
    reasons:              string;
  }>(cleaned);

  if (!parsed.ok) {
    throw new Error(`Judge ${judge.judgeId} (${judge.nameAr}) analysis parse failed: ${cleaned.slice(0, 200)}`);
  }

  const d = parsed.data;

  // Per-judge citation verification
  const allJudgeText = JSON.stringify({ d });
  const rawTokens    = extractCitationTokens(allJudgeText);
  const resolved     = await resolveCitations(rawTokens, sourceIndex, userId);
  const fabricatedTagSet = buildFabricatedTagSet(rawTokens, resolved);

  const verificationStatus: JreVerificationStatus = {
    allAuthoritiesVerified:      fabricatedTagSet.size === 0,
    verifiedCount:               resolved.length,
    unverifiedCount:             fabricatedTagSet.size,
    fabricatedCitationsFiltered: fabricatedTagSet.size,
    message: fabricatedTagSet.size === 0
      ? "جميع استشهادات القاضي موثَّقة."
      : `تمَّ حذف ${fabricatedTagSet.size} استشهاد(ات) غير موثَّق(ة).`,
  };

  // Strip fabricated from text fields and arrays
  const filteredLeg   = filterByRagTag(d.applicableLegislation ?? [], fabricatedTagSet);
  const filteredPrec  = filterByRagTag(d.precedents ?? [], fabricatedTagSet);

  return {
    judgeId:   judge.judgeId,
    nameAr:    judge.nameAr,
    nameEn:    judge.nameEn,
    role:      judge.role,

    jurisdictionFinding:   d.jurisdictionFinding,
    applicableLegislation: filteredLeg,
    precedents:            filteredPrec,
    principles:            d.principles ?? [],
    proportionality:       d.proportionality,
    aiDecisionAnalysis:    d.aiDecisionAnalysis ?? null,
    theoryNote:            d.theoryNote ?? null,

    legalityAssessment: d.legalityAssessment,
    disposalPosition:   d.disposalPosition ?? "dismiss",
    holding:            stripFabricatedFromText(d.holding    ?? "", fabricatedTagSet),
    holdingEn:          stripFabricatedFromText(d.holdingEn  ?? "", fabricatedTagSet),
    reasons:            stripFabricatedFromText(d.reasons    ?? "", fabricatedTagSet),

    opinionType: null,   // set in determineMajority()
    verificationStatus,
  };
}

// ─── Majority Determination ──────────────────────────────────────────────────

function determineMajority(
  judges: JudgeAnalysis[],
  panelSize: PanelSize,
): {
  majorityPosition:   DisposalPosition;
  majorityJudgeIds:   number[];
  dissentingJudgeIds: number[];
  concurringJudgeIds: number[];
} {
  if (panelSize === 1) {
    return {
      majorityPosition:   judges[0].disposalPosition,
      majorityJudgeIds:   [judges[0].judgeId],
      dissentingJudgeIds: [],
      concurringJudgeIds: [],
    };
  }

  // Count votes per disposal position
  const tally: Record<string, number[]> = {};
  for (const j of judges) {
    const pos = j.disposalPosition;
    if (!tally[pos]) tally[pos] = [];
    tally[pos].push(j.judgeId);
  }

  // Find plurality position (most votes wins; alphabetic position name as deterministic tie-break)
  const sorted = Object.entries(tally).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );
  const [majorityPosition, majorityJudgeIds] = sorted[0] as [DisposalPosition, number[]];
  const threshold = panelSize === 3 ? 2 : 3;

  // Judges not in majority
  const nonMajority = judges
    .filter((j) => !majorityJudgeIds.includes(j.judgeId))
    .map((j) => j.judgeId);

  // If majority threshold not met (e.g. 2-2-1 in a 5-judge), take plurality as majority
  // Concurring: same outcome but different position label (e.g., "conditional" vs "grant" both favoring applicant)
  const grantSide   = new Set(["grant", "conditional"]);
  const dismissSide = new Set(["dismiss", "remand"]);

  const majorityIsGrant = grantSide.has(majorityPosition);

  const dissentingJudgeIds: number[] = [];
  const concurringJudgeIds: number[] = [];

  for (const id of nonMajority) {
    const judge = judges.find((j) => j.judgeId === id)!;
    const jGrant = grantSide.has(judge.disposalPosition);
    const jDismiss = dismissSide.has(judge.disposalPosition);

    // Same side but different label → concurring
    if ((majorityIsGrant && jGrant) || (!majorityIsGrant && jDismiss)) {
      concurringJudgeIds.push(id);
    } else {
      dissentingJudgeIds.push(id);
    }
  }

  return { majorityPosition, majorityJudgeIds, dissentingJudgeIds, concurringJudgeIds };
}

// ─── Main Chamber Function ────────────────────────────────────────────────────

export async function runChamberDeliberation(params: {
  disputeSummary:   string;
  parties:          JreParties;
  disputeType:      string;
  panelSize:        PanelSize;
  hasAiDecision:    boolean;
  theoryLensId:     string | null;
  userId:           number;
}): Promise<PanelDeliberation> {
  const {
    disputeSummary, parties, disputeType, panelSize,
    hasAiDecision, userId,
  } = params;

  // Route AI provider once
  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err) {
    throw new Error(`AI provider unavailable: ${(err as Error).message}`);
  }

  // ── Phase 1: Case Intake ────────────────────────────────────────────────────
  const intakePrompt = `ملخص النزاع الإداري:
${disputeSummary}

المدعي (المتظلم): ${parties.applicantAr || parties.applicant}
المدعى عليه (الجهة الإدارية): ${parties.respondentAr || parties.respondent}
نوع النزاع: ${disputeType}`;

  const intakeRaw = await provider.complete({
    taskType:     TaskType.RAG,
    systemPrompt: INTAKE_SYSTEM,
    prompt:       intakePrompt,
    maxTokens:    2500,
  });

  const intakeCleaned = intakeRaw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const intakeParse   = parseModelJson<{
    caseTitle:             string;
    facts:                 { summary: string; keyFacts: Array<{ factAr: string; significance: string }>; hasAiSystemInvolved: boolean };
    legalIssues:           Array<{ issueAr: string; issueEn: string; classification: string }>;
    disputeClassification: string;
    legQuery:              string;
    caseQuery:             string;
  }>(intakeCleaned);

  if (!intakeParse.ok) throw new Error(`Phase 1 (intake) parse failed: ${intakeCleaned.slice(0, 200)}`);
  const intake = intakeParse.data;

  // ── Phase 2: KB Retrieval ───────────────────────────────────────────────────
  const legQuery  = intake.legQuery  || `${disputeType} قانون إداري إماراتي اختصاص تسبيب`;
  const caseQuery = intake.caseQuery || `مبادئ قضائية إدارية ${disputeType} إماراتية`;

  const { ragContext, sourceIndex } = await buildChamberRagContext(legQuery, caseQuery);

  const contextBlock = ragContext
    ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nالسياق القانوني من قاعدة البيانات (المصادر المُتاحة فحسب):\n${ragContext}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : "⚠️ لا توجد مصادر قانونية مُفهرَسة متاحة لهذا الاستعلام. قيِّد تحليلك على ما هو موثَّق عموماً في القانون الإداري الإماراتي وأشِر إلى غياب السلطات المحددة.";

  const caseContext = {
    facts:        intake.facts,
    legalIssues:  intake.legalIssues,
    parties,
    disputeType:  intake.disputeClassification || disputeType,
    hasAiDecision: hasAiDecision || intake.facts.hasAiSystemInvolved,
    ragContext,
    contextBlock,
  };

  // ── Phase 3: Parallel Judge Analyses ───────────────────────────────────────
  const panelJudges = getPanelJudges(panelSize);

  const judgeAnalyses = await Promise.all(
    panelJudges.map((judge) =>
      analyzeAsJudge(judge, caseContext, sourceIndex, userId),
    ),
  );

  // ── Majority Determination ──────────────────────────────────────────────────
  const {
    majorityPosition,
    majorityJudgeIds,
    dissentingJudgeIds,
    concurringJudgeIds,
  } = determineMajority(judgeAnalyses, panelSize);

  // Tag each judge's opinion type
  for (const j of judgeAnalyses) {
    if (majorityJudgeIds.includes(j.judgeId)) {
      j.opinionType = "majority";
    } else if (concurringJudgeIds.includes(j.judgeId)) {
      j.opinionType = "concurring";
    } else {
      j.opinionType = "dissenting";
    }
  }

  // ── Phase 4: Panel Synthesis ────────────────────────────────────────────────
  const majorityJudges   = judgeAnalyses.filter((j) => majorityJudgeIds.includes(j.judgeId));
  const dissentingJudges = judgeAnalyses.filter((j) => dissentingJudgeIds.includes(j.judgeId));
  const concurringJudges = judgeAnalyses.filter((j) => concurringJudgeIds.includes(j.judgeId));

  const synthUserPrompt = `قضية: ${intake.caseTitle}

تحليلات القضاة الفردية:
${judgeAnalyses.map((j) => `
## ${j.nameAr} (القاضي ${j.judgeId})
المنطوق الفردي: ${j.disposalPosition.toUpperCase()} — ${j.holding}
الأسباب: ${j.reasons.slice(0, 800)}
التشريعات: ${(j.applicableLegislation ?? []).map((l) => `${l.titleAr} ${l.ragTag ?? ""}`).join("; ")}
السوابق: ${(j.precedents ?? []).map((p) => `${p.caseRef} ${p.ragTag ?? ""}`).join("; ")}
تقييم المشروعية: ${j.legalityAssessment.score}/100
`).join("\n---\n")}

التصويت:
- الأغلبية (${majorityPosition}): القضاة ${majorityJudgeIds.join(", ")}
- المعارضون: القضاة ${dissentingJudgeIds.join(", ") || "لا يوجد"}
- المتفقون بأسباب مختلفة: القضاة ${concurringJudgeIds.join(", ") || "لا يوجد"}

أطراف النزاع:
المدعي: ${parties.applicantAr || parties.applicant}
المدعى عليه: ${parties.respondentAr || parties.respondent}`;

  const synthRaw = await provider.complete({
    taskType:     TaskType.RAG,
    systemPrompt: buildSynthesisSystem(panelSize),
    prompt:       synthUserPrompt,
    maxTokens:    10000,
  });

  const synthCleaned = synthRaw.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const synthParse   = parseModelJson<{
    majorityPosition:    string;
    majorityJudgeIds:    number[];
    dissentingJudgeIds:  number[];
    concurringJudgeIds:  number[];
    majorityOpinionAr:   string;
    majorityOpinionEn:   string;
    majorityReasonsAr:   string;
    majorityReasonsEn:   string;
    dissentingOpinionAr: string | null;
    dissentingOpinionEn: string | null;
    concurringOpinionAr: string | null;
    concurringOpinionEn: string | null;
    finalHoldingAr:      string;
    finalHoldingEn:      string;
    operativeOrderAr:    string;
    operativeOrderEn:    string;
    authorityHierarchy:  JreAuthorityEntry[];
  }>(synthCleaned);

  if (!synthParse.ok) throw new Error(`Phase 4 (synthesis) parse failed: ${synthCleaned.slice(0, 200)}`);
  const synth = synthParse.data;

  // ── Citation Verification: Synthesis Layer ──────────────────────────────────
  // Include authorityHierarchy ragTags in the citation scan so hierarchy entries
  // with fabricated [SRC:N] tokens are caught by resolveCitations, not just text fields.
  const synthText = JSON.stringify({
    majorityReasonsAr: synth.majorityReasonsAr,
    dissentingOpinionAr: synth.dissentingOpinionAr,
    concurringOpinionAr: synth.concurringOpinionAr,
    operativeOrderAr: synth.operativeOrderAr,
    _hierarchyTags: (synth.authorityHierarchy ?? []).map((h) => h.ragTag).filter(Boolean),
  });
  const synthRawTokens  = extractCitationTokens(synthText);
  const synthResolved   = await resolveCitations(synthRawTokens, sourceIndex, userId);
  const synthFabTagSet  = buildFabricatedTagSet(synthRawTokens, synthResolved);

  const filteredHierarchy = filterByRagTag(synth.authorityHierarchy ?? [], synthFabTagSet);
  const classOrder: Record<string, number> = { binding: 0, persuasive: 1, non_binding: 2 };
  const sortedHierarchy = filteredHierarchy.slice().sort((a, b) => {
    const diff = (classOrder[a.authorityClass] ?? 2) - (classOrder[b.authorityClass] ?? 2);
    return diff !== 0 ? diff : a.rank - b.rank;
  });

  // ── Aggregate Verification Report ──────────────────────────────────────────
  const perJudge = judgeAnalyses.map((j) => ({
    judgeId:   j.judgeId,
    verified:  j.verificationStatus.verifiedCount,
    fabricated: j.verificationStatus.fabricatedCitationsFiltered,
  }));
  const totalVerified   = perJudge.reduce((s, j) => s + j.verified, 0) + synthResolved.length;
  const totalFabricated = perJudge.reduce((s, j) => s + j.fabricated, 0) + synthFabTagSet.size;

  const verificationReport = {
    totalVerified,
    totalFabricated,
    allAuthoritiesVerified: totalFabricated === 0,
    perJudge,
    overallMessage: totalFabricated === 0
      ? "جميع استشهادات الدائرة موثَّقة في قاعدة البيانات."
      : `تمَّ حذف ${totalFabricated} استشهاد(ات) غير موثَّق(ة) من مجمل آراء الدائرة.`,
  };

  // ── Compute AI Decision Scores (from majority judges with AI review) ────────
  let legalityScore: number | undefined;
  let riskScore:     number | undefined;

  const majorityWithAiReview = majorityJudges.filter((j) => j.aiDecisionAnalysis?.dimensions?.length);
  if (majorityWithAiReview.length > 0) {
    const avgScore = Math.round(
      majorityWithAiReview.reduce((s, j) => s + (j.legalityAssessment.score ?? 0), 0) /
      majorityWithAiReview.length,
    );
    const dimMap: Record<string, DimensionResult> = {};
    const lastJudge = majorityWithAiReview[0];
    for (const d of lastJudge.aiDecisionAnalysis!.dimensions!) {
      dimMap[d.dimension] = {
        status:              d.compliant ? "compliant" : "non-compliant",
        score:               d.compliant ? 80 : 30,
        explanationAr:       d.finding,
        explanationEn:       d.finding,
        missingRequirements: [],
        applicableLaw:       [d.basis],
      };
    }
    legalityScore = computeLegalityScore(dimMap);
    riskScore     = computeRiskScore(dimMap, "high", legalityScore);
  }

  // ── Assemble Final Deliberation ─────────────────────────────────────────────
  return {
    panelSize,
    judges: judgeAnalyses,

    // Always use deterministic vote math; never trust synthesis AI to re-compute these.
    majorityPosition,
    majorityJudgeIds,
    dissentingJudgeIds,
    concurringJudgeIds,

    majorityOpinionAr: stripFabricatedFromText(synth.majorityOpinionAr ?? "", synthFabTagSet),
    majorityOpinionEn: synth.majorityOpinionEn ?? "",
    majorityReasonsAr: stripFabricatedFromText(synth.majorityReasonsAr ?? "", synthFabTagSet),
    majorityReasonsEn: synth.majorityReasonsEn ?? "",

    dissentingOpinionAr: synth.dissentingOpinionAr
      ? stripFabricatedFromText(synth.dissentingOpinionAr, synthFabTagSet)
      : null,
    dissentingOpinionEn: synth.dissentingOpinionEn ?? null,

    concurringOpinionAr: synth.concurringOpinionAr
      ? stripFabricatedFromText(synth.concurringOpinionAr, synthFabTagSet)
      : null,
    concurringOpinionEn: synth.concurringOpinionEn ?? null,

    finalHoldingAr:   stripFabricatedFromText(synth.finalHoldingAr   ?? "", synthFabTagSet),
    finalHoldingEn:   synth.finalHoldingEn   ?? "",
    operativeOrderAr: stripFabricatedFromText(synth.operativeOrderAr ?? "", synthFabTagSet),
    operativeOrderEn: synth.operativeOrderEn ?? "",

    authorityHierarchy: sortedHierarchy,
    verificationReport,
    legalityScore,
    riskScore,
  };
}
