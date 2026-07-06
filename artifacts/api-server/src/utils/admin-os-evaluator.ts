/**
 * Al-Shamsi 16-Pillar Administrative Decision Evaluator
 *
 * Builds the AI prompt, validates the structured response, and
 * computes Legality Score + Risk Score.
 *
 * Traditional Administrative Law Pillars (6):
 *   Jurisdiction (Institutional)  14%
 *   Competence (Issuer Capacity)   8%
 *   Form                           7%
 *   Cause                         12%
 *   Subject Matter                 7%
 *   Purpose                        7%
 *
 * AI / Digital Decision Pillars (10):
 *   Human Will                     7%
 *   Digital Will Formation         5%
 *   Algorithmic Legal Weight       5%
 *   Algorithmic Bias               4%
 *   Explainability                 4%
 *   Human Oversight                4%
 *   Judicial Review Readiness      4%
 *   Proportionality                5%
 *   Transparency                   4%
 *   Accountability                 3%
 *
 * Total: 100%
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
  // ── Traditional Administrative Law Pillars (6) ────────────────────
  jurisdiction: DimensionResult;
  /** Legal capacity/rank of the issuing official — distinct from institutional jurisdiction */
  competence: DimensionResult;
  form: DimensionResult;
  cause: DimensionResult;
  subjectMatter: DimensionResult;
  purpose: DimensionResult;

  // ── AI / Digital Decision Pillars (10) ────────────────────────────
  humanWill: DimensionResult;
  digitalWillFormation: DimensionResult;
  algorithmicWeight: DimensionResult;
  algorithmicBias: DimensionResult;
  explainability: DimensionResult;
  humanOversight: DimensionResult;
  judicialReviewReadiness: DimensionResult;
  /** Whether the decision measure is proportionate to its stated objective */
  proportionality: DimensionResult;
  /** Adequate disclosure of reasoning and process to affected parties */
  transparency: DimensionResult;
  /** Existence of an identifiable human decision-maker who can be held liable */
  accountability: DimensionResult;

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

// ─── Pillar weights ────────────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<string, number> = {
  // Traditional (6) — sum: 55
  jurisdiction:           14,
  competence:              8,
  form:                    7,
  cause:                  12,
  subjectMatter:           7,
  purpose:                 7,
  // AI / Digital (10) — sum: 45
  humanWill:               7,
  digitalWillFormation:    5,
  algorithmicWeight:       5,
  algorithmicBias:         4,
  explainability:          4,
  humanOversight:          4,
  judicialReviewReadiness: 4,
  proportionality:         5,
  transparency:            4,
  accountability:          3,
};

export const DIMENSION_KEYS = Object.keys(DIMENSION_WEIGHTS) as Array<keyof typeof DIMENSION_WEIGHTS>;

// ─── Score computation ─────────────────────────────────────────────────────────

export function computeLegalityScore(dims: Record<string, DimensionResult>): number {
  let weighted = 0;
  for (const key of DIMENSION_KEYS) {
    const dim = dims[key];
    if (!dim) continue;
    const weight = DIMENSION_WEIGHTS[key] ?? 0;
    weighted += (dim.score / 100) * weight;
  }
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

export function computeRiskScore(
  dims: Record<string, DimensionResult>,
  inherentRiskLevel: string,
  legalityScore: number,
): number {
  const base = 100 - legalityScore;

  let penalty = 0;
  for (const key of DIMENSION_KEYS) {
    const dim = dims[key];
    if (!dim) continue;
    const weight = DIMENSION_WEIGHTS[key] ?? 0;
    if (dim.status === "non-compliant") penalty += weight * 0.5;
    else if (dim.status === "partial") penalty += weight * 0.15;
    penalty += dim.missingRequirements.length * 0.8;
  }

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

  for (const dim of REQUIRED_DIMENSIONS) {
    const d = obj[dim];
    if (typeof d !== "object" || d === null) return `Missing dimension: ${dim}`;
    const dObj = d as Record<string, unknown>;
    if (!VALID_STATUSES.has(dObj.status as string)) return `Invalid status in dimension ${dim}: ${dObj.status}`;
    if (typeof dObj.score !== "number") return `Missing numeric score in dimension: ${dim}`;
    if ((dObj.score as number) < 0 || (dObj.score as number) > 100)
      return `Score out of range in dimension ${dim}: ${dObj.score}`;
    if (typeof dObj.explanationAr !== "string" || !(dObj.explanationAr as string).length)
      return `Missing explanationAr in dimension: ${dim}`;
    if (typeof dObj.explanationEn !== "string" || !(dObj.explanationEn as string).length)
      return `Missing explanationEn in dimension: ${dim}`;
    if (!Array.isArray(dObj.missingRequirements)) return `Missing missingRequirements array in dimension: ${dim}`;
    if (!Array.isArray(dObj.applicableLaw)) return `Missing applicableLaw array in dimension: ${dim}`;
  }

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

export interface RolePromptContext {
  roleKey: string;
  titleAr: string;
  titleEn: string;
  competenceCeiling: string;
  involvementAr: string;
  legalBasisAr: string;
  isChallenging: boolean;
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
  roleContext?: RolePromptContext;
  jurisdictionContext?: string;
}): { systemPrompt: string; userPrompt: string } {
  const { role, roleAr, decisionTypeAr, decisionTypeEn, jurisdiction, inherentRiskLevel, applicableLaws, answers, ragContext, roleContext, jurisdictionContext } = params;

  const lawsList = applicableLaws
    .map((l) => `• ${l.lawAr} (${l.referenceNumber})` + (l.articles?.length ? `\n  المواد: ${l.articles.join("، ")}` : ""))
    .join("\n");

  const answersText = Object.entries(answers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

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

  const expertIntro = jurisdictionContext
    ? `أنت خبير قانوني متخصص في القانون الإداري المقارن ونظرية الشامسي للقرارات الإدارية.
مهمتك: تقييم القرار الإداري المعروض عبر ستة عشر عموداً قانونياً وفق نظرية الشامسي، مع تطبيق الإطار القانوني الخاص بالنظام القانوني المحدد في سياق النظام القانوني أدناه.`
    : `أنت خبير قانوني متخصص في القانون الإداري الإماراتي ونظرية الشامسي للقرارات الإدارية.
مهمتك: تقييم القرار الإداري المعروض عبر ستة عشر عموداً قانونياً وفق نظرية الشامسي، وإصدار تقرير موضوعي ودقيق.`;

  const systemPrompt = `${expertIntro}
${roleFramingBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الأعمدة التقليدية للقانون الإداري (6 أعمدة):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. الاختصاص المؤسسي (Jurisdiction) — هل الجهة المُصدِرة تملك الصلاحية القانونية لإصدار هذا النوع من القرارات؟
2. أهلية المُصدِر (Competence) — هل الموظف/المسؤول الموقِّع على القرار يملك الأهلية القانونية والمستوى الوظيفي المطلوب؟ (هذا الركن مستقل عن الاختصاص المؤسسي)
3. الشكل (Form) — هل القرار مستوفٍ للشكل القانوني المطلوب (كتابة، توقيع، تسبيب، تبليغ)؟
4. السبب (Cause) — هل ثمة واقعة أو حالة قانونية مشروعة تسوّغ القرار؟
5. المحل (Subject Matter) — هل موضوع القرار مشروع وممكن وغير مخالف للنظام العام؟
6. الغاية (Purpose) — هل القرار يستهدف المصلحة العامة وليس أغراضاً شخصية؟

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
أعمدة القرارات الرقمية / الذكاء الاصطناعي (10 أعمدة):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7.  الإرادة الإنسانية (Human Will) — هل القرار صادر عن إرادة إنسانية حرة وواعية؟
8.  تكوين الإرادة الرقمية (Digital Will Formation) — هل الأنظمة الرقمية المستخدمة معتمدة قانونياً وفق المرسوم بقانون اتحادي 21/2021؟
9.  الوزن القانوني الخوارزمي (Algorithmic Legal Weight) — ما مقدار تأثير التوصية الخوارزمية على القرار؟
10. التحيز الخوارزمي (Algorithmic Bias) — هل الخوارزمية خضعت للتقييم وفحص التحيز والمراجعة الدورية؟
11. قابلية التفسير (Explainability) — هل يمكن شرح القرار للمتأثر بوضوح وفق حق الاطلاع؟
12. الإشراف البشري (Human Oversight) — هل ثمة رقابة بشرية كافية على عملية اتخاذ القرار وتنفيذه؟
13. الجاهزية للمراجعة القضائية (Judicial Review Readiness) — هل القرار موثق بما يكفي للصمود أمام الطعن القضائي؟
14. التناسب (Proportionality) — هل الإجراء الإداري متناسب مع الهدف المُعلن ولا يتجاوز ما هو ضروري لتحقيق الغرض؟
15. الشفافية (Transparency) — هل تم الإفصاح بشكل كافٍ عن أسباب القرار وعملية صنعه للأطراف المتأثرة؟
16. المساءلة (Accountability) — هل ثمة إنسان مسؤول ومحدد الهوية يمكن مساءلته قانونياً وإدارياً عن هذا القرار؟

${jurisdictionContext
  ? `${jurisdictionContext}\n\nالمراجع القانونية الخاصة بهذا القرار:\n${lawsList}`
  : `القوانين الإماراتية المرجعية لهذا القرار:\n${lawsList}`}

${ragContext ? `السياق القانوني من قاعدة البيانات:\n${ragContext}` : "لا توجد مصادر إضافية في قاعدة البيانات."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
قواعد توثيق المصادر — MANDATORY AUTHORITY LABELLING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
لكل ركن من الأركان الستة عشر، يجب أن تحتوي قائمة applicableLaw على مصدر قانوني واحد على الأقل مُصنَّف بإحدى العلامتين:
• [UAE Binding] — للمصادر الإماراتية الملزِمة (الدساتير، المراسيم بقوانين، القرارات الاتحادية، أحكام المحاكم الإماراتية)
• [Comparative Persuasive] — للمصادر المقارنة الاسترشادية (مبادئ مجلس الدولة الفرنسي، الفقه الإداري المقارن، أحكام محاكم أجنبية)
أي ركن بدون مصدر مُصنَّف يُعدّ تقييماً منقوصاً.

مثال صحيح:
"applicableLaw": [
  "المادة 11 من المرسوم بقانون اتحادي رقم 21 لسنة 2021 [UAE Binding]",
  "مبدأ التناسب في قرارات مجلس الدولة الفرنسي [Comparative Persuasive]"
]

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
    "applicableLaw": ["النص القانوني [UAE Binding]"]
  },
  "competence": { ... },
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
  "proportionality": { ... },
  "transparency": { ... },
  "accountability": { ... },
  "canIssueToday": "yes|no|conditional",
  "canIssueTodayRationale": "إجابة مباشرة في 2-3 جمل",
  "governmentAuthority": {
    "nameAr": "...",
    "nameEn": "...",
    "department": "...",
    "website": "https://... أو null",
    "phone": "... أو null",
    "competenceBasis": "النص القانوني الذي يمنح هذه الجهة الصلاحية [UAE Binding]"
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

قدّم التقييم الإداري الشامل وفق نظرية الشامسي الستة عشر عموداً${roleContext?.isChallenging ? " من منظور حقوق المتأثر بالقرار" : roleContext?.isJudicialReview ? " من منظور الرقابة القضائية" : ""}.`;

  return { systemPrompt, userPrompt };
}

// ─── ADKG Decision Prompt Builder ─────────────────────────────────────────────
// Builds the evaluator prompt for a stored ADKG decision (content-based, not interview-based).

export function buildAdkgEvaluatorPrompt(params: {
  decisionNumber: string;
  titleAr: string;
  titleEn: string;
  issuerOrg: string | null | undefined;
  issuerOrgAr: string | null | undefined;
  bodyAr: string;
  bodyEn: string;
  linkedAuthorities: Array<{
    titleAr: string | null | undefined;
    titleEn: string | null | undefined;
    linkType: string;
    authorityClass: string;
    linkedEntityRef: string | null | undefined;
  }>;
  ragContext: string;
}): { systemPrompt: string; userPrompt: string } {
  const { decisionNumber, titleAr, titleEn, issuerOrg, issuerOrgAr, bodyAr, bodyEn, linkedAuthorities, ragContext } = params;

  const authoritiesList = linkedAuthorities.length > 0
    ? linkedAuthorities
        .map((a) => `• ${a.titleAr ?? a.titleEn ?? a.linkedEntityRef ?? "—"} (${a.linkType}) [${a.authorityClass}]`)
        .join("\n")
    : "لا توجد سلطات مستشهد بها مسجّلة.";

  const systemPrompt = `أنت خبير قانوني متخصص في القانون الإداري الإماراتي ونظرية الشامسي الستة عشر عموداً.
مهمتك: تقييم القرار الإداري المُخزَّن في قاعدة بيانات المعرفة الإدارية (ADKG) عبر الستة عشر عموداً القانونية، واستخراج نتائج موضوعية مبنية على النص الفعلي للقرار والمصادر المرتبطة به.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الأعمدة التقليدية للقانون الإداري (6 أعمدة):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. الاختصاص المؤسسي (Jurisdiction) — هل الجهة المُصدِرة تملك الصلاحية القانونية؟
2. أهلية المُصدِر (Competence) — هل الموظف الموقِّع يملك الأهلية القانونية والمستوى الوظيفي المطلوب؟
3. الشكل (Form) — هل القرار مستوفٍ للشكل القانوني (كتابة، توقيع، تسبيب، تبليغ)؟
4. السبب (Cause) — هل ثمة سبب قانوني مشروع يسوّغ القرار؟
5. المحل (Subject Matter) — هل موضوع القرار مشروع وممكن؟
6. الغاية (Purpose) — هل القرار يستهدف المصلحة العامة؟

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
أعمدة القرارات الرقمية (10 أعمدة):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7.  الإرادة الإنسانية (Human Will) — هل القرار صادر عن إرادة إنسانية حرة؟
8.  تكوين الإرادة الرقمية (Digital Will Formation) — هل الأنظمة الرقمية معتمدة قانونياً؟
9.  الوزن القانوني الخوارزمي (Algorithmic Legal Weight) — ما مدى تأثير التوصية الخوارزمية؟
10. التحيز الخوارزمي (Algorithmic Bias) — هل خضع الذكاء الاصطناعي للتقييم والمراجعة؟
11. قابلية التفسير (Explainability) — هل القرار قابل للشرح للمتأثرين؟
12. الإشراف البشري (Human Oversight) — هل توجد رقابة بشرية كافية؟
13. الجاهزية للمراجعة القضائية (Judicial Review Readiness) — هل القرار موثق بشكل كافٍ؟
14. التناسب (Proportionality) — هل الإجراء متناسب مع الهدف المُعلن؟
15. الشفافية (Transparency) — هل أُفصح عن الأسباب للأطراف المتأثرة؟
16. المساءلة (Accountability) — هل ثمة إنسان مسؤول يمكن مساءلته قانونياً؟

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
قاعدة تصنيف المصادر الإلزامية:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
لكل ركن، يجب أن تتضمن قائمة applicableLaw مصدراً واحداً على الأقل مُصنَّفاً بإحدى العلامتين:
• [UAE Binding]  — للمصادر الإماراتية الملزِمة (مراسيم، قرارات، أحكام محاكم إماراتية)
• [Comparative Persuasive] — للمصادر المقارنة الاسترشادية (مجلس الدولة الفرنسي، فقه مقارن)
أي ركن بدون تصنيف مصدر = تقييم منقوص.

${ragContext ? `السياق القانوني من قاعدة البيانات:\n${ragContext}` : "لا توجد مصادر إضافية."}

الهيكل الإلزامي للإجابة (JSON فقط، مسبوقاً بـ <think></think>):
{
  "jurisdiction": { "status": "compliant|partial|non-compliant|unknown", "score": 0-100, "explanationAr": "...", "explanationEn": "...", "missingRequirements": [], "applicableLaw": ["... [UAE Binding]"] },
  "competence": { ... },
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
  "proportionality": { ... },
  "transparency": { ... },
  "accountability": { ... },
  "canIssueToday": "yes|no|conditional",
  "canIssueTodayRationale": "...",
  "governmentAuthority": { "nameAr": "...", "nameEn": "...", "department": "...", "website": null, "phone": null, "competenceBasis": "... [UAE Binding]" },
  "applicableLegislation": [{ "token": null, "articleAr": "...", "relevanceAr": "..." }],
  "courtPrecedents": null,
  "requiredDocuments": [{ "nameAr": "...", "descriptionAr": "...", "mandatory": true }],
  "timeline": { "steps": [{ "step": 1, "titleAr": "...", "duration": "...", "actor": "..." }] },
  "appealStrategy": { "routes": [{ "routeAr": "...", "deadlineAr": "...", "procedureAr": "..." }], "recommendationAr": "..." },
  "algorithmExplanation": "...",
  "humanInterventionPoints": ["..."]
}`;

  const userPrompt = `القرار الإداري للتقييم:
رقم القرار: ${decisionNumber}
العنوان: ${titleAr}
Title (EN): ${titleEn}
الجهة المُصدِرة: ${issuerOrgAr ?? issuerOrg ?? "غير محدد"}

نص القرار:
${bodyAr || bodyEn || "(لا يوجد نص)"}

السلطات المستشهد بها المرتبطة بهذا القرار:
${authoritiesList}

قدّم التقييم الشامل للقرار وفق نظرية الشامسي الستة عشر عموداً. إذا كان نص القرار غير مكتمل، اعتمد على المعطيات المتاحة وحدد الأركان "unknown" حيث لا معطيات كافية.`;

  return { systemPrompt, userPrompt };
}
