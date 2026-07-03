/**
 * AI Legal Operating System — Scenario Catalog
 * 8 user roles × 5-7 scenarios × 4-6 question nodes each.
 * Shared between API (system prompt building) and can be served via GET /legal-os/scenarios.
 */

export type AnswerType = 'chips' | 'yes-no' | 'text' | 'number';

export interface QuestionOption {
  value: string;
  labelAr: string;
  labelEn: string;
}

export interface QuestionNode {
  id: string;
  questionAr: string;
  questionEn: string;
  hintAr?: string;
  answerType: AnswerType;
  options?: QuestionOption[];
  placeholder?: string;
  unit?: string;
}

export interface Scenario {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  jurisdictions: string[];
  estimatedMinutes: number;
  questions: QuestionNode[];
}

export interface Role {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  icon: string;
  scenarios: Scenario[];
}

// ─── ROLES ────────────────────────────────────────────────────────────────────

export const ROLES: Role[] = [
  // ══════════════════════════════════════════════════════════════════════
  // 1. CITIZEN — مواطن
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'citizen',
    titleAr: 'مواطن / مقيم',
    titleEn: 'Citizen / Resident',
    descriptionAr: 'أريد اتخاذ إجراء قانوني أو التحقق من حقوقي',
    icon: 'UserCircle',
    scenarios: [
      {
        id: 'citizen-rental-termination',
        titleAr: 'إنهاء عقد إيجار',
        titleEn: 'Terminate a Rental Contract',
        descriptionAr: 'تقييم حقوقك والتزاماتك عند إنهاء عقد إيجار',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'tenancy_type',
            questionAr: 'ما نوع العقار المؤجَّر؟',
            questionEn: 'What type of property is rented?',
            answerType: 'chips',
            options: [
              { value: 'residential', labelAr: 'سكني', labelEn: 'Residential' },
              { value: 'commercial', labelAr: 'تجاري', labelEn: 'Commercial' },
            ],
          },
          {
            id: 'tenancy_duration',
            questionAr: 'كم مضى على عقد الإيجار؟',
            questionEn: 'How long has the tenancy been active?',
            answerType: 'chips',
            options: [
              { value: 'less_1yr', labelAr: 'أقل من سنة', labelEn: 'Less than 1 year' },
              { value: '1_3yr', labelAr: 'من 1 إلى 3 سنوات', labelEn: '1–3 years' },
              { value: '3_5yr', labelAr: 'من 3 إلى 5 سنوات', labelEn: '3–5 years' },
              { value: 'over_5yr', labelAr: 'أكثر من 5 سنوات', labelEn: 'Over 5 years' },
            ],
          },
          {
            id: 'termination_reason',
            questionAr: 'ما سبب رغبتك في إنهاء العقد؟',
            questionEn: 'What is the reason for termination?',
            answerType: 'chips',
            options: [
              { value: 'nonpayment', labelAr: 'عدم دفع الإيجار', labelEn: 'Non-payment of rent' },
              { value: 'breach', labelAr: 'مخالفة شروط العقد', labelEn: 'Contract breach' },
              { value: 'owner_use', labelAr: 'استخدام المالك شخصياً', labelEn: 'Owner personal use' },
              { value: 'redevelopment', labelAr: 'إعادة التطوير أو الهدم', labelEn: 'Redevelopment / demolition' },
              { value: 'mutual', labelAr: 'اتفاق متبادل', labelEn: 'Mutual agreement' },
            ],
          },
          {
            id: 'notice_given',
            questionAr: 'هل أُرسل إشعار رسمي للطرف الآخر قبل الإنهاء؟',
            questionEn: 'Has a formal notice been sent to the other party?',
            answerType: 'yes-no',
          },
          {
            id: 'registered_ejari',
            questionAr: 'هل العقد مسجل في نظام إيجاري (دبي) أو ما يماثله؟',
            questionEn: 'Is the contract registered with Ejari (Dubai) or equivalent?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'citizen-labor-complaint',
        titleAr: 'تقديم شكوى عمالية',
        titleEn: 'File a Labor Complaint',
        descriptionAr: 'توجيه حول كيفية تقديم شكوى ضد صاحب العمل',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'complaint_type',
            questionAr: 'ما موضوع الشكوى العمالية؟',
            questionEn: 'What is the subject of the labor complaint?',
            answerType: 'chips',
            options: [
              { value: 'unpaid_salary', labelAr: 'تأخر أو عدم دفع الراتب', labelEn: 'Unpaid / delayed salary' },
              { value: 'wrongful_dismissal', labelAr: 'فصل تعسفي', labelEn: 'Wrongful dismissal' },
              { value: 'entitlements', labelAr: 'عدم صرف مستحقات', labelEn: 'Unpaid entitlements (gratuity, leave)' },
              { value: 'harassment', labelAr: 'تحرش أو إساءة', labelEn: 'Harassment or abuse' },
              { value: 'contract_breach', labelAr: 'مخالفة شروط العقد', labelEn: 'Contract breach by employer' },
            ],
          },
          {
            id: 'employment_duration',
            questionAr: 'كم مدة خدمتك لدى هذا صاحب العمل؟',
            questionEn: 'How long have you worked for this employer?',
            answerType: 'chips',
            options: [
              { value: 'under_1yr', labelAr: 'أقل من سنة', labelEn: 'Less than 1 year' },
              { value: '1_3yr', labelAr: '1–3 سنوات', labelEn: '1–3 years' },
              { value: '3_5yr', labelAr: '3–5 سنوات', labelEn: '3–5 years' },
              { value: 'over_5yr', labelAr: 'أكثر من 5 سنوات', labelEn: 'Over 5 years' },
            ],
          },
          {
            id: 'contract_type',
            questionAr: 'ما نوع عقد عملك؟',
            questionEn: 'What type of employment contract do you have?',
            answerType: 'chips',
            options: [
              { value: 'limited', labelAr: 'محدد المدة', labelEn: 'Fixed-term' },
              { value: 'unlimited', labelAr: 'غير محدد المدة', labelEn: 'Unlimited-term' },
            ],
          },
          {
            id: 'amicable_attempted',
            questionAr: 'هل حاولت حل النزاع بصورة ودية مع صاحب العمل؟',
            questionEn: 'Have you attempted to resolve the dispute amicably with the employer?',
            answerType: 'yes-no',
          },
          {
            id: 'evidence_available',
            questionAr: 'هل لديك وثائق أو أدلة تدعم شكواك (عقد، مراسلات، كشف راتب...إلخ)؟',
            questionEn: 'Do you have documents or evidence supporting your complaint?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'citizen-business-start',
        titleAr: 'تأسيس نشاط تجاري',
        titleEn: 'Start a Business',
        descriptionAr: 'خطوات وشروط تأسيس شركة أو نشاط تجاري في الإمارات',
        jurisdictions: ['UAE'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'business_type',
            questionAr: 'ما نوع النشاط التجاري الذي تنوي تأسيسه؟',
            questionEn: 'What type of business do you want to establish?',
            answerType: 'chips',
            options: [
              { value: 'sole', labelAr: 'مؤسسة فردية', labelEn: 'Sole proprietorship' },
              { value: 'llc', labelAr: 'شركة ذات مسؤولية محدودة', labelEn: 'LLC' },
              { value: 'freezone', labelAr: 'شركة في منطقة حرة', labelEn: 'Free zone company' },
              { value: 'branch', labelAr: 'فرع شركة أجنبية', labelEn: 'Foreign company branch' },
            ],
          },
          {
            id: 'business_activity',
            questionAr: 'ما طبيعة النشاط الرئيسي؟',
            questionEn: 'What is the main business activity?',
            answerType: 'chips',
            options: [
              { value: 'trade', labelAr: 'تجارة / استيراد وتصدير', labelEn: 'Trading / import-export' },
              { value: 'services', labelAr: 'خدمات مهنية', labelEn: 'Professional services' },
              { value: 'tech', labelAr: 'تقنية وبرمجيات', labelEn: 'Technology / software' },
              { value: 'food', labelAr: 'مطاعم وأغذية', labelEn: 'Food & restaurants' },
              { value: 'consulting', labelAr: 'استشارات', labelEn: 'Consulting' },
            ],
          },
          {
            id: 'ownership_preference',
            questionAr: 'هل تفضل ملكية 100٪ للأجنبي أم شراكة مواطن إماراتي؟',
            questionEn: 'Do you prefer 100% foreign ownership or a UAE national partner?',
            answerType: 'chips',
            options: [
              { value: 'full_foreign', labelAr: 'ملكية أجنبية كاملة', labelEn: 'Full foreign ownership' },
              { value: 'local_partner', labelAr: 'شريك محلي إماراتي', labelEn: 'Local UAE partner' },
              { value: 'undecided', labelAr: 'لم أقرر بعد', labelEn: 'Not yet decided' },
            ],
          },
          {
            id: 'has_capital',
            questionAr: 'هل لديك رأس المال المطلوب للتسجيل؟',
            questionEn: 'Do you have the required capital for registration?',
            answerType: 'yes-no',
          },
          {
            id: 'location_decided',
            questionAr: 'هل قررت موقع مقر الشركة (إمارة / منطقة حرة)؟',
            questionEn: 'Have you decided on the company location (emirate / free zone)?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'citizen-compensation-claim',
        titleAr: 'المطالبة بتعويض مدني',
        titleEn: 'Civil Compensation Claim',
        descriptionAr: 'تقييم مطالبتك بالتعويض عن ضرر أو خسارة',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'damage_type',
            questionAr: 'ما نوع الضرر الذي تعرضت له؟',
            questionEn: 'What type of damage did you suffer?',
            answerType: 'chips',
            options: [
              { value: 'physical', labelAr: 'إصابة جسدية', labelEn: 'Physical injury' },
              { value: 'material', labelAr: 'خسارة مالية', labelEn: 'Financial loss' },
              { value: 'moral', labelAr: 'ضرر معنوي', labelEn: 'Moral / reputational damage' },
              { value: 'property', labelAr: 'تلف ممتلكات', labelEn: 'Property damage' },
            ],
          },
          {
            id: 'damage_amount',
            questionAr: 'ما التقدير التقريبي لقيمة الضرر؟ (بالدرهم)',
            questionEn: 'What is the approximate value of the damage? (AED)',
            answerType: 'number',
            unit: 'AED',
            placeholder: '50000',
          },
          {
            id: 'liable_party',
            questionAr: 'من المسؤول عن الضرر؟',
            questionEn: 'Who is responsible for the damage?',
            answerType: 'chips',
            options: [
              { value: 'individual', labelAr: 'شخص طبيعي', labelEn: 'An individual' },
              { value: 'company', labelAr: 'شركة أو مؤسسة', labelEn: 'A company / entity' },
              { value: 'government', labelAr: 'جهة حكومية', labelEn: 'A government body' },
            ],
          },
          {
            id: 'evidence_damage',
            questionAr: 'هل لديك وثائق أو تقارير تثبت الضرر؟',
            questionEn: 'Do you have documents or reports proving the damage?',
            answerType: 'yes-no',
          },
          {
            id: 'time_elapsed',
            questionAr: 'كم مضى على وقوع الضرر؟',
            questionEn: 'How long ago did the damage occur?',
            answerType: 'chips',
            options: [
              { value: 'recent', labelAr: 'أقل من شهر', labelEn: 'Less than 1 month' },
              { value: 'months', labelAr: '1–6 أشهر', labelEn: '1–6 months' },
              { value: 'year', labelAr: '6 أشهر – سنة', labelEn: '6 months – 1 year' },
              { value: 'over_year', labelAr: 'أكثر من سنة', labelEn: 'Over 1 year' },
            ],
          },
        ],
      },
      {
        id: 'citizen-divorce-custody',
        titleAr: 'الطلاق وحضانة الأطفال',
        titleEn: 'Divorce & Child Custody',
        descriptionAr: 'إرشادات قانونية حول إجراءات الطلاق والحضانة',
        jurisdictions: ['UAE'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'initiating_party',
            questionAr: 'من يطلب الطلاق؟',
            questionEn: 'Who is requesting the divorce?',
            answerType: 'chips',
            options: [
              { value: 'husband', labelAr: 'الزوج', labelEn: 'Husband' },
              { value: 'wife', labelAr: 'الزوجة', labelEn: 'Wife (Khul\')' },
              { value: 'mutual', labelAr: 'بالتراضي', labelEn: 'Mutual agreement' },
            ],
          },
          {
            id: 'children_exist',
            questionAr: 'هل يوجد أطفال قاصرون من هذا الزواج؟',
            questionEn: 'Are there minor children from this marriage?',
            answerType: 'yes-no',
          },
          {
            id: 'children_count',
            questionAr: 'كم عدد الأطفال القاصرين؟',
            questionEn: 'How many minor children are there?',
            answerType: 'number',
            unit: 'طفل',
            placeholder: '2',
          },
          {
            id: 'property_dispute',
            questionAr: 'هل هناك نزاع على ممتلكات أو نفقة؟',
            questionEn: 'Is there a dispute over assets or alimony?',
            answerType: 'yes-no',
          },
          {
            id: 'marriage_registered',
            questionAr: 'هل الزواج موثق رسمياً في الإمارات؟',
            questionEn: 'Is the marriage officially registered in the UAE?',
            answerType: 'yes-no',
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 2. LAWYER — محامي
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'lawyer',
    titleAr: 'محامي / مستشار قانوني',
    titleEn: 'Lawyer / Legal Counsel',
    descriptionAr: 'تحضير قضية أو وثيقة قانونية قبل التقديم',
    icon: 'Briefcase',
    scenarios: [
      {
        id: 'lawyer-file-lawsuit',
        titleAr: 'رفع دعوى قضائية',
        titleEn: 'File a Lawsuit',
        descriptionAr: 'التحقق من استيفاء شروط قبول الدعوى',
        jurisdictions: ['UAE'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'lawsuit_type',
            questionAr: 'ما نوع الدعوى؟',
            questionEn: 'What type of lawsuit?',
            answerType: 'chips',
            options: [
              { value: 'civil', labelAr: 'مدنية', labelEn: 'Civil' },
              { value: 'commercial', labelAr: 'تجارية', labelEn: 'Commercial' },
              { value: 'labor', labelAr: 'عمالية', labelEn: 'Labor' },
              { value: 'criminal', labelAr: 'جزائية', labelEn: 'Criminal' },
              { value: 'administrative', labelAr: 'إدارية', labelEn: 'Administrative' },
            ],
          },
          {
            id: 'claim_value',
            questionAr: 'ما قيمة المطالبة؟ (بالدرهم)',
            questionEn: 'What is the claim value? (AED)',
            answerType: 'number',
            unit: 'AED',
            placeholder: '100000',
          },
          {
            id: 'limitation_period',
            questionAr: 'هل أنت ضمن مدة التقادم القانونية؟',
            questionEn: 'Are you within the legal limitation period?',
            answerType: 'yes-no',
          },
          {
            id: 'amicable_failed',
            questionAr: 'هل استُنفدت محاولات التسوية الودية؟',
            questionEn: 'Have amicable settlement attempts been exhausted?',
            answerType: 'yes-no',
          },
          {
            id: 'evidence_type',
            questionAr: 'ما نوع الأدلة المتاحة؟',
            questionEn: 'What type of evidence is available?',
            answerType: 'chips',
            options: [
              { value: 'written', labelAr: 'وثائق مكتوبة وعقود', labelEn: 'Written documents & contracts' },
              { value: 'witnesses', labelAr: 'شهود', labelEn: 'Witnesses' },
              { value: 'digital', labelAr: 'أدلة رقمية (رسائل، تسجيلات)', labelEn: 'Digital evidence' },
              { value: 'expert', labelAr: 'تقارير خبراء', labelEn: 'Expert reports' },
              { value: 'limited', labelAr: 'أدلة محدودة', labelEn: 'Limited evidence' },
            ],
          },
        ],
      },
      {
        id: 'lawyer-draft-contract',
        titleAr: 'صياغة عقد تجاري',
        titleEn: 'Draft a Commercial Contract',
        descriptionAr: 'مراجعة المتطلبات القانونية لصياغة عقد صحيح',
        jurisdictions: ['UAE', 'France'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'contract_type',
            questionAr: 'ما نوع العقد التجاري؟',
            questionEn: 'What type of commercial contract?',
            answerType: 'chips',
            options: [
              { value: 'supply', labelAr: 'عقد توريد', labelEn: 'Supply agreement' },
              { value: 'service', labelAr: 'عقد خدمات', labelEn: 'Service agreement' },
              { value: 'agency', labelAr: 'عقد وكالة تجارية', labelEn: 'Commercial agency' },
              { value: 'jv', labelAr: 'اتفاقية مشاريع مشتركة', labelEn: 'Joint venture' },
              { value: 'franchise', labelAr: 'عقد امتياز تجاري', labelEn: 'Franchise agreement' },
            ],
          },
          {
            id: 'governing_law',
            questionAr: 'ما القانون الواجب التطبيق؟',
            questionEn: 'Which law governs the contract?',
            answerType: 'chips',
            options: [
              { value: 'uae', labelAr: 'القانون الإماراتي', labelEn: 'UAE Law' },
              { value: 'french', labelAr: 'القانون الفرنسي', labelEn: 'French Law' },
              { value: 'english', labelAr: 'القانون الإنجليزي', labelEn: 'English Law' },
              { value: 'parties_choice', labelAr: 'سيُتفق عليه بين الطرفين', labelEn: 'To be agreed' },
            ],
          },
          {
            id: 'international_element',
            questionAr: 'هل العقد بين أطراف من دول مختلفة؟',
            questionEn: 'Is the contract between parties from different countries?',
            answerType: 'yes-no',
          },
          {
            id: 'dispute_resolution',
            questionAr: 'ما آلية تسوية النزاعات المفضلة؟',
            questionEn: 'What is the preferred dispute resolution mechanism?',
            answerType: 'chips',
            options: [
              { value: 'court', labelAr: 'القضاء', labelEn: 'Courts' },
              { value: 'arbitration', labelAr: 'التحكيم', labelEn: 'Arbitration' },
              { value: 'mediation', labelAr: 'الوساطة', labelEn: 'Mediation' },
            ],
          },
        ],
      },
      {
        id: 'lawyer-appeal',
        titleAr: 'الطعن في حكم قضائي',
        titleEn: 'Appeal a Court Judgment',
        descriptionAr: 'تقييم جدوى وإجراءات الطعن بالاستئناف',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'judgment_type',
            questionAr: 'ما نوع الحكم المراد الطعن فيه؟',
            questionEn: 'What type of judgment is being appealed?',
            answerType: 'chips',
            options: [
              { value: 'civil', labelAr: 'مدني', labelEn: 'Civil' },
              { value: 'commercial', labelAr: 'تجاري', labelEn: 'Commercial' },
              { value: 'labor', labelAr: 'عمالي', labelEn: 'Labor' },
              { value: 'criminal', labelAr: 'جزائي', labelEn: 'Criminal' },
            ],
          },
          {
            id: 'days_since_judgment',
            questionAr: 'كم يوماً مضى منذ صدور الحكم؟',
            questionEn: 'How many days have passed since the judgment?',
            answerType: 'number',
            unit: 'يوم',
            placeholder: '15',
          },
          {
            id: 'grounds_for_appeal',
            questionAr: 'ما أساس الطعن؟',
            questionEn: 'What are the grounds for appeal?',
            answerType: 'chips',
            options: [
              { value: 'legal_error', labelAr: 'خطأ في تطبيق القانون', labelEn: 'Error in applying the law' },
              { value: 'procedural', labelAr: 'بطلان إجرائي', labelEn: 'Procedural irregularity' },
              { value: 'new_evidence', labelAr: 'أدلة جديدة', labelEn: 'New evidence' },
              { value: 'factual_error', labelAr: 'خطأ في الوقائع', labelEn: 'Factual error' },
            ],
          },
          {
            id: 'previous_appeals',
            questionAr: 'هل سبق الطعن في الحكم ابتدائياً؟',
            questionEn: 'Has the judgment already been appealed at first instance?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'lawyer-constitutional-petition',
        titleAr: 'دعوى دستورية',
        titleEn: 'Constitutional Petition',
        descriptionAr: 'إجراءات الطعن بعدم الدستورية في نص قانوني',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'provision_challenged',
            questionAr: 'ما النص القانوني المطعون بدستوريته؟',
            questionEn: 'Which legal provision is being challenged?',
            answerType: 'text',
            placeholder: 'مثال: المادة 15 من قانون العمل الاتحادي رقم 33 لسنة 2021',
          },
          {
            id: 'constitutional_right',
            questionAr: 'أي حق دستوري يُنتهك؟',
            questionEn: 'Which constitutional right is being violated?',
            answerType: 'chips',
            options: [
              { value: 'equality', labelAr: 'المساواة وعدم التمييز', labelEn: 'Equality & non-discrimination' },
              { value: 'due_process', labelAr: 'ضمانات المحاكمة العادلة', labelEn: 'Due process guarantees' },
              { value: 'property', labelAr: 'حماية الملكية', labelEn: 'Property protection' },
              { value: 'liberty', labelAr: 'الحرية الشخصية', labelEn: 'Personal liberty' },
            ],
          },
          {
            id: 'active_case',
            questionAr: 'هل الطعن مُثار ضمن قضية منظورة؟',
            questionEn: 'Is the challenge raised within an active case?',
            answerType: 'yes-no',
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 3. MANAGER — مدير
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'manager',
    titleAr: 'مدير / مسؤول موارد بشرية',
    titleEn: 'Manager / HR Manager',
    descriptionAr: 'قبل إصدار قرار إداري أو عمالي، تحقق من موقفك القانوني',
    icon: 'Users',
    scenarios: [
      {
        id: 'manager-dismiss-employee',
        titleAr: 'فصل موظف',
        titleEn: 'Dismiss an Employee',
        descriptionAr: 'التحقق من صحة إجراءات إنهاء خدمة الموظف قانونياً',
        jurisdictions: ['UAE'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'dismissal_reason',
            questionAr: 'ما سبب إنهاء الخدمة؟',
            questionEn: 'What is the reason for dismissal?',
            answerType: 'chips',
            options: [
              { value: 'performance', labelAr: 'ضعف الأداء', labelEn: 'Poor performance' },
              { value: 'misconduct', labelAr: 'سلوك مخالف / مخالفة جسيمة', labelEn: 'Misconduct / serious violation' },
              { value: 'redundancy', labelAr: 'إعادة هيكلة / فائض عمالة', labelEn: 'Redundancy / restructuring' },
              { value: 'contract_end', labelAr: 'انتهاء مدة العقد', labelEn: 'End of fixed-term contract' },
              { value: 'mutual', labelAr: 'اتفاق طرفين', labelEn: 'Mutual agreement' },
            ],
          },
          {
            id: 'tenure_years',
            questionAr: 'كم سنة خدمة للموظف؟',
            questionEn: 'How many years of service does the employee have?',
            answerType: 'number',
            unit: 'سنة',
            placeholder: '3',
          },
          {
            id: 'contract_type',
            questionAr: 'ما نوع عقد العمل؟',
            questionEn: 'What is the contract type?',
            answerType: 'chips',
            options: [
              { value: 'limited', labelAr: 'محدد المدة', labelEn: 'Fixed-term' },
              { value: 'unlimited', labelAr: 'غير محدد المدة', labelEn: 'Unlimited-term' },
              { value: 'probationary', labelAr: 'فترة تجريبية', labelEn: 'Probationary period' },
            ],
          },
          {
            id: 'written_warning',
            questionAr: 'هل صدر بحق الموظف إنذار أو تحذير رسمي خطي مسبق؟',
            questionEn: 'Has the employee received a formal prior written warning?',
            answerType: 'yes-no',
          },
          {
            id: 'mohre_notification',
            questionAr: 'هل أُبلغت وزارة الموارد البشرية أو صدرت موافقتها؟',
            questionEn: 'Has the Ministry of Human Resources been notified or approved?',
            answerType: 'yes-no',
          },
          {
            id: 'nda_noncompete',
            questionAr: 'هل وقّع الموظف اتفاقية عدم منافسة أو سرية معلومات؟',
            questionEn: 'Has the employee signed a non-compete or confidentiality agreement?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'manager-disciplinary',
        titleAr: 'توقيع إجراء تأديبي',
        titleEn: 'Apply Disciplinary Action',
        descriptionAr: 'صحة الإجراءات التأديبية قبل تطبيقها',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'violation_type',
            questionAr: 'ما المخالفة المرتكبة؟',
            questionEn: 'What is the violation?',
            answerType: 'chips',
            options: [
              { value: 'attendance', labelAr: 'غياب أو تأخر متكرر', labelEn: 'Repeated absence / tardiness' },
              { value: 'insubordination', labelAr: 'عصيان أوامر', labelEn: 'Insubordination' },
              { value: 'harassment', labelAr: 'تحرش أو إساءة لزميل', labelEn: 'Harassment of colleague' },
              { value: 'theft', labelAr: 'سرقة أو احتيال', labelEn: 'Theft or fraud' },
              { value: 'disclosure', labelAr: 'إفشاء معلومات سرية', labelEn: 'Disclosure of confidential info' },
              { value: 'performance', labelAr: 'إهمال مهام وظيفية', labelEn: 'Neglect of duties' },
            ],
          },
          {
            id: 'investigation_done',
            questionAr: 'هل أُجريت تحقيق رسمي مع الموظف قبل اتخاذ القرار؟',
            questionEn: 'Was a formal investigation conducted with the employee before the decision?',
            answerType: 'yes-no',
          },
          {
            id: 'employee_heard',
            questionAr: 'هل أُتيحت للموظف فرصة الدفاع عن نفسه؟',
            questionEn: 'Was the employee given an opportunity to defend themselves?',
            answerType: 'yes-no',
          },
          {
            id: 'sanction_type',
            questionAr: 'ما العقوبة التأديبية المقترحة؟',
            questionEn: 'What disciplinary sanction is proposed?',
            answerType: 'chips',
            options: [
              { value: 'warning', labelAr: 'إنذار خطي', labelEn: 'Written warning' },
              { value: 'suspension', labelAr: 'إيقاف عن العمل مؤقت', labelEn: 'Temporary suspension' },
              { value: 'demotion', labelAr: 'خفض الوظيفة', labelEn: 'Demotion' },
              { value: 'termination', labelAr: 'إنهاء الخدمة', labelEn: 'Termination' },
            ],
          },
          {
            id: 'policy_exists',
            questionAr: 'هل يوجد نظام داخلي أو سياسة مكتوبة للعقوبات؟',
            questionEn: 'Is there a written internal policy or disciplinary code?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'manager-labor-inspection',
        titleAr: 'الاستجابة لتفتيش عمالي',
        titleEn: 'Respond to Labor Inspection',
        descriptionAr: 'الإعداد القانوني لمواجهة تفتيش وزارة الموارد البشرية',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'inspection_type',
            questionAr: 'ما نوع التفتيش؟',
            questionEn: 'What type of inspection?',
            answerType: 'chips',
            options: [
              { value: 'wages', labelAr: 'التحقق من نظام حماية الأجور', labelEn: 'Wage Protection System (WPS)' },
              { value: 'safety', labelAr: 'السلامة المهنية', labelEn: 'Occupational health & safety' },
              { value: 'contracts', labelAr: 'مطابقة العقود', labelEn: 'Contract compliance' },
              { value: 'general', labelAr: 'تفتيش عام', labelEn: 'General inspection' },
            ],
          },
          {
            id: 'wps_compliant',
            questionAr: 'هل الشركة ملتزمة بنظام حماية الأجور (WPS)؟',
            questionEn: 'Is the company compliant with the Wage Protection System?',
            answerType: 'yes-no',
          },
          {
            id: 'known_violations',
            questionAr: 'هل تعلم بوجود مخالفات محتملة؟',
            questionEn: 'Are you aware of any potential violations?',
            answerType: 'yes-no',
          },
          {
            id: 'previous_fines',
            questionAr: 'هل سبق صدور غرامات بحق الشركة؟',
            questionEn: 'Has the company previously received fines?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'manager-sign-contract',
        titleAr: 'توقيع عقد تجاري كبير',
        titleEn: 'Sign a Major Commercial Contract',
        descriptionAr: 'مراجعة المتطلبات القانونية قبل التوقيع',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'contract_value',
            questionAr: 'ما قيمة العقد التقريبية؟ (بالدرهم)',
            questionEn: 'What is the approximate contract value? (AED)',
            answerType: 'number',
            unit: 'AED',
            placeholder: '500000',
          },
          {
            id: 'counterparty_type',
            questionAr: 'مع من يُبرم العقد؟',
            questionEn: 'Who is the contracting party?',
            answerType: 'chips',
            options: [
              { value: 'local_company', labelAr: 'شركة محلية', labelEn: 'Local company' },
              { value: 'foreign_company', labelAr: 'شركة أجنبية', labelEn: 'Foreign company' },
              { value: 'government', labelAr: 'جهة حكومية', labelEn: 'Government entity' },
              { value: 'individual', labelAr: 'شخص طبيعي', labelEn: 'Individual' },
            ],
          },
          {
            id: 'legal_review',
            questionAr: 'هل خضع العقد لمراجعة قانونية داخلية أو خارجية؟',
            questionEn: 'Has the contract undergone internal or external legal review?',
            answerType: 'yes-no',
          },
          {
            id: 'signatory_authority',
            questionAr: 'هل لديك صلاحية التوقيع وفق تفويض رسمي؟',
            questionEn: 'Do you have signing authority under a formal power of attorney?',
            answerType: 'yes-no',
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 4. HEIR — وارث
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'heir',
    titleAr: 'وارث / صاحب تركة',
    titleEn: 'Heir / Estate Beneficiary',
    descriptionAr: 'إرشادات قانونية حول توزيع التركة وحقوق الورثة',
    icon: 'FileText',
    scenarios: [
      {
        id: 'heir-estate-distribution',
        titleAr: 'توزيع التركة',
        titleEn: 'Distribute Estate',
        descriptionAr: 'إجراءات توزيع إرث المتوفى وفق أحكام الشريعة والقانون',
        jurisdictions: ['UAE'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'death_registered',
            questionAr: 'هل سُجلت الوفاة رسمياً وصدرت شهادة الوفاة؟',
            questionEn: 'Has the death been officially registered with a death certificate?',
            answerType: 'yes-no',
          },
          {
            id: 'estate_type',
            questionAr: 'ما أنواع أصول التركة الرئيسية؟',
            questionEn: 'What are the main types of estate assets?',
            answerType: 'chips',
            options: [
              { value: 'real_estate', labelAr: 'عقارات', labelEn: 'Real estate' },
              { value: 'cash_bank', labelAr: 'أموال نقدية / حسابات بنكية', labelEn: 'Cash / bank accounts' },
              { value: 'business', labelAr: 'حصص في شركات', labelEn: 'Business shares' },
              { value: 'mixed', labelAr: 'مزيج من الأعلاه', labelEn: 'Mixed assets' },
            ],
          },
          {
            id: 'will_exists',
            questionAr: 'هل ترك المتوفى وصية موثقة؟',
            questionEn: 'Did the deceased leave a registered will?',
            answerType: 'yes-no',
          },
          {
            id: 'debts_exist',
            questionAr: 'هل على المتوفى ديون معلومة؟',
            questionEn: 'Are there known debts owed by the deceased?',
            answerType: 'yes-no',
          },
          {
            id: 'heirs_agreed',
            questionAr: 'هل جميع الورثة متفقون على التوزيع؟',
            questionEn: 'Are all heirs in agreement on the distribution?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'heir-contest-will',
        titleAr: 'الطعن في وصية',
        titleEn: 'Contest a Will',
        descriptionAr: 'تقييم أسس الطعن في وصية وإجراءاتها',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'contest_grounds',
            questionAr: 'ما أساس الطعن في الوصية؟',
            questionEn: 'What are the grounds for contesting the will?',
            answerType: 'chips',
            options: [
              { value: 'capacity', labelAr: 'عدم الأهلية وقت إعداد الوصية', labelEn: 'Lack of testamentary capacity' },
              { value: 'fraud', labelAr: 'تدليس أو إكراه', labelEn: 'Fraud or coercion' },
              { value: 'sharia', labelAr: 'مخالفة أحكام الشريعة', labelEn: 'Violation of Sharia rules' },
              { value: 'procedural', labelAr: 'عيب شكلي في التوثيق', labelEn: 'Procedural defect in documentation' },
            ],
          },
          {
            id: 'will_registered',
            questionAr: 'هل الوصية مسجلة رسمياً لدى المحكمة أو دائرة القضاء؟',
            questionEn: 'Is the will officially registered with the court or judicial authority?',
            answerType: 'yes-no',
          },
          {
            id: 'evidence_available',
            questionAr: 'هل لديك أدلة تدعم الطعن؟',
            questionEn: 'Do you have evidence to support the contest?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'heir-renounce-inheritance',
        titleAr: 'التنازل عن الإرث',
        titleEn: 'Renounce Inheritance',
        descriptionAr: 'إجراءات وآثار التنازل الإرادي عن الإرث',
        jurisdictions: ['UAE'],
        estimatedMinutes: 4,
        questions: [
          {
            id: 'renounce_reason',
            questionAr: 'ما سبب رغبتك في التنازل؟',
            questionEn: 'Why do you wish to renounce?',
            answerType: 'chips',
            options: [
              { value: 'debts', labelAr: 'ديون التركة تتجاوز أصولها', labelEn: 'Estate debts exceed assets' },
              { value: 'voluntarily', labelAr: 'تنازل طوعي لصالح وارث آخر', labelEn: 'Voluntary renunciation for another heir' },
              { value: 'unknown_assets', labelAr: 'جهل بمحتوى التركة', labelEn: 'Unknown estate contents' },
            ],
          },
          {
            id: 'aware_of_debts',
            questionAr: 'هل أنت على علم بحجم ديون التركة؟',
            questionEn: 'Are you aware of the extent of the estate\'s debts?',
            answerType: 'yes-no',
          },
          {
            id: 'other_heirs_informed',
            questionAr: 'هل أبلغت بقية الورثة برغبتك في التنازل؟',
            questionEn: 'Have you informed other heirs of your intention to renounce?',
            answerType: 'yes-no',
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 5. EMPLOYER — صاحب عمل
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'employer',
    titleAr: 'صاحب عمل',
    titleEn: 'Employer',
    descriptionAr: 'إجراءات عمالية وقانونية تخص إدارة موظفيك',
    icon: 'Building2',
    scenarios: [
      {
        id: 'employer-terminate',
        titleAr: 'إنهاء خدمة موظف',
        titleEn: 'Terminate Employment',
        descriptionAr: 'الإجراءات الصحيحة لإنهاء عقد العمل مع تجنب المخاطر القانونية',
        jurisdictions: ['UAE'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'employee_nationality',
            questionAr: 'ما جنسية الموظف؟',
            questionEn: 'What is the employee\'s nationality?',
            answerType: 'chips',
            options: [
              { value: 'uae_national', labelAr: 'إماراتي (مواطن)', labelEn: 'UAE National' },
              { value: 'gcc', labelAr: 'مواطن خليجي', labelEn: 'GCC National' },
              { value: 'expat', labelAr: 'وافد أجنبي', labelEn: 'Expatriate' },
            ],
          },
          {
            id: 'tenure',
            questionAr: 'كم سنة خدمة للموظف لديك؟',
            questionEn: 'How many years of service?',
            answerType: 'number',
            unit: 'سنة',
            placeholder: '4',
          },
          {
            id: 'termination_reason',
            questionAr: 'ما سبب إنهاء الخدمة؟',
            questionEn: 'Reason for termination?',
            answerType: 'chips',
            options: [
              { value: 'performance', labelAr: 'ضعف الأداء الموثق', labelEn: 'Documented poor performance' },
              { value: 'misconduct', labelAr: 'مخالفة جسيمة', labelEn: 'Gross misconduct' },
              { value: 'restructuring', labelAr: 'إعادة هيكلة', labelEn: 'Restructuring' },
              { value: 'contract_end', labelAr: 'انتهاء مدة العقد', labelEn: 'Contract expiry' },
            ],
          },
          {
            id: 'notice_period_served',
            questionAr: 'هل ستلتزم بفترة الإشعار القانونية؟',
            questionEn: 'Will you observe the legal notice period?',
            answerType: 'yes-no',
          },
          {
            id: 'gratuity_calculated',
            questionAr: 'هل حُسبت مكافأة نهاية الخدمة؟',
            questionEn: 'Has the end-of-service gratuity been calculated?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'employer-salary-cut',
        titleAr: 'خفض رواتب الموظفين',
        titleEn: 'Reduce Employee Salaries',
        descriptionAr: 'الشروط القانونية لخفض الرواتب في ظروف استثنائية',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'cut_reason',
            questionAr: 'ما سبب الخفض المقترح؟',
            questionEn: 'What is the reason for the proposed reduction?',
            answerType: 'chips',
            options: [
              { value: 'crisis', labelAr: 'أزمة اقتصادية / جائحة', labelEn: 'Economic crisis / pandemic' },
              { value: 'losses', labelAr: 'خسائر مالية موثقة', labelEn: 'Documented financial losses' },
              { value: 'restructure', labelAr: 'إعادة هيكلة تنظيمية', labelEn: 'Organizational restructuring' },
            ],
          },
          {
            id: 'cut_percentage',
            questionAr: 'ما نسبة الخفض المقترحة؟ (%)',
            questionEn: 'What is the proposed reduction percentage? (%)',
            answerType: 'number',
            unit: '%',
            placeholder: '20',
          },
          {
            id: 'employee_consent',
            questionAr: 'هل وافق الموظفون على الخفض كتابياً؟',
            questionEn: 'Have employees consented in writing to the reduction?',
            answerType: 'yes-no',
          },
          {
            id: 'ministry_notified',
            questionAr: 'هل أُبلغت وزارة الموارد البشرية؟',
            questionEn: 'Has the Ministry of Human Resources been notified?',
            answerType: 'yes-no',
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 6. EMPLOYEE — موظف
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'employee',
    titleAr: 'موظف',
    titleEn: 'Employee',
    descriptionAr: 'معرفة حقوقك القانونية في بيئة العمل',
    icon: 'UserCheck',
    scenarios: [
      {
        id: 'employee-resignation',
        titleAr: 'تقديم الاستقالة',
        titleEn: 'Submit Resignation',
        descriptionAr: 'حقوقك والتزاماتك القانونية عند الاستقالة من العمل',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'tenure',
            questionAr: 'كم مدة خدمتك لدى هذا صاحب العمل؟',
            questionEn: 'How long have you worked for this employer?',
            answerType: 'chips',
            options: [
              { value: 'under_1yr', labelAr: 'أقل من سنة', labelEn: 'Less than 1 year' },
              { value: '1_3yr', labelAr: '1–3 سنوات', labelEn: '1–3 years' },
              { value: '3_5yr', labelAr: '3–5 سنوات', labelEn: '3–5 years' },
              { value: 'over_5yr', labelAr: 'أكثر من 5 سنوات', labelEn: 'Over 5 years' },
            ],
          },
          {
            id: 'contract_type',
            questionAr: 'ما نوع عقدك؟',
            questionEn: 'What is your contract type?',
            answerType: 'chips',
            options: [
              { value: 'limited', labelAr: 'محدد المدة', labelEn: 'Fixed-term' },
              { value: 'unlimited', labelAr: 'غير محدد المدة', labelEn: 'Unlimited-term' },
            ],
          },
          {
            id: 'notice_period',
            questionAr: 'ما فترة الإشعار المنصوص عليها في عقدك؟',
            questionEn: 'What is the notice period specified in your contract?',
            answerType: 'chips',
            options: [
              { value: '30', labelAr: '30 يوماً', labelEn: '30 days' },
              { value: '60', labelAr: '60 يوماً', labelEn: '60 days' },
              { value: '90', labelAr: '90 يوماً', labelEn: '90 days' },
              { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
            ],
          },
          {
            id: 'noncompete_signed',
            questionAr: 'هل وقّعت اتفاقية عدم منافسة؟',
            questionEn: 'Did you sign a non-compete agreement?',
            answerType: 'yes-no',
          },
          {
            id: 'leave_balance',
            questionAr: 'هل لديك أيام إجازة مستحقة غير مستخدمة؟',
            questionEn: 'Do you have unused annual leave days?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'employee-claim-entitlements',
        titleAr: 'المطالبة بمستحقات عمالية',
        titleEn: 'Claim Labor Entitlements',
        descriptionAr: 'تقييم حقك في مكافأة نهاية الخدمة والمستحقات الأخرى',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'entitlement_type',
            questionAr: 'ما المستحق الذي لم يُصرف لك؟',
            questionEn: 'What entitlement has not been paid?',
            answerType: 'chips',
            options: [
              { value: 'gratuity', labelAr: 'مكافأة نهاية الخدمة', labelEn: 'End-of-service gratuity' },
              { value: 'leave', labelAr: 'بدل إجازة', labelEn: 'Annual leave allowance' },
              { value: 'overtime', labelAr: 'مستحقات عمل إضافي', labelEn: 'Overtime pay' },
              { value: 'ticket', labelAr: 'تذكرة سفر العودة', labelEn: 'Return airfare' },
              { value: 'all', labelAr: 'جميع ما سبق', labelEn: 'All of the above' },
            ],
          },
          {
            id: 'termination_type',
            questionAr: 'كيف انتهت خدمتك؟',
            questionEn: 'How did your employment end?',
            answerType: 'chips',
            options: [
              { value: 'resigned', labelAr: 'استقالة', labelEn: 'Resignation' },
              { value: 'dismissed', labelAr: 'فصل من قِبل صاحب العمل', labelEn: 'Dismissal by employer' },
              { value: 'contract_end', labelAr: 'انتهاء عقد محدد المدة', labelEn: 'Fixed-term contract end' },
              { value: 'mutual', labelAr: 'اتفاق مشترك', labelEn: 'Mutual agreement' },
            ],
          },
          {
            id: 'days_since_termination',
            questionAr: 'كم يوماً مضى على انتهاء خدمتك؟',
            questionEn: 'How many days since your employment ended?',
            answerType: 'number',
            unit: 'يوم',
            placeholder: '20',
          },
          {
            id: 'mohre_complaint_filed',
            questionAr: 'هل تقدمت بشكوى لوزارة الموارد البشرية؟',
            questionEn: 'Have you filed a complaint with the Ministry of Human Resources?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'employee-harassment',
        titleAr: 'تقديم شكوى تحرش',
        titleEn: 'File Harassment Complaint',
        descriptionAr: 'إجراءات الإبلاغ عن التحرش في بيئة العمل',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'harassment_type',
            questionAr: 'ما نوع التحرش؟',
            questionEn: 'What type of harassment?',
            answerType: 'chips',
            options: [
              { value: 'sexual', labelAr: 'تحرش جنسي', labelEn: 'Sexual harassment' },
              { value: 'verbal', labelAr: 'إيذاء لفظي / تهديد', labelEn: 'Verbal abuse / threats' },
              { value: 'bullying', labelAr: 'ترهيب وتنمر', labelEn: 'Bullying' },
              { value: 'discrimination', labelAr: 'تمييز على أساس الجنس / الجنسية', labelEn: 'Discrimination based on gender/nationality' },
            ],
          },
          {
            id: 'harasser_position',
            questionAr: 'ما علاقة المتحرش بك؟',
            questionEn: 'What is the harasser\'s relationship to you?',
            answerType: 'chips',
            options: [
              { value: 'manager', labelAr: 'مدير مباشر', labelEn: 'Direct manager' },
              { value: 'colleague', labelAr: 'زميل', labelEn: 'Colleague' },
              { value: 'client', labelAr: 'عميل / زبون', labelEn: 'Client / customer' },
            ],
          },
          {
            id: 'evidence_exists',
            questionAr: 'هل لديك أدلة (رسائل، شهود، تسجيلات...إلخ)؟',
            questionEn: 'Do you have evidence (messages, witnesses, recordings)?',
            answerType: 'yes-no',
          },
          {
            id: 'internal_reported',
            questionAr: 'هل أبلغت الموارد البشرية أو الإدارة داخلياً؟',
            questionEn: 'Have you reported internally to HR or management?',
            answerType: 'yes-no',
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 7. LEGISLATOR — مشرّع
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'legislator',
    titleAr: 'مشرّع / واضع سياسات',
    titleEn: 'Legislator / Policy Maker',
    descriptionAr: 'مراجعة قانونية ودستورية قبل إصدار أو تعديل تشريع',
    icon: 'ScrollText',
    scenarios: [
      {
        id: 'legislator-review-bill',
        titleAr: 'مراجعة مشروع قانون',
        titleEn: 'Review a Bill',
        descriptionAr: 'تقييم المشروع من حيث الدستورية والاتساق التشريعي',
        jurisdictions: ['UAE', 'France', 'EU'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'bill_subject',
            questionAr: 'ما موضوع مشروع القانون؟',
            questionEn: 'What is the subject of the bill?',
            answerType: 'chips',
            options: [
              { value: 'labor', labelAr: 'تشريع عمالي', labelEn: 'Labor legislation' },
              { value: 'commercial', labelAr: 'قانون تجاري / شركات', labelEn: 'Commercial / company law' },
              { value: 'criminal', labelAr: 'قانون جزائي', labelEn: 'Criminal law' },
              { value: 'administrative', labelAr: 'قانون إداري', labelEn: 'Administrative law' },
              { value: 'civil', labelAr: 'قانون مدني / أحوال شخصية', labelEn: 'Civil / personal status law' },
              { value: 'digital', labelAr: 'تشريع رقمي / بيانات', labelEn: 'Digital / data legislation' },
            ],
          },
          {
            id: 'constitutional_review',
            questionAr: 'هل خضع المشروع لمراجعة دستورية مسبقة؟',
            questionEn: 'Has the bill undergone prior constitutional review?',
            answerType: 'yes-no',
          },
          {
            id: 'international_treaties',
            questionAr: 'هل يتأثر المشروع باتفاقيات دولية ملزمة؟',
            questionEn: 'Does the bill interact with binding international treaties?',
            answerType: 'yes-no',
          },
          {
            id: 'existing_legislation_conflict',
            questionAr: 'هل يوجد تشريع نافذ قد يتعارض مع هذا المشروع؟',
            questionEn: 'Is there existing legislation that might conflict with this bill?',
            answerType: 'yes-no',
          },
          {
            id: 'stakeholder_consultation',
            questionAr: 'هل جرت استشارة الجهات المعنية والشركاء الاجتماعيين؟',
            questionEn: 'Have relevant stakeholders and social partners been consulted?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'legislator-amend-text',
        titleAr: 'تعديل نص قانوني قائم',
        titleEn: 'Amend Existing Legal Text',
        descriptionAr: 'مراجعة قانونية لتعديل مادة أو نص في قانون نافذ',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'amendment_type',
            questionAr: 'ما طبيعة التعديل المقترح؟',
            questionEn: 'What type of amendment is proposed?',
            answerType: 'chips',
            options: [
              { value: 'add', labelAr: 'إضافة نص جديد', labelEn: 'Add new text' },
              { value: 'modify', labelAr: 'تعديل نص قائم', labelEn: 'Modify existing text' },
              { value: 'repeal', labelAr: 'إلغاء مادة', labelEn: 'Repeal an article' },
            ],
          },
          {
            id: 'retroactive',
            questionAr: 'هل التعديل ذو أثر رجعي؟',
            questionEn: 'Is the amendment retroactive?',
            answerType: 'yes-no',
          },
          {
            id: 'rights_affected',
            questionAr: 'هل يمس التعديل حقوقاً مكتسبة؟',
            questionEn: 'Does the amendment affect vested rights?',
            answerType: 'yes-no',
          },
          {
            id: 'transition_period',
            questionAr: 'هل أُعدّ نص انتقالي لحالات الجاري تنفيذها؟',
            questionEn: 'Has a transitional provision been drafted for ongoing cases?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'legislator-impact-assessment',
        titleAr: 'دراسة الأثر التشريعي',
        titleEn: 'Legislative Impact Assessment',
        descriptionAr: 'تقييم الأثر الاقتصادي والاجتماعي والقانوني لتشريع جديد',
        jurisdictions: ['UAE', 'EU'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'impact_sectors',
            questionAr: 'ما القطاعات الأكثر تأثراً بالتشريع؟',
            questionEn: 'Which sectors are most affected by the legislation?',
            answerType: 'chips',
            options: [
              { value: 'private_sector', labelAr: 'القطاع الخاص', labelEn: 'Private sector' },
              { value: 'public_sector', labelAr: 'القطاع الحكومي', labelEn: 'Public sector' },
              { value: 'sme', labelAr: 'المؤسسات الصغيرة والمتوسطة', labelEn: 'SMEs' },
              { value: 'citizens', labelAr: 'المواطنون والمقيمون', labelEn: 'Citizens & residents' },
              { value: 'all', labelAr: 'جميع القطاعات', labelEn: 'All sectors' },
            ],
          },
          {
            id: 'eu_comparable',
            questionAr: 'هل هناك تشريع مماثل في الاتحاد الأوروبي أو فرنسا يمكن الاسترشاد به؟',
            questionEn: 'Is there comparable EU or French legislation that can be referenced?',
            answerType: 'yes-no',
          },
          {
            id: 'implementation_timeline',
            questionAr: 'ما المدة المتوقعة للتطبيق الفعلي بعد الإقرار؟',
            questionEn: 'What is the expected implementation timeline after approval?',
            answerType: 'chips',
            options: [
              { value: 'immediate', labelAr: 'فور الإقرار', labelEn: 'Immediately upon approval' },
              { value: '6months', labelAr: '6 أشهر', labelEn: '6 months' },
              { value: '1year', labelAr: 'سنة', labelEn: '1 year' },
              { value: 'phased', labelAr: 'تدريجي على مراحل', labelEn: 'Phased rollout' },
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // 8. GOVERNMENT OFFICIAL — مسؤول حكومي
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'government',
    titleAr: 'مسؤول حكومي',
    titleEn: 'Government Official',
    descriptionAr: 'التحقق من سلامة القرارات الإدارية قبل إصدارها',
    icon: 'Landmark',
    scenarios: [
      {
        id: 'gov-administrative-decision',
        titleAr: 'إصدار قرار إداري',
        titleEn: 'Issue an Administrative Decision',
        descriptionAr: 'التحقق من اكتمال أركان القرار الإداري ومشروعيته',
        jurisdictions: ['UAE'],
        estimatedMinutes: 6,
        questions: [
          {
            id: 'decision_type',
            questionAr: 'ما نوع القرار الإداري؟',
            questionEn: 'What type of administrative decision?',
            answerType: 'chips',
            options: [
              { value: 'license', labelAr: 'منح رخصة أو تصريح', labelEn: 'Granting a license / permit' },
              { value: 'revoke', labelAr: 'سحب رخصة أو تصريح', labelEn: 'Revoking a license / permit' },
              { value: 'fine', labelAr: 'توقيع غرامة', labelEn: 'Imposing a fine' },
              { value: 'appointment', labelAr: 'تعيين موظف', labelEn: 'Employee appointment' },
              { value: 'contract', labelAr: 'إبرام عقد حكومي', labelEn: 'Government contract' },
              { value: 'policy', labelAr: 'إصدار لائحة أو سياسة', labelEn: 'Issuing a regulation / policy' },
            ],
          },
          {
            id: 'legal_authority',
            questionAr: 'هل لديك الاختصاص القانوني لإصدار هذا القرار؟',
            questionEn: 'Do you have the legal competence to issue this decision?',
            answerType: 'yes-no',
          },
          {
            id: 'due_process',
            questionAr: 'هل استُكملت الإجراءات المسبقة (استماع / استشارة / تحقيق)؟',
            questionEn: 'Have preliminary procedures been completed (hearing / consultation / investigation)?',
            answerType: 'yes-no',
          },
          {
            id: 'legal_basis',
            questionAr: 'هل يوجد نص قانوني صريح يسند القرار؟',
            questionEn: 'Is there an explicit legal provision supporting the decision?',
            answerType: 'yes-no',
          },
          {
            id: 'proportionality',
            questionAr: 'هل القرار متناسب مع المخالفة أو الهدف المنشود؟',
            questionEn: 'Is the decision proportionate to the violation or intended objective?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'gov-respond-appeal',
        titleAr: 'الرد على طعن إداري',
        titleEn: 'Respond to an Administrative Appeal',
        descriptionAr: 'مراجعة موقفك القانوني في مواجهة طعن إداري',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'appeal_type',
            questionAr: 'ما نوع الطعن؟',
            questionEn: 'What type of appeal?',
            answerType: 'chips',
            options: [
              { value: 'internal', labelAr: 'تظلم داخلي إداري', labelEn: 'Internal administrative grievance' },
              { value: 'court', labelAr: 'دعوى قضائية أمام المحكمة', labelEn: 'Court lawsuit' },
              { value: 'ombudsman', labelAr: 'شكوى لدى الرقابة أو الجهة الرقابية', labelEn: 'Oversight / ombudsman complaint' },
            ],
          },
          {
            id: 'decision_documented',
            questionAr: 'هل القرار الإداري موثق بما يكفي للدفاع عنه؟',
            questionEn: 'Is the administrative decision sufficiently documented to defend?',
            answerType: 'yes-no',
          },
          {
            id: 'appeal_timeline',
            questionAr: 'كم يوماً مضى على رفع الطعن؟',
            questionEn: 'How many days have passed since the appeal was filed?',
            answerType: 'number',
            unit: 'يوم',
            placeholder: '10',
          },
          {
            id: 'legal_counsel_engaged',
            questionAr: 'هل طُلبت استشارة مستشار قانوني متخصص؟',
            questionEn: 'Has specialized legal counsel been consulted?',
            answerType: 'yes-no',
          },
        ],
      },
      {
        id: 'gov-investigate-violation',
        titleAr: 'التحقيق في مخالفة',
        titleEn: 'Investigate a Violation',
        descriptionAr: 'إجراءات التحقيق الإداري الصحيحة',
        jurisdictions: ['UAE'],
        estimatedMinutes: 5,
        questions: [
          {
            id: 'violation_nature',
            questionAr: 'ما طبيعة المخالفة المحققة فيها؟',
            questionEn: 'What is the nature of the violation under investigation?',
            answerType: 'chips',
            options: [
              { value: 'financial', labelAr: 'مالية / فساد', labelEn: 'Financial / corruption' },
              { value: 'regulatory', labelAr: 'مخالفة تنظيمية', labelEn: 'Regulatory non-compliance' },
              { value: 'employee', labelAr: 'سلوك موظف حكومي', labelEn: 'Government employee conduct' },
              { value: 'contractor', labelAr: 'إخلال متعاقد بالتزاماته', labelEn: 'Contractor default' },
            ],
          },
          {
            id: 'subject_informed',
            questionAr: 'هل أُخطر الشخص موضوع التحقيق رسمياً؟',
            questionEn: 'Has the subject of the investigation been formally notified?',
            answerType: 'yes-no',
          },
          {
            id: 'evidence_secured',
            questionAr: 'هل جُمعت الأدلة وحُفظت بطريقة سليمة؟',
            questionEn: 'Has evidence been collected and preserved properly?',
            answerType: 'yes-no',
          },
          {
            id: 'hearing_held',
            questionAr: 'هل أُجريت جلسة استماع مع المتهم أو المخالف؟',
            questionEn: 'Has a hearing been held with the accused / violating party?',
            answerType: 'yes-no',
          },
        ],
      },
    ],
  },
];

/** Flat lookup: scenarioId → Scenario */
export function findScenario(roleId: string, scenarioId: string): Scenario | undefined {
  const role = ROLES.find((r) => r.id === roleId);
  return role?.scenarios.find((s) => s.id === scenarioId);
}

/** Build a human-readable summary of answers for use in AI prompts */
export function formatAnswers(scenario: Scenario, answers: Record<string, string>): string {
  return scenario.questions
    .map((q) => {
      const raw = answers[q.id];
      if (!raw) return null;
      let display = raw;
      if (q.answerType === 'chips' && q.options) {
        const opt = q.options.find((o) => o.value === raw);
        display = opt ? `${opt.labelAr} (${opt.labelEn})` : raw;
      } else if (q.answerType === 'yes-no') {
        display = raw === 'yes' ? 'نعم (Yes)' : 'لا (No)';
      }
      return `• ${q.questionAr}: ${display}`;
    })
    .filter(Boolean)
    .join('\n');
}
