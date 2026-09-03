// Guided assistant configuration — shared between the Dashboard entry point
// and the AI Assistant composer (role / legal-context / answer-mode selectors).
// Extracted during the Judicial Command Center visual rebuild so the dashboard
// could collapse to a single card while this configuration still lives on
// (and is fully reachable) inside the assistant's composer.
//
// Updated per Issue #8 (تنفيذ التصميم النهائي المعتمد لواجهة منصة مرصد):
// - الفئة المهنية rebuilt — "مستخدم عام" is first/default, "وزير" و"وكيل" (independent
//   options) removed and replaced by "فئة إدارية عليا تنفيذية — بدرجة وكيل وزارة فأعلى".
// - الإطار التحليلي rebuilt as a two-tier structure (traditional law vs. Al-Shamsi Theory).
// - New dropdown datasets added: نوع الطلب / نوع القانون / مصدر القانون / مستوى التحليل / لغة الإجابة.
// - Merged services catalogue (الخدمات المهنية والتدقيق الذكي) added.
//
// Every `userType` value below is deliberately one of the existing `UserType` union
// members from `ai-assistant.tsx` (never a newly invented string) so the strictly-typed
// `USER_TYPE_CONFIG: Record<UserType, …>` lookup in that file can never receive an
// unrecognised key. The *display label* shown to the user is independent of that
// internal id and follows the wording approved in Issue #8 exactly.

// ─── الفئة المهنية — professional category ─────────────────────────────────────
export type UserCategoryId =
  | 'general' | 'senior_executive' | 'secretary_general' | 'director_general'
  | 'consultant' | 'judge_first_instance' | 'judge_appeal' | 'judge_cassation'
  | 'prosecutor_deputy' | 'lawyer' | 'officer_new' | 'officer_expert' | 'student';

export const USER_CATEGORIES: { id: UserCategoryId; labelAr: string; userType: string }[] = [
  { id: 'general',              labelAr: 'مستخدم عام',                                                 userType: 'general_user' },
  { id: 'senior_executive',     labelAr: 'فئة إدارية عليا تنفيذية — بدرجة وكيل وزارة فأعلى',           userType: 'undersecretary' },
  { id: 'secretary_general',    labelAr: 'أمين عام',                                                    userType: 'government' },
  { id: 'director_general',     labelAr: 'مدير عام',                                                    userType: 'director_general' },
  { id: 'consultant',           labelAr: 'مستشار',                                                      userType: 'legal_consultant' },
  { id: 'judge_first_instance', labelAr: 'قاضٍ ابتدائي',                                                userType: 'judge_first_instance' },
  { id: 'judge_appeal',         labelAr: 'قاضٍ استئناف',                                                userType: 'judge_appeal' },
  { id: 'judge_cassation',      labelAr: 'قاضٍ نقض',                                                    userType: 'judge_cassation' },
  { id: 'prosecutor_deputy',    labelAr: 'وكيل نيابة',                                                  userType: 'prosecution_deputy' },
  { id: 'lawyer',               labelAr: 'محامٍ',                                                       userType: 'lawyer' },
  { id: 'officer_new',          labelAr: 'ضابط مركز مستجد',                                             userType: 'police_recruit_officer' },
  { id: 'officer_expert',       labelAr: 'ضابط مركز خبير',                                              userType: 'police_station_officer' },
  { id: 'student',              labelAr: 'طالب أو دارس',                                                userType: 'law_student' },
];

/** "مستخدم عام" is first and the default selection, per Issue #8. */
export const DEFAULT_USER_CATEGORY_ID: UserCategoryId = 'general';

export const USER_CATEGORY_STORAGE_KEY = 'marsad_user_category';

// ─── أسلوب الإجابة — answer style ───────────────────────────────────────────────
export type AnswerStyleId = 'quick' | 'standard' | 'detailed';
export const ANSWER_STYLES: { id: AnswerStyleId; labelAr: string }[] = [
  { id: 'quick',    labelAr: 'إجابة سريعة' },
  { id: 'standard', labelAr: 'إجابة نموذجية' },
  { id: 'detailed', labelAr: 'إجابة مفصلة' },
];
export const DEFAULT_ANSWER_STYLE_ID: AnswerStyleId = 'standard';

// ─── الإطار التحليلي — analytical framework (tiered) ────────────────────────────
// أ. وفق القوانين المنظمة للقرارات التقليدية | ب. نظرية الشامسي (مقيّدة بالصلاحيات)
export type LegalRefId = 'uae' | 'france' | 'eu' | 'comparative' | 'shamsi';

/** Flat list — kept for callers that only need id/label (session-config plumbing). */
export const LEGAL_REFERENCES: { id: LegalRefId; labelAr: string }[] = [
  { id: 'uae',         labelAr: 'القانون الإماراتي' },
  { id: 'france',      labelAr: 'القانون الفرنسي' },
  { id: 'eu',          labelAr: 'القانون الأوروبي' },
  { id: 'comparative', labelAr: 'دراسة مقارنة' },
  { id: 'shamsi',      labelAr: 'نظرية الشامسي' },
];

export const DEFAULT_LEGAL_REFERENCE_ID: LegalRefId = 'uae';

export const SHAMSI_THEORY_DESCRIPTION_AR =
  'حوكمة ومشروعية ورقابة القرارات الصادرة عن الذكاء الاصطناعي';

/** "أ. وفق القوانين المنظمة للقرارات التقليدية" — group A of الإطار التحليلي (single-select). */
export const ANALYTICAL_FRAMEWORK_TRADITIONAL_TITLE_AR = 'أ. وفق القوانين المنظمة للقرارات التقليدية';
export const ANALYTICAL_FRAMEWORK_TRADITIONAL_OPTIONS: { id: LegalRefId; labelAr: string }[] = [
  { id: 'uae',         labelAr: 'القانون الإماراتي' },
  { id: 'france',      labelAr: 'القانون الفرنسي' },
  { id: 'eu',          labelAr: 'القانون الأوروبي' },
  { id: 'comparative', labelAr: 'دراسة مقارنة' },
];

// ══════════════════════════════════════════════════════════════════════════
// DOCTRINAL LOCK — Al-Shamsi Framework — DO NOT CHANGE WITHOUT EXPLICIT
// OWNER APPROVAL.
// ══════════════════════════════════════════════════════════════════════════
// The algorithm has no independent legal will, is not a legal person, and
// never constitutes a sixth element of the administrative decision.
// Algorithmic contribution is assessed within the legally recognized process
// of forming the administrative decision, with responsibility remaining
// attributable to the competent administrative authority. This framework is
// a separate analytical layer alongside the classical administrative-legality
// elements (competence, form, cause, subject, purpose) — never a replacement
// or extension of them. See admin-os-evaluator.ts for the matching backend lock.
//
// Canonical terminology (product-facing text, any language): do not label a
// decision's legality shortfalls as "administrative vulnerabilities" — use
// "Administrative Legality Risks" / "مخاطر المشروعية الإدارية". For
// litigation/annulment-specific exposure, use "Judicial Exposure" /
// "مخاطر التعرض القضائي" instead.
// ══════════════════════════════════════════════════════════════════════════
/**
 * "ب. نظرية الشامسي" — group B of الإطار التحليلي (multi-select rule picker,
 * restricted to `canUseShamsiFramework`). Item 1 ("تطبيق النظرية كاملة") is a
 * select-all convenience action, not stored itself — selecting it checks the
 * other 11 rules; it is never persisted inside `shamsiRules`.
 */
export type ShamsiRuleId =
  | 'apply_all' | 'algorithmic_weight' | 'legitimate_bias' | 'graduated_compliance'
  | 'explainable_reasoning' | 'conscious_control' | 'reasoning_log' | 'pre_appeal'
  | 'governance' | 'legality' | 'oversight' | 'responsibility';

export const SHAMSI_RULES: { id: ShamsiRuleId; labelAr: string; shortAr: string }[] = [
  { id: 'apply_all',             labelAr: 'تطبيق النظرية كاملة',      shortAr: 'النظرية كاملة' },
  { id: 'algorithmic_weight',    labelAr: 'الوزن الخوارزمي',          shortAr: 'الوزن الخوارزمي' },
  { id: 'legitimate_bias',       labelAr: 'التحيز المشروع',           shortAr: 'التحيز المشروع' },
  { id: 'graduated_compliance',  labelAr: 'الامتثال المتدرج',          shortAr: 'الامتثال المتدرج' },
  { id: 'explainable_reasoning', labelAr: 'السبب الخوارزمي المفسر',   shortAr: 'السبب المفسر' },
  { id: 'conscious_control',     labelAr: 'التحكم الواعي',            shortAr: 'التحكم الواعي' },
  { id: 'reasoning_log',         labelAr: 'سجل الأسباب',              shortAr: 'سجل الأسباب' },
  { id: 'pre_appeal',            labelAr: 'الطعن المسبق',             shortAr: 'الطعن المسبق' },
  { id: 'governance',            labelAr: 'الحوكمة',                  shortAr: 'الحوكمة' },
  { id: 'legality',              labelAr: 'المشروعية',                shortAr: 'المشروعية' },
  { id: 'oversight',             labelAr: 'الرقابة',                  shortAr: 'الرقابة' },
  { id: 'responsibility',        labelAr: 'المسؤولية',                shortAr: 'المسؤولية' },
];
/** All selectable rule ids excluding the "select all" meta-action. */
export const SHAMSI_RULE_IDS: ShamsiRuleId[] = SHAMSI_RULES
  .filter((r) => r.id !== 'apply_all')
  .map((r) => r.id);

// ─── نوع القانون — hierarchical legal-branch picker ─────────────────────────────
// أ. القانون العام | ب. القانون الخاص | ج. القانون الجزائي — each with its own
// branch list, revealed only after its top-level category is selected.
export type LawCategoryId = 'public' | 'private' | 'criminal';
export interface LawBranchOption { id: string; labelAr: string; }
export const LAW_CATEGORIES: { id: LawCategoryId; labelAr: string; branches: LawBranchOption[] }[] = [
  {
    id: 'public',
    labelAr: 'أ. القانون العام',
    branches: [
      { id: 'admin',                  labelAr: 'القانون الإداري' },
      { id: 'constitutional',         labelAr: 'القانون الدستوري' },
      { id: 'financial',              labelAr: 'القانون المالي' },
      { id: 'public_international',   labelAr: 'القانون الدولي العام' },
    ],
  },
  {
    id: 'private',
    labelAr: 'ب. القانون الخاص',
    branches: [
      { id: 'civil',                  labelAr: 'القانون المدني' },
      { id: 'commercial',             labelAr: 'القانون التجاري' },
      { id: 'labor',                  labelAr: 'قانون العمل' },
      { id: 'private_international',  labelAr: 'القانون الدولي الخاص' },
    ],
  },
  {
    id: 'criminal',
    labelAr: 'ج. القانون الجزائي',
    branches: [
      { id: 'criminal_substantive',   labelAr: 'القانون الجزائي الموضوعي' },
      { id: 'criminal_procedure',     labelAr: 'الإجراءات الجزائية' },
      { id: 'tech_crimes',            labelAr: 'الجرائم التقنية' },
      { id: 'financial_crimes',       labelAr: 'الجرائم المالية' },
      { id: 'security_crimes',        labelAr: 'الجرائم الأمنية' },
    ],
  },
];
export const DEFAULT_LAW_CATEGORY_ID: LawCategoryId = 'public';
export const DEFAULT_LAW_BRANCH_ID = 'admin';

/** Look up a branch's Arabic label by id, across all three categories. */
export function findLawBranchLabel(branchId: string): string {
  for (const cat of LAW_CATEGORIES) {
    const b = cat.branches.find((br) => br.id === branchId);
    if (b) return b.labelAr;
  }
  return branchId;
}

// ─── مصدر القانون — law source ──────────────────────────────────────────────────
export type LawSourceId = 'uae' | 'france' | 'egypt' | 'saudi' | 'comparative';
export const LAW_SOURCES: { id: LawSourceId; labelAr: string }[] = [
  { id: 'uae',         labelAr: 'القانون الإماراتي' },
  { id: 'france',      labelAr: 'القانون الفرنسي' },
  { id: 'egypt',       labelAr: 'القانون المصري' },
  { id: 'saudi',       labelAr: 'القانون السعودي' },
  { id: 'comparative', labelAr: 'دراسة مقارنة' },
];
export const DEFAULT_LAW_SOURCE_ID: LawSourceId = 'uae';

// ─── مستوى التحليل — analysis depth ─────────────────────────────────────────────
export type AnalysisLevelId = 'basic' | 'intermediate' | 'advanced' | 'comprehensive';
export const ANALYSIS_LEVELS: { id: AnalysisLevelId; labelAr: string }[] = [
  { id: 'basic',         labelAr: 'أساسي' },
  { id: 'intermediate',  labelAr: 'متوسط' },
  { id: 'advanced',      labelAr: 'متقدم' },
  { id: 'comprehensive', labelAr: 'شامل' },
];
export const DEFAULT_ANALYSIS_LEVEL_ID: AnalysisLevelId = 'intermediate';

// ─── لغة الإجابة — answer language ──────────────────────────────────────────────
export type AnswerLanguageId = 'ar' | 'en' | 'fr' | 'ar_en' | 'other';
export const ANSWER_LANGUAGES: { id: AnswerLanguageId; labelAr: string }[] = [
  { id: 'ar',    labelAr: 'العربية' },
  { id: 'en',    labelAr: 'الإنجليزية' },
  { id: 'fr',    labelAr: 'الفرنسية' },
  { id: 'ar_en', labelAr: 'العربية والإنجليزية' },
  { id: 'other', labelAr: 'لغة أخرى' },
];
/** العربية افتراضيًا، per Issue #8. */
export const DEFAULT_ANSWER_LANGUAGE_ID: AnswerLanguageId = 'ar';

// ─── الخدمات المهنية والتدقيق الذكي — merged services catalogue ────────────────
// Replaces the previously separate "الطلبات السريعة" و"الأدوات الذكية" sections.
// Also doubles as the option set for the "نوع الطلب" dropdown.
export interface ServiceItem {
  id: string;
  labelAr: string;
  kind: 'output' | 'audit';
}

/** المخرجات المهنية */
export const PROFESSIONAL_OUTPUTS: ServiceItem[] = [
  { id: 'memo',           labelAr: 'مذكرة',        kind: 'output' },
  { id: 'report',         labelAr: 'تقرير',        kind: 'output' },
  { id: 'analysis',       labelAr: 'تحليل',        kind: 'output' },
  { id: 'comparison',     labelAr: 'مقارنة',       kind: 'output' },
  { id: 'legal_opinion',  labelAr: 'رأي قانوني',   kind: 'output' },
  { id: 'judgment_draft', labelAr: 'مسودة حكم',    kind: 'output' },
  { id: 'decision_draft', labelAr: 'مسودة قرار',   kind: 'output' },
  { id: 'research',       labelAr: 'بحث',          kind: 'output' },
];

/** المعالجة والتدقيق */
export const AUDIT_SERVICES: ServiceItem[] = [
  { id: 'summarize',            labelAr: 'تلخيص',                        kind: 'audit' },
  { id: 'extract_facts',        labelAr: 'استخراج الوقائع',              kind: 'audit' },
  { id: 'drafting_suggestion',  labelAr: 'اقتراح الصياغة',               kind: 'audit' },
  { id: 'legality_review',      labelAr: 'تدقيق المشروعية',              kind: 'audit' },
  { id: 'verify_texts',         labelAr: 'التحقق من النصوص والمراجع',    kind: 'audit' },
  { id: 'conflict_detection',   labelAr: 'كشف التعارض أو النقص',         kind: 'audit' },
  { id: 'reasoning_log',        labelAr: 'سجل الأسباب والمصادر',         kind: 'audit' },
];

/** Full 15-item catalogue — first 4 shown as cards, rest behind "عرض المزيد". */
export const MERGED_SERVICES: ServiceItem[] = [...PROFESSIONAL_OUTPUTS, ...AUDIT_SERVICES];
export const MERGED_SERVICES_VISIBLE_COUNT = 4;

// ─── نوع الطلب — request type (mirrors the merged services catalogue) ─────────
export const REQUEST_TYPES: ServiceItem[] = MERGED_SERVICES;
export const DEFAULT_REQUEST_TYPE_ID = 'analysis';

// ─── Guided config payload — written to sessionStorage, read by ai-assistant.tsx ──
export interface GuidedAssistantConfig {
  userCategory: UserCategoryId;
  userType: string;
  answerStyle: AnswerStyleId;
  legalReference: LegalRefId;
  /** One of LAW_CATEGORIES[].branches[].id — a plain string since branches now
   *  nest under three top-level categories instead of a flat union. */
  legalBranch: string | null;
  trainingMode: boolean;
  /** Added per Issue #8 — carried through for display/state, not yet consumed
   *  by the legacy composer's prefix builder (backward compatible, additive). */
  requestType?: string;
  lawSource?: LawSourceId;
  analysisLevel?: AnalysisLevelId;
  answerLanguage?: AnswerLanguageId;
}
