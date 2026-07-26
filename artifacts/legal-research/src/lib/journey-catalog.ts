/**
 * Journey Catalog — رحلة مرصد الموجهة
 *
 * The single source of truth for the guided journey templates (المرفق ١):
 *   الصفحة الرئيسية (المسارات المهنية بترتيبها)
 *     → اختيار الفئة التفصيلية
 *       → مسار الخدمة التشعبي (خدمات مرتبة لكل فئة)
 *         → تفصيل الخدمة (مراحل + قوائم فحص + أدوات مساعدة)
 *           → تحديد نوع الواقعة
 *             → إدخال المعطيات التفصيلية
 *               → النتيجة الذكية (محرك SPG الحالي — بلا أي تغيير في الأتمتة)
 *
 * Ordering of arrays here is meaningful — it drives on-screen ordering exactly
 * as laid out in the reference mockup.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JourneyStage {
  id:        string;
  nameAr:    string;
  /** Ordered checklist items shown for this stage. */
  checklist: string[];
  /** Optional structured interactive block rendered above the checklist —
   *  used sparingly for stage-specific compliance widgets (e.g. prosecution
   *  notification/authorization capture). Stages without it render as before. */
  interactive?: JourneyStageInteractive;
}

/** A single question inside a JourneyStageInteractive block. */
export interface JourneyInteractiveQuestion {
  id:       string;
  promptAr: string;
  options:  string[];
  /** When set, selecting this exact option reveals `fields` below the question. */
  revealFieldsOnOption?: string;
  fields?:  JourneyFormField[];
}

/** A self-contained interactive widget scoped to one journey stage. */
export interface JourneyStageInteractive {
  titleAr:  string;
  /** Short legal/procedural caveat shown under the widget title. */
  noteAr?:  string;
  questions: JourneyInteractiveQuestion[];
}

export interface JourneyTool {
  id:     string;
  nameAr: string;
  icon:   string;
}

export interface JourneyService {
  id:      string;
  nameAr:  string;
  /** Short description line under the service name (as in the mockup list). */
  descAr:  string;
  icon:    string;
  /** Ordered stages of the service (screen 5 stepper). */
  stages:  JourneyStage[];
  /** Helper tools strip (screen 5). */
  tools:   JourneyTool[];
  /** When set, the service links directly to an existing module instead of the wizard. */
  href?:   string;
}

export interface JourneyCategory {
  id:       string;
  nameAr:   string;
  icon:     string;
  /** Welcome line shown after selecting the category (screen 3 bottom card). */
  welcomeAr: string;
  /** Ordered services for this category (screen 4). */
  services: JourneyService[];
  /** Mapping into the existing SPG catalogue — keeps the current AI automation untouched. */
  spg: { sectorId: string; sectorNameAr: string; roleId: string; roleNameAr: string };
}

export interface JourneyIncidentType {
  id:     string;
  nameAr: string;
  icon:   string;
}

export interface JourneyFormField {
  id:          string;
  labelAr:     string;
  type:        'text' | 'textarea' | 'datetime' | 'boolean' | 'select';
  required?:   boolean;
  options?:    string[];
  placeholder?: string;
}

export interface JourneyPath {
  id:        string;
  nameAr:    string;
  nameEn:    string;
  icon:      string;
  /** Ordered detailed categories (screen 3). */
  categories: JourneyCategory[];
  /** Incident/case types for this path (screen 6). Falls back to DEFAULT_INCIDENT_TYPES. */
  incidentTypes?: JourneyIncidentType[];
  /** Label used for the "incident" concept in this path (واقعة / دعوى / قضية / مهمة). */
  incidentLabelAr: string;
}

// ─── Shared building blocks ───────────────────────────────────────────────────

const DEFAULT_TOOLS: JourneyTool[] = [
  { id: 'checklist',  nameAr: 'قائمة فحص',      icon: '📋' },
  { id: 'report',     nameAr: 'نموذج بلاغ',      icon: '📝' },
  { id: 'inspection', nameAr: 'أدوات المعاينة',  icon: '🛠️' },
  { id: 'legal-apps', nameAr: 'تطبيقات قانونية', icon: '⚖️' },
];

/** Generic 5-stage template used by services that don't define bespoke stages. */
function genericStages(subject: string): JourneyStage[] {
  return [
    {
      id: 'before', nameAr: 'قبل البدء',
      checklist: [
        `التحقق من الاختصاص والصلاحية القانونية قبل مباشرة ${subject}`,
        'مراجعة السند القانوني والإجراءات المنظمة',
        'تجهيز المستندات والنماذج المطلوبة',
        'التأكد من اكتمال البيانات الأولية',
      ],
    },
    {
      id: 'during', nameAr: 'أثناء الإجراء',
      checklist: [
        'الالتزام بالضمانات القانونية والإجرائية',
        'توثيق كل خطوة بتاريخها ووقتها',
        'التحقق من صحة البيانات والمعلومات الواردة',
        'إشراك الجهات المختصة عند الحاجة',
      ],
    },
    {
      id: 'documentation', nameAr: 'التوثيق',
      checklist: [
        'تحرير المحضر أو التقرير وفق النموذج المعتمد',
        'إرفاق المستندات والأدلة المؤيدة',
        'مراجعة الصياغة القانونية قبل الاعتماد',
      ],
    },
    {
      id: 'after', nameAr: 'بعد الانتهاء',
      checklist: [
        'إحالة الملف إلى الجهة المختصة',
        'حفظ نسخة موثقة في السجل',
        'متابعة الإجراء اللاحق والتحقق من الاستلام',
      ],
    },
    {
      id: 'review', nameAr: 'مراجعة خطوة بخطوة',
      checklist: [
        'مراجعة اكتمال جميع الخطوات السابقة',
        'التحقق من عدم وجود أخطاء إجرائية مؤثرة',
        'تقييم المخاطر المتبقية وتوثيق الملاحظات',
      ],
    },
  ];
}

/** Builds a standard wizard service with generic stages. */
function svc(id: string, nameAr: string, descAr: string, icon: string, stages?: JourneyStage[]): JourneyService {
  return { id, nameAr, descAr, icon, stages: stages ?? genericStages(nameAr), tools: DEFAULT_TOOLS };
}

// ─── مسرح الجريمة — bespoke stages (سيناريو «أنت في مسرح جريمة») ───────────────
// تسعة مراحل: قبل الانتقال (وفيها إخطار النيابة العامة) ← عند الوصول ← أثناء
// التعامل مع مسرح الجريمة ← ماذا تسأل؟ ← ماذا تقول؟ ← ماذا تحرر؟ ← متى تمتنع؟ ←
// بعد الانتهاء ← التقييم النهائي. هذه المراحل خاصة بهذا السيناريو فقط ولا تُعرض
// كعناصر مستقلة في القائمة الجانبية.

const CRIME_SCENE_STAGES: JourneyStage[] = [
  {
    id: 'before-travel', nameAr: 'قبل الانتقال',
    checklist: [
      'تلقي البلاغ وتوجيهه فوراً',
      'تحديد نوع البلاغ وموقعه بدقة',
      'إبلاغ غرفة العمليات والجهات المختصة',
      'إحضار الأدوات والمعدات اللازمة',
      'الاطلاع على أي معلومات أولية متاحة',
      'التأكد من وسائل السلامة المتاحة',
    ],
    interactive: {
      titleAr: 'إخطار النيابة العامة وأخذ التوجيه',
      noteAr:
        'لا يتطلب مجرد الانتقال لتأمين الموقع أو معاينة الواقعة دائمًا إذنًا مسبقًا، أما الإجراءات التي تمس حرمة المسكن أو الأشخاص فتخضع للضوابط القانونية، مع مراعاة حالات التلبس والاستعجال وخطر ضياع الأدلة.',
      questions: [
        {
          id: 'notify-status',
          promptAr: 'هل تم إخطار النيابة العامة أو أخذ توجيهها قبل الانتقال؟',
          options: [
            'نعم، تم الإخطار وأخذ التوجيه.',
            'تم الإخطار ولم يصدر التوجيه بعد.',
            'الحالة عاجلة وتم الانتقال فورًا مع إخطار النيابة العامة.',
            'الواقعة لا تستلزم إذنًا مسبقًا لمجرد الانتقال.',
            'لم يتم الإخطار.',
          ],
        },
        {
          id: 'permit-needed',
          promptAr: 'هل يتضمن الإجراء دخول مسكن أو تفتيشًا أو ضبطًا أو أي إجراء يحتاج إلى إذن؟',
          options: ['نعم.', 'لا.', 'غير واضح ويحتاج إلى مراجعة.'],
          revealFieldsOnOption: 'نعم.',
          fields: [
            { id: 'prosecutor-name', labelAr: 'اسم عضو النيابة العامة', type: 'text' },
            { id: 'permit-ref',      labelAr: 'رقم الإذن أو رقم المرجع', type: 'text' },
            { id: 'permit-date',     labelAr: 'تاريخ الإذن',            type: 'text', placeholder: 'يوم / شهر / سنة' },
            { id: 'permit-time',     labelAr: 'وقت الإذن',              type: 'text', placeholder: 'الساعة' },
            { id: 'permit-type',     labelAr: 'نوع الإذن أو التوجيه',   type: 'text' },
            { id: 'permit-scope',    labelAr: 'نطاق الإذن',             type: 'textarea' },
            { id: 'permit-duration', labelAr: 'مدة سريان الإذن',        type: 'text' },
            { id: 'permit-notes',    labelAr: 'ملاحظات',                type: 'textarea' },
          ],
        },
      ],
    },
  },
  {
    id: 'on-arrival', nameAr: 'عند الوصول',
    checklist: [
      'تأمين محيط مسرح الحادث ومنع الاقتراب',
      'تقديم الإسعافات الأولية للمصابين إن وجدوا',
      'تحديد المداخل والمخارج ومسار الدخول الآمن',
      'رصد الأشخاص المتواجدين وتدوين بياناتهم',
      'حماية الأدلة القابلة للتلف أو الزوال',
    ],
  },
  {
    id: 'handling-scene', nameAr: 'أثناء التعامل مع مسرح الجريمة',
    checklist: [
      'التصوير الشامل للموقع قبل أي تحريك',
      'رفع الأدلة المادية وترقيمها وتوثيقها',
      'رسم مخطط تفصيلي (كروكي) لمسرح الحادث',
      'سماع أقوال الشهود الأوائل وتدوينها',
      'التنسيق مع خبراء الأدلة الجنائية',
    ],
  },
  {
    id: 'what-to-ask', nameAr: 'ماذا تسأل؟',
    checklist: [
      'من كان أول من وصل إلى الموقع أو اكتشف الواقعة؟',
      'ما الذي شاهدته أو سمعته بالتحديد؟ وفي أي وقت؟',
      'هل تم تحريك أو لمس أي شيء في الموقع قبل وصولك؟',
      'هل يوجد شهود آخرون أو أشخاص غادروا الموقع قبل وصولك؟',
      'هل توجد كاميرات مراقبة قريبة من الموقع يمكن الرجوع إليها؟',
      'هل هناك علاقة سابقة أو خلافات معروفة بين الأطراف؟',
      'كيف تم تحديد وقت وقوع الحادث تقريبًا؟',
    ],
  },
  {
    id: 'what-to-say', nameAr: 'ماذا تقول؟',
    checklist: [
      'الإفصاح فقط بالمعلومات العامة اللازمة لطمأنة الحاضرين، دون ذكر تفاصيل التحقيق.',
      'عدم التكهن أو الجزم بسبب الواقعة أو هوية أي طرف أمام الشهود أو وسائل الإعلام.',
      'إحالة أي استفسار إعلامي إلى الجهة المختصة بالتواصل الرسمي.',
      'إبلاغ الحاضرين بإجراءات التعامل مع مسرح الحادث دون وعود بنتائج التحقيق.',
      'توثيق أي تصريح يُدلى به من الشهود أو الأطراف بلغة محايدة لا توحي بإدانة أو تبرئة مسبقة.',
    ],
  },
  {
    id: 'what-to-document', nameAr: 'ماذا تحرر؟',
    checklist: [
      'تحرير محضر معاينة مسرح الحادث بالتفصيل والتسلسل الزمني',
      'إثبات إخطار النيابة العامة وإثبات وقت الاتصال بها',
      'اسم عضو النيابة العامة الذي تم التواصل معه، والتوجيه الصادر عنه',
      'بيانات الإذن عند وجوده، ونطاقه ومدة سريانه',
      'إثبات سبب الانتقال العاجل قبل صدور التوجيه، عند الضرورة',
      'تسليم الأدلة وفق سلسلة حيازة موثقة',
      'رفع التقرير الشامل للجهة المختصة',
    ],
  },
  {
    id: 'when-to-abstain', nameAr: 'متى تمتنع؟',
    checklist: [
      'الامتناع عن دخول مسكن أو مكان خاص دون إذن أو توجيه من النيابة العامة، إلا في حالات التلبس أو الخطر العاجل على الأرواح أو الأدلة.',
      'الامتناع عن تفتيش الأشخاص أو الأماكن أو ضبط أي منقول دون سند قانوني واضح.',
      'الامتناع عن الإدلاء بأي رأي حول ثبوت التهمة أو براءة أي طرف.',
      'الامتناع عن تحريك أو نقل أي دليل قبل توثيقه وتصويره.',
      'الامتناع عن تسليم أي معلومة أو مستند للإعلام أو الغير دون إذن الجهة المختصة.',
    ],
  },
  {
    id: 'after', nameAr: 'بعد الانتهاء',
    checklist: [
      'التأكد من رفع الحراسة عن الموقع بعد الإذن بذلك',
      'إعادة الموقع إلى وضعه الطبيعي إن أمكن وبعد موافقة الجهة المختصة',
      'متابعة استكمال أي إجراء لاحق يتعلق بمسرح الحادث',
    ],
  },
  {
    id: 'final-evaluation', nameAr: 'التقييم النهائي',
    checklist: [
      'سلامة إخطار النيابة العامة وتوثيقه',
      'صحة تحديد الحاجة إلى إذن مسبق من عدمها',
      'الالتزام بنطاق الإذن الصادر ومدته',
      'مشروعية الدخول والتفتيش والضبط إن وُجد',
      'توثيق الاتصال والتوجيه الصادر عن النيابة العامة بصورة صحيحة',
      'مراجعة اكتمال محضر المعاينة والمرفقات',
      'التحقق من سلامة سلسلة حيازة الأدلة',
      'رصد أي ثغرات إجرائية قد تؤثر على الدعوى',
    ],
  },
];

// ─── الجهات الشرطية — services shared by police categories (screen 4 order) ────

function policeServices(): JourneyService[] {
  return [
    { ...svc('crime-scene', 'مسرح الجريمة', 'إدارة المعاينة وجمع الأدلة وتوثيق الموقع', '🕵️', CRIME_SCENE_STAGES) },
    svc('station-complaint', 'مباشرة الاستدلالات', 'استقبال البلاغ وجمع الاستدلالات والتحري', '🏢'),
    svc('suspect-interrogation', 'استجواب مشتبه به', 'التحقيق والاستجواب وفق الضمانات القانونية', '🗣️'),
    svc('reports-drafting', 'تحرير محاضر', 'محضر استدلال — ضبط — إثبات حالة', '📄'),
    svc('evidence-management', 'إدارة الأدلة', 'حفظ الأدلة وتحليلها وسلسلة الحيازة', '🧾'),
    svc('risk-alerts', 'المخاطر والتنبيهات', 'تحليل المخاطر والإشعارات القانونية', '⚠️'),
    svc('training-scenarios', 'التدريب والسيناريوهات', 'سيناريوهات تفاعلية وتدريب مهني', '🎓'),
  ];
}

// ─── Generic service sets per path ────────────────────────────────────────────

function judiciaryServices(): JourneyService[] {
  return [
    svc('case-management', 'إدارة الدعوى', 'دراسة ملف الدعوى وتحضير الجلسات', '📁'),
    svc('hearing', 'إدارة الجلسة', 'ضبط الجلسة وسماع الأطراف والشهود', '🏛️'),
    svc('deliberation', 'المداولة والتسبيب', 'بناء الحكم وتسبيبه وفق المنهج القضائي', '🧠'),
    svc('judgment-drafting', 'صياغة الحكم', 'تحرير منطوق الحكم وأسبابه', '✍️'),
    svc('execution', 'التنفيذ والإشكالات', 'إجراءات التنفيذ والفصل في إشكالاته', '⚙️'),
    svc('risk-alerts', 'المخاطر والتنبيهات', 'تحليل مخاطر الطعن والنقض', '⚠️'),
    svc('training-scenarios', 'التدريب والسيناريوهات', 'محاكاة قضائية وتدريب مهني', '🎓'),
  ];
}

function prosecutionServices(): JourneyService[] {
  return [
    svc('investigation-file', 'ملف التحقيق', 'فتح التحقيق ودراسة الأوراق والاستدلالات', '📁'),
    svc('interrogation', 'الاستجواب وسماع الأقوال', 'استجواب المتهم وسماع الشهود وفق الضمانات', '🗣️'),
    svc('detention-orders', 'أوامر الحبس والإفراج', 'تقدير الحبس الاحتياطي وبدائله', '🔒'),
    svc('disposition', 'التصرف في التحقيق', 'الإحالة أو الحفظ أو الأمر الجنائي', '⚖️'),
    svc('trial-attendance', 'المرافعة أمام المحكمة', 'تمثيل الاتهام ومتابعة الدعوى', '🏛️'),
    svc('risk-alerts', 'المخاطر والتنبيهات', 'تحليل مخاطر البطلان الإجرائي', '⚠️'),
    svc('training-scenarios', 'التدريب والسيناريوهات', 'سيناريوهات نيابية تفاعلية', '🎓'),
  ];
}

function lawyerServices(): JourneyService[] {
  return [
    svc('case-intake', 'دراسة القضية والتوكيل', 'تقييم الموقف القانوني وقبول التوكيل', '📁'),
    svc('memo-drafting', 'صياغة المذكرات', 'مذكرات الدفاع واللوائح والطلبات', '✍️'),
    svc('litigation', 'إدارة التقاضي', 'متابعة الجلسات والطعون والمواعيد', '🏛️'),
    svc('legal-opinion', 'الرأي والاستشارة القانونية', 'إعداد الآراء القانونية للعملاء', '💡'),
    svc('contracts', 'العقود والمراجعة', 'صياغة العقود ومراجعتها', '📜'),
    svc('risk-alerts', 'المخاطر والتنبيهات', 'مخاطر السقوط والتقادم والمواعيد', '⚠️'),
    svc('training-scenarios', 'التدريب والسيناريوهات', 'تدريب مهني تفاعلي', '🎓'),
  ];
}

function executiveServices(): JourneyService[] {
  return [
    svc('decision-issuance', 'إصدار القرار الإداري', 'بناء القرار وأركانه وتسبيبه', '🖋️'),
    svc('delegation', 'التفويض والصلاحيات', 'حوكمة التفويض وسلسلة الاعتماد', '🔗'),
    svc('grievances', 'التظلمات والطعون', 'دراسة التظلمات والرد عليها', '📮'),
    svc('governance-review', 'المراجعة والحوكمة', 'مراجعة القرارات ومؤشرات الالتزام', '🛡️'),
    svc('crisis-management', 'إدارة الأزمات', 'قرارات الطوارئ والاستجابة السريعة', '🚨'),
    svc('risk-alerts', 'المخاطر والتنبيهات', 'تحليل المخاطر القانونية والمؤسسية', '⚠️'),
    svc('training-scenarios', 'التدريب والسيناريوهات', 'محاكاة قرارات تنفيذية', '🎓'),
  ];
}

function academicServices(): JourneyService[] {
  return [
    svc('research-plan', 'خطة البحث', 'صياغة الإشكالية والمنهجية', '🗺️'),
    svc('literature', 'المراجعة الأدبية', 'جمع المصادر وتحليلها', '📚'),
    svc('legal-analysis', 'التحليل القانوني', 'تحليل النصوص والسوابق والمقارن', '🔬'),
    svc('writing', 'الكتابة الأكاديمية', 'التحرير والتوثيق والاقتباس', '✍️'),
    svc('publication', 'النشر والتحكيم', 'تجهيز البحث للنشر العلمي', '🏅'),
    svc('risk-alerts', 'المخاطر والتنبيهات', 'الانتحال والأخطاء المنهجية', '⚠️'),
    svc('training-scenarios', 'التدريب والسيناريوهات', 'تمارين بحثية تفاعلية', '🎓'),
  ];
}

function publicServices(): JourneyService[] {
  return [
    svc('know-your-rights', 'اعرف حقوقك', 'استعلام مبسط عن الحقوق والواجبات', '📖'),
    svc('complaint-filing', 'تقديم شكوى أو بلاغ', 'خطوات تقديم الشكوى للجهة المختصة', '📮'),
    svc('grievance', 'التظلم من قرار إداري', 'كيفية التظلم ومواعيده', '🧾'),
    svc('document-help', 'المستندات والنماذج', 'النماذج المطلوبة وطريقة تعبئتها', '📄'),
    svc('risk-alerts', 'المخاطر والتنبيهات', 'تنبيهات الاحتيال والجرائم الحديثة', '⚠️'),
  ];
}

// ─── Category factory ─────────────────────────────────────────────────────────

function cat(
  id: string, nameAr: string, icon: string, welcomeAr: string,
  services: JourneyService[],
  spg: JourneyCategory['spg'],
): JourneyCategory {
  return { id, nameAr, icon, welcomeAr, services, spg };
}

const SPG = {
  judge:        { sectorId: 'law_judiciary', sectorNameAr: 'القانون والقضاء', roleId: 'judge',            roleNameAr: 'القاضي' },
  prosecutor:   { sectorId: 'law_judiciary', sectorNameAr: 'القانون والقضاء', roleId: 'prosecutor',       roleNameAr: 'وكيل النيابة' },
  lawyer:       { sectorId: 'law_judiciary', sectorNameAr: 'القانون والقضاء', roleId: 'lawyer',           roleNameAr: 'المحامي' },
  legalAdvisor: { sectorId: 'law_judiciary', sectorNameAr: 'القانون والقضاء', roleId: 'legal_advisor',    roleNameAr: 'المستشار القانوني' },
  legalResearcher: { sectorId: 'law_judiciary', sectorNameAr: 'القانون والقضاء', roleId: 'legal_researcher', roleNameAr: 'الباحث القانوني' },
  police:       { sectorId: 'security_investigation', sectorNameAr: 'الأمن والتحقيق', roleId: 'police_officer',        roleNameAr: 'ضابط الشرطة' },
  judicialOfficer: { sectorId: 'security_investigation', sectorNameAr: 'الأمن والتحقيق', roleId: 'judicial_officer',   roleNameAr: 'رجل الضبط القضائي' },
  forensicInvestigator: { sectorId: 'security_investigation', sectorNameAr: 'الأمن والتحقيق', roleId: 'forensic_investigator', roleNameAr: 'المحقق الجنائي' },
  forensicEvidence: { sectorId: 'security_investigation', sectorNameAr: 'الأمن والتحقيق', roleId: 'forensic_evidence', roleNameAr: 'الأدلة الجنائية' },
  crimeScene:   { sectorId: 'security_investigation', sectorNameAr: 'الأمن والتحقيق', roleId: 'crime_scene', roleNameAr: 'مسرح الجريمة' },
  adminDecision: { sectorId: 'government_admin', sectorNameAr: 'الإدارة الحكومية', roleId: 'admin_decision_maker', roleNameAr: 'متخذ القرار الإداري' },
  researcher:   { sectorId: 'academics', sectorNameAr: 'الأكاديميون', roleId: 'researcher',            roleNameAr: 'الباحث' },
  supervisor:   { sectorId: 'academics', sectorNameAr: 'الأكاديميون', roleId: 'scientific_supervisor', roleNameAr: 'المشرف العلمي' },
  masters:      { sectorId: 'academics', sectorNameAr: 'الأكاديميون', roleId: 'masters_student',       roleNameAr: 'طالب الماجستير' },
  phd:          { sectorId: 'academics', sectorNameAr: 'الأكاديميون', roleId: 'phd_student',           roleNameAr: 'طالب الدكتوراه' },
} as const;

// ─── Incident type sets (screen 6) ────────────────────────────────────────────

export const DEFAULT_INCIDENT_TYPES: JourneyIncidentType[] = [
  { id: 'theft',        nameAr: 'سرقة',            icon: '🕶️' },
  { id: 'fraud',        nameAr: 'احتيال',          icon: '🎭' },
  { id: 'assault',      nameAr: 'اعتداء',          icon: '🤼' },
  { id: 'fire',         nameAr: 'حريق',            icon: '🔥' },
  { id: 'traffic',      nameAr: 'حادث مروري',      icon: '🚗' },
  { id: 'death',        nameAr: 'وفاة',            icon: '🕊️' },
  { id: 'domestic',     nameAr: 'عنف أسري',        icon: '🏠' },
  { id: 'cyber',        nameAr: 'جريمة إلكترونية', icon: '💻' },
  { id: 'forgery',      nameAr: 'تزوير',           icon: '📑' },
  { id: 'drugs',        nameAr: 'مخدرات',          icon: '💊' },
  { id: 'property',     nameAr: 'إتلاف مال',       icon: '💥' },
  { id: 'other',        nameAr: 'أخرى',            icon: '➕' },
];

const CASE_TYPES: JourneyIncidentType[] = [
  { id: 'civil',      nameAr: 'مدني',           icon: '🤝' },
  { id: 'criminal',   nameAr: 'جزائي',          icon: '⚖️' },
  { id: 'admin',      nameAr: 'إداري',          icon: '🏛️' },
  { id: 'commercial', nameAr: 'تجاري',          icon: '💼' },
  { id: 'labor',      nameAr: 'عمالي',          icon: '👷' },
  { id: 'family',     nameAr: 'أحوال شخصية',    icon: '👪' },
  { id: 'rental',     nameAr: 'إيجاري',         icon: '🏢' },
  { id: 'execution',  nameAr: 'تنفيذ',          icon: '⚙️' },
  { id: 'appeal',     nameAr: 'استئناف / طعن',  icon: '📮' },
  { id: 'other',      nameAr: 'أخرى',           icon: '➕' },
];

const ADMIN_TYPES: JourneyIncidentType[] = [
  { id: 'disciplinary', nameAr: 'قرار تأديبي',        icon: '🧷' },
  { id: 'appointment',  nameAr: 'تعيين / ترقية',      icon: '📈' },
  { id: 'termination',  nameAr: 'إنهاء خدمة',         icon: '📤' },
  { id: 'license',      nameAr: 'ترخيص / تصريح',      icon: '🪪' },
  { id: 'tender',       nameAr: 'مشتريات / مناقصة',   icon: '📦' },
  { id: 'algorithmic',  nameAr: 'قرار خوارزمي',       icon: '🤖' },
  { id: 'emergency',    nameAr: 'قرار طارئ',          icon: '🚨' },
  { id: 'other',        nameAr: 'أخرى',               icon: '➕' },
];

const RESEARCH_TYPES: JourneyIncidentType[] = [
  { id: 'thesis',      nameAr: 'رسالة علمية',     icon: '🎓' },
  { id: 'paper',       nameAr: 'ورقة بحثية',      icon: '📄' },
  { id: 'comparative', nameAr: 'دراسة مقارنة',    icon: '🌍' },
  { id: 'case-note',   nameAr: 'تعليق على حكم',   icon: '🖊️' },
  { id: 'review',      nameAr: 'مراجعة أدبية',    icon: '📚' },
  { id: 'other',       nameAr: 'أخرى',            icon: '➕' },
];

// ─── Case form fields (screen 7) ──────────────────────────────────────────────

export const CASE_FORM_FIELDS: JourneyFormField[] = [
  { id: 'datetime',   labelAr: 'التاريخ والوقت',            type: 'datetime', required: true },
  { id: 'location',   labelAr: 'المكان',                    type: 'text',     required: true,  placeholder: 'مثال: أبوظبي — مدينة محمد بن زايد، فيلا رقم 21' },
  { id: 'description',labelAr: 'وصف الواقعة',               type: 'textarea', required: true,  placeholder: 'صف الواقعة بدقة: ما الذي حدث؟ وكيف؟' },
  { id: 'casualties', labelAr: 'وجود وفيات أو إصابات',      type: 'boolean' },
  { id: 'witnesses',  labelAr: 'وجود شهود',                 type: 'boolean' },
  { id: 'cameras',    labelAr: 'وجود كاميرات مراقبة',       type: 'boolean' },
  { id: 'agencies',   labelAr: 'الجهات المنفذة / الحاضرة',  type: 'text',     placeholder: 'مثال: الدفاع المدني — إسعاف — كهرباء' },
  { id: 'notes',      labelAr: 'ملاحظات أولية',             type: 'textarea', placeholder: 'أي معلومات إضافية مهمة' },
];

// ─── The paths (screen 2 order — exactly as the mockup) ───────────────────────

export const JOURNEY_PATHS: JourneyPath[] = [
  {
    id: 'judiciary', nameAr: 'القضاء', nameEn: 'Judiciary', icon: '⚖️',
    incidentLabelAr: 'الدعوى',
    incidentTypes: CASE_TYPES,
    categories: [
      cat('judge', 'قاضٍ', '👨‍⚖️', 'مرحباً بك سعادة القاضي. تم تجهيز بيئة العمل والأدوات القضائية التي تساعدك في أداء مهامك بكفاءة وسرعة عالية.', judiciaryServices(), SPG.judge),
      cat('trainee-judge', 'متدرب قضائي', '🎓', 'مرحباً بك أيها المتدرب القضائي. تم تجهيز مسار تدريبي متكامل يرافقك خطوة بخطوة في رحلتك القضائية.', judiciaryServices(), SPG.judge),
      cat('chief-judge', 'رئيس دائرة', '🏛️', 'مرحباً بك سعادة رئيس الدائرة. تم تجهيز أدوات إدارة الدائرة والمداولات القضائية.', judiciaryServices(), SPG.judge),
      cat('execution-judge', 'قاضي تنفيذ', '⚙️', 'مرحباً بك سعادة قاضي التنفيذ. تم تجهيز أدوات إدارة ملفات التنفيذ وإشكالاته.', judiciaryServices(), SPG.judge),
      cat('court-admin', 'إدارة المحكمة', '🗂️', 'مرحباً بك. تم تجهيز أدوات إدارة العمل القضائي والجداول والجلسات.', judiciaryServices(), SPG.legalAdvisor),
    ],
  },
  {
    // شعار النيابة العامة يُعرض كـ SVG معتمد (الخيار 5 — ميزان بمحور إنسان وغصن غار)
    // عبر PathIcon في components/icons/prosecution-emblem.tsx؛ الرمز هنا احتياطي فقط.
    id: 'prosecution', nameAr: 'النيابة العامة', nameEn: 'Public Prosecution', icon: '⚖️',
    incidentLabelAr: 'الواقعة',
    categories: [
      cat('prosecutor', 'وكيل نيابة', '🧑‍⚖️', 'مرحباً بك سعادة وكيل النيابة. تم تجهيز بيئة التحقيق والأدوات التي تساعدك في أداء مهامك بكفاءة وسرعة عالية.', prosecutionServices(), SPG.prosecutor),
      cat('chief-prosecutor', 'رئيس نيابة', '⭐', 'مرحباً بك سعادة رئيس النيابة. تم تجهيز أدوات الإشراف على التحقيقات والتصرف فيها.', prosecutionServices(), SPG.prosecutor),
      cat('deputy-prosecutor', 'معاون نيابة', '🧭', 'مرحباً بك. تم تجهيز مسار مهني موجه لمعاوني النيابة خطوة بخطوة.', prosecutionServices(), SPG.prosecutor),
      cat('new-member', 'عضو نيابة مستجد', '🌱', 'مرحباً بك. تم تجهيز مسار تدريبي متدرج يرافقك في بداية عملك النيابي.', prosecutionServices(), SPG.prosecutor),
      cat('investigation-admin', 'إدارة التحقيقات', '🗄️', 'مرحباً بك. تم تجهيز أدوات إدارة ملفات التحقيق ومتابعتها.', prosecutionServices(), SPG.prosecutor),
    ],
  },
  {
    id: 'police', nameAr: 'الجهات الشرطية وإنفاذ القانون', nameEn: 'Police & Law Enforcement', icon: '👮',
    incidentLabelAr: 'الواقعة',
    categories: [
      cat('station-officer', 'ضابط مركز شرطة', '👮', 'مرحباً بك سعادة الضابط. بما أنك ضمن (ضباط مركز الشرطة)، تم تجهيز بيئة العمل والأدوات التي تساعدك في أداء مهامك بكفاءة وسرعة عالية.', policeServices(), SPG.police),
      cat('criminal-investigator', 'محقق جنائي', '🕵️', 'مرحباً بك أيها المحقق. تم تجهيز أدوات التحقيق الجنائي وجمع الاستدلالات.', policeServices(), SPG.forensicInvestigator),
      cat('judicial-officer', 'مأمور ضبط قضائي', '🪪', 'مرحباً بك. تم تجهيز أدوات الضبط القضائي وفق الضمانات القانونية.', policeServices(), SPG.judicialOfficer),
      cat('evidence-expert', 'خبير استدلالات', '🔬', 'مرحباً بك أيها الخبير. تم تجهيز أدوات فحص الأدلة والاستدلالات الجنائية.', policeServices(), SPG.forensicEvidence),
      cat('report-clerk', 'كاتب محضر', '🖊️', 'مرحباً بك. تم تجهيز نماذج المحاضر وأدوات التحرير والتوثيق وفق الأصول القانونية.', policeServices(), SPG.judicialOfficer),
      cat('new-officer', 'ضابط مستجد', '🌱', 'مرحباً بك أيها الضابط المستجد. تم تجهيز مسار تدريبي يرافقك خطوة بخطوة في بداية عملك.', policeServices(), SPG.police),
      cat('operations', 'إدارة العمليات', '🖥️', 'مرحباً بك. تم تجهيز أدوات إدارة غرفة العمليات وتوجيه البلاغات.', policeServices(), SPG.police),
    ],
  },
  {
    id: 'lawyers', nameAr: 'المحامون والاستشاريون', nameEn: 'Lawyers & Consultants', icon: '💼',
    incidentLabelAr: 'القضية',
    incidentTypes: CASE_TYPES,
    categories: [
      cat('lawyer', 'محامٍ', '💼', 'مرحباً بك أيها المحامي. تم تجهيز أدوات إدارة القضايا والمذكرات والمرافعات.', lawyerServices(), SPG.lawyer),
      cat('legal-consultant', 'مستشار قانوني', '💡', 'مرحباً بك أيها المستشار. تم تجهيز أدوات الرأي القانوني والاستشارات.', lawyerServices(), SPG.legalAdvisor),
      cat('trainee-lawyer', 'محامٍ متدرب', '🎓', 'مرحباً بك. تم تجهيز مسار تدريبي مهني يرافقك في بداية ممارستك.', lawyerServices(), SPG.lawyer),
      cat('legal-researcher', 'باحث قانوني', '📚', 'مرحباً بك أيها الباحث. تم تجهيز أدوات البحث والتحليل القانوني.', lawyerServices(), SPG.legalResearcher),
    ],
  },
  {
    id: 'executive', nameAr: 'القيادات التنفيذية العليا', nameEn: 'Senior Executive Leadership', icon: '👑',
    incidentLabelAr: 'القرار',
    incidentTypes: ADMIN_TYPES,
    categories: [
      cat('minister', 'وزير', '👑', 'مرحباً بك معالي الوزير. تم تجهيز لوحة الحوكمة وأدوات القرار الاستراتيجي.', executiveServices(), SPG.adminDecision),
      cat('undersecretary', 'وكيل وزارة', '🏛️', 'مرحباً بك سعادة الوكيل. تم تجهيز أدوات الحوكمة الوزارية ومتابعة القرارات.', executiveServices(), SPG.adminDecision),
      cat('director-general', 'مدير عام', '🏢', 'مرحباً بك سعادة المدير العام. تم تجهيز أدوات إدارة القرارات المؤسسية.', executiveServices(), SPG.adminDecision),
      cat('department-director', 'مدير إدارة', '📊', 'مرحباً بك. تم تجهيز أدوات إدارة القرارات على مستوى الإدارة.', executiveServices(), SPG.adminDecision),
    ],
  },
  {
    id: 'academics', nameAr: 'الباحثون والأكاديميون', nameEn: 'Researchers & Academics', icon: '🎓',
    incidentLabelAr: 'البحث',
    incidentTypes: RESEARCH_TYPES,
    categories: [
      cat('researcher', 'باحث', '🔬', 'مرحباً بك أيها الباحث. تم تجهيز أدوات البحث العلمي والتحليل القانوني المقارن.', academicServices(), SPG.researcher),
      cat('scientific-supervisor', 'مشرف علمي', '🧑‍🏫', 'مرحباً بك أستاذنا الفاضل. تم تجهيز أدوات الإشراف العلمي ومتابعة الطلبة.', academicServices(), SPG.supervisor),
      cat('masters-student', 'طالب ماجستير', '📖', 'مرحباً بك. تم تجهيز مسار بحثي موجه لمرحلة الماجستير.', academicServices(), SPG.masters),
      cat('phd-student', 'طالب دكتوراه', '🎓', 'مرحباً بك. تم تجهيز مسار بحثي موجه لمرحلة الدكتوراه.', academicServices(), SPG.phd),
    ],
  },
  {
    id: 'public', nameAr: 'المستخدم العام', nameEn: 'General User', icon: '👤',
    incidentLabelAr: 'الحالة',
    categories: [
      cat('citizen', 'مواطن / مقيم', '🧍', 'مرحباً بك في مرصد. تم تجهيز خدمات مبسطة تساعدك على معرفة حقوقك وإجراءاتك.', publicServices(), SPG.legalResearcher),
      cat('company', 'منشأة / شركة', '🏢', 'مرحباً بكم. تم تجهيز خدمات موجهة للمنشآت والشركات.', publicServices(), SPG.legalAdvisor),
      cat('student', 'طالب قانون', '🎒', 'مرحباً بك. تم تجهيز مواد تعليمية ومسارات مبسطة لطلبة القانون.', publicServices(), SPG.legalResearcher),
    ],
  },
];

// ─── خدمات مرصد (the 8th tile) — direct links to existing modules ─────────────

export interface MarsadServiceLink {
  id:     string;
  nameAr: string;
  descAr: string;
  icon:   string;
  href:   string;
}

export const MARSAD_SERVICES: MarsadServiceLink[] = [
  { id: 'assistant',   nameAr: 'المساعد القانوني الذكي', descAr: 'إجابة قانونية منظمة بالشكل المعتمد',   icon: '🤖', href: '/assistant' },
  { id: 'decisions',   nameAr: 'منصة القرار الإداري',    descAr: 'دورة القرار الإداري الذكية الكاملة',    icon: '🖋️', href: '/decisions' },
  { id: 'risk-lab',    nameAr: 'مختبر المخاطر',           descAr: 'محرك النمذجة الوطنية للمخاطر',          icon: '🧪', href: '/risk-engine' },
  { id: 'jdc',         nameAr: 'جلسات محاكاة قضائية',     descAr: 'غرفة المداولة القضائية الرقمية',        icon: '🏛️', href: '/jdc' },
  { id: 'training',    nameAr: 'السيناريوهات التدريبية',  descAr: 'تدريب مهني تفاعلي متدرج',              icon: '🎯', href: '/pgf' },
  { id: 'nafe',        nameAr: 'خدمة نافع التوعوية',      descAr: 'التوعية والتحذير من الجرم الحديث',      icon: '🛡️', href: '/nafe' },
];

// ─── جديد في مرصد (home strip) ────────────────────────────────────────────────

export const NEW_IN_MARSAD: MarsadServiceLink[] = [
  { id: 'training-scenarios', nameAr: 'السيناريوهات التدريبية',  descAr: '', icon: '🎯', href: '/pgf' },
  { id: 'crime-scene',        nameAr: 'مسرح الجريمة التفاعلي',   descAr: '', icon: '🕵️', href: '/journey/police/station-officer/crime-scene' },
  { id: 'jdc-sessions',       nameAr: 'جلسات محاكاة قضائية',     descAr: '', icon: '🏛️', href: '/jdc' },
  { id: 'risk-lab',           nameAr: 'مختبر المخاطر',            descAr: '', icon: '🧪', href: '/risk-engine' },
  { id: 'nafe',               nameAr: 'خدمة نافع التوعوية',       descAr: '', icon: '🛡️', href: '/nafe' },
];

// ─── خدمة نافع — awareness alerts (seed content from the mockup) ──────────────

export type NafeCategory = 'financial' | 'cyber' | 'social' | 'other';

export interface NafeAlert {
  id:        string;
  sourceAr:  string;
  date:      string;
  titleAr:   string;
  bodyAr:    string;
  category:  NafeCategory;
}

export const NAFE_CATEGORIES: { id: NafeCategory | 'latest'; nameAr: string }[] = [
  { id: 'latest',    nameAr: 'أحدث التنبيهات' },
  { id: 'financial', nameAr: 'تحذيرات مالية' },
  { id: 'cyber',     nameAr: 'تحذيرات إلكترونية' },
  { id: 'social',    nameAr: 'تحذيرات اجتماعية' },
  { id: 'other',     nameAr: 'أخرى' },
];

export const NAFE_ALERTS: NafeAlert[] = [
  {
    id: 'moi-extortion', sourceAr: 'وزارة الداخلية', date: '2024-05-13',
    titleAr: 'ارتفاع حالات الابتزاز الإلكتروني باستخدام صور وفيديوهات',
    bodyAr: 'رصدت الجهات المختصة ارتفاعاً في حالات الابتزاز الإلكتروني عبر منصات التواصل. لا تشارك صورك أو بياناتك مع مجهولين، وبادر بالإبلاغ فوراً.',
    category: 'cyber',
  },
  {
    id: 'adp-qr', sourceAr: 'شرطة أبوظبي', date: '2024-05-14',
    titleAr: 'تنبيه: أسلوب جديد لسرقة البيانات عبر QR Code',
    bodyAr: 'انتشرت أساليب احتيالية تعتمد على رموز QR مزيفة تُفضي إلى مواقع تصيّد. تحقق من مصدر الرمز قبل مسحه ولا تُدخل بياناتك المصرفية.',
    category: 'cyber',
  },
  {
    id: 'bayan-fake-apps', sourceAr: 'صحيفة البيان', date: '2024-05-15',
    titleAr: 'تحذير من عمليات الاحتيال عبر التطبيقات البنكية المزيفة',
    bodyAr: 'حذّرت الجهات المصرفية من تطبيقات مزيفة تنتحل هوية البنوك. حمّل تطبيقات البنوك من المتاجر الرسمية فقط وتحقق من الناشر.',
    category: 'financial',
  },
  {
    id: 'moi-call-fraud', sourceAr: 'وزارة الداخلية', date: '2024-04-28',
    titleAr: 'احتيال هاتفي بانتحال صفة جهات رسمية',
    bodyAr: 'لا تُفصح عن رقم بطاقتك أو رمز OTP لأي متصل يدّعي أنه من جهة رسمية — الجهات الرسمية لا تطلب هذه البيانات هاتفياً.',
    category: 'financial',
  },
  {
    id: 'social-recruit', sourceAr: 'النيابة العامة', date: '2024-04-20',
    titleAr: 'تحذير من عروض العمل الوهمية عبر وسائل التواصل',
    bodyAr: 'انتبه لعروض العمل التي تطلب رسوماً مقدمة أو بيانات مصرفية. تحقق من الجهة عبر قنواتها الرسمية قبل أي تعامل.',
    category: 'social',
  },
];

// ─── المجتمع المهني (seed content from the mockup) ────────────────────────────

export interface CommunityFeature {
  id:     string;
  nameAr: string;
  icon:   string;
}

export const COMMUNITY_FEATURES: CommunityFeature[] = [
  { id: 'share',        nameAr: 'مشاركة خبرات',   icon: '🧠' },
  { id: 'discussions',  nameAr: 'نقاشات مهنية',   icon: '💬' },
  { id: 'consultations',nameAr: 'استشارات',       icon: '🤝' },
  { id: 'events',       nameAr: 'فعاليات وورش',   icon: '🎪' },
  { id: 'resources',    nameAr: 'موارد معرفية',   icon: '📚' },
];

export interface CommunityPost {
  id:        string;
  titleAr:   string;
  authorAr:  string;
  date:      string;
  replies:   number;
  likes:     number;
}

export const COMMUNITY_POSTS: CommunityPost[] = [
  { id: 'p1', titleAr: 'مناقشة حول إجراءات جمع الأدلة الرقمية في جرائم الابتزاز', authorAr: 'المحامي أحمد', date: '2024-05-14', replies: 26, likes: 8 },
  { id: 'p2', titleAr: 'تجربة عملية في مسرح حريق منزل — نقاط مهمة', authorAr: 'النقيب سيف', date: '2024-05-14', replies: 18, likes: 3 },
  { id: 'p3', titleAr: 'متى يُعد التسبيب الإلكتروني للقرار الإداري كافياً؟', authorAr: 'مستشار قانوني', date: '2024-05-12', replies: 11, likes: 5 },
];

// ─── نظرية الشامسي — الأركان السبعة (home locked section) ─────────────────────

export const SHAMSI_PILLARS: { id: string; nameAr: string; icon: string }[] = [
  { id: 'activated-appeal',      nameAr: 'الطعن المنشّط',              icon: '🛡️' },
  { id: 'algorithmic-record',    nameAr: 'سجل الأسباب الخوارزمي',      icon: '🗄️' },
  { id: 'reasoned-control',      nameAr: 'الاستقلال المتدرج',          icon: '🧷' },
  { id: 'explained-cause',       nameAr: 'السبب الخوارزمي المفسَّر',   icon: '💡' },
  { id: 'conscious-reasoning',   nameAr: 'التسبيب الخوارزمي الواعي',   icon: '🧠' },
  { id: 'legitimate-distinction',nameAr: 'التمييز الخوارزمي المشروع',  icon: '⚖️' },
  { id: 'approved-weight',       nameAr: 'الوزن الخوارزمي المعتمد',    icon: '🏋️' },
];

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function findPath(pathId: string): JourneyPath | undefined {
  return JOURNEY_PATHS.find((p) => p.id === pathId);
}

export function findCategory(pathId: string, categoryId: string): { path: JourneyPath; category: JourneyCategory } | undefined {
  const path = findPath(pathId);
  const category = path?.categories.find((c) => c.id === categoryId);
  return path && category ? { path, category } : undefined;
}

export function findService(pathId: string, categoryId: string, serviceId: string):
  { path: JourneyPath; category: JourneyCategory; service: JourneyService } | undefined {
  const found = findCategory(pathId, categoryId);
  const service = found?.category.services.find((s) => s.id === serviceId);
  return found && service ? { ...found, service } : undefined;
}

export function incidentTypesFor(path: JourneyPath): JourneyIncidentType[] {
  return path.incidentTypes ?? DEFAULT_INCIDENT_TYPES;
}
