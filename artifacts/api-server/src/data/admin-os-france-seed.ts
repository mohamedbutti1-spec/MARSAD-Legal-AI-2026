/**
 * French Administrative Decision Type seed catalog — Al-Shamsi Theory Phase 4
 *
 * 15 decision types across 5 domains, each referencing specific CRPA articles,
 * CGFP provisions, and Conseil d'État principles.
 *
 * Domain coverage:
 *   personnel (4)   — fonctionnaires, statut général
 *   regulatory (4)  — police administrative, autorisations, sanctions
 *   citizen (3)     — étrangers, aide sociale, regroupement
 *   appeals (2)     — décisions implicites, recours préalables
 *   digital (2)     — traitement algorithmique, décisions automatisées
 */

import type { ApplicableLaw, InterviewQuestionNode } from "@workspace/db";

export interface SeedDecisionType {
  jurisdiction: string;
  domain: string;
  decisionTypeAr: string;
  decisionTypeEn: string;
  descriptionAr: string;
  requiredCompetenceLevel: string;
  inherentRiskLevel: string;
  applicableLaws: ApplicableLaw[];
  interviewTemplate: InterviewQuestionNode[];
}

// ─── Common French law references ─────────────────────────────────────────────

const CRPA: ApplicableLaw = {
  lawAr: "قانون العلاقات بين الجمهور والإدارة",
  lawEn: "Code des relations entre le public et l'administration (CRPA)",
  referenceNumber: "CRPA Ordonnances 2015-1341 & 2015-1342",
  articles: ["L121-1", "L211-2", "L232-4", "L311-3-1"],
};

const CGFP: ApplicableLaw = {
  lawAr: "القانون العام للوظيفة العمومية",
  lawEn: "Code général de la fonction publique (CGFP)",
  referenceNumber: "Loi no 2019-828",
  articles: ["L530-1", "L532-3", "L612-1"],
};

const LOI_NUMERIQUE: ApplicableLaw = {
  lawAr: "قانون الجمهورية الرقمية",
  lawEn: "Loi pour une République numérique",
  referenceNumber: "Loi no 2016-1321",
  articles: ["art. 4 (transparence algorithmique)"],
};

const RGPD: ApplicableLaw = {
  lawAr: "اللائحة الأوروبية العامة لحماية البيانات",
  lawEn: "Règlement général sur la protection des données (RGPD)",
  referenceNumber: "EU 2016/679",
  articles: ["art. 22 (décisions automatisées)"],
};

const LOIN_78: ApplicableLaw = {
  lawAr: "قانون المعلوماتية والحريات",
  lawEn: "Loi Informatique et Libertés",
  referenceNumber: "Loi 78-17 du 6 janvier 1978",
  articles: ["art. 47", "art. 63"],
};

const CJA: ApplicableLaw = {
  lawAr: "قانون القضاء الإداري",
  lawEn: "Code de justice administrative (CJA)",
  referenceNumber: "Décret no 2016-1480",
  articles: ["L411-1", "L521-1"],
};

// ─── Shared French interview question base ────────────────────────────────────

const frenchCompetenceQuestions: InterviewQuestionNode[] = [
  {
    id: "fr_competence_source",
    dimensionTag: "jurisdiction",
    questionAr: "ما النص القانوني الفرنسي الذي يمنح الجهة صلاحية إصدار هذا القرار؟",
    questionEn: "What is the French legal text (CRPA, CGFP, or special statute) granting this authority?",
    hintAr: "مثال: CRPA art. L200-1، أو CGFP art. L530-1، أو مرسوم تنظيمي خاص",
    answerType: "text",
    required: true,
  },
  {
    id: "fr_delegation_type",
    dimensionTag: "jurisdiction",
    questionAr: "هل الصلاحية بموجب تفويض إمضاء أم تفويض سلطة؟",
    questionEn: "Is the authority via délégation de signature or délégation de pouvoir?",
    answerType: "chips",
    options: [
      { value: "direct", labelAr: "صلاحية مباشرة (sans délégation)", labelEn: "Direct authority (no delegation)" },
      { value: "signature", labelAr: "تفويض إمضاء (délégation de signature)", labelEn: "Signature delegation" },
      { value: "pouvoir", labelAr: "تفويض سلطة (délégation de pouvoir)", labelEn: "Power delegation" },
    ],
    required: true,
  },
];

const frenchFormQuestions: InterviewQuestionNode[] = [
  {
    id: "fr_motivation",
    dimensionTag: "form",
    questionAr: "هل القرار مُسبَّب كتابةً وفق CRPA art. L211-2؟ (التسبيب الإلزامي للقرارات الضارة بالأفراد)",
    questionEn: "Is the decision motivated in writing per CRPA art. L211-2 (mandatory motivation for adverse decisions)?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "fr_contradictoire",
    dimensionTag: "form",
    questionAr: "هل أُجريت الإجراءات التناقضية المطلوبة قبل القرار الضار؟ (CRPA art. L121-1)",
    questionEn: "Was the required contradictory procedure conducted before this adverse decision? (CRPA art. L121-1)",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "fr_notification",
    dimensionTag: "form",
    questionAr: "هل تم التبليغ الرسمي للمعني بالقرار مع ذكر آجال ومسالك الطعن؟",
    questionEn: "Was the party formally notified of the decision with appeal deadlines and routes mentioned?",
    answerType: "yes-no",
    required: true,
  },
];

const frenchCauseQuestions: InterviewQuestionNode[] = [
  {
    id: "fr_facts_exact",
    dimensionTag: "cause",
    questionAr: "هل الوقائع المادية التي يستند إليها القرار ثابتة وصحيحة؟ (Exactitude matérielle des faits)",
    questionEn: "Are the material facts underlying the decision verified and accurate?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "fr_legal_qualification",
    dimensionTag: "cause",
    questionAr: "هل الوقائع تمت تأهيلها قانونياً بصورة سليمة للاستناد إليها؟ (Qualification juridique)",
    questionEn: "Were the facts properly legally qualified to serve as the decision's legal basis?",
    answerType: "chips",
    options: [
      { value: "correct", labelAr: "نعم — التأهيل القانوني سليم", labelEn: "Yes — qualification is correct" },
      { value: "debatable", labelAr: "مثار جدل — قد يُطعن فيه بخطأ واضح في التقدير", labelEn: "Debatable — possible erreur manifeste d'appréciation" },
      { value: "incorrect", labelAr: "لا — الوقائع لا تسوّغ القرار قانونياً", labelEn: "No — facts do not legally justify the decision" },
    ],
    required: true,
  },
];

function frenchBaseTemplate(extra: InterviewQuestionNode[] = []): InterviewQuestionNode[] {
  const digitalWillQs: InterviewQuestionNode[] = [
    {
      id: "fr_digital_signature",
      dimensionTag: "digitalWillFormation",
      questionAr: "هل صدر القرار إلكترونياً؟ وإن كان كذلك، هل استُخدم توقيع إلكتروني معتمد وفق CRPA art. L232-4؟",
      questionEn: "Was the decision issued electronically? If so, was a qualified electronic signature used per CRPA art. L232-4?",
      answerType: "chips",
      options: [
        { value: "paper", labelAr: "ورقي بتوقيع يدوي — لا إشكالية", labelEn: "Paper with handwritten signature — no issue" },
        { value: "e_valid", labelAr: "إلكتروني بتوقيع معتمد (CRPA L232-4)", labelEn: "Electronic with qualified signature (CRPA L232-4)" },
        { value: "e_unqualified", labelAr: "إلكتروني بدون توقيع معتمد — إشكالية", labelEn: "Electronic without qualified signature — issue" },
      ],
      required: true,
    },
  ];

  const algorithmicQs: InterviewQuestionNode[] = [
    {
      id: "fr_algo_used",
      dimensionTag: "algorithmicWeight",
      questionAr: "هل استُخدمت خوارزمية في اتخاذ هذا القرار أو التوصية به؟ (CRPA art. L311-3-1)",
      questionEn: "Was an algorithm used in making or recommending this decision? (CRPA art. L311-3-1)",
      answerType: "yes-no",
      required: true,
    },
    {
      id: "fr_algo_exclusive",
      dimensionTag: "algorithmicWeight",
      questionAr: "هل القرار صادر حصراً عن الخوارزمية دون تدخل بشري؟ (محظور وفق CRPA L311-3-1)",
      questionEn: "Was the decision made exclusively by the algorithm without human intervention? (Prohibited per CRPA L311-3-1)",
      answerType: "yes-no",
      required: false,
      conditionalOn: { questionId: "fr_algo_used", value: "yes" },
    },
    {
      id: "fr_algo_transparency",
      dimensionTag: "explainability",
      questionAr: "هل يمكن الإفصاح عن معايير الخوارزمية للمعني عند الطلب؟ (Loi République Numérique art. 4)",
      questionEn: "Can the algorithm's criteria be disclosed to the affected party on request? (Loi République Numérique art. 4)",
      answerType: "yes-no",
      required: false,
      conditionalOn: { questionId: "fr_algo_used", value: "yes" },
    },
  ];

  const purposeQs: InterviewQuestionNode[] = [
    {
      id: "fr_but_legal",
      dimensionTag: "purpose",
      questionAr: "هل القرار يستهدف الصالح العام حصراً؟ أم ثمة احتمال لانحراف بالسلطة (détournement de pouvoir)؟",
      questionEn: "Does the decision exclusively target the public interest, or is there a risk of détournement de pouvoir?",
      answerType: "chips",
      options: [
        { value: "public_only", labelAr: "الصالح العام حصراً — لا انحراف", labelEn: "Public interest only — no détournement" },
        { value: "mixed", labelAr: "مصلحة عامة + اعتبارات أخرى — مثار جدل", labelEn: "Mixed motives — debatable" },
        { value: "private", labelAr: "اعتبارات غير مشروعة — انحراف واضح", labelEn: "Improper motives — clear détournement" },
      ],
      required: true,
    },
  ];

  const humanOversightQs: InterviewQuestionNode[] = [
    {
      id: "fr_controle_hierarchique",
      dimensionTag: "humanOversight",
      questionAr: "هل يخضع القرار للرقابة الهرمية الداخلية (contrôle hiérarchique) قبل سريانه؟",
      questionEn: "Is the decision subject to internal hierarchical control before taking effect?",
      answerType: "yes-no",
      required: true,
    },
  ];

  const judicialReadinessQs: InterviewQuestionNode[] = [
    {
      id: "fr_recours_deadline",
      dimensionTag: "judicialReviewReadiness",
      questionAr: "هل القرار مشفوع بإشارة لأجل الطعن القضائي (2 شهران من التبليغ) ومسالكه؟",
      questionEn: "Does the decision mention the judicial review deadline (2 months from notification) and routes?",
      answerType: "yes-no",
      required: true,
    },
    {
      id: "fr_recours_admin_prior",
      dimensionTag: "judicialReviewReadiness",
      questionAr: "هل استُنفدت طرق الطعن الإدارية (تظلم ودّي / هرمي) قبل اللجوء للقضاء؟",
      questionEn: "Were administrative remedies (recours gracieux / hiérarchique) exhausted before judicial proceedings?",
      answerType: "chips",
      options: [
        { value: "not_applicable", labelAr: "لا ينطبق — قرار ابتدائي لم يُطعن فيه بعد", labelEn: "N/A — initial decision, not yet challenged" },
        { value: "exhausted", labelAr: "نعم — استُنفدت الطرق الإدارية", labelEn: "Yes — administrative remedies exhausted" },
        { value: "not_exhausted", labelAr: "لا — لم تُستنفد", labelEn: "No — not exhausted" },
      ],
      required: true,
    },
  ];

  return [
    ...frenchCompetenceQuestions,
    ...frenchFormQuestions,
    ...frenchCauseQuestions,
    {
      id: "fr_subject_licit",
      dimensionTag: "subjectMatter",
      questionAr: "هل محل القرار مشروع قانونياً ولا يتعارض مع النظام العام الفرنسي؟",
      questionEn: "Is the subject matter of the decision lawful and not contrary to French public order?",
      answerType: "yes-no",
      required: true,
    },
    ...purposeQs,
    {
      id: "fr_will_free",
      dimensionTag: "humanWill",
      questionAr: "هل صدر القرار عن إرادة حرة للموظف المختص دون إكراه هرمي غير مشروع؟",
      questionEn: "Was the decision made freely by the competent official without unlawful hierarchical pressure?",
      answerType: "yes-no",
      required: true,
    },
    ...digitalWillQs,
    ...algorithmicQs,
    {
      id: "fr_bias_cnil",
      dimensionTag: "algorithmicBias",
      questionAr: "هل النظام الخوارزمي المستخدم خضع لتقييم عدالة من CNIL أو هيئة مماثلة؟",
      questionEn: "Has the algorithm been assessed for fairness by CNIL or an equivalent body?",
      answerType: "yes-no",
      required: false,
    },
    ...humanOversightQs,
    ...judicialReadinessQs,
    ...extra,
  ];
}

// ─── French decision type catalog ─────────────────────────────────────────────

export const FRANCE_DECISION_TYPES: SeedDecisionType[] = [

  // ══════════════════════════════
  //  PERSONNEL (4)
  // ══════════════════════════════

  {
    jurisdiction: "france",
    domain: "personnel",
    decisionTypeAr: "نقل موظف مدني (Mutation de fonctionnaire)",
    decisionTypeEn: "Civil Servant Transfer (Mutation)",
    descriptionAr: "قرار نقل موظف مدني إلى منصب أو مكان عمل آخر وفق CGFP وحاجة المرفق",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [CGFP, CRPA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_mutation_consentement",
        dimensionTag: "humanWill",
        questionAr: "هل الموظف وافق على النقل؟ (إذا تعذّرت الموافقة، هل اتُّبعت إجراءات CGFP L512-1؟)",
        questionEn: "Did the civil servant consent? (If involuntary, was CGFP L512-1 followed?)",
        answerType: "chips",
        options: [
          { value: "voluntary", labelAr: "نقل طوعي بطلب الموظف", labelEn: "Voluntary — requested by the agent" },
          { value: "involuntary_procedure", labelAr: "إجباري — اتُّبعت الإجراءات (CGFP L512-1)", labelEn: "Involuntary — procedure followed (CGFP L512-1)" },
          { value: "involuntary_no_procedure", labelAr: "إجباري — لم تُتَّبع الإجراءات", labelEn: "Involuntary — procedure not followed" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "personnel",
    decisionTypeAr: "إحالة على التقاعد المبكر للموظف (Mise en retraite d'office)",
    decisionTypeEn: "Compulsory Early Retirement of Civil Servant",
    descriptionAr: "قرار إحالة موظف مدني إلى التقاعد قبل بلوغ السن القانونية الاختيارية",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [CGFP, CRPA, CJA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_retraite_age",
        dimensionTag: "subjectMatter",
        questionAr: "هل الإحالة بسبب الوصول للسن القانوني أم بسبب عجز صحي موثّق أم عقوبة تأديبية؟",
        questionEn: "Is retirement due to statutory age, documented incapacity, or disciplinary sanction?",
        answerType: "chips",
        options: [
          { value: "age", labelAr: "السن القانوني (limite d'âge)", labelEn: "Statutory age (limite d'âge)" },
          { value: "incapacity", labelAr: "عجز صحي موثّق (inaptitude physique)", labelEn: "Documented incapacity (inaptitude physique)" },
          { value: "disciplinary", labelAr: "عقوبة تأديبية (mise à la retraite d'office)", labelEn: "Disciplinary sanction" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "personnel",
    decisionTypeAr: "عقوبة تأديبية — إنذار أو توبيخ (Sanction disciplinaire)",
    decisionTypeEn: "Disciplinary Sanction — Warning or Reprimand",
    descriptionAr: "توقيع عقوبة تأديبية على موظف مدني من الدرجة الأولى (avertissement / blâme) وفق CGFP L530-1",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [CGFP, CRPA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_sanction_type",
        dimensionTag: "subjectMatter",
        questionAr: "ما درجة العقوبة التأديبية المقررة وفق CGFP؟",
        questionEn: "What is the disciplinary sanction grade per CGFP?",
        answerType: "chips",
        options: [
          { value: "avertissement", labelAr: "إنذار (avertissement) — المجموعة الأولى", labelEn: "Warning (avertissement) — Group 1" },
          { value: "blame", labelAr: "توبيخ (blâme) — المجموعة الأولى", labelEn: "Reprimand (blâme) — Group 1" },
          { value: "exclusion_15", labelAr: "إيقاف حتى 15 يوماً — المجموعة الثانية", labelEn: "Exclusion up to 15 days — Group 2" },
          { value: "degradation", labelAr: "خفض الدرجة — المجموعة الثالثة", labelEn: "Grade reduction — Group 3" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "personnel",
    decisionTypeAr: "ترقية وظيفية (Avancement de grade)",
    decisionTypeEn: "Grade Promotion (Avancement de grade)",
    descriptionAr: "قرار ترقية موظف مدني إلى درجة أعلى وفق معايير الاستحقاق والأقدمية في CGFP",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "low",
    applicableLaws: [CGFP],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_avancement_criteria",
        dimensionTag: "cause",
        questionAr: "ما أساس الترقية المقررة؟",
        questionEn: "What is the basis for the proposed promotion?",
        answerType: "chips",
        options: [
          { value: "anciennete", labelAr: "الأقدمية وحدها (ancienneté)", labelEn: "Seniority alone (ancienneté)" },
          { value: "merite", labelAr: "الاستحقاق (mérite) — تقييم سنوي ممتاز", labelEn: "Merit (mérite) — excellent annual assessment" },
          { value: "concours", labelAr: "اجتياز مسابقة وظيفية (concours)", labelEn: "Competitive examination (concours)" },
        ],
        required: true,
      },
    ]),
  },

  // ══════════════════════════════
  //  REGULATORY (4)
  // ══════════════════════════════

  {
    jurisdiction: "france",
    domain: "regulatory",
    decisionTypeAr: "ترخيص استغلال تجاري (Autorisation d'exploitation)",
    decisionTypeEn: "Commercial Operating License (Autorisation d'exploitation)",
    descriptionAr: "منح أو رفض ترخيص لاستغلال نشاط تجاري يستوجب تدخل الإدارة وفق قانون التجارة والشرطة الإدارية",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [CRPA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_autorisation_type",
        dimensionTag: "subjectMatter",
        questionAr: "ما نوع الترخيص التجاري المطلوب؟",
        questionEn: "What type of commercial operating license is requested?",
        answerType: "chips",
        options: [
          { value: "commerce", labelAr: "نشاط تجاري عام", labelEn: "General commercial activity" },
          { value: "restaurant", labelAr: "مطعم أو مقهى — ترخيص خاص", labelEn: "Restaurant/café — special license" },
          { value: "construction", labelAr: "ترخيص بناء (permis de construire)", labelEn: "Building permit (permis de construire)" },
          { value: "environmental", labelAr: "نشاط خاضع لقانون البيئة (ICPE)", labelEn: "Activity subject to environmental law (ICPE)" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "regulatory",
    decisionTypeAr: "عقوبة إدارية — غلق مؤقت (Sanction administrative — fermeture temporaire)",
    decisionTypeEn: "Administrative Sanction — Temporary Closure",
    descriptionAr: "قرار غلق مؤقت لمنشأة مخالفة وفق صلاحيات الشرطة الإدارية وضمانات CRPA",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [CRPA, CJA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_closure_urgency",
        dimensionTag: "cause",
        questionAr: "هل الغلق بسبب خطر داهم يبرر الاستعجال (urgence)؟",
        questionEn: "Is the closure due to imminent danger justifying urgency measures?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "regulatory",
    decisionTypeAr: "إنذار إداري رسمي (Mise en demeure administrative)",
    decisionTypeEn: "Administrative Formal Notice (Mise en demeure)",
    descriptionAr: "إشعار رسمي يُلزم شخصاً طبيعياً أو اعتبارياً بالامتثال لالتزام قانوني في أجل محدد",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [CRPA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_demeure_delai",
        dimensionTag: "form",
        questionAr: "هل تضمّن الإنذار أجلاً معقولاً للامتثال (délai raisonnable)؟",
        questionEn: "Does the notice include a reasonable compliance deadline (délai raisonnable)?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "regulatory",
    decisionTypeAr: "قرار ضبط إداري (Décision de police administrative)",
    decisionTypeEn: "Administrative Police Decision",
    descriptionAr: "قرار في إطار الشرطة الإدارية العامة لحفظ النظام العام (الأمن والسلامة والسكينة)",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [CRPA, CJA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_police_proportionnalite",
        dimensionTag: "purpose",
        questionAr: "هل القرار يستوفي اختبار التناسب (proportionnalité) بين الإجراء والتهديد؟ (Arrêt Benjamin 1933)",
        questionEn: "Does the decision satisfy the proportionality test between the measure and the threat? (Arrêt Benjamin 1933)",
        answerType: "chips",
        options: [
          { value: "proportionate", labelAr: "نعم — القيد الأدنى الضروري لحفظ النظام", labelEn: "Yes — minimum necessary restriction" },
          { value: "excessive", labelAr: "مبالغ فيه — قد يُلغى للتدخل المفرط", labelEn: "Excessive — may be annulled for over-restriction" },
        ],
        required: true,
      },
    ]),
  },

  // ══════════════════════════════
  //  CITIZEN SERVICES (3)
  // ══════════════════════════════

  {
    jurisdiction: "france",
    domain: "citizen",
    decisionTypeAr: "تصريح إقامة — أول إصدار (Titre de séjour — primo-délivrance)",
    decisionTypeEn: "First-Issue Residence Permit",
    descriptionAr: "البت الأول في طلب تصريح إقامة لأجنبي وفق CESEDA واجتهادات مجلس الدولة",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [CRPA, CJA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_sejour_category",
        dimensionTag: "subjectMatter",
        questionAr: "ما فئة تصريح الإقامة المطلوبة؟",
        questionEn: "What residence permit category is requested?",
        answerType: "chips",
        options: [
          { value: "travail", labelAr: "تصريح عمل (salarié/travailleur temporaire)", labelEn: "Work permit (salarié/travailleur temporaire)" },
          { value: "famille", labelAr: "لمّ شمل عائلي", labelEn: "Family reunification" },
          { value: "etudiant", labelAr: "طالب دراسة", labelEn: "Student" },
          { value: "humanitaire", labelAr: "إنساني أو لجوء", labelEn: "Humanitarian or asylum" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "citizen",
    decisionTypeAr: "منح مساعدة اجتماعية (Décision d'aide sociale)",
    decisionTypeEn: "Social Aid Grant Decision",
    descriptionAr: "قرار منح أو رفض مساعدة اجتماعية (RSA، APL، allocation handicapé) وفق قانون الفعل الاجتماعي",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [CRPA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_aide_type",
        dimensionTag: "subjectMatter",
        questionAr: "ما نوع المساعدة الاجتماعية موضوع القرار؟",
        questionEn: "What type of social aid is the subject of the decision?",
        answerType: "chips",
        options: [
          { value: "rsa", labelAr: "دخل التضامن النشيط (RSA)", labelEn: "Active Solidarity Income (RSA)" },
          { value: "apl", labelAr: "مساعدة سكنية (APL/ALS/ALF)", labelEn: "Housing assistance (APL/ALS/ALF)" },
          { value: "aah", labelAr: "تعويض عجز بالغ (AAH)", labelEn: "Disabled adult allowance (AAH)" },
          { value: "other", labelAr: "مساعدة اجتماعية أخرى", labelEn: "Other social aid" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "citizen",
    decisionTypeAr: "تصريح لمّ شمل الأسرة (Autorisation de regroupement familial)",
    decisionTypeEn: "Family Reunification Authorization",
    descriptionAr: "البت في طلب لمّ شمل عائلي لمقيم شرعي في فرنسا وفق CESEDA وتوجيهية 2003/86/CE",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [CRPA, CJA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_regroupement_conditions",
        dimensionTag: "cause",
        questionAr: "هل تستوفي الأسرة شروط CESEDA لطلب لمّ الشمل (مدة الإقامة + الموارد + السكن)؟",
        questionEn: "Does the family meet CESEDA conditions for family reunification (residence duration + resources + housing)?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  // ══════════════════════════════
  //  APPEALS (2)
  // ══════════════════════════════

  {
    jurisdiction: "france",
    domain: "appeals",
    decisionTypeAr: "قرار ضمني بالقبول (Décision implicite d'acceptation)",
    decisionTypeEn: "Implicit Acceptance Decision (Silence = Yes)",
    descriptionAr: "حالات يُعدّ فيها صمت الإدارة لمدة شهرين موافقةً ضمنية وفق CRPA art. L231-1 (قاعدة SVP — Silence vaut acceptation)",
    requiredCompetenceLevel: "any",
    inherentRiskLevel: "medium",
    applicableLaws: [CRPA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_sva_category",
        dimensionTag: "subjectMatter",
        questionAr: "هل الطلب يندرج ضمن مبدأ 'الصمت يعني القبول' (CRPA L231-1)؟",
        questionEn: "Does the request fall under the 'silence means yes' principle (CRPA L231-1)?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "fr_sva_deadline_elapsed",
        dimensionTag: "cause",
        questionAr: "هل انقضى أجل شهرين (أو الأجل الخاص المحدد بمرسوم) دون رد الإدارة؟",
        questionEn: "Have 2 months (or the specific regulatory deadline) elapsed without an administration response?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "appeals",
    decisionTypeAr: "قرار في تظلم هرمي (Recours hiérarchique)",
    decisionTypeEn: "Decision on Hierarchical Appeal",
    descriptionAr: "قرار السلطة الرئاسية في التظلم الهرمي المقدم ضد قرار مرؤوس وفق مبادئ CRPA والاجتهاد القضائي",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [CRPA, CJA],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_recours_type",
        dimensionTag: "judicialReviewReadiness",
        questionAr: "ما نوع التظلم الإداري المطروح على السلطة الرئاسية؟",
        questionEn: "What type of administrative appeal is before the higher authority?",
        answerType: "chips",
        options: [
          { value: "gracieux", labelAr: "تظلم ودّي (recours gracieux) — نفس الجهة", labelEn: "Gracious appeal (same authority)" },
          { value: "hierarchique", labelAr: "تظلم هرمي (recours hiérarchique) — السلطة الرئاسية", labelEn: "Hierarchical appeal (higher authority)" },
          { value: "tutelle", labelAr: "تظلم وصاية (recours de tutelle) — سلطة الوصاية", labelEn: "Supervisory appeal (tutelle authority)" },
        ],
        required: true,
      },
    ]),
  },

  // ══════════════════════════════
  //  DIGITAL (2)
  // ══════════════════════════════

  {
    jurisdiction: "france",
    domain: "digital",
    decisionTypeAr: "قرار بمعالجة خوارزمية (CRPA art. L311-3-1)",
    decisionTypeEn: "Algorithmic Processing Decision (CRPA art. L311-3-1)",
    descriptionAr: "قرار فردي صادر كلياً أو جزئياً عن معالجة آلية للبيانات وفق CRPA L311-3-1 وقانون الجمهورية الرقمية",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "high",
    applicableLaws: [CRPA, LOI_NUMERIQUE, RGPD, LOIN_78],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_algo_decision_type",
        dimensionTag: "algorithmicWeight",
        questionAr: "ما نوع القرار الصادر عن الخوارزمية؟",
        questionEn: "What type of decision is being made by the algorithm?",
        answerType: "chips",
        options: [
          { value: "admission_ecole", labelAr: "قبول في مؤسسة تعليمية (كـParcoursup)", labelEn: "Educational institution admission (e.g. Parcoursup)" },
          { value: "social_benefit", labelAr: "تحديد الأهلية للمساعدة الاجتماعية", labelEn: "Social benefit eligibility determination" },
          { value: "tax_assessment", labelAr: "تقدير ضريبي آلي", labelEn: "Automated tax assessment" },
          { value: "other_admin", labelAr: "قرار إداري آخر بمعالجة آلية", labelEn: "Other administratively automated decision" },
        ],
        required: true,
      },
      {
        id: "fr_algo_human_mandatory",
        dimensionTag: "humanOversight",
        questionAr: "هل يتمتع المعني بالحق في طلب مراجعة بشرية للقرار الآلي؟ (CRPA L311-3-1)",
        questionEn: "Does the affected party have the right to request human review of the automated decision? (CRPA L311-3-1)",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "france",
    domain: "digital",
    decisionTypeAr: "قرار بعد فحص تلقائي للملف (Décision sur examen automatisé de dossier)",
    decisionTypeEn: "Decision After Automated File Review",
    descriptionAr: "قرار إداري يصدر بعد فحص أولي آلي للملف يستكمله مسؤول بشري، وفق RGPD art. 22 وقانون 78-17",
    requiredCompetenceLevel: "any",
    inherentRiskLevel: "medium",
    applicableLaws: [RGPD, LOIN_78, CRPA, LOI_NUMERIQUE],
    interviewTemplate: frenchBaseTemplate([
      {
        id: "fr_auto_review_split",
        dimensionTag: "algorithmicWeight",
        questionAr: "ما النسبة التقريبية لتأثير الفحص الآلي مقارنة بمراجعة الإنسان على القرار النهائي؟",
        questionEn: "What is the approximate split between automated screening and human review in the final decision?",
        answerType: "chips",
        options: [
          { value: "10_90", labelAr: "الفحص الآلي أدوات بحث فقط — القرار بشري 100%", labelEn: "Automated = search tools only — human decision 100%" },
          { value: "50_50", labelAr: "الفحص الآلي يوصي — الإنسان يقرر", labelEn: "Automated recommends — human decides" },
          { value: "80_20", labelAr: "الآلي يحدد المسار والإنسان يوقّع فقط", labelEn: "Automated sets the course — human signs only" },
          { value: "100_0", labelAr: "قرار آلي حصري — يستوجب مراجعة CRPA L311-3-1", labelEn: "Fully automated — triggers CRPA L311-3-1 review" },
        ],
        required: true,
      },
    ]),
  },
];
