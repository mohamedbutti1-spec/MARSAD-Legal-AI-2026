/**
 * UAE Administrative Decision Type seed catalog — Al-Shamsi Theory Phase 1
 * ≥30 decision types across 6 domains, with applicable UAE federal laws
 * and base 12-dimension interview templates.
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

// ─── Shared base questions that appear in many decision types ─────────────────

const jurisdictionQuestions: InterviewQuestionNode[] = [
  {
    id: "authority_source",
    dimensionTag: "jurisdiction",
    questionAr: "ما النص القانوني الذي يمنح الجهة صلاحية إصدار هذا القرار؟",
    questionEn: "What is the legal text granting this authority the power to issue this decision?",
    hintAr: "اذكر رقم القانون أو المرسوم أو اللائحة",
    answerType: "text",
    required: true,
  },
  {
    id: "authority_delegated",
    dimensionTag: "jurisdiction",
    questionAr: "هل الصلاحية مفوَّضة من جهة أعلى؟",
    questionEn: "Is the authority delegated from a higher body?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "delegation_document",
    dimensionTag: "jurisdiction",
    questionAr: "هل وثيقة التفويض سارية وموثقة رسمياً؟",
    questionEn: "Is the delegation document current and formally documented?",
    answerType: "yes-no",
    required: false,
    conditionalOn: { questionId: "authority_delegated", value: "yes" },
  },
];

const formQuestions: InterviewQuestionNode[] = [
  {
    id: "decision_written",
    dimensionTag: "form",
    questionAr: "هل القرار مُحرَّر كتابةً ومُوقَّع من المسؤول المختص؟",
    questionEn: "Is the decision in writing and signed by the competent authority?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "decision_reasoned",
    dimensionTag: "form",
    questionAr: "هل يتضمن القرار تسبيباً قانونياً واضحاً؟",
    questionEn: "Does the decision include clear legal reasoning/motivation?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "notification_method",
    dimensionTag: "form",
    questionAr: "كيف سيُبلَّغ المعني بالقرار؟",
    questionEn: "How will the affected party be notified of the decision?",
    answerType: "chips",
    options: [
      { value: "written_notice", labelAr: "إشعار كتابي رسمي", labelEn: "Formal written notice" },
      { value: "registered_mail", labelAr: "بريد مسجل", labelEn: "Registered mail" },
      { value: "digital_system", labelAr: "نظام رقمي حكومي", labelEn: "Government digital system" },
      { value: "in_person", labelAr: "إشعار شخصي", labelEn: "In-person notification" },
      { value: "not_yet", labelAr: "لم يُحدَّد بعد", labelEn: "Not yet determined" },
    ],
    required: true,
  },
];

const causeQuestions: InterviewQuestionNode[] = [
  {
    id: "factual_basis",
    dimensionTag: "cause",
    questionAr: "ما الواقعة أو الحالة التي أفضت إلى هذا القرار؟",
    questionEn: "What is the factual situation or event that led to this decision?",
    answerType: "text",
    required: true,
  },
  {
    id: "cause_documented",
    dimensionTag: "cause",
    questionAr: "هل السبب موثق بأدلة أو وثائق رسمية؟",
    questionEn: "Is the cause documented with evidence or official records?",
    answerType: "yes-no",
    required: true,
  },
];

const purposeQuestions: InterviewQuestionNode[] = [
  {
    id: "public_interest",
    dimensionTag: "purpose",
    questionAr: "كيف يحقق هذا القرار المصلحة العامة أو الهدف القانوني المحدد؟",
    questionEn: "How does this decision serve the public interest or the stated legal objective?",
    answerType: "text",
    required: true,
  },
];

const humanWillQuestions: InterviewQuestionNode[] = [
  {
    id: "human_decision_maker",
    dimensionTag: "humanWill",
    questionAr: "هل اتخذ القرار إنسان بإرادة حرة ووعي كامل بعواقبه القانونية؟",
    questionEn: "Was the decision made by a human with free will and full awareness of its legal consequences?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "external_pressure",
    dimensionTag: "humanWill",
    questionAr: "هل تعرض صاحب القرار لأي ضغط خارجي غير مشروع أثناء اتخاذه؟",
    questionEn: "Was the decision-maker subject to any unlawful external pressure?",
    answerType: "yes-no",
    required: true,
  },
];

const digitalWillQuestions: InterviewQuestionNode[] = [
  {
    id: "system_assisted",
    dimensionTag: "digitalWillFormation",
    questionAr: "هل استُعين بنظام معلوماتي أو رقمي في صياغة أو توليد هذا القرار؟",
    questionEn: "Was a digital or information system used in drafting or generating this decision?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "system_name",
    dimensionTag: "digitalWillFormation",
    questionAr: "ما اسم النظام أو المنصة المستخدمة؟",
    questionEn: "What is the name of the system or platform used?",
    answerType: "text",
    required: false,
    conditionalOn: { questionId: "system_assisted", value: "yes" },
  },
  {
    id: "system_certified",
    dimensionTag: "digitalWillFormation",
    questionAr: "هل النظام المستخدم معتمد رسمياً من جهة حكومية مختصة؟",
    questionEn: "Is the system officially certified by a competent government authority?",
    answerType: "yes-no",
    required: false,
    conditionalOn: { questionId: "system_assisted", value: "yes" },
  },
];

const algorithmicQuestions: InterviewQuestionNode[] = [
  {
    id: "ai_used",
    dimensionTag: "algorithmicWeight",
    questionAr: "هل استُخدم نظام ذكاء اصطناعي أو خوارزمية في اتخاذ هذا القرار أو التوصية به؟",
    questionEn: "Was an AI system or algorithm used to make or recommend this decision?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "ai_weight",
    dimensionTag: "algorithmicWeight",
    questionAr: "ما مقدار الوزن الذي أعطاه صاحب القرار لتوصية النظام الذكي؟",
    questionEn: "How much weight did the decision-maker give to the AI system's recommendation?",
    answerType: "chips",
    options: [
      { value: "none", labelAr: "لم يؤثر على القرار", labelEn: "No influence" },
      { value: "minor", labelAr: "تأثير ثانوي فقط", labelEn: "Minor influence" },
      { value: "significant", labelAr: "تأثير كبير", labelEn: "Significant influence" },
      { value: "determinative", labelAr: "حاسم ومحدد للقرار", labelEn: "Determinative" },
    ],
    required: false,
    conditionalOn: { questionId: "ai_used", value: "yes" },
  },
  {
    id: "bias_assessment",
    dimensionTag: "algorithmicBias",
    questionAr: "هل أُجريت تقييم للتحيزات المحتملة في النظام الخوارزمي؟",
    questionEn: "Has an assessment of potential biases in the algorithmic system been conducted?",
    answerType: "yes-no",
    required: false,
    conditionalOn: { questionId: "ai_used", value: "yes" },
  },
];

const oversightQuestions: InterviewQuestionNode[] = [
  {
    id: "legal_review",
    dimensionTag: "humanOversight",
    questionAr: "هل راجع مختص قانوني القرار قبل إصداره؟",
    questionEn: "Did a legal specialist review the decision before issuance?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "escalation_available",
    dimensionTag: "humanOversight",
    questionAr: "هل ثمة آلية رسمية للإشراف والرقابة على تنفيذ هذا القرار؟",
    questionEn: "Is there a formal mechanism for oversight and monitoring of this decision's implementation?",
    answerType: "yes-no",
    required: true,
  },
];

const explainabilityQuestions: InterviewQuestionNode[] = [
  {
    id: "explainable_affected",
    dimensionTag: "explainability",
    questionAr: "هل يمكن شرح أسباب القرار للطرف المتأثر بلغة واضحة ومفهومة؟",
    questionEn: "Can the reasons for the decision be explained to the affected party in clear, understandable language?",
    answerType: "yes-no",
    required: true,
  },
];

const judicialReadinessQuestions: InterviewQuestionNode[] = [
  {
    id: "appeal_rights_notified",
    dimensionTag: "judicialReviewReadiness",
    questionAr: "هل سيُبلَّغ المعني بحقوق الطعن والاعتراض وآجالها؟",
    questionEn: "Will the affected party be informed of appeal rights and deadlines?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "documentation_complete",
    dimensionTag: "judicialReviewReadiness",
    questionAr: "هل الملف الكامل للقرار محفوظ ومُعَدّ للإتاحة أمام القضاء إن طُلب؟",
    questionEn: "Is the complete decision file preserved and ready for judicial access if required?",
    answerType: "yes-no",
    required: true,
  },
];

// Helper to build a standard full-dimension template
function fullTemplate(extra: InterviewQuestionNode[] = []): InterviewQuestionNode[] {
  return [
    ...jurisdictionQuestions,
    ...causeQuestions,
    ...formQuestions,
    ...purposeQuestions,
    ...humanWillQuestions,
    ...digitalWillQuestions,
    ...algorithmicQuestions,
    ...explainabilityQuestions,
    ...oversightQuestions,
    ...judicialReadinessQuestions,
    ...extra,
  ];
}

// ─── UAE Applicable Law references ───────────────────────────────────────────

const UAE_ADMIN_PROCEDURES: ApplicableLaw = {
  lawAr: "القانون الاتحادي رقم 11 لسنة 2021 بشأن تنظيم العلاقة بين الجهات الحكومية الاتحادية والمتعاملين",
  lawEn: "Federal Law No. 11 of 2021 on Regulating Relations Between Federal Government Entities and Their Clients",
  referenceNumber: "Federal Law No. 11/2021",
  articles: ["Art. 4 – Right to service", "Art. 14 – Grievances", "Art. 15 – Response deadlines"],
};

const UAE_CIVIL_SERVICE: ApplicableLaw = {
  lawAr: "المرسوم بقانون اتحادي رقم 49 لسنة 2023 في شأن الموارد البشرية في الحكومة الاتحادية",
  lawEn: "Federal Decree-Law No. 49 of 2023 on Human Resources in the Federal Government",
  referenceNumber: "Federal Decree-Law No. 49/2023",
  articles: ["Art. 12 – Appointment", "Art. 43 – Promotion", "Art. 67 – Termination", "Art. 88 – Disciplinary sanctions"],
};

const UAE_LABOUR: ApplicableLaw = {
  lawAr: "المرسوم بقانون اتحادي رقم 33 لسنة 2021 في شأن تنظيم علاقات العمل",
  lawEn: "Federal Decree-Law No. 33 of 2021 Regulating Labour Relations",
  referenceNumber: "Federal Decree-Law No. 33/2021",
  articles: ["Art. 42 – Termination", "Art. 51 – Unlawful termination", "Art. 31 – Disciplinary procedures"],
};

const UAE_COMMERCIAL_TRANSACTIONS: ApplicableLaw = {
  lawAr: "القانون الاتحادي رقم 18 لسنة 1993 بإصدار قانون المعاملات التجارية",
  lawEn: "Federal Law No. 18 of 1993 on Commercial Transactions",
  referenceNumber: "Federal Law No. 18/1993",
};

const UAE_PROCUREMENT: ApplicableLaw = {
  lawAr: "المرسوم بقانون اتحادي رقم 26 لسنة 2021 في شأن المشتريات الحكومية",
  lawEn: "Federal Decree-Law No. 26 of 2021 on Government Procurement",
  referenceNumber: "Federal Decree-Law No. 26/2021",
  articles: ["Art. 8 – Tender award", "Art. 22 – Cancellation", "Art. 31 – Disqualification"],
};

const UAE_LICENSING: ApplicableLaw = {
  lawAr: "القانون الاتحادي رقم 2 لسنة 2015 بشأن الشركات التجارية",
  lawEn: "Federal Law No. 2 of 2015 on Commercial Companies",
  referenceNumber: "Federal Law No. 2/2015",
};

const UAE_ADMIN_PENALTIES: ApplicableLaw = {
  lawAr: "القانون الاتحادي رقم 11 لسنة 1992 بإصدار قانون الإجراءات المدنية",
  lawEn: "Federal Law No. 11 of 1992 on Civil Procedure",
  referenceNumber: "Federal Law No. 11/1992",
};

const UAE_CYBER: ApplicableLaw = {
  lawAr: "المرسوم بقانون اتحادي رقم 34 لسنة 2021 في شأن مكافحة الشائعات والجرائم الإلكترونية",
  lawEn: "Federal Decree-Law No. 34 of 2021 on Combating Rumours and Cybercrimes",
  referenceNumber: "Federal Decree-Law No. 34/2021",
};

const UAE_NATIONALITY: ApplicableLaw = {
  lawAr: "قانون الجنسية الإماراتية والجوازات الاتحادي رقم 17 لسنة 1972",
  lawEn: "Federal Law No. 17 of 1972 on Nationality and Passports",
  referenceNumber: "Federal Law No. 17/1972",
};

const UAE_AI_ETHICS: ApplicableLaw = {
  lawAr: "استراتيجية الإمارات للذكاء الاصطناعي 2031 ودليل أخلاقيات الذكاء الاصطناعي الصادر عن وزارة الذكاء الاصطناعي",
  lawEn: "UAE AI Strategy 2031 and AI Ethics Guidelines issued by the Ministry of AI",
  referenceNumber: "UAE AI Strategy 2031",
};

// ─── SEED DATA — 31 UAE Administrative Decision Types ────────────────────────

export const SEED_DECISION_TYPES: SeedDecisionType[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // DOMAIN 1: PERSONNEL (القرارات الوظيفية)
  // ══════════════════════════════════════════════════════════════════════════

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "تعيين موظف",
    decisionTypeEn: "Employee Appointment",
    descriptionAr: "قرار إداري بتعيين شخص في وظيفة حكومية",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "position_classification",
        dimensionTag: "subjectMatter",
        questionAr: "ما التصنيف الوظيفي للمنصب المراد التعيين فيه؟",
        questionEn: "What is the job classification of the position?",
        answerType: "chips",
        options: [
          { value: "technical", labelAr: "تقني / فني", labelEn: "Technical" },
          { value: "administrative", labelAr: "إداري", labelEn: "Administrative" },
          { value: "leadership", labelAr: "قيادي", labelEn: "Leadership" },
          { value: "specialist", labelAr: "متخصص", labelEn: "Specialist" },
        ],
        required: true,
      },
      {
        id: "emiratisation_check",
        dimensionTag: "subjectMatter",
        questionAr: "هل استُوفيت متطلبات التوطين (نسبة الإماراتيين) قبل هذا التعيين؟",
        questionEn: "Were Emiratisation requirements met before this appointment?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "ترقية موظف",
    decisionTypeEn: "Employee Promotion",
    descriptionAr: "قرار إداري برفع درجة موظف أو منحه لقباً وظيفياً أعلى",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "low",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "performance_basis",
        dimensionTag: "cause",
        questionAr: "ما معيار الأداء أو الإنجاز الذي يُبرر الترقية؟",
        questionEn: "What performance or achievement criterion justifies the promotion?",
        answerType: "text",
        required: true,
      },
      {
        id: "minimum_service",
        dimensionTag: "subjectMatter",
        questionAr: "هل استكمل الموظف المدة الزمنية الدنيا المطلوبة في الدرجة الحالية؟",
        questionEn: "Has the employee completed the minimum required period in the current grade?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "إنهاء خدمة موظف",
    decisionTypeEn: "Employee Service Termination",
    descriptionAr: "قرار إداري بإنهاء خدمة موظف حكومي لأي سبب من الأسباب",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_LABOUR, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "termination_ground",
        dimensionTag: "cause",
        questionAr: "ما أساس إنهاء الخدمة؟",
        questionEn: "What is the ground for termination?",
        answerType: "chips",
        options: [
          { value: "disciplinary", labelAr: "تأديبي (مخالفة)", labelEn: "Disciplinary (violation)" },
          { value: "performance", labelAr: "ضعف الأداء", labelEn: "Poor performance" },
          { value: "restructuring", labelAr: "إعادة هيكلة", labelEn: "Restructuring" },
          { value: "end_of_contract", labelAr: "انتهاء مدة العقد", labelEn: "Contract expiry" },
          { value: "resignation_accepted", labelAr: "قبول استقالة", labelEn: "Accepted resignation" },
        ],
        required: true,
      },
      {
        id: "disciplinary_process",
        dimensionTag: "cause",
        questionAr: "هل استُوفيت إجراءات التأديب الرسمية قبل قرار الإنهاء؟",
        questionEn: "Were formal disciplinary procedures followed before the termination decision?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "entitlements_calculated",
        dimensionTag: "subjectMatter",
        questionAr: "هل حُسبت مستحقات الموظف (مكافأة نهاية الخدمة، الإجازات...) وفق القانون؟",
        questionEn: "Have the employee's entitlements (gratuity, leave, etc.) been calculated per law?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "نقل موظف",
    decisionTypeEn: "Employee Transfer",
    descriptionAr: "قرار إداري بنقل موظف من وحدة تنظيمية أو موقع جغرافي إلى آخر",
    requiredCompetenceLevel: "hr_officer",
    inherentRiskLevel: "low",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "transfer_reason",
        dimensionTag: "cause",
        questionAr: "ما سبب قرار النقل؟",
        questionEn: "What is the reason for the transfer?",
        answerType: "chips",
        options: [
          { value: "operational", labelAr: "احتياجات العمل", labelEn: "Operational needs" },
          { value: "disciplinary", labelAr: "تأديبي", labelEn: "Disciplinary" },
          { value: "employee_request", labelAr: "طلب الموظف", labelEn: "Employee request" },
          { value: "restructuring", labelAr: "إعادة هيكلة", labelEn: "Restructuring" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "إيقاف موظف مؤقتاً عن العمل",
    decisionTypeEn: "Employee Temporary Suspension",
    descriptionAr: "قرار إداري بإيقاف الموظف مؤقتاً عن ممارسة مهامه ريثما تنتهي التحقيقات",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "investigation_initiated",
        dimensionTag: "cause",
        questionAr: "هل فُتح تحقيق رسمي قبل قرار الإيقاف؟",
        questionEn: "Was a formal investigation initiated before the suspension decision?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "suspension_duration",
        dimensionTag: "subjectMatter",
        questionAr: "ما المدة المقررة للإيقاف؟",
        questionEn: "What is the intended duration of the suspension?",
        answerType: "chips",
        options: [
          { value: "up_30", labelAr: "حتى 30 يوماً", labelEn: "Up to 30 days" },
          { value: "30_90", labelAr: "30 – 90 يوماً", labelEn: "30–90 days" },
          { value: "pending_investigation", labelAr: "لحين انتهاء التحقيق", labelEn: "Pending investigation outcome" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "توقيع جزاء تأديبي",
    decisionTypeEn: "Disciplinary Sanction",
    descriptionAr: "قرار إداري بفرض عقوبة تأديبية على موظف ثبت ارتكابه مخالفة",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "violation_established",
        dimensionTag: "cause",
        questionAr: "هل ثُبتت المخالفة بتحقيق رسمي مكتوب؟",
        questionEn: "Was the violation established through a formal written investigation?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "sanction_type",
        dimensionTag: "subjectMatter",
        questionAr: "ما نوع الجزاء التأديبي المقرر؟",
        questionEn: "What type of disciplinary sanction is being imposed?",
        answerType: "chips",
        options: [
          { value: "warning", labelAr: "إنذار كتابي", labelEn: "Written warning" },
          { value: "salary_deduction", labelAr: "خصم من الراتب", labelEn: "Salary deduction" },
          { value: "demotion", labelAr: "خفض الدرجة", labelEn: "Demotion" },
          { value: "dismissal", labelAr: "فصل من الخدمة", labelEn: "Dismissal" },
        ],
        required: true,
      },
      {
        id: "proportionality",
        dimensionTag: "purpose",
        questionAr: "هل الجزاء متناسب مع جسامة المخالفة المرتكبة؟",
        questionEn: "Is the sanction proportionate to the severity of the violation?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "منح إجازة دراسية",
    decisionTypeEn: "Granting Study Leave",
    descriptionAr: "قرار إداري بمنح موظف إجازة دراسية مدفوعة أو غير مدفوعة",
    requiredCompetenceLevel: "hr_officer",
    inherentRiskLevel: "low",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "study_relevance",
        dimensionTag: "purpose",
        questionAr: "هل البرنامج الدراسي ذو صلة بالعمل الحكومي للموظف؟",
        questionEn: "Is the study programme relevant to the employee's government work?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "personnel",
    decisionTypeAr: "قبول الاستقالة",
    decisionTypeEn: "Acceptance of Resignation",
    descriptionAr: "قرار إداري بقبول طلب استقالة موظف حكومي",
    requiredCompetenceLevel: "hr_officer",
    inherentRiskLevel: "low",
    applicableLaws: [UAE_CIVIL_SERVICE, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "notice_period",
        dimensionTag: "subjectMatter",
        questionAr: "هل قدّم الموظف الاستقالة مع مراعاة مهلة الإشعار القانونية؟",
        questionEn: "Did the employee submit the resignation with the required legal notice period?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "outstanding_obligations",
        dimensionTag: "cause",
        questionAr: "هل ثمة التزامات مالية أو عقدية معلقة على الموظف تجاه الجهة؟",
        questionEn: "Are there outstanding financial or contractual obligations from the employee?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMAIN 2: REGULATORY (القرارات التنظيمية)
  // ══════════════════════════════════════════════════════════════════════════

  {
    jurisdiction: "uae",
    domain: "regulatory",
    decisionTypeAr: "منح ترخيص نشاط تجاري",
    decisionTypeEn: "Business License Grant",
    descriptionAr: "قرار إداري بإصدار ترخيص تجاري لممارسة نشاط اقتصادي",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_LICENSING, UAE_ADMIN_PROCEDURES, UAE_COMMERCIAL_TRANSACTIONS],
    interviewTemplate: fullTemplate([
      {
        id: "activity_category",
        dimensionTag: "subjectMatter",
        questionAr: "ما فئة النشاط التجاري المرخص له؟",
        questionEn: "What is the category of the licensed commercial activity?",
        answerType: "chips",
        options: [
          { value: "commercial", labelAr: "تجاري", labelEn: "Commercial" },
          { value: "industrial", labelAr: "صناعي", labelEn: "Industrial" },
          { value: "professional", labelAr: "مهني", labelEn: "Professional" },
          { value: "tourism", labelAr: "سياحي", labelEn: "Tourism" },
        ],
        required: true,
      },
      {
        id: "requirements_met",
        dimensionTag: "cause",
        questionAr: "هل استُوفيت جميع الشروط المحددة في اللوائح للنشاط المطلوب؟",
        questionEn: "Have all regulatory requirements for the requested activity been met?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "regulatory",
    decisionTypeAr: "تعليق ترخيص",
    decisionTypeEn: "License Suspension",
    descriptionAr: "قرار إداري بتعليق ترخيص تجاري أو مهني مؤقتاً",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_LICENSING, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "violation_type",
        dimensionTag: "cause",
        questionAr: "ما طبيعة المخالفة التي أدت إلى قرار التعليق؟",
        questionEn: "What is the nature of the violation that led to the suspension?",
        answerType: "text",
        required: true,
      },
      {
        id: "prior_warning",
        dimensionTag: "cause",
        questionAr: "هل صدر إنذار رسمي للجهة قبل قرار التعليق؟",
        questionEn: "Was a formal warning issued to the entity before the suspension decision?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "regulatory",
    decisionTypeAr: "سحب ترخيص",
    decisionTypeEn: "License Revocation",
    descriptionAr: "قرار إداري بسحب ترخيص تجاري أو مهني بصفة نهائية",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "critical",
    applicableLaws: [UAE_LICENSING, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "grounds_revocation",
        dimensionTag: "cause",
        questionAr: "ما الأسباب القانونية المحددة لسحب الترخيص؟",
        questionEn: "What are the specific legal grounds for license revocation?",
        answerType: "text",
        required: true,
      },
      {
        id: "hearing_conducted",
        dimensionTag: "humanWill",
        questionAr: "هل أُتيح للطرف المتأثر فرصة الدفاع عن نفسه قبل قرار السحب؟",
        questionEn: "Was the affected party given an opportunity to be heard before revocation?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "regulatory",
    decisionTypeAr: "فرض غرامة إدارية",
    decisionTypeEn: "Administrative Fine",
    descriptionAr: "قرار إداري بفرض غرامة مالية على شخص طبيعي أو اعتباري",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_ADMIN_PENALTIES, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "fine_amount",
        dimensionTag: "subjectMatter",
        questionAr: "ما مبلغ الغرامة الإدارية المقرر فرضه؟ (درهم إماراتي)",
        questionEn: "What is the administrative fine amount? (AED)",
        answerType: "number",
        unit: "AED",
        placeholder: "10000",
        required: true,
      },
      {
        id: "legal_ceiling",
        dimensionTag: "jurisdiction",
        questionAr: "هل مبلغ الغرامة ضمن الحد الأقصى المقرر قانوناً؟",
        questionEn: "Is the fine amount within the legally prescribed maximum?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "regulatory",
    decisionTypeAr: "إصدار أمر إداري",
    decisionTypeEn: "Administrative Order",
    descriptionAr: "قرار إداري يُلزم شخصاً أو جهة بفعل أو الامتناع عن فعل",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_ADMIN_PROCEDURES, UAE_ADMIN_PENALTIES],
    interviewTemplate: fullTemplate([
      {
        id: "order_content",
        dimensionTag: "subjectMatter",
        questionAr: "ما الفعل أو الامتناع الذي يُلزم به الأمر الإداري؟",
        questionEn: "What action or abstention does the administrative order require?",
        answerType: "text",
        required: true,
      },
      {
        id: "compliance_deadline",
        dimensionTag: "subjectMatter",
        questionAr: "ما الأجل الممنوح للامتثال للأمر الإداري؟",
        questionEn: "What is the deadline for compliance with the administrative order?",
        answerType: "text",
        placeholder: "مثال: 30 يوماً من تاريخ الإشعار",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "regulatory",
    decisionTypeAr: "منح تصريح بناء",
    decisionTypeEn: "Building Permit Grant",
    descriptionAr: "قرار إداري بمنح تصريح للبناء أو التعديل على منشأة قائمة",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "plot_approved",
        dimensionTag: "cause",
        questionAr: "هل الأرض أو المبنى مُدرج في خريطة التخطيط الحضري المعتمدة؟",
        questionEn: "Is the land or building included in the approved urban planning map?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "technical_review",
        dimensionTag: "humanOversight",
        questionAr: "هل راجع مهندس مختص المخططات الهندسية وأقرّها؟",
        questionEn: "Did a qualified engineer review and approve the engineering drawings?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "regulatory",
    decisionTypeAr: "سحب تصريح",
    decisionTypeEn: "Permit Revocation",
    descriptionAr: "قرار إداري بسحب تصريح ممنوح سابقاً (بناء، تشغيل، استيراد...إلخ)",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "revocation_reason",
        dimensionTag: "cause",
        questionAr: "ما الأسباب الموجبة لسحب التصريح؟",
        questionEn: "What are the grounds for revoking the permit?",
        answerType: "text",
        required: true,
      },
    ]),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMAIN 3: PROCUREMENT (قرارات المشتريات)
  // ══════════════════════════════════════════════════════════════════════════

  {
    jurisdiction: "uae",
    domain: "procurement",
    decisionTypeAr: "إرساء عطاء حكومي",
    decisionTypeEn: "Government Tender Award",
    descriptionAr: "قرار إداري بإرساء عقد توريد أو خدمات على مزوّد معين",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_PROCUREMENT, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "tender_published",
        dimensionTag: "form",
        questionAr: "هل أُعلن عن العطاء وفق إجراءات المشتريات الحكومية المعتمدة؟",
        questionEn: "Was the tender advertised per the approved government procurement procedures?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "evaluation_committee",
        dimensionTag: "humanOversight",
        questionAr: "هل قيّمت العروض لجنة مشكَّلة وفق اللوائح؟",
        questionEn: "Did a duly constituted committee evaluate the bids?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "lowest_price_or_best_value",
        dimensionTag: "purpose",
        questionAr: "هل يستند إرساء العطاء إلى أفضل قيمة وليس فقط أدنى سعر؟",
        questionEn: "Is the award based on best value, not merely the lowest price?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "procurement",
    decisionTypeAr: "إلغاء عطاء حكومي",
    decisionTypeEn: "Government Tender Cancellation",
    descriptionAr: "قرار إداري بإلغاء إجراءات عطاء قبل الإرساء",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_PROCUREMENT, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "cancellation_reason",
        dimensionTag: "cause",
        questionAr: "ما مبررات إلغاء العطاء؟",
        questionEn: "What are the justifications for cancelling the tender?",
        answerType: "chips",
        options: [
          { value: "no_adequate_bids", labelAr: "عدم وجود عروض مناسبة", labelEn: "No adequate bids received" },
          { value: "changed_requirements", labelAr: "تغيير متطلبات المشروع", labelEn: "Changed project requirements" },
          { value: "budget_constraints", labelAr: "قيود ميزانية", labelEn: "Budget constraints" },
          { value: "procedural_error", labelAr: "خطأ إجرائي في إعلان العطاء", labelEn: "Procedural error in tender announcement" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "procurement",
    decisionTypeAr: "استبعاد عرض من العطاء",
    decisionTypeEn: "Bid Disqualification",
    descriptionAr: "قرار إداري باستبعاد عرض مزوّد من منافسة العطاء",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_PROCUREMENT, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "disqualification_ground",
        dimensionTag: "cause",
        questionAr: "ما أساس استبعاد العرض؟",
        questionEn: "What is the basis for the bid disqualification?",
        answerType: "chips",
        options: [
          { value: "incomplete_docs", labelAr: "وثائق ناقصة", labelEn: "Incomplete documentation" },
          { value: "non_compliant_specs", labelAr: "عدم مطابقة المواصفات", labelEn: "Non-compliant with specifications" },
          { value: "late_submission", labelAr: "تقديم متأخر", labelEn: "Late submission" },
          { value: "conflict_of_interest", labelAr: "تعارض مصالح", labelEn: "Conflict of interest" },
        ],
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "procurement",
    decisionTypeAr: "تجديد عقد حكومي",
    decisionTypeEn: "Government Contract Renewal",
    descriptionAr: "قرار إداري بتجديد عقد حكومي قائم لفترة إضافية",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_PROCUREMENT, UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "performance_satisfactory",
        dimensionTag: "cause",
        questionAr: "هل أثبت المزود أداءً مُرضياً خلال مدة العقد الحالية؟",
        questionEn: "Has the vendor demonstrated satisfactory performance during the current contract period?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "renewal_clauses",
        dimensionTag: "form",
        questionAr: "هل يتضمن العقد الأصلي بنداً صريحاً يجيز التجديد؟",
        questionEn: "Does the original contract contain an explicit renewal clause?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMAIN 4: APPEALS & RECONSIDERATION (قرارات التظلم وإعادة النظر)
  // ══════════════════════════════════════════════════════════════════════════

  {
    jurisdiction: "uae",
    domain: "appeals",
    decisionTypeAr: "رفض تظلم إداري",
    decisionTypeEn: "Rejection of Administrative Grievance",
    descriptionAr: "قرار إداري برفض تظلم مقدم من مواطن أو موظف ضد قرار سابق",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "grievance_examined",
        dimensionTag: "cause",
        questionAr: "هل دُرس التظلم فعلياً ولم يُرفض شكلياً دون نظر في موضوعه؟",
        questionEn: "Was the grievance substantively examined and not merely dismissed on formal grounds?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "rejection_reasoned",
        dimensionTag: "form",
        questionAr: "هل يتضمن قرار الرفض تسبيباً وافياً يُبين وجه الحق في الرفض؟",
        questionEn: "Does the rejection decision include sufficient reasoning explaining the basis for rejection?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "appeals",
    decisionTypeAr: "قبول تظلم وإلغاء القرار المطعون فيه",
    decisionTypeEn: "Grievance Accepted — Annulling Prior Decision",
    descriptionAr: "قرار إداري بقبول تظلم وإلغاء القرار الأصلي أو تعديله",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "original_decision_flaw",
        dimensionTag: "cause",
        questionAr: "ما العيب القانوني أو الإجرائي في القرار الأصلي الذي يبرر إلغاءه؟",
        questionEn: "What legal or procedural flaw in the original decision justifies its annulment?",
        answerType: "text",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "appeals",
    decisionTypeAr: "إعادة النظر في قرار إداري",
    decisionTypeEn: "Administrative Decision Reconsideration",
    descriptionAr: "مراجعة قرار إداري نافذ بناء على معطيات جديدة أو طعن مشروع",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "new_facts",
        dimensionTag: "cause",
        questionAr: "هل ظهرت وقائع أو أدلة جديدة لم تكن موجودة عند صدور القرار الأصلي؟",
        questionEn: "Have new facts or evidence emerged that were not available when the original decision was made?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "reconsideration_deadline",
        dimensionTag: "judicialReviewReadiness",
        questionAr: "هل طلب إعادة النظر ضمن الأجل القانوني المحدد؟",
        questionEn: "Is the reconsideration request within the legally prescribed deadline?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMAIN 5: CITIZEN-FACING (القرارات المواجهة للمواطن)
  // ══════════════════════════════════════════════════════════════════════════

  {
    jurisdiction: "uae",
    domain: "citizen",
    decisionTypeAr: "منح إعانة اجتماعية",
    decisionTypeEn: "Social Benefit Grant",
    descriptionAr: "قرار إداري بمنح مواطن أو مقيم دعماً أو إعانة اجتماعية",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "low",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "eligibility_verified",
        dimensionTag: "cause",
        questionAr: "هل تحقق الموظف المختص من استيفاء المتقدم لشروط الاستحقاق؟",
        questionEn: "Did the competent officer verify the applicant meets all eligibility criteria?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "citizen",
    decisionTypeAr: "رفض طلب إعانة اجتماعية",
    decisionTypeEn: "Social Benefit Application Rejection",
    descriptionAr: "قرار إداري برفض طلب الحصول على إعانة أو دعم اجتماعي",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "rejection_criteria",
        dimensionTag: "cause",
        questionAr: "ما معيار عدم الاستحقاق الذي يُبرر الرفض؟",
        questionEn: "What ineligibility criterion justifies the rejection?",
        answerType: "text",
        required: true,
      },
      {
        id: "reapplication_info",
        dimensionTag: "explainability",
        questionAr: "هل سيُبلَّغ المتقدم بالأسباب وبحقه في إعادة التقديم أو الطعن؟",
        questionEn: "Will the applicant be informed of reasons and the right to reapply or appeal?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "citizen",
    decisionTypeAr: "تعليق خدمة حكومية",
    decisionTypeEn: "Government Service Suspension",
    descriptionAr: "قرار إداري بتعليق تقديم خدمة حكومية معينة لشخص",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "service_type",
        dimensionTag: "subjectMatter",
        questionAr: "ما الخدمة الحكومية المراد تعليقها؟",
        questionEn: "What government service is being suspended?",
        answerType: "text",
        required: true,
      },
      {
        id: "suspension_ground",
        dimensionTag: "cause",
        questionAr: "ما الأساس القانوني الذي يجيز تعليق هذه الخدمة؟",
        questionEn: "What is the legal basis allowing suspension of this service?",
        answerType: "text",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "citizen",
    decisionTypeAr: "الحرمان من خدمة حكومية",
    decisionTypeEn: "Government Service Denial",
    descriptionAr: "قرار إداري نهائي بحرمان شخص من الحصول على خدمة حكومية",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "critical",
    applicableLaws: [UAE_ADMIN_PROCEDURES],
    interviewTemplate: fullTemplate([
      {
        id: "denial_basis",
        dimensionTag: "cause",
        questionAr: "ما النص القانوني الصريح الذي يُجيز الحرمان من هذه الخدمة؟",
        questionEn: "What explicit legal provision permits denial of this service?",
        answerType: "text",
        required: true,
      },
      {
        id: "proportionality_denial",
        dimensionTag: "purpose",
        questionAr: "هل الحرمان النهائي متناسب مع الفعل أو الإخلال المنسوب؟",
        questionEn: "Is the permanent denial proportionate to the attributed act or failure?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "citizen",
    decisionTypeAr: "رفض طلب إقامة أو تأشيرة",
    decisionTypeEn: "Residency or Visa Application Rejection",
    descriptionAr: "قرار إداري برفض طلب الحصول على إقامة أو تأشيرة دخول",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_ADMIN_PROCEDURES, UAE_NATIONALITY],
    interviewTemplate: fullTemplate([
      {
        id: "rejection_category",
        dimensionTag: "cause",
        questionAr: "ما فئة الرفض؟",
        questionEn: "What is the category of rejection?",
        answerType: "chips",
        options: [
          { value: "security", labelAr: "أسباب أمنية", labelEn: "Security grounds" },
          { value: "ineligibility", labelAr: "عدم استيفاء الشروط", labelEn: "Eligibility not met" },
          { value: "incomplete_docs", labelAr: "نقص في الوثائق", labelEn: "Incomplete documentation" },
          { value: "quota", labelAr: "استيفاء الحصص", labelEn: "Quota reached" },
        ],
        required: true,
      },
    ]),
  },

  // ══════════════════════════════════════════════════════════════════════════
  // DOMAIN 6: DIGITAL / ALGORITHMIC (القرارات الرقمية والخوارزمية)
  // ══════════════════════════════════════════════════════════════════════════

  {
    jurisdiction: "uae",
    domain: "digital",
    decisionTypeAr: "قرار صادر عن نظام حكومي آلي",
    decisionTypeEn: "Automated Government System Decision",
    descriptionAr: "قرار إداري صدر آلياً بالكامل عن نظام معلوماتي حكومي دون تدخل بشري مباشر",
    requiredCompetenceLevel: "director_general",
    inherentRiskLevel: "critical",
    applicableLaws: [UAE_ADMIN_PROCEDURES, UAE_AI_ETHICS],
    interviewTemplate: fullTemplate([
      {
        id: "system_legal_basis",
        dimensionTag: "jurisdiction",
        questionAr: "ما النص القانوني الذي يُجيز صدور هذا النوع من القرارات آلياً دون توقيع بشري؟",
        questionEn: "What legal provision permits this type of decision to be issued automatically without human signature?",
        answerType: "text",
        required: true,
      },
      {
        id: "human_review_available",
        dimensionTag: "humanOversight",
        questionAr: "هل يحق للمتأثر طلب مراجعة بشرية للقرار الآلي؟",
        questionEn: "Does the affected party have the right to request human review of the automated decision?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "algorithm_audited",
        dimensionTag: "algorithmicBias",
        questionAr: "هل خضع الخوارزمية المُصدِرة للقرار لتدقيق مستقل لضمان خلوها من التحيز؟",
        questionEn: "Has the algorithm issuing the decision been independently audited for bias?",
        answerType: "yes-no",
        required: true,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "digital",
    decisionTypeAr: "قرار مدعوم بالذكاء الاصطناعي",
    decisionTypeEn: "AI-Assisted Administrative Decision",
    descriptionAr: "قرار إداري استُعين في إعداده أو التوصية به بنظام ذكاء اصطناعي مع احتفاظ الإنسان بقرار الإصدار",
    requiredCompetenceLevel: "department_head",
    inherentRiskLevel: "high",
    applicableLaws: [UAE_ADMIN_PROCEDURES, UAE_AI_ETHICS],
    interviewTemplate: fullTemplate([
      {
        id: "ai_recommendation_documented",
        dimensionTag: "digitalWillFormation",
        questionAr: "هل وُثِّقت توصية نظام الذكاء الاصطناعي في ملف القرار؟",
        questionEn: "Is the AI system's recommendation documented in the decision file?",
        answerType: "yes-no",
        required: true,
      },
      {
        id: "human_override_documented",
        dimensionTag: "humanWill",
        questionAr: "إذا خالف صاحب القرار توصية النظام، هل وُثِّق سبب ذلك؟",
        questionEn: "If the decision-maker overrode the AI recommendation, was the reason documented?",
        answerType: "yes-no",
        required: false,
      },
    ]),
  },

  {
    jurisdiction: "uae",
    domain: "digital",
    decisionTypeAr: "تصنيف آلي لطلب حكومي",
    decisionTypeEn: "Automated Government Request Classification",
    descriptionAr: "تصنيف طلب مواطن أو مزوّد خدمات آلياً بواسطة نظام رقمي يحدد مساره ومعالجته",
    requiredCompetenceLevel: "any",
    inherentRiskLevel: "medium",
    applicableLaws: [UAE_ADMIN_PROCEDURES, UAE_AI_ETHICS],
    interviewTemplate: fullTemplate([
      {
        id: "classification_impact",
        dimensionTag: "subjectMatter",
        questionAr: "ما الأثر الفعلي للتصنيف الآلي على الطرف المتأثر؟",
        questionEn: "What is the actual impact of the automated classification on the affected party?",
        answerType: "chips",
        options: [
          { value: "routing_only", labelAr: "توجيه الطلب فقط دون أثر حقوقي", labelEn: "Routing only, no rights impact" },
          { value: "priority_queue", labelAr: "تحديد أولوية المعالجة", labelEn: "Processing priority determination" },
          { value: "eligibility_screen", labelAr: "تحديد مبدئي للأهلية", labelEn: "Preliminary eligibility screening" },
          { value: "final_determination", labelAr: "تحديد نهائي للحق", labelEn: "Final rights determination" },
        ],
        required: true,
      },
    ]),
  },
];
