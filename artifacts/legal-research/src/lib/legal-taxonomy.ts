// ─── MLOS Hierarchical Legal Taxonomy — shared module ─────────────────────────
// Extracted verbatim from ai-assistant.tsx during the Judicial Command Center
// workflow rebuild so the sidebar's legal-context selectors and the assistant's
// PreAnalysisPanel consume the exact same taxonomy, law-source and answer-format
// definitions. No option was added, removed or renamed in the move.

export type Jurisdiction = 'uae' | 'france' | 'saudi' | 'egypt' | 'eu' | 'gcc' | 'comparative' | 'other';

// "التصنيف القانوني الرئيسي" — exactly 4 top-level options.
export type LegalDomain = 'public_law' | 'private_law' | 'criminal_law' | 'mixed_regulatory_law';
// "فرع القانون …" and "التخصص الدقيق" are plain string ids resolved at runtime
// against LEGAL_TAXONOMY (too many branch/specialization combinations for a
// union type to stay maintainable) — never indexed without going through
// getLegalBranchDef/getLegalSpecializationDef below.
// مصدر القانون — exactly 5 options (Al-Shamsi Theory and "other" removed).
export type LawSource = 'uae_law' | 'french_law' | 'egyptian_law' | 'saudi_law' | 'comparative_law';
// شكل الإجابة — exactly 2 options.
export type AnswerFormat = 'urgent_brief_answer' | 'specialized_legal_analysis';

export interface LegalSpecializationDef { id: string; ar: string; }
export interface LegalBranchDef { id: string; ar: string; specializations: LegalSpecializationDef[]; }
export interface LegalDomainDef { ar: string; branches: LegalBranchDef[]; }

export const LEGAL_TAXONOMY: Record<LegalDomain, LegalDomainDef> = {
  public_law: {
    ar: 'القانون العام',
    branches: [
      { id: 'constitutional_law', ar: 'القانون الدستوري', specializations: [
        { id: 'constitutional_review', ar: 'الرقابة الدستورية' },
        { id: 'rights_freedoms', ar: 'الحقوق والحريات' },
        { id: 'public_authorities', ar: 'السلطات العامة' },
        { id: 'constitutional_system', ar: 'النظام الدستوري' },
        { id: 'separation_of_powers', ar: 'الفصل بين السلطات' },
      ] },
      { id: 'administrative_law', ar: 'القانون الإداري', specializations: [
        { id: 'administrative_decision', ar: 'القرار الإداري' },
        { id: 'administrative_contracts', ar: 'العقود الإدارية' },
        { id: 'public_function', ar: 'الوظيفة العامة' },
        { id: 'administrative_control', ar: 'الضبط الإداري' },
        { id: 'public_facilities', ar: 'المرافق العامة' },
        { id: 'administrative_liability', ar: 'المسؤولية الإدارية' },
        { id: 'administrative_judiciary', ar: 'القضاء الإداري' },
      ] },
      { id: 'financial_tax_law', ar: 'القانون المالي والضريبي', specializations: [
        { id: 'public_budget', ar: 'الميزانية العامة' },
        { id: 'taxes', ar: 'الضرائب' },
        { id: 'fees', ar: 'الرسوم' },
        { id: 'public_expenditure', ar: 'الإنفاق العام' },
        { id: 'financial_control', ar: 'الرقابة المالية' },
      ] },
      { id: 'public_international_law', ar: 'القانون الدولي العام', specializations: [] },
      { id: 'human_rights_law', ar: 'حقوق الإنسان والحريات العامة', specializations: [] },
      { id: 'public_function_admin_org', ar: 'الوظيفة العامة والتنظيم الإداري', specializations: [] },
      { id: 'environmental_law', ar: 'القانون البيئي', specializations: [] },
    ],
  },
  private_law: {
    ar: 'القانون الخاص',
    branches: [
      { id: 'civil_law', ar: 'القانون المدني', specializations: [
        { id: 'contracts', ar: 'العقود' },
        { id: 'civil_liability', ar: 'المسؤولية المدنية' },
        { id: 'ownership', ar: 'الملكية' },
        { id: 'possession', ar: 'الحيازة' },
        { id: 'obligations', ar: 'الالتزامات' },
        { id: 'evidence', ar: 'الإثبات' },
      ] },
      { id: 'commercial_law', ar: 'القانون التجاري', specializations: [
        { id: 'commercial_papers', ar: 'الأوراق التجارية' },
        { id: 'bankruptcy', ar: 'الإفلاس' },
        { id: 'commercial_companies', ar: 'الشركات التجارية' },
        { id: 'commercial_business', ar: 'الأعمال التجارية' },
      ] },
      { id: 'companies_law', ar: 'قانون الشركات', specializations: [] },
      { id: 'labor_law', ar: 'قانون العمل', specializations: [
        { id: 'employment_contracts', ar: 'عقود العمل' },
        { id: 'termination_of_service', ar: 'إنهاء الخدمة' },
        { id: 'wages', ar: 'الأجور' },
        { id: 'work_injuries', ar: 'إصابات العمل' },
        { id: 'labor_disputes', ar: 'المنازعات العمالية' },
      ] },
      { id: 'personal_status_law', ar: 'الأحوال الشخصية', specializations: [] },
      { id: 'private_international_law', ar: 'القانون الدولي الخاص', specializations: [] },
      { id: 'intellectual_property_law', ar: 'الملكية الفكرية', specializations: [] },
      { id: 'insurance_law', ar: 'التأمين', specializations: [] },
      { id: 'maritime_law', ar: 'القانون البحري', specializations: [] },
      { id: 'aviation_law', ar: 'القانون الجوي', specializations: [] },
      { id: 'banking_law', ar: 'القانون المصرفي', specializations: [] },
    ],
  },
  criminal_law: {
    ar: 'القانون الجزائي / الجنائي',
    branches: [
      { id: 'penal_code', ar: 'قانون العقوبات', specializations: [
        { id: 'felonies', ar: 'الجنايات' },
        { id: 'misdemeanors', ar: 'الجنح' },
        { id: 'violations', ar: 'المخالفات' },
        { id: 'attempt', ar: 'الشروع' },
        { id: 'criminal_participation', ar: 'المساهمة الجنائية' },
      ] },
      { id: 'criminal_procedure', ar: 'الإجراءات الجزائية', specializations: [
        { id: 'gathering_evidence', ar: 'جمع الاستدلالات' },
        { id: 'preliminary_investigation', ar: 'التحقيق الابتدائي' },
        { id: 'search', ar: 'التفتيش' },
        { id: 'arrest', ar: 'القبض' },
        { id: 'interrogation', ar: 'الاستجواب' },
        { id: 'pretrial_detention', ar: 'الحبس الاحتياطي' },
        { id: 'referral_to_court', ar: 'الإحالة للمحكمة' },
      ] },
      { id: 'cybercrime', ar: 'الجرائم الإلكترونية', specializations: [
        { id: 'hacking', ar: 'الاختراق' },
        { id: 'electronic_fraud', ar: 'الاحتيال الإلكتروني' },
        { id: 'electronic_extortion', ar: 'الابتزاز الإلكتروني' },
        { id: 'technology_misuse', ar: 'إساءة استخدام التقنية' },
      ] },
      { id: 'economic_crimes', ar: 'الجرائم الاقتصادية', specializations: [] },
      { id: 'money_laundering', ar: 'غسل الأموال', specializations: [] },
      { id: 'drug_crimes', ar: 'المخدرات', specializations: [] },
      { id: 'international_crimes', ar: 'الجرائم الدولية', specializations: [] },
    ],
  },
  mixed_regulatory_law: {
    ar: 'القانون المختلط والتنظيمي',
    branches: [
      { id: 'ai_law', ar: 'قانون الذكاء الاصطناعي', specializations: [
        { id: 'algorithmic_liability', ar: 'المسؤولية الخوارزمية' },
        { id: 'algorithmic_transparency', ar: 'الشفافية الخوارزمية' },
        { id: 'algorithmic_bias', ar: 'التحيز الخوارزمي' },
        { id: 'digital_governance', ar: 'الحوكمة الرقمية' },
        { id: 'smart_administrative_decisions', ar: 'القرارات الإدارية الذكية' },
      ] },
      { id: 'data_protection_law', ar: 'حماية البيانات الشخصية', specializations: [] },
      { id: 'competition_law', ar: 'قانون المنافسة', specializations: [] },
      { id: 'investment_law', ar: 'قانون الاستثمار', specializations: [] },
      { id: 'financial_markets_law', ar: 'الأسواق المالية', specializations: [] },
      { id: 'government_procurement_law', ar: 'المشتريات الحكومية', specializations: [] },
      { id: 'energy_law', ar: 'الطاقة', specializations: [] },
      { id: 'telecom_law', ar: 'الاتصالات', specializations: [] },
    ],
  },
};

export function getLegalBranchDef(domain: LegalDomain | '', branchId: string): LegalBranchDef | undefined {
  if (!domain || !branchId) return undefined;
  return LEGAL_TAXONOMY[domain].branches.find((b) => b.id === branchId);
}
export function getLegalSpecializationDef(domain: LegalDomain | '', branchId: string, specId: string): LegalSpecializationDef | undefined {
  if (!specId) return undefined;
  return getLegalBranchDef(domain, branchId)?.specializations.find((s) => s.id === specId);
}

export const BRANCH_LEVEL_LABEL: Record<LegalDomain, string> = {
  public_law: 'فرع القانون العام',
  private_law: 'فرع القانون الخاص',
  criminal_law: 'فرع القانون الجزائي',
  mixed_regulatory_law: 'فرع القانون التنظيمي',
};

// ─── مصدر القانون ───────────────────────────────────────────────────────────
export const LAW_SOURCE_CFG: Record<LawSource, { ar: string; jurisdiction: Jurisdiction; comparativeMode: boolean }> = {
  uae_law:         { ar: 'القانون الإماراتي', jurisdiction: 'uae',         comparativeMode: false },
  french_law:      { ar: 'القانون الفرنسي',   jurisdiction: 'france',      comparativeMode: false },
  egyptian_law:    { ar: 'القانون المصري',    jurisdiction: 'egypt',       comparativeMode: false },
  saudi_law:       { ar: 'القانون السعودي',   jurisdiction: 'saudi',       comparativeMode: false },
  comparative_law: { ar: 'القانون المقارن',   jurisdiction: 'comparative', comparativeMode: true },
};

// ─── شكل الإجابة ─────────────────────────────────────────────────────────────
export const ANSWER_FORMAT_CFG: Record<AnswerFormat, { ar: string; instructions: string }> = {
  urgent_brief_answer: {
    ar: 'سريعة عاجلة ملخصة',
    instructions:
      '[شكل الإجابة: سريعة عاجلة ملخصة]\n' +
      'قدّم إجابة مباشرة في نقاط مختصرة، بنتيجة واضحة دون توسع طويل، مع بيان الأساس القانوني الأساسي فقط.\n',
  },
  specialized_legal_analysis: {
    ar: 'تحليل قانوني متخصص',
    instructions:
      '[شكل الإجابة: تحليل قانوني متخصص]\n' +
      'قدّم تحليلاً منظماً يشمل: تحديد الوقائع، تحديد المسائل القانونية، بيان القواعد القانونية، التطبيق القانوني، ثم النتيجة، ' +
      'مع الإشارة إلى المخاطر أو أوجه الاختلاف عند الحاجة.\n',
  },
};
