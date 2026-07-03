/**
 * Al-Shamsi 7 Role Definitions — UAE Administrative Decision OS, Phase 2
 *
 * Each role carries:
 *  - competenceCeiling: highest decision level the role can issue/act upon
 *  - permittedDomains: domains where the role is a primary actor
 *  - actionCapabilities: can_issue / can_review / can_challenge flags
 *  - interviewModifiers: prepend/append/override/remove question nodes
 *  - legalBasisAr/En: statutory grounding for the role's authority
 *
 * UAE Legal References:
 *  - Federal Decree-Law 49/2023 — Civil Service Law
 *  - Federal Law 11/2021 — Administrative Procedures Law
 *  - Federal Law 3/1983 — Federal Supreme Court (as amended)
 *  - Federal Decree-Law 34/2021 — Combating Rumours and Cybercrime
 *  - Cabinet Decision 1/2021 — Executive Regulations of Administrative Procedures
 */

import type { InterviewQuestionNode, InterviewModifiers, RoleActionCapabilities, JurisdictionScopeEntry } from "@workspace/db";

export interface SeedRole {
  roleKey: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  competenceCeiling: string;
  permittedDomains: string[];
  actionCapabilities: RoleActionCapabilities;
  jurisdictionScope: Record<string, JurisdictionScopeEntry>;
  preferredLanguage: string;
  interviewModifiers: InterviewModifiers;
  legalBasisAr: string;
  legalBasisEn: string;
}

// ─── Shared modifier question blocks ───────────────────────────────────────────

/** Citizen-specific prepend: what decision was issued against you */
const citizenPrependQuestions: InterviewQuestionNode[] = [
  {
    id: "citizen_decision_received",
    dimensionTag: "jurisdiction",
    questionAr: "ما القرار الإداري الصادر بحقك؟",
    questionEn: "What administrative decision was issued against you?",
    hintAr: "صِف القرار بإيجاز (مثال: فُصلت من العمل، رُفض طلب تجديد إقامتي...)",
    answerType: "text",
    required: true,
  },
  {
    id: "citizen_notification_date",
    dimensionTag: "form",
    questionAr: "متى أُبلِغت بهذا القرار؟",
    questionEn: "When were you notified of this decision?",
    answerType: "date",
    required: true,
  },
  {
    id: "citizen_issuing_authority",
    dimensionTag: "jurisdiction",
    questionAr: "أي جهة حكومية أصدرت القرار؟",
    questionEn: "Which government authority issued the decision?",
    hintAr: "مثال: وزارة الموارد البشرية، بلدية دبي...",
    answerType: "text",
    required: true,
  },
  {
    id: "citizen_impact",
    dimensionTag: "purpose",
    questionAr: "كيف أثّر هذا القرار عليك؟",
    questionEn: "How has this decision affected you?",
    answerType: "chips",
    options: [
      { value: "job_loss",   labelAr: "فقدان الوظيفة",     labelEn: "Job loss" },
      { value: "financial",  labelAr: "خسارة مالية",        labelEn: "Financial loss" },
      { value: "residency",  labelAr: "مشكلة إقامة أو تأشيرة", labelEn: "Residency / visa issue" },
      { value: "service",    labelAr: "حرمان من خدمة حكومية", labelEn: "Denial of government service" },
      { value: "reputation", labelAr: "ضرر بالسمعة",        labelEn: "Reputational harm" },
      { value: "other",      labelAr: "أخرى",                labelEn: "Other" },
    ],
    required: true,
  },
  {
    id: "citizen_already_appealed",
    dimensionTag: "judicialReviewReadiness",
    questionAr: "هل تظلّمت من هذا القرار مسبقاً لدى نفس الجهة؟",
    questionEn: "Have you already filed a grievance about this decision with the same authority?",
    answerType: "yes-no",
    required: true,
  },
];

/** Administrative court prepend: judicial review framing */
const courtPrependQuestions: InterviewQuestionNode[] = [
  {
    id: "court_case_type",
    dimensionTag: "judicialReviewReadiness",
    questionAr: "ما طبيعة الطعن القضائي المنظور أمام المحكمة؟",
    questionEn: "What is the nature of the judicial challenge before the court?",
    answerType: "chips",
    options: [
      { value: "annulment",    labelAr: "طعن بالإلغاء",          labelEn: "Annulment action" },
      { value: "compensation", labelAr: "دعوى تعويض",            labelEn: "Compensation claim" },
      { value: "both",         labelAr: "إلغاء وتعويض معاً",    labelEn: "Annulment + compensation" },
      { value: "injunction",   labelAr: "طلب وقف تنفيذ مستعجل", labelEn: "Interim injunction" },
    ],
    required: true,
  },
  {
    id: "court_filing_deadline",
    dimensionTag: "judicialReviewReadiness",
    questionAr: "هل رُفعت الدعوى ضمن المهلة القانونية (60 يوماً من التبليغ)؟",
    questionEn: "Was the lawsuit filed within the legal deadline (60 days from notification)?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "court_admin_exhaustion",
    dimensionTag: "judicialReviewReadiness",
    questionAr: "هل استُنفدت طرق التظلم الإداري قبل رفع الدعوى؟",
    questionEn: "Were administrative grievance channels exhausted before filing the lawsuit?",
    answerType: "yes-no",
    required: true,
  },
];

/** Legal department prepend: review scope framing */
const legalDeptPrependQuestions: InterviewQuestionNode[] = [
  {
    id: "legal_review_scope",
    dimensionTag: "jurisdiction",
    questionAr: "ما نطاق المراجعة القانونية المطلوبة؟",
    questionEn: "What is the scope of the legal review requested?",
    answerType: "chips",
    options: [
      { value: "pre_issuance",  labelAr: "مراجعة قبل الإصدار (رأي قانوني)",  labelEn: "Pre-issuance review (legal opinion)" },
      { value: "post_issuance", labelAr: "مراجعة بعد الإصدار (تدقيق شرعي)",  labelEn: "Post-issuance compliance audit" },
      { value: "litigation_prep", labelAr: "تحضير للتقاضي",                  labelEn: "Litigation preparation" },
    ],
    required: true,
  },
  {
    id: "legal_precedent_available",
    dimensionTag: "judicialReviewReadiness",
    questionAr: "هل هناك سوابق قضائية إدارية ذات صلة بهذا النوع من القرارات؟",
    questionEn: "Are there relevant administrative court precedents for this type of decision?",
    answerType: "yes-no",
    required: false,
  },
];

/** Minister-specific authority questions */
const ministerPrependQuestions: InterviewQuestionNode[] = [
  {
    id: "minister_legal_mandate",
    dimensionTag: "jurisdiction",
    questionAr: "ما المرسوم الوزاري أو القانون الاتحادي الذي يمنح الوزارة صلاحية إصدار هذا القرار؟",
    questionEn: "What ministerial decree or federal law grants the ministry the authority for this decision?",
    hintAr: "مثال: المرسوم بقانون اتحادي رقم 49 لسنة 2023 في شأن الموارد البشرية",
    answerType: "text",
    required: true,
  },
  {
    id: "minister_delegated_signing",
    dimensionTag: "jurisdiction",
    questionAr: "هل القرار موقَّع من الوزير شخصياً أم من مفوَّض بالتوقيع؟",
    questionEn: "Is the decision signed by the Minister personally or a delegated signatory?",
    answerType: "chips",
    options: [
      { value: "minister_direct", labelAr: "الوزير شخصياً",    labelEn: "Minister directly" },
      { value: "undersecretary",  labelAr: "وكيل الوزارة",      labelEn: "Undersecretary" },
      { value: "delegated",       labelAr: "مفوَّض بالتوقيع",   labelEn: "Delegated signatory" },
    ],
    required: true,
  },
];

/** HR-specific questions */
const hrPrependQuestions: InterviewQuestionNode[] = [
  {
    id: "hr_civil_service_article",
    dimensionTag: "jurisdiction",
    questionAr: "ما المادة المحددة في قانون الخدمة المدنية (المرسوم بقانون اتحادي رقم 49/2023) التي تستند إليها؟",
    questionEn: "What specific article of the Civil Service Law (Federal Decree-Law 49/2023) does this decision rely on?",
    answerType: "text",
    required: true,
  },
  {
    id: "hr_committee_approval",
    dimensionTag: "form",
    questionAr: "هل اعتمدت لجنة شؤون الموظفين أو ما يعادلها هذا القرار؟",
    questionEn: "Has the Staff Affairs Committee (or equivalent) approved this decision?",
    answerType: "yes-no",
    required: true,
  },
  {
    id: "hr_employee_heard",
    dimensionTag: "humanWill",
    questionAr: "هل أُتيحت للموظف فرصة الاستماع إليه قبل إصدار القرار؟",
    questionEn: "Was the employee given an opportunity to be heard before the decision was issued?",
    answerType: "yes-no",
    required: true,
  },
];

/** Director General authority framing */
const dgPrependQuestions: InterviewQuestionNode[] = [
  {
    id: "dg_entity_founding_law",
    dimensionTag: "jurisdiction",
    questionAr: "ما قانون أو مرسوم تأسيس الجهة الحكومية الذي يخوّل المدير العام إصدار هذا القرار؟",
    questionEn: "What is the founding law or decree of the government entity authorising the Director General to issue this decision?",
    answerType: "text",
    required: true,
  },
  {
    id: "dg_within_strategic_plan",
    dimensionTag: "purpose",
    questionAr: "هل القرار يندرج ضمن الخطة الاستراتيجية المعتمدة للجهة؟",
    questionEn: "Does this decision fall within the entity's approved strategic plan?",
    answerType: "yes-no",
    required: false,
  },
];

// ─── 7 Role Definitions ─────────────────────────────────────────────────────────

export const SEED_ROLES: SeedRole[] = [
  // ════════════════════════════════════════════════════
  // 1. Government Official — مسؤول حكومي
  // ════════════════════════════════════════════════════
  {
    roleKey: "government_official",
    titleAr: "مسؤول حكومي",
    titleEn: "Government Official",
    descriptionAr: "موظف حكومي يتمتع بصلاحية إصدار قرارات إدارية في حدود اختصاصه على مستوى الدائرة أو القسم",
    descriptionEn: "A government employee holding authority to issue administrative decisions within their department or division competence",
    competenceCeiling: "department_head",
    permittedDomains: ["personnel", "citizen", "regulatory"],
    actionCapabilities: { canIssue: true, canReview: true, canChallenge: false },
    jurisdictionScope: {
      uae: {
        federalAuthority: true,
        emirateAuthority: true,
        legalBasis: "المرسوم بقانون اتحادي رقم 49 لسنة 2023 في شأن الموارد البشرية في الحكومة الاتحادية",
      },
    },
    preferredLanguage: "ar",
    interviewModifiers: {
      prependQuestions: [
        {
          id: "official_delegated_authority",
          dimensionTag: "jurisdiction",
          questionAr: "هل تملك تفويضاً كتابياً صريحاً بإصدار هذا النوع من القرارات على مستوى دائرتك؟",
          questionEn: "Do you hold explicit written delegation of authority to issue this type of decision at your department level?",
          answerType: "yes-no" as const,
          required: true,
        },
        {
          id: "official_scope_check",
          dimensionTag: "jurisdiction",
          questionAr: "هل يقع موضوع القرار ضمن نطاق اختصاص دائرتك أو قسمك التنظيمي المحدد في الهيكل التنظيمي الرسمي؟",
          questionEn: "Does the subject of this decision fall within your department's or division's scope as defined in the official organisational structure?",
          answerType: "yes-no" as const,
          required: true,
        },
      ],
      appendQuestions: [
        {
          id: "official_supervisor_clearance",
          dimensionTag: "humanOversight",
          questionAr: "هل تمت مراجعة القرار مع رئيسك المباشر أو المدير العام قبل إصداره، إن كانت درجة الخطورة متوسطة أو عالية؟",
          questionEn: "Was the decision reviewed with your direct supervisor or Director General before issuance, if risk level is medium or high?",
          answerType: "yes-no" as const,
          required: false,
        },
      ],
      overrides: [],
      removeQuestions: [],
    },
    legalBasisAr: "المرسوم بقانون اتحادي رقم 49 لسنة 2023 في شأن الموارد البشرية — يُحدد صلاحيات رؤساء الأقسام والدوائر في إصدار القرارات الإدارية في حدود الاختصاص الوظيفي",
    legalBasisEn: "Federal Decree-Law No. 49 of 2023 on Human Resources — defines the authority of department heads and division chiefs to issue administrative decisions within their functional competence",
  },

  // ════════════════════════════════════════════════════
  // 2. Minister — وزير
  // ════════════════════════════════════════════════════
  {
    roleKey: "minister",
    titleAr: "وزير",
    titleEn: "Minister",
    descriptionAr: "وزير في الحكومة الاتحادية يملك صلاحيات وزارية شاملة لإصدار القرارات والمراسيم الوزارية",
    descriptionEn: "A federal government minister holding comprehensive ministerial authority to issue ministerial decisions and decrees",
    competenceCeiling: "ministerial",
    permittedDomains: ["all"],
    actionCapabilities: { canIssue: true, canReview: true, canChallenge: false },
    jurisdictionScope: {
      uae: {
        federalAuthority: true,
        emirateAuthority: false,
        legalBasis: "الدستور الاتحادي لدولة الإمارات العربية المتحدة والقانون الاتحادي رقم 1 لسنة 1972 في شأن اختصاصات الوزارات",
      },
    },
    preferredLanguage: "ar",
    interviewModifiers: {
      prependQuestions: ministerPrependQuestions,
      appendQuestions: [],
      overrides: [
        {
          questionId: "authority_source",
          questionAr: "ما نص المادة القانونية في القانون المنشئ للوزارة أو المرسوم الاتحادي الذي يمنح الوزير صلاحية هذا القرار بالذات؟",
          questionEn: "What specific article in the ministry's founding law or federal decree grants the Minister authority for this exact decision?",
        },
      ],
      removeQuestions: [],
    },
    legalBasisAr: "الدستور الاتحادي والقانون الاتحادي رقم 1 لسنة 1972 وتعديلاته — الوزير مسؤول عن الوزارة ويملك صلاحية إصدار القرارات الوزارية في نطاق اختصاصه",
    legalBasisEn: "UAE Federal Constitution and Federal Law No. 1 of 1972 (as amended) — the Minister is responsible for the ministry and holds authority to issue ministerial decisions within their mandate",
  },

  // ════════════════════════════════════════════════════
  // 3. Director General — مدير عام
  // ════════════════════════════════════════════════════
  {
    roleKey: "director_general",
    titleAr: "مدير عام",
    titleEn: "Director General",
    descriptionAr: "مدير عام جهة حكومية يملك صلاحيات واسعة لإصدار القرارات الإدارية داخل نطاق اختصاص الجهة",
    descriptionEn: "Director General of a government entity with broad authority to issue administrative decisions within the entity's mandate",
    competenceCeiling: "director_general",
    permittedDomains: ["personnel", "regulatory", "procurement"],
    actionCapabilities: { canIssue: true, canReview: true, canChallenge: false },
    jurisdictionScope: {
      uae: {
        federalAuthority: true,
        emirateAuthority: true,
        legalBasis: "قانون أو مرسوم تأسيس الجهة الحكومية المعنية وما يُخوِّله من صلاحيات للمدير العام",
      },
    },
    preferredLanguage: "ar",
    interviewModifiers: {
      prependQuestions: dgPrependQuestions,
      appendQuestions: [],
      overrides: [
        {
          questionId: "authority_source",
          questionAr: "ما قانون تأسيس الجهة أو القانون الخاص الذي يمنح المدير العام صلاحية إصدار هذا القرار؟",
          questionEn: "What founding law or special legislation grants the Director General authority to issue this decision?",
        },
      ],
      removeQuestions: [],
    },
    legalBasisAr: "قوانين وتشريعات تأسيس الجهات الحكومية الاتحادية والمحلية — تُخوِّل المديرين العامين إصدار القرارات الإدارية في حدود اختصاصاتهم المؤسسية",
    legalBasisEn: "Founding laws and charters of federal and local government entities — authorise Director Generals to issue administrative decisions within their institutional mandate",
  },

  // ════════════════════════════════════════════════════
  // 4. HR Department — قسم الموارد البشرية
  // ════════════════════════════════════════════════════
  {
    roleKey: "hr",
    titleAr: "قسم الموارد البشرية",
    titleEn: "HR Department",
    descriptionAr: "قسم الموارد البشرية في جهة حكومية، مختص بإصدار قرارات شؤون الموظفين وفق قانون الخدمة المدنية",
    descriptionEn: "HR department in a government entity, specialising in personnel decisions under the Civil Service Law",
    competenceCeiling: "hr_officer",
    permittedDomains: ["personnel"],
    actionCapabilities: { canIssue: true, canReview: false, canChallenge: false },
    jurisdictionScope: {
      uae: {
        federalAuthority: true,
        emirateAuthority: true,
        legalBasis: "المرسوم بقانون اتحادي رقم 49 لسنة 2023 — يُنظِّم صلاحيات أقسام الموارد البشرية في شؤون الموظفين",
      },
    },
    preferredLanguage: "ar",
    interviewModifiers: {
      prependQuestions: hrPrependQuestions,
      appendQuestions: [],
      overrides: [
        {
          questionId: "authority_source",
          questionAr: "ما المادة المحددة في قانون الخدمة المدنية (المرسوم بقانون اتحادي رقم 49/2023) أو اللوائح الداخلية التي تخوّل قسم الموارد البشرية إصدار هذا القرار؟",
          questionEn: "What specific article in the Civil Service Law (Federal Decree-Law 49/2023) or internal regulations authorises the HR department to issue this decision?",
        },
        {
          questionId: "decision_reasoned",
          questionAr: "هل القرار مُسبَّب ومُوثَّق في ملف الموظف وفق إجراءات قانون الخدمة المدنية؟",
          questionEn: "Is the decision reasoned and documented in the employee's file per Civil Service Law procedures?",
        },
      ],
      // HR only handles personnel — remove questions irrelevant to their scope
      removeQuestions: [],
    },
    legalBasisAr: "المرسوم بقانون اتحادي رقم 49 لسنة 2023 في شأن الموارد البشرية في الحكومة الاتحادية — يُنظِّم صلاحيات أقسام الموارد البشرية وإجراءات قراراتها المتعلقة بالموظفين",
    legalBasisEn: "Federal Decree-Law No. 49 of 2023 on Human Resources in the Federal Government — regulates HR department authority and procedures for employee-related decisions",
  },

  // ════════════════════════════════════════════════════
  // 5. Legal Department — الإدارة القانونية
  // ════════════════════════════════════════════════════
  {
    roleKey: "legal_department",
    titleAr: "الإدارة القانونية",
    titleEn: "Legal Department",
    descriptionAr: "الإدارة القانونية في جهة حكومية، تراجع القرارات الإدارية للتحقق من مشروعيتها قبل وبعد الإصدار",
    descriptionEn: "Legal department in a government entity, reviewing administrative decisions for legal compliance before and after issuance",
    competenceCeiling: "review_only",
    permittedDomains: ["all"],
    actionCapabilities: { canIssue: false, canReview: true, canChallenge: false },
    jurisdictionScope: {
      uae: {
        federalAuthority: true,
        emirateAuthority: true,
        legalBasis: "القانون الاتحادي رقم 11 لسنة 2021 بشأن الإجراءات الإدارية — يُلزم الجهات الحكومية بمراجعة قانونية لقراراتها",
      },
    },
    preferredLanguage: "bilingual",
    interviewModifiers: {
      prependQuestions: legalDeptPrependQuestions,
      appendQuestions: [
        {
          id: "legal_risk_assessment",
          dimensionTag: "judicialReviewReadiness",
          questionAr: "ما تقديرك للمخاطر القانونية الأبرز في هذا القرار؟",
          questionEn: "What do you assess as the most significant legal risks in this decision?",
          answerType: "text",
          required: false,
        },
      ],
      overrides: [
        {
          questionId: "authority_source",
          questionAr: "ما النص القانوني الذي تستند إليه في مراجعتك لصلاحية الجهة المُصدِرة لهذا القرار؟",
          questionEn: "What legal text are you relying on in your review of the issuing authority's competence for this decision?",
        },
        {
          questionId: "authority_delegated",
          questionAr: "هل تحققت من وجود وثيقة تفويض سارية وصحيحة؟",
          questionEn: "Have you verified the existence of a valid and current delegation document?",
        },
      ],
      removeQuestions: [],
    },
    legalBasisAr: "القانون الاتحادي رقم 11 لسنة 2021 بشأن الإجراءات الإدارية ومبدأ المشروعية الإدارية — تضطلع الإدارة القانونية بدور الرقابة الداخلية على سلامة القرارات الإدارية",
    legalBasisEn: "Federal Law No. 11 of 2021 on Administrative Procedures and the principle of administrative legality — the Legal Department performs internal oversight of administrative decision compliance",
  },

  // ════════════════════════════════════════════════════
  // 6. Administrative Court — محكمة إدارية
  // ════════════════════════════════════════════════════
  {
    roleKey: "administrative_court",
    titleAr: "محكمة إدارية",
    titleEn: "Administrative Court",
    descriptionAr: "المحكمة المختصة بالنظر في الطعون الإدارية وتقييم مدى مشروعية القرارات الإدارية المطعون فيها",
    descriptionEn: "The court competent to examine administrative challenges and assess the legality of contested administrative decisions",
    competenceCeiling: "judicial_review",
    permittedDomains: ["all"],
    actionCapabilities: { canIssue: false, canReview: true, canChallenge: false },
    jurisdictionScope: {
      uae: {
        federalAuthority: true,
        emirateAuthority: true,
        legalBasis: "القانون الاتحادي رقم 3 لسنة 1983 في شأن المحكمة الاتحادية العليا وتعديلاته",
      },
    },
    preferredLanguage: "ar",
    interviewModifiers: {
      prependQuestions: courtPrependQuestions,
      appendQuestions: [
        {
          id: "court_interim_measures",
          dimensionTag: "judicialReviewReadiness",
          questionAr: "هل طُلب وقف تنفيذ القرار المطعون فيه بصفة مستعجلة؟",
          questionEn: "Has a request been made for interim suspension of the contested decision?",
          answerType: "yes-no",
          required: false,
        },
      ],
      overrides: [
        {
          questionId: "authority_source",
          questionAr: "ما النص القانوني الذي تستند إليه المحكمة في تقييم اختصاص الجهة المُصدِرة لهذا القرار؟",
          questionEn: "What legal text does the court rely on when assessing the competence of the authority that issued this decision?",
        },
        {
          questionId: "decision_reasoned",
          questionAr: "هل القرار المطعون فيه مُسبَّب تسبيباً كافياً يُمكِّن المحكمة من مراجعة مشروعيته؟",
          questionEn: "Is the contested decision sufficiently reasoned to allow the court to review its legality?",
        },
      ],
      removeQuestions: [],
    },
    legalBasisAr: "القانون الاتحادي رقم 3 لسنة 1983 وتعديلاته — يُخصِّص الدائرة الإدارية بالمحكمة الاتحادية العليا للنظر في الطعون الإدارية، مدعوماً بقانون الإجراءات المدنية في الطعون الإدارية",
    legalBasisEn: "Federal Law No. 3 of 1983 (as amended) — establishes the Administrative Division of the Federal Supreme Court to hear administrative challenges, supported by civil procedure laws governing administrative appeals",
  },

  // ════════════════════════════════════════════════════
  // 7. Citizen / Resident — مواطن / مقيم
  // ════════════════════════════════════════════════════
  {
    roleKey: "citizen",
    titleAr: "مواطن / مقيم",
    titleEn: "Citizen / Resident",
    descriptionAr: "مواطن إماراتي أو مقيم متأثر بقرار إداري صادر بحقه ويسعى للتظلم أو الطعن فيه",
    descriptionEn: "A UAE national or resident affected by an administrative decision issued against them and seeking to challenge or appeal it",
    competenceCeiling: "challenge_only",
    permittedDomains: ["appeals", "citizen"],
    actionCapabilities: { canIssue: false, canReview: false, canChallenge: true },
    jurisdictionScope: {
      uae: {
        federalAuthority: true,
        emirateAuthority: true,
        legalBasis: "القانون الاتحادي رقم 11 لسنة 2021 بشأن الإجراءات الإدارية — يكفل حق التظلم الإداري والقضائي لكل متأثر بقرار إداري",
      },
    },
    preferredLanguage: "ar",
    interviewModifiers: {
      // Citizen sees a completely different front-end: what happened to them
      prependQuestions: citizenPrependQuestions,
      appendQuestions: [],
      overrides: [
        {
          questionId: "authority_source",
          questionAr: "هل تعرف الجهة الحكومية التي لديها صلاحية إصدار هذا النوع من القرارات؟",
          questionEn: "Do you know which government authority has the power to issue this type of decision?",
          required: false,
        },
        {
          questionId: "authority_delegated",
          questionAr: "هل أبلغك المسؤول أن القرار صادر بتفويض من جهة أعلى؟",
          questionEn: "Did the official inform you that this decision was issued under delegation from a higher authority?",
          required: false,
        },
        {
          questionId: "decision_written",
          questionAr: "هل تلقيت القرار كتابةً (ورقياً أو إلكترونياً)؟",
          questionEn: "Did you receive the decision in writing (paper or electronic)?",
        },
        {
          questionId: "decision_reasoned",
          questionAr: "هل يتضمن القرار الذي تلقيته شرحاً للأسباب التي أدت إلى إصداره؟",
          questionEn: "Does the decision you received include an explanation of the reasons for its issuance?",
        },
        {
          questionId: "notification_method",
          questionAr: "كيف تلقيت إشعاراً بالقرار؟",
          questionEn: "How were you notified of the decision?",
        },
      ],
      // Remove questions that only make sense for issuers, not recipients
      removeQuestions: ["delegation_document"],
    },
    legalBasisAr: "القانون الاتحادي رقم 11 لسنة 2021 بشأن الإجراءات الإدارية — يكفل المادتان 26 و27 حق أي شخص متأثر بقرار إداري في التظلم منه خلال 60 يوماً وحق الطعن القضائي",
    legalBasisEn: "Federal Law No. 11 of 2021 on Administrative Procedures — Articles 26 and 27 guarantee the right of any person affected by an administrative decision to file a grievance within 60 days and to seek judicial review",
  },
];
