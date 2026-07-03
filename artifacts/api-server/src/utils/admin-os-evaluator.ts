/**
 * Al-Shamsi 12-Dimension Administrative Decision Evaluator
 *
 * Builds the AI prompt, validates the structured response, and
 * computes Legality Score + Risk Score.
 *
 * Dimension weights (must sum to 100):
 *   Jurisdiction          20%
 *   Cause                 15%
 *   Form                  10%
 *   Subject Matter        10%
 *   Purpose               10%
 *   Human Will             8%
 *   Digital Will           5%
 *   Algorithmic Weight     5%
 *   Algorithmic Bias       5%
 *   Explainability         4%
 *   Human Oversight        4%
 *   Judicial Review        4%
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DimensionStatus = "compliant" | "partial" | "non-compliant" | "unknown";

export interface DimensionResult {
  status: DimensionStatus;
  /** 0–100 score for this dimension */
  score: number;
  explanationAr: string;
  explanationEn: string;
  missingRequirements: string[];
  applicableLaw: string[];
}

export interface AdminDecisionBriefData {
  // 12 Al-Shamsi dimensions
  jurisdiction: DimensionResult;
  form: DimensionResult;
  cause: DimensionResult;
  subjectMatter: DimensionResult;
  purpose: DimensionResult;
  humanWill: DimensionResult;
  digitalWillFormation: DimensionResult;
  algorithmicWeight: DimensionResult;
  algorithmicBias: DimensionResult;
  explainability: DimensionResult;
  humanOversight: DimensionResult;
  judicialReviewReadiness: DimensionResult;

  // Top-level brief fields
  legalityScore: number;
  riskScore: number;
  canIssueToday: "yes" | "no" | "conditional";
  canIssueTodayRationale: string;
  governmentAuthority: {
    nameAr: string;
    nameEn: string;
    department: string;
    website: string | null;
    phone: string | null;
    competenceBasis: string;
  };
  applicableLegislation: Array<{
    token: string | null;
    articleAr: string;
    relevanceAr: string;
  }>;
  courtPrecedents: Array<{
    caseRef: string;
    courtAr: string;
    yearAr: string;
    principleAr: string;
  }> | null;
  requiredDocuments: Array<{
    nameAr: string;
    descriptionAr: string;
    mandatory: boolean;
  }>;
  timeline: {
    steps: Array<{
      step: number;
      titleAr: string;
      duration: string;
      actor: string;
    }>;
  };
  appealStrategy: {
    routes: Array<{
      routeAr: string;
      deadlineAr: string;
      procedureAr: string;
    }>;
    recommendationAr: string;
  };
  algorithmExplanation: string;
  humanInterventionPoints: string[];
  citations?: unknown[];
}

// ─── Dimension weights ─────────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<string, number> = {
  jurisdiction:          20,
  cause:                 15,
  form:                  10,
  subjectMatter:         10,
  purpose:               10,
  humanWill:              8,
  digitalWillFormation:   5,
  algorithmicWeight:      5,
  algorithmicBias:        5,
  explainability:         4,
  humanOversight:         4,
  judicialReviewReadiness: 4,
};

const DIMENSION_KEYS = Object.keys(DIMENSION_WEIGHTS) as Array<keyof typeof DIMENSION_WEIGHTS>;

// ─── Score computation ─────────────────────────────────────────────────────────

export function computeLegalityScore(dims: Record<string, DimensionResult>): number {
  let weighted = 0;
  for (const key of DIMENSION_KEYS) {
    const dim = dims[key];
    if (!dim) continue;
    const weight = DIMENSION_WEIGHTS[key] ?? 0;
    // Use the dimension's own score (0–100), weighted
    weighted += (dim.score / 100) * weight;
  }
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

export function computeRiskScore(
  dims: Record<string, DimensionResult>,
  inherentRiskLevel: string,
  legalityScore: number,
): number {
  // Base risk from legality inversion
  const base = 100 - legalityScore;

  // Penalty for each non-compliant dimension (weighted by dimension importance)
  let penalty = 0;
  for (const key of DIMENSION_KEYS) {
    const dim = dims[key];
    if (!dim) continue;
    const weight = DIMENSION_WEIGHTS[key] ?? 0;
    if (dim.status === "non-compliant") penalty += weight * 0.5;
    else if (dim.status === "partial") penalty += weight * 0.15;
    // Missing requirements add fractional penalty
    penalty += dim.missingRequirements.length * 0.8;
  }

  // Inherent risk level multiplier
  const multipliers: Record<string, number> = {
    low: 0.7,
    medium: 1.0,
    high: 1.3,
    critical: 1.6,
  };
  const multiplier = multipliers[inherentRiskLevel] ?? 1.0;

  const raw = (base + penalty) * multiplier;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ─── Validation ────────────────────────────────────────────────────────────────

const REQUIRED_DIMENSIONS = DIMENSION_KEYS;
const VALID_STATUSES: Set<string> = new Set(["compliant", "partial", "non-compliant", "unknown"]);
const VALID_CAN_ISSUE: Set<string> = new Set(["yes", "no", "conditional"]);

/** The seven permitted Al-Shamsi role keys */
export const VALID_ROLES: Set<string> = new Set([
  "government_official",
  "minister",
  "director_general",
  "hr",
  "legal_department",
  "administrative_court",
  "citizen",
]);

export function validateAdminBrief(r: unknown): string | null {
  if (typeof r !== "object" || r === null) return "Response is not an object";
  const obj = r as Record<string, unknown>;

  // Check all 12 dimensions exist and are valid
  for (const dim of REQUIRED_DIMENSIONS) {
    const d = obj[dim];
    if (typeof d !== "object" || d === null) return `Missing dimension: ${dim}`;
    const dObj = d as Record<string, unknown>;
    if (!VALID_STATUSES.has(dObj.status as string)) return `Invalid status in dimension ${dim}: ${dObj.status}`;
    if (typeof dObj.score !== "number") return `Missing numeric score in dimension: ${dim}`;
    // Enforce score bounds 0–100
    if ((dObj.score as number) < 0 || (dObj.score as number) > 100)
      return `Score out of range in dimension ${dim}: ${dObj.score}`;
    if (typeof dObj.explanationAr !== "string" || !(dObj.explanationAr as string).length)
      return `Missing explanationAr in dimension: ${dim}`;
    if (typeof dObj.explanationEn !== "string" || !(dObj.explanationEn as string).length)
      return `Missing explanationEn in dimension: ${dim}`;
    if (!Array.isArray(dObj.missingRequirements)) return `Missing missingRequirements array in dimension: ${dim}`;
    if (!Array.isArray(dObj.applicableLaw)) return `Missing applicableLaw array in dimension: ${dim}`;
  }

  // Check top-level required fields
  if (!VALID_CAN_ISSUE.has(obj.canIssueToday as string)) return `Invalid canIssueToday: ${obj.canIssueToday}`;
  if (typeof obj.canIssueTodayRationale !== "string" || !(obj.canIssueTodayRationale as string).length)
    return "Missing canIssueTodayRationale";
  if (typeof obj.algorithmExplanation !== "string") return "Missing algorithmExplanation";
  if (!Array.isArray(obj.humanInterventionPoints)) return "Missing humanInterventionPoints array";
  if (!Array.isArray(obj.requiredDocuments)) return "Missing requiredDocuments array";
  if (!Array.isArray(obj.applicableLegislation)) return "Missing applicableLegislation array";

  const gov = obj.governmentAuthority as Record<string, unknown> | undefined;
  if (!gov || typeof gov.nameAr !== "string") return "Missing governmentAuthority.nameAr";

  return null;
}

// ─── Prompt builder ────────────────────────────────────────────────────────────

// ─── Role context for prompt injection ────────────────────────────────────────

export interface RolePromptContext {
  /** Role key, e.g. "minister" */
  roleKey: string;
  /** Arabic role title */
  titleAr: string;
  /** English role title */
  titleEn: string;
  /** Competence ceiling key */
  competenceCeiling: string;
  /** Nature of involvement sentence (from getRoleInvolvementContext) */
  involvementAr: string;
  /** Legal basis grounding this role's authority */
  legalBasisAr: string;
  /** Whether this role is challenging/appealing (shifts analysis to rights-focused) */
  isChallenging: boolean;
  /** Whether this role is judicially reviewing (shifts analysis to JR readiness) */
  isJudicialReview: boolean;
}

export function buildEvaluatorPrompt(params: {
  role: string;
  roleAr: string;
  decisionTypeAr: string;
  decisionTypeEn: string;
  jurisdiction: string;
  inherentRiskLevel: string;
  applicableLaws: Array<{ lawAr: string; referenceNumber: string; articles?: string[] }>;
  answers: Record<string, string>;
  ragContext: string;
  /** Phase 2: optional role context block for role-specific analysis framing */
  roleContext?: RolePromptContext;
}): { systemPrompt: string; userPrompt: string } {
  const { role, roleAr, decisionTypeAr, decisionTypeEn, jurisdiction, inherentRiskLevel, applicableLaws, answers, ragContext, roleContext } = params;

  const lawsList = applicableLaws
    .map((l) => `• ${l.lawAr} (${l.referenceNumber})` + (l.articles?.length ? `\n  المواد: ${l.articles.join("، ")}` : ""))
    .join("\n");

  const answersText = Object.entries(answers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  // ── Role-specific analysis framing block ───────────────────────────────────
  let roleFramingBlock = "";
  if (roleContext) {
    const { titleAr, titleEn, involvementAr, legalBasisAr, isChallenging, isJudicialReview } = roleContext;

    roleFramingBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
سياق الدور — Role Context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الدور: ${titleAr} (${titleEn})
طبيعة التعامل مع القرار: ${involvementAr}
الأساس القانوني لصلاحية الدور: ${legalBasisAr}
${isChallenging ? `
⚠️ تنبيه تحليلي — Citizen/Challenge Mode:
المستخدم متأثر بالقرار ويسعى للتظلم أو الطعن فيه. ركّز التحليل على:
• حقوق المتأثر بالقرار وضمانات الإجراءات الواجبة (due process)
• مشروعية الإشعار والتسبيب (بُعدا الشكل والاختصاص)
• مسارات الطعن المتاحة وآجالها (بُعد الجاهزية للمراجعة القضائية)
• إمكانية إلغاء القرار أو التعويض عنه
• يجب أن يعكس canIssueToday مدى قانونية القرار من منظور المتأثر، لا منظور المُصدِر
` : ""}${isJudicialReview ? `
⚖️ تنبيه تحليلي — Judicial Review Mode:
المحكمة تراجع هذا القرار للبت في مشروعيته. ركّز التحليل على:
• الاختصاص القضائي والاختصاص الولائي
• استنفاد طرق الطعن الإدارية قبل اللجوء للقضاء
• صحة الإجراءات الشكلية (التسبيب، التبليغ، الآجال)
• إمكانية إلغاء القرار أو تعليق تنفيذه
• canIssueToday = "conditional" إذا كان القرار قابلاً للتصحيح، و"no" إذا كان معيباً عيباً جوهرياً
` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  const systemPrompt = `أنت خبير قانوني متخصص في القانون الإداري الإماراتي ونظرية الشمسي للقرارات الإدارية.
مهمتك: تقييم القرار الإداري المعروض عبر اثني عشر بُعداً قانونياً وفق نظرية الشمسي، وإصدار تقرير موضوعي ودقيق.
${roleFramingBlock}
الأبعاد الاثنا عشر لنظرية الشمسي:
1. الاختصاص (Jurisdiction / Competence) — هل الجهة المُصدِرة تملك الصلاحية القانونية؟
2. الشكل (Form) — هل القرار مستوفٍ للشكل القانوني المطلوب (كتابة، توقيع، تسبيب، تبليغ)؟
3. السبب (Cause) — هل ثمة واقعة أو حالة قانونية مشروعة تسوّغ القرار؟
4. المحل (Subject Matter) — هل موضوع القرار مشروع وممكن وغير مخالف للنظام العام؟
5. الغاية (Purpose) — هل القرار يستهدف المصلحة العامة وليس أغراضاً شخصية؟
6. الإرادة الإنسانية (Human Will) — هل القرار صادر عن إرادة إنسانية حرة وواعية؟
7. تكوين الإرادة الرقمية (Digital Will Formation) — هل الأنظمة الرقمية المستخدمة معتمدة قانونياً؟
8. الوزن القانوني الخوارزمي (Algorithmic Legal Weight) — ما مقدار تأثير التوصية الخوارزمية على القرار؟
9. التحيز الخوارزمي المشروع (Legitimate Algorithmic Bias) — هل الخوارزمية خضعت للتقييم والمراجعة؟
10. قابلية التفسير (Explainability) — هل يمكن شرح القرار للمتأثر بوضوح؟
11. الإشراف البشري (Human Oversight) — هل ثمة رقابة بشرية كافية على تنفيذ القرار؟
12. الجاهزية للمراجعة القضائية (Judicial Review Readiness) — هل القرار قادر على الصمود أمام الرقابة القضائية؟

القوانين الإماراتية المرجعية لهذا القرار:
${lawsList}

${ragContext ? `السياق القانوني من قاعدة البيانات:\n${ragContext}` : "لا توجد مصادر إضافية في قاعدة البيانات."}

قواعد الإجابة:
- أجب حصراً بـJSON دقيق ومكتمل وفق الهيكل المحدد أدناه، مسبوقاً بتفكير داخلي موجز بين علامات <think></think>
- اجعل التحليل موضوعياً مبنياً على المعطيات المُقدَّمة
- استشهد بالقوانين الإماراتية بدقة
- اكتب الحقول الثنائية بالعربية والإنجليزية
- عدِّل إطار التحليل وفق الدور المُحدَّد في "سياق الدور" أعلاه

الهيكل الإلزامي للإجابة:
<think>
[تفكير موجز: أبرز نقاط القوة والضعف القانونية في هذا القرار من منظور دور المستخدم]
</think>
{
  "jurisdiction": {
    "status": "compliant|partial|non-compliant|unknown",
    "score": 0-100,
    "explanationAr": "...",
    "explanationEn": "...",
    "missingRequirements": ["..."],
    "applicableLaw": ["نص المادة القانونية"]
  },
  "form": { ... },
  "cause": { ... },
  "subjectMatter": { ... },
  "purpose": { ... },
  "humanWill": { ... },
  "digitalWillFormation": { ... },
  "algorithmicWeight": { ... },
  "algorithmicBias": { ... },
  "explainability": { ... },
  "humanOversight": { ... },
  "judicialReviewReadiness": { ... },
  "canIssueToday": "yes|no|conditional",
  "canIssueTodayRationale": "إجابة مباشرة في 2-3 جمل",
  "governmentAuthority": {
    "nameAr": "...",
    "nameEn": "...",
    "department": "...",
    "website": "https://... أو null",
    "phone": "... أو null",
    "competenceBasis": "النص القانوني الذي يمنح هذه الجهة الصلاحية"
  },
  "applicableLegislation": [
    {
      "token": "[SRC:N] أو null",
      "articleAr": "المادة X من القانون Y",
      "relevanceAr": "وجه الانطباق على هذا القرار"
    }
  ],
  "courtPrecedents": null,
  "requiredDocuments": [
    {
      "nameAr": "...",
      "descriptionAr": "...",
      "mandatory": true
    }
  ],
  "timeline": {
    "steps": [
      { "step": 1, "titleAr": "...", "duration": "...", "actor": "..." }
    ]
  },
  "appealStrategy": {
    "routes": [
      {
        "routeAr": "التظلم الإداري الداخلي",
        "deadlineAr": "خلال 60 يوماً من تاريخ إبلاغ القرار",
        "procedureAr": "تقديم طلب مكتوب إلى الجهة المُصدِرة للقرار"
      }
    ],
    "recommendationAr": "..."
  },
  "algorithmExplanation": "شرح بسيط وواضح لكيفية توصل النظام إلى هذا التقييم وما الذي لم يستطع التحقق منه",
  "humanInterventionPoints": [
    "نقطة تتطلب تدخلاً بشرياً لا يمكن تفويضه للخوارزمية"
  ]
}`;

  const userPrompt = `دور المستخدم: ${roleAr} (${role})
نوع القرار الإداري: ${decisionTypeAr} (${decisionTypeEn})
النطاق القضائي: ${jurisdiction === "uae" ? "الإمارات العربية المتحدة" : jurisdiction}
مستوى الخطر الجوهري: ${inherentRiskLevel}

إجابات الاستبيان:
${answersText}

قدّم التقييم الإداري الشامل وفق نظرية الشمسي الاثني عشر أبعاداً${roleContext?.isChallenging ? " من منظور حقوق المتأثر بالقرار" : roleContext?.isJudicialReview ? " من منظور الرقابة القضائية" : ""}.`;

  return { systemPrompt, userPrompt };
}
