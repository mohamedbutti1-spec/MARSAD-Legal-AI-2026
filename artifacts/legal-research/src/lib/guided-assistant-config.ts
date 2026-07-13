// Guided assistant configuration — shared between the Dashboard entry point
// and the AI Assistant composer (role / legal-context / answer-mode selectors).
// Extracted during the Judicial Command Center visual rebuild so the dashboard
// could collapse to a single card while this configuration still lives on
// (and is fully reachable) inside the assistant's composer.

export type UserCategoryId =
  | 'student' | 'researcher' | 'police_station_officer' | 'prosecutor' | 'judge'
  | 'lawyer' | 'consultant' | 'legislator' | 'minister' | 'general_user';

export const USER_CATEGORIES: { id: UserCategoryId; labelAr: string; userType: string }[] = [
  { id: 'student',                labelAr: 'طالب',              userType: 'law_student' },
  { id: 'researcher',             labelAr: 'باحث',              userType: 'academic_researcher' },
  { id: 'police_station_officer', labelAr: 'ضابط مركز',         userType: 'police_station_officer' },
  { id: 'prosecutor',             labelAr: 'وكيل نيابة',        userType: 'prosecution_deputy' },
  { id: 'judge',                  labelAr: 'قاضٍ',              userType: 'judge_first_instance' },
  { id: 'lawyer',                 labelAr: 'محامٍ',             userType: 'lawyer' },
  { id: 'consultant',             labelAr: 'مستشار',            userType: 'legal_consultant' },
  { id: 'legislator',             labelAr: 'مشرّع',             userType: 'legislator' },
  { id: 'minister',               labelAr: 'وزير',              userType: 'minister' },
  { id: 'general_user',           labelAr: 'متعامل عام',        userType: 'citizen' },
];

export const USER_CATEGORY_STORAGE_KEY = 'marsad_user_category';

export type AnswerStyleId = 'quick' | 'standard' | 'detailed';
export const ANSWER_STYLES: { id: AnswerStyleId; labelAr: string }[] = [
  { id: 'quick',    labelAr: 'إجابة سريعة' },
  { id: 'standard', labelAr: 'إجابة نموذجية' },
  { id: 'detailed', labelAr: 'إجابة مفصلة' },
];

export type LegalRefId = 'uae' | 'france' | 'comparative' | 'shamsi' | 'other';
export const LEGAL_REFERENCES: { id: LegalRefId; labelAr: string }[] = [
  { id: 'uae',         labelAr: 'القانون الإماراتي' },
  { id: 'france',      labelAr: 'القانون الفرنسي' },
  { id: 'comparative', labelAr: 'القانون المقارن' },
  { id: 'shamsi',      labelAr: 'نظرية الشامسي' },
  { id: 'other',       labelAr: 'أخرى' },
];

export type LegalBranchId = 'admin' | 'civil' | 'commercial' | 'criminal';
export const LEGAL_BRANCHES: { id: LegalBranchId; labelAr: string }[] = [
  { id: 'admin',      labelAr: 'إداري' },
  { id: 'civil',      labelAr: 'مدني' },
  { id: 'commercial', labelAr: 'تجاري' },
  { id: 'criminal',   labelAr: 'جنائي' },
];

export interface GuidedAssistantConfig {
  userCategory: UserCategoryId;
  userType: string;
  answerStyle: AnswerStyleId;
  legalReference: LegalRefId;
  legalBranch: LegalBranchId | null;
  trainingMode: boolean;
}
