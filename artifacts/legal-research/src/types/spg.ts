// ─── Sector / Role catalogue ──────────────────────────────────────────────────

export interface SpgRole {
  id:      string;
  nameAr:  string;
  nameEn:  string;
}

export interface SpgSector {
  id:      string;
  nameAr:  string;
  nameEn:  string;
  icon:    string;   // emoji used in the UI
  roles:   SpgRole[];
}

export const SPG_SECTORS: SpgSector[] = [
  {
    id: 'law_judiciary', nameAr: 'القانون والقضاء', nameEn: 'Law & Judiciary', icon: '⚖️',
    roles: [
      { id: 'judge',            nameAr: 'القاضي',             nameEn: 'Judge' },
      { id: 'prosecutor',       nameAr: 'وكيل النيابة',        nameEn: 'Public Prosecutor' },
      { id: 'lawyer',           nameAr: 'المحامي',             nameEn: 'Lawyer' },
      { id: 'legal_advisor',    nameAr: 'المستشار القانوني',   nameEn: 'Legal Advisor' },
      { id: 'legal_researcher', nameAr: 'الباحث القانوني',     nameEn: 'Legal Researcher' },
    ],
  },
  {
    id: 'security_investigation', nameAr: 'الأمن والتحقيق', nameEn: 'Security & Investigation', icon: '🔍',
    roles: [
      { id: 'police_officer',       nameAr: 'ضابط الشرطة',          nameEn: 'Police Officer' },
      { id: 'judicial_officer',     nameAr: 'رجل الضبط القضائي',     nameEn: 'Judicial Officer' },
      { id: 'forensic_investigator',nameAr: 'المحقق الجنائي',        nameEn: 'Forensic Investigator' },
      { id: 'forensic_evidence',    nameAr: 'الأدلة الجنائية',       nameEn: 'Forensic Evidence' },
      { id: 'crime_scene',          nameAr: 'مسرح الجريمة',          nameEn: 'Crime Scene' },
    ],
  },
  {
    id: 'government_admin', nameAr: 'الإدارة الحكومية', nameEn: 'Government Administration', icon: '🏛️',
    roles: [
      { id: 'admin_decision_maker', nameAr: 'متخذ القرار الإداري', nameEn: 'Administrative Decision-Maker' },
      { id: 'admin_investigator',   nameAr: 'المحقق الإداري',       nameEn: 'Administrative Investigator' },
      { id: 'hr',                   nameAr: 'الموارد البشرية',       nameEn: 'Human Resources' },
      { id: 'legal_affairs',        nameAr: 'الشؤون القانونية',     nameEn: 'Legal Affairs' },
    ],
  },
  {
    id: 'governance_oversight', nameAr: 'الحوكمة والرقابة', nameEn: 'Governance & Oversight', icon: '🛡️',
    roles: [
      { id: 'internal_audit',   nameAr: 'التدقيق الداخلي',  nameEn: 'Internal Audit' },
      { id: 'risk_management',  nameAr: 'إدارة المخاطر',    nameEn: 'Risk Management' },
      { id: 'compliance',       nameAr: 'الامتثال',         nameEn: 'Compliance' },
      { id: 'anti_corruption',  nameAr: 'مكافحة الفساد',    nameEn: 'Anti-Corruption' },
    ],
  },
  {
    id: 'strategy_development', nameAr: 'الاستراتيجية والتطوير', nameEn: 'Strategy & Development', icon: '🎯',
    roles: [
      { id: 'strategic_planning', nameAr: 'التخطيط الاستراتيجي', nameEn: 'Strategic Planning' },
      { id: 'kpi_management',     nameAr: 'مؤشرات الأداء',        nameEn: 'KPI Management' },
      { id: 'project_management', nameAr: 'إدارة المشاريع',        nameEn: 'Project Management' },
      { id: 'change_management',  nameAr: 'إدارة التغيير',         nameEn: 'Change Management' },
    ],
  },
  {
    id: 'quality_standards', nameAr: 'الجودة والمعايير', nameEn: 'Quality & Standards', icon: '✅',
    roles: [
      { id: 'iso',       nameAr: 'ISO',        nameEn: 'ISO' },
      { id: 'efqm',      nameAr: 'EFQM',       nameEn: 'EFQM' },
      { id: 'six_sigma', nameAr: 'Six Sigma',  nameEn: 'Six Sigma' },
    ],
  },
  {
    id: 'finance_economy', nameAr: 'المالية والاقتصاد', nameEn: 'Finance & Economy', icon: '💰',
    roles: [
      { id: 'government_finance', nameAr: 'المالية الحكومية', nameEn: 'Government Finance' },
      { id: 'taxation',           nameAr: 'الضرائب',          nameEn: 'Taxation' },
      { id: 'procurement',        nameAr: 'المشتريات',         nameEn: 'Procurement' },
      { id: 'contracts',          nameAr: 'العقود',            nameEn: 'Contracts' },
    ],
  },
  {
    id: 'ai_digital', nameAr: 'الذكاء الاصطناعي والتحول الرقمي', nameEn: 'AI & Digital Transformation', icon: '🤖',
    roles: [
      { id: 'ai_governance',    nameAr: 'حوكمة الذكاء الاصطناعي',  nameEn: 'AI Governance' },
      { id: 'algorithm_review', nameAr: 'مراجعة الخوارزميات',      nameEn: 'Algorithm Review' },
      { id: 'data_protection',  nameAr: 'حماية البيانات',           nameEn: 'Data Protection' },
      { id: 'cybersecurity',    nameAr: 'الأمن السيبراني',           nameEn: 'Cybersecurity' },
    ],
  },
  {
    id: 'academics', nameAr: 'الأكاديميون', nameEn: 'Academics', icon: '🎓',
    roles: [
      { id: 'researcher',           nameAr: 'الباحث',             nameEn: 'Researcher' },
      { id: 'scientific_supervisor',nameAr: 'المشرف العلمي',       nameEn: 'Scientific Supervisor' },
      { id: 'masters_student',      nameAr: 'طالب الماجستير',      nameEn: 'Master\'s Student' },
      { id: 'phd_student',          nameAr: 'طالب الدكتوراه',      nameEn: 'PhD Student' },
    ],
  },
];

// ─── Wizard ───────────────────────────────────────────────────────────────────

export interface SpgWizardAnswers {
  incident:    string;   // ما الواقعة أو المهمة؟
  stage:       string;   // ما المرحلة الحالية؟
  documents:   string;   // ما المستندات المتوفرة؟
  action:      string;   // ما الإجراء المطلوب؟
  risks:       string;   // ما المخاطر المحتملة؟
  nextStep:    string;   // ما الخطوة التالية المتوقعة؟
}

// ─── Guidance Output ──────────────────────────────────────────────────────────

export interface SpgLegalReference {
  title:     string;
  type:      'law' | 'regulation' | 'decree' | 'principle' | 'standard' | 'guideline';
  reference: string;  // e.g. "قانون اتحادي رقم 11 لسنة 1992"
  binding:   boolean; // true = binding legal requirement, false = best practice
}

export interface SpgChecklistItem {
  step:        string;
  priority:    'high' | 'medium' | 'low';
  mandatory:   boolean;
}

export interface SpgGuidanceOutput {
  summary:                  string;
  requiredActions:          string[];
  requiredDocuments:        string[];
  legalReferences:          SpgLegalReference[];
  practicalWarnings:        string[];
  commonMistakes:           string[];
  nextStepChecklist:        SpgChecklistItem[];
  escalationRecommendation: string | null;
  disclaimer:               string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface SpgSession {
  id:           number;
  userId:       number;
  title:        string;
  sectorId:     string;
  sectorNameAr: string;
  roleId:       string;
  roleNameAr:   string;
  status:       'draft' | 'analyzing' | 'complete' | 'error';
  answers:      SpgWizardAnswers | null;
  output:       SpgGuidanceOutput | null;
  createdAt:    string;
  updatedAt:    string;
}
