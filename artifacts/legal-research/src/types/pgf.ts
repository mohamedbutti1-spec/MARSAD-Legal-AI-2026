// ─── Re-export AI output types for frontend consumption ───────────────────────
// These mirror server-side types in pgf/types.ts — kept in sync manually.

export interface PgfLegalReference {
  title:     string;
  reference: string;
  type:      'law' | 'regulation' | 'decree' | 'principle' | 'standard' | 'policy' | 'guideline';
  binding:   boolean;
}

export interface PgfRequiredDocument {
  name:          string;
  description?:  string;
  mandatory:     boolean;
  whenRequired?: string;
}

export interface PgfCommonMistake {
  mistake:     string;
  consequence: string;
  remedy:      string;
}

export interface PgfRiskIndicator {
  indicator: string;
  severity:  'high' | 'medium' | 'low';
  flag:      string;
}

export interface PgfEscalationRule {
  condition:  string;
  escalateTo: string;
  mandatory:  boolean;
}

export interface PgfThinkingStep {
  step:     string;
  question: string;
}

export interface PgfFinalChecklistItem {
  id:       string;
  item:     string;
  category: 'legal' | 'procedural' | 'documentation' | 'risk' | 'quality';
  mandatory: boolean;
}

export interface PgfWorkflowQuestion {
  id:           string;
  text:         string;
  type:         'text' | 'select' | 'multiselect' | 'boolean';
  required:     boolean;
  minLength?:   number;
  options?:     string[];
  decisionKey?: string;
  hint?:        string;
}

export interface PgfWorkflowStage {
  id:                  string;
  title:               string;
  description:         string;
  icon?:               string;
  questions:           PgfWorkflowQuestion[];
  defaultNextStageId?: string;
}

export interface PgfProfessionSummary {
  sectorId:         string;
  professionId:     string;
  professionNameAr: string;
  professionNameEn: string;
  icon:             string;
  description:      string;
}

export interface PgfSectorSummary {
  sectorId:     string;
  sectorNameAr: string;
  sectorNameEn: string;
  icon:         string;
  professions:  PgfProfessionSummary[];
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export interface PgfRisk {
  risk:       string;
  severity:   'high' | 'medium' | 'low';
  mitigation: string;
}

export interface PgfFinalChecklistResult {
  id:       string;
  item:     string;
  category: 'legal' | 'procedural' | 'documentation' | 'risk' | 'quality';
  mandatory: boolean;
  status:   'complete' | 'incomplete' | 'not_applicable';
  note?:    string;
}

export interface PgfAssessmentOutput {
  summary:                  string;
  requiredActions:          string[];
  missingActions:           string[];
  risks:                    PgfRisk[];
  applicableLegislation:    PgfLegalReference[];
  applicableRegulations:    PgfLegalReference[];
  bestPractices:            string[];
  commonMistakes:           PgfCommonMistake[];
  escalationRecommendation: string | null;
  confidenceScore:          number;
  confidenceRationale:      string;
  finalChecklist:           PgfFinalChecklistResult[];
  disclaimer:               string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface PgfSession {
  id:               number;
  userId:           number;
  title:            string;
  sectorId:         string;
  sectorNameAr:     string;
  professionId:     string;
  professionNameAr: string;
  status:           'draft' | 'finalizing' | 'complete' | 'error';
  answers:          Record<string, Record<string, string | string[] | boolean>> | null;
  triggeredFlags:   string[] | null;
  currentStageId:   string | null;
  completedStages:  string[] | null;
  output:           PgfAssessmentOutput | null;
  createdAt:        string;
  updatedAt:        string;
}

// ─── API response shapes ───────────────────────────────────────────────────────

export interface PgfAnswerResponse {
  nextStageId: string | null;   // null = workflow complete, ready to finalize
  isComplete:  boolean;
  addedFlag:   string | null;
  session:     PgfSession;
}
