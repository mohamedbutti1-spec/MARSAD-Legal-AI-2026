/**
 * MARSAD V2 — Professional persona layer (المرحلة الثانية: اختيار الفئة).
 *
 * A UI-level personalization layer on top of the existing JWT/RBAC roles:
 * the server-verified role still governs *permissions*; the persona only
 * governs *presentation* — the smart greeting, the professional service
 * package shown on the hub, and the smart-question placeholder in the
 * assistant composer. Persisted in localStorage (same pattern as appLang).
 *
 * Every service maps onto an EXISTING module route. Services that are
 * conversational launch the AI assistant through the same
 * `pendingAssistantQuery` sessionStorage hand-off the dashboard composer
 * already uses (see ai-assistant.tsx auto-start effect) — no new backend.
 */

export type PersonaCategoryId =
  | 'judiciary'
  | 'prosecution'
  | 'police'
  | 'lawyers'
  | 'executive'
  | 'academics'
  | 'public';

export interface PersonaSubRole {
  id: string;
  ar: string;
  /** Overrides the category greeting (e.g. معالي الوزير vs سعادة المدير العام). */
  greetingAr?: string;
}

export interface PersonaService {
  id: string;
  ar: string;
  descAr: string;
  emoji: string;
  /** Existing module route to open. */
  href: string;
  /**
   * When set, the service is conversational: the prompt is stored in
   * sessionStorage('pendingAssistantQuery') before navigating to /assistant,
   * which auto-creates a session and starts the analysis.
   */
  prompt?: string;
}

export interface PersonaCategory {
  id: PersonaCategoryId;
  ar: string;
  descAr: string;
  emoji: string;
  /** Default smart greeting for the category. */
  greetingAr: string;
  subRoles: PersonaSubRole[];
  services: PersonaService[];
  /** Smart-question placeholder shown in the assistant composer. */
  questionPlaceholderAr: string;
}

export const PERSONA_CATEGORIES: PersonaCategory[] = [
  {
    id: 'judiciary',
    ar: 'السلطة القضائية',
    descAr: 'القضاة ورؤساء الدوائر ومحاكم الاستئناف والنقض',
    emoji: '⚖️',
    greetingAr: 'مرحباً بكم سعادة القاضي',
    subRoles: [
      { id: 'judge', ar: 'قاضٍ' },
      { id: 'chamber_president', ar: 'رئيس دائرة', greetingAr: 'مرحباً بكم سعادة رئيس الدائرة' },
      { id: 'appeal', ar: 'قاضي استئناف', greetingAr: 'مرحباً بكم سعادة قاضي الاستئناف' },
      { id: 'cassation', ar: 'قاضي نقض', greetingAr: 'مرحباً بكم سعادة قاضي النقض' },
    ],
    services: [
      { id: 'judgment_session', ar: 'جلسة حكم', descAr: 'إعداد وتحليل جلسة إصدار الحكم عبر محرك التفكير القضائي', emoji: '🏛️', href: '/jre' },
      { id: 'deliberation_session', ar: 'جلسة مداولة', descAr: 'مداولة قضائية متعددة الأعضاء داخل غرفة المداولة', emoji: '🗳️', href: '/jdc' },
      { id: 'case_review', ar: 'مراجعة دعوى', descAr: 'مراجعة شاملة لملف الدعوى: الوقائع والدفوع والأدلة', emoji: '📂', href: '/assistant', prompt: 'أرغب في مراجعة دعوى: سأزودك بالوقائع والدفوع والأدلة، وأريد تحليلاً قضائياً منظماً لنقاط القوة والضعف والمسائل القانونية الواجبة الفصل.' },
      { id: 'judicial_reasoning', ar: 'تسبيب قضائي', descAr: 'صياغة أسباب الحكم وفق منهج التسبيب القضائي', emoji: '✍️', href: '/assistant?train=judicial_judgment' },
      { id: 'appeal_grounds_review', ar: 'مراجعة أسباب الطعن', descAr: 'فحص أسباب الطعن ومدى جديتها وأثرها على الحكم', emoji: '🔎', href: '/assistant', prompt: 'أرغب في مراجعة أسباب طعن: سأزودك بالحكم المطعون فيه وأسباب الطعن، وأريد تقييماً قضائياً لكل سبب ومدى إنتاجيته.' },
      { id: 'court_simulation', ar: 'محاكاة محكمة', descAr: 'محاكاة كاملة لجلسة محكمة إدارية ذكية', emoji: '🎭', href: '/jdc' },
    ],
    questionPlaceholderAr: 'أرفق الوقائع والدفوع والأدلة لإعداد التحليل والحكم المقترح',
  },
  {
    id: 'prosecution',
    ar: 'النيابة العامة',
    descAr: 'وكلاء النيابة ورؤساء النيابات والمحامون العامون',
    emoji: '🏛️',
    greetingAr: 'مرحباً بكم سعادة وكيل النيابة',
    subRoles: [
      { id: 'prosecutor_deputy', ar: 'وكيل نيابة' },
      { id: 'prosecution_chief', ar: 'رئيس نيابة', greetingAr: 'مرحباً بكم سعادة رئيس النيابة' },
      { id: 'public_attorney', ar: 'محام عام', greetingAr: 'مرحباً بكم سعادة المحامي العام' },
    ],
    services: [
      { id: 'investigation_session', ar: 'جلسة تحقيق', descAr: 'إدارة جلسة تحقيق ابتدائي وفق الأصول الإجرائية', emoji: '🔍', href: '/assistant', prompt: 'أنا عضو نيابة وأستعد لجلسة تحقيق. سأزودك بملخص البلاغ والأدلة الأولية، وأريد خطة تحقيق: ترتيب الأسئلة، ونقاط المواجهة بالأدلة، والإجراءات الاحترازية الواجبة.' },
      { id: 'interrogation', ar: 'استجواب', descAr: 'بناء خطة استجواب المتهم والمواجهة بالأدلة', emoji: '🗣️', href: '/assistant', prompt: 'أرغب في إعداد خطة استجواب متهم: سأزودك بالوقائع والأدلة، وأريد تسلسل الأسئلة ومتى أواجه بالأدلة وضمانات صحة الاستجواب.' },
      { id: 'referral_decision', ar: 'قرار إحالة', descAr: 'صياغة قرار الإحالة إلى المحكمة المختصة وتسبيبه', emoji: '📤', href: '/assistant', prompt: 'أرغب في إعداد قرار إحالة: سأزودك بالوقائع والأدلة والتهم، وأريد مشروع قرار إحالة مسبب مع الوصف القانوني الدقيق ومواد الاتهام.' },
      { id: 'closure_decision', ar: 'قرار حفظ', descAr: 'تقييم مبررات الحفظ وصياغة قرار مسبب', emoji: '📥', href: '/assistant', prompt: 'أرغب في إعداد قرار حفظ: سأزودك بالوقائع ونتيجة التحقيق، وأريد تقييم أسباب الحفظ المتاحة قانوناً ومشروع قرار حفظ مسبب.' },
      { id: 'case_file_management', ar: 'إدارة ملف القضية', descAr: 'تنظيم ملف القضية ومستنداته داخل مساحة العمل', emoji: '🗂️', href: '/workspace' },
    ],
    questionPlaceholderAr: 'أرفق ملخص البلاغ والأدلة ونتائج التحقيق لإعداد التحليل والتصرف المقترح',
  },
  {
    id: 'police',
    ar: 'الجهات الشرطية وإنفاذ القانون',
    descAr: 'ضباط المراكز والمحققون ومأمورو الضبط وخبراء الاستدلال',
    emoji: '🛡️',
    greetingAr: 'مرحباً بكم سعادة الضابط',
    subRoles: [
      { id: 'station_officer', ar: 'ضابط مركز شرطة' },
      { id: 'criminal_investigator', ar: 'محقق جنائي' },
      { id: 'judicial_officer', ar: 'مأمور ضبط قضائي' },
      { id: 'evidence_expert', ar: 'خبير استدلالات' },
      { id: 'new_officer', ar: 'ضابط مستجد' },
      { id: 'operations', ar: 'إدارة العمليات' },
    ],
    services: [
      { id: 'incident_scene', ar: 'مسرح الواقعة', descAr: 'إدارة المعاينة وحفظ المسرح وتوثيق الموقع', emoji: '📍', href: '/assistant', prompt: 'أنا ضابط في طريقي إلى مسرح واقعة. سأصف لك نوع الواقعة، وأريد قائمة إجراءات كاملة: قبل الوصول، وأثناء الوصول، وأثناء المعاينة، وبعد الانتهاء، مع التنبيه على الأخطاء الإجرائية الشائعة.' },
      { id: 'evidence_gathering', ar: 'جمع الاستدلالات', descAr: 'خطة جمع الاستدلالات وسماع الشهود وفق القانون', emoji: '🧩', href: '/assistant', prompt: 'أرغب في خطة جمع استدلالات: سأصف الواقعة، وأريد ترتيب إجراءات الاستدلال وسماع الأقوال وضوابط صحتها القانونية.' },
      { id: 'report_management', ar: 'إدارة البلاغات', descAr: 'استقبال البلاغ وتحرير المحضر وتحديد جهة الاختصاص', emoji: '📞', href: '/assistant', prompt: 'أنا أمام مشتكٍ في مركز الشرطة. سأنقل لك أقواله، وأريد: الأسئلة الواجب طرحها، وكيفية صياغة البلاغ، وما يُحرَّر من محاضر، ومتى يجب الانتقال إلى الموقع.' },
      { id: 'seizure_report', ar: 'محضر ضبط', descAr: 'صياغة محضر ضبط قانوني سليم البنية والإجراءات', emoji: '📋', href: '/assistant', prompt: 'أرغب في تحرير محضر ضبط: سأزودك بتفاصيل الواقعة والمضبوطات، وأريد مشروع محضر ضبط مستوفي الأركان مع بيان الضمانات الإجرائية.' },
      { id: 'forensic_evidence', ar: 'الأدلة الجنائية', descAr: 'حفظ الأدلة وسلسلة العهدة وتحليلها المخبري', emoji: '🧬', href: '/assistant', prompt: 'أحتاج توجيهاً في الأدلة الجنائية: سأصف الأدلة المرفوعة، وأريد إجراءات الحفظ وسلسلة العهدة والتحليلات المطلوبة وحجيتها.' },
      { id: 'operations_room', ar: 'غرفة العمليات', descAr: 'سيناريوهات العمليات والتنسيق الميداني عبر نظام العمليات', emoji: '🎛️', href: '/legal-os' },
    ],
    questionPlaceholderAr: 'أرفق البلاغ والأدلة والإجراءات المتخذة لتحليل الواقعة',
  },
  {
    id: 'lawyers',
    ar: 'المحامون والاستشارات القانونية',
    descAr: 'المحامون والمستشارون والمحكمون والخبراء القانونيون',
    emoji: '🧑‍⚖️',
    greetingAr: 'مرحباً بكم سعادة المحامي',
    subRoles: [
      { id: 'lawyer', ar: 'محام' },
      { id: 'legal_consultant', ar: 'مستشار قانوني', greetingAr: 'مرحباً بكم سعادة المستشار' },
      { id: 'arbitrator', ar: 'محكم', greetingAr: 'مرحباً بكم سعادة المحكم' },
      { id: 'legal_expert', ar: 'خبير قانوني', greetingAr: 'مرحباً بكم سعادة الخبير' },
    ],
    services: [
      { id: 'memo_preparation', ar: 'إعداد مذكرة', descAr: 'إعداد مذكرة قانونية كاملة البنية عبر مسار التدريب المهيكل', emoji: '📝', href: '/assistant?train=legal_memorandum' },
      { id: 'statement_of_claim', ar: 'صحيفة دعوى', descAr: 'صياغة صحيفة دعوى مستوفية البيانات والطلبات', emoji: '📜', href: '/assistant', prompt: 'أرغب في إعداد صحيفة دعوى: سأزودك بالوقائع والمستندات، وأريد مشروع صحيفة دعوى كاملة: الأطراف، الوقائع، الأساس القانوني، الطلبات.' },
      { id: 'defense_memo', ar: 'مذكرة دفاع', descAr: 'بناء مذكرة دفاع وترتيب الدفوع الشكلية والموضوعية', emoji: '🛡️', href: '/assistant', prompt: 'أرغب في إعداد مذكرة دفاع: سأزودك بصحيفة الدعوى ومستندات الخصم، وأريد مذكرة دفاع بترتيب الدفوع الشكلية ثم الموضوعية مع الطلبات الختامية.' },
      { id: 'appeal_service', ar: 'استئناف', descAr: 'إعداد صحيفة استئناف وأسبابه الموضوعية والقانونية', emoji: '⬆️', href: '/assistant', prompt: 'أرغب في إعداد استئناف: سأزودك بالحكم الابتدائي، وأريد صحيفة استئناف بأسباب واضحة: مخالفة القانون، الخطأ في التطبيق، القصور في التسبيب، الإخلال بحق الدفاع.' },
      { id: 'cassation_service', ar: 'طعن', descAr: 'صياغة أسباب الطعن بالنقض وفق الحالات المقررة قانوناً', emoji: '🏔️', href: '/assistant', prompt: 'أرغب في إعداد طعن بالنقض: سأزودك بحكم الاستئناف، وأريد أسباب طعن منضبطة وفق حالات الطعن المقررة قانوناً مع صياغة قانونية دقيقة.' },
      { id: 'litigation_strategy', ar: 'استراتيجية التقاضي', descAr: 'خطة تقاضٍ متكاملة: تقييم الموقف والمسارات والبدائل', emoji: '♟️', href: '/assistant', prompt: 'أرغب في بناء استراتيجية تقاضٍ: سأزودك بموقف موكلي والمستندات، وأريد تقييم فرص النجاح والمسارات المتاحة (صلح، تحكيم، قضاء) وخطة مراحل التقاضي.' },
    ],
    questionPlaceholderAr: 'أرفق الوقائع والمستندات لإعداد المذكرة المناسبة',
  },
  {
    id: 'executive',
    ar: 'القيادات التنفيذية العليا',
    descAr: 'الوزراء والوكلاء والأمناء العامون والمديرون العامون',
    emoji: '👑',
    greetingAr: 'مرحباً بكم معالي الوزير',
    subRoles: [
      { id: 'minister', ar: 'معالي وزير', greetingAr: 'مرحباً بكم معالي الوزير' },
      { id: 'undersecretary', ar: 'سعادة وكيل وزارة', greetingAr: 'مرحباً بكم سعادة وكيل الوزارة' },
      { id: 'secretary_general', ar: 'سعادة أمين عام', greetingAr: 'مرحباً بكم سعادة الأمين العام' },
      { id: 'director_general', ar: 'سعادة مدير عام', greetingAr: 'مرحباً بكم سعادة المدير العام' },
    ],
    services: [
      { id: 'decision_support', ar: 'دعم القرار', descAr: 'دورة حياة القرار الإداري الذكي كاملة من الإعداد إلى الختم', emoji: '🧠', href: '/decisions' },
      { id: 'governance', ar: 'الحوكمة', descAr: 'مركز الحوكمة التنفيذية والرقابة على القرارات', emoji: '🏛️', href: '/governance' },
      { id: 'compliance', ar: 'الامتثال', descAr: 'مراجعة الامتثال التشريعي والتنظيمي للقرارات', emoji: '✅', href: '/assistant', prompt: 'بصفتي قيادة تنفيذية، أريد مراجعة امتثال: سأصف القرار أو السياسة، وأريد تحليل التوافق مع التشريعات النافذة والمخاطر التنظيمية والتوصيات التصحيحية.' },
      { id: 'risk_management', ar: 'إدارة المخاطر', descAr: 'محرك النمذجة الوطنية للمخاطر ومؤشراتها', emoji: '⚠️', href: '/risk-engine' },
      { id: 'future_scenarios', ar: 'السيناريوهات المستقبلية', descAr: 'محرك السيناريوهات: ماذا لو وغرفة الأزمات وتوقع النتائج', emoji: '🔮', href: '/scenarios' },
    ],
    questionPlaceholderAr: 'اعرض القرار أو السياسة محل الدراسة لإعداد تحليل دعم القرار التنفيذي',
  },
  {
    id: 'academics',
    ar: 'الباحثون والأكاديميون',
    descAr: 'الباحثون وأساتذة الجامعات وطلبة الدراسات العليا',
    emoji: '🎓',
    greetingAr: 'مرحباً بكم الباحث الكريم',
    subRoles: [
      { id: 'researcher', ar: 'باحث' },
      { id: 'professor', ar: 'أستاذ جامعي', greetingAr: 'مرحباً بكم سعادة الأستاذ الدكتور' },
      { id: 'grad_student', ar: 'طالب دراسات عليا' },
    ],
    services: [
      { id: 'comparative_studies', ar: 'الدراسات المقارنة', descAr: 'دراسة مقارنة منهجية بين نظامين قانونيين', emoji: '🌐', href: '/assistant?train=comparative_study' },
      { id: 'jurisprudence_studies', ar: 'الدراسات الفقهية', descAr: 'بحث فقهي مؤصل بالمذاهب والآراء والأدلة', emoji: '📖', href: '/assistant', prompt: 'أرغب في دراسة فقهية: سأحدد المسألة، وأريد عرض الآراء الفقهية وأدلتها ومناقشتها والترجيح المسبب، بمنهج أكاديمي موثق.' },
      { id: 'constitutional_studies', ar: 'الدراسات الدستورية', descAr: 'المبادئ الدستورية وقواعد الرقابة والحقوق والحريات', emoji: '🏛️', href: '/constitutional-principles' },
      { id: 'legislative_lab', ar: 'المختبر التشريعي', descAr: 'صياغة وتقييم مسودات تشريعية داخل مختبر تفاعلي', emoji: '🧪', href: '/assistant?train=legislative_draft' },
    ],
    questionPlaceholderAr: 'حدد الإشكالية البحثية والمنهج المطلوب لإعداد الدراسة الأكاديمية',
  },
  {
    id: 'public',
    ar: 'المستخدم العام',
    descAr: 'المواطنون والمقيمون والموظفون وأصحاب الأعمال',
    emoji: '👥',
    greetingAr: 'مرحباً بكم في مرصد',
    subRoles: [
      { id: 'citizen', ar: 'مواطن' },
      { id: 'resident', ar: 'مقيم' },
      { id: 'employee', ar: 'موظف' },
      { id: 'business_owner', ar: 'صاحب عمل' },
    ],
    services: [
      { id: 'decision_check', ar: 'فحص القرار الإداري', descAr: 'فحص قرار إداري صدر بحقك ومعرفة خياراتك', emoji: '🔍', href: '/citizen' },
      { id: 'grievances', ar: 'التظلمات', descAr: 'إعداد تظلم إداري سليم الشكل والمواعيد', emoji: '📮', href: '/assistant', prompt: 'أريد إعداد تظلم إداري: سأصف القرار الصادر بحقي، وأريد معرفة مواعيد التظلم وجهته المختصة ومشروع صيغة تظلم مناسبة.' },
      { id: 'complaints', ar: 'الشكاوى', descAr: 'توجيه الشكوى إلى الجهة الصحيحة بصيغة سليمة', emoji: '🗳️', href: '/assistant', prompt: 'أريد تقديم شكوى: سأصف المشكلة، وأريد تحديد الجهة المختصة والمستندات المطلوبة وصيغة شكوى واضحة.' },
      { id: 'rights_obligations', ar: 'الحقوق والالتزامات', descAr: 'فهم حقوقك والتزاماتك القانونية بلغة واضحة', emoji: '📗', href: '/assistant', prompt: 'أريد فهم حقوقي والتزاماتي: سأصف وضعي، وأريد شرحاً مبسطاً وواضحاً لحقوقي والتزاماتي القانونية والخطوات العملية المتاحة لي.' },
    ],
    questionPlaceholderAr: 'صف القرار أو المشكلة وسنقوم بتحليل الخيارات القانونية المتاحة',
  },
];

export function getPersonaCategory(id: string | undefined | null): PersonaCategory | undefined {
  return PERSONA_CATEGORIES.find((c) => c.id === id);
}

// ─── Persistence (UI preference only — never a permission source) ────────────

export interface StoredPersona {
  categoryId: PersonaCategoryId;
  subRoleId: string;
}

const PERSONA_STORAGE_KEY = 'marsadPersona';

export function getStoredPersona(): StoredPersona | null {
  try {
    const raw = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPersona>;
    const category = getPersonaCategory(parsed.categoryId);
    if (!category) return null;
    const subRoleId = category.subRoles.some((s) => s.id === parsed.subRoleId)
      ? (parsed.subRoleId as string)
      : category.subRoles[0].id;
    return { categoryId: category.id, subRoleId };
  } catch {
    return null;
  }
}

export function setStoredPersona(persona: StoredPersona): void {
  localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(persona));
}

export function clearStoredPersona(): void {
  localStorage.removeItem(PERSONA_STORAGE_KEY);
}

/** Resolves the smart greeting: sub-role override → category default. */
export function getPersonaGreeting(persona: StoredPersona | null): string | null {
  if (!persona) return null;
  const category = getPersonaCategory(persona.categoryId);
  if (!category) return null;
  const sub = category.subRoles.find((s) => s.id === persona.subRoleId);
  return sub?.greetingAr ?? category.greetingAr;
}

/** The persona-aware smart-question placeholder for the assistant composer. */
export function getPersonaQuestionPlaceholder(): string | null {
  const persona = getStoredPersona();
  return getPersonaCategory(persona?.categoryId)?.questionPlaceholderAr ?? null;
}

/**
 * Launch a conversational persona service: stores the prompt through the
 * existing dashboard→assistant hand-off, then the caller navigates to
 * /assistant (which auto-creates a session and starts the analysis).
 */
export function stageAssistantPrompt(prompt: string): void {
  sessionStorage.setItem('pendingAssistantQuery', prompt);
}

// ─── الرسالة الختامية — shown at the bottom of every page ────────────────────

export const MARSAD_CLOSING_MESSAGE =
  'مرصد ليس منصة قانونية فحسب، بل مجتمع مهني ومعرفي يجمع القضاة وأعضاء النيابة والمحامين والباحثين والقيادات التنفيذية والمستخدمين في بيئة واحدة لصناعة المعرفة القانونية ودعم العدالة وتعزيز جودة القرار.';

export const MARSAD_CLOSING_PRAYER = 'نحن معكم أينما كنتم في الوطن، فحفظ اللهم القائد والوطن.';

export const MARSAD_COMMUNITY_LINE = 'من في مجتمع مرصد لحفظ الوطن';
