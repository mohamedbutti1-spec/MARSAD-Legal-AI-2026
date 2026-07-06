/**
 * Professional Guidance Framework (PGF) — Core Type Definitions
 *
 * Every profession is declared as a ProfessionConfig. The framework reads
 * configs at runtime — no code changes are needed to add new professions.
 */

// ─── Reference types ──────────────────────────────────────────────────────────

export interface PgfLegalReference {
  title:     string;
  reference: string;
  type:      'law' | 'regulation' | 'decree' | 'principle' | 'standard' | 'policy' | 'guideline';
  binding:   boolean;
}

export interface PgfRequiredDocument {
  name:         string;
  description?: string;
  mandatory:    boolean;
  whenRequired?: string;  // optional condition
}

export interface PgfCommonMistake {
  mistake:     string;
  consequence: string;
  remedy:      string;
}

export interface PgfRiskIndicator {
  indicator: string;
  severity:  'high' | 'medium' | 'low';
  flag:      string;  // machine-readable flag ID used in decision tree
}

export interface PgfEscalationRule {
  condition:   string;
  escalateTo:  string;
  mandatory:   boolean;
}

export interface PgfThinkingStep {
  step:     string;
  question: string;  // what the professional must ask themselves
}

export interface PgfFinalChecklistItem {
  id:        string;
  item:      string;
  category:  'legal' | 'procedural' | 'documentation' | 'risk' | 'quality';
  mandatory: boolean;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface PgfWorkflowQuestion {
  id:            string;
  text:          string;           // Arabic primary
  type:          'text' | 'select' | 'multiselect' | 'boolean';
  required:      boolean;
  minLength?:    number;           // for text inputs
  options?:      string[];         // for select/multiselect
  decisionKey?:  string;           // links to a DecisionNode entry
  hint?:         string;           // shown below the field
}

export interface PgfWorkflowStage {
  id:                  string;
  title:               string;
  description:         string;
  icon?:               string;     // emoji
  questions:           PgfWorkflowQuestion[];
  defaultNextStageId?: string;     // next stage if no decision tree match
}

/**
 * DecisionNode: when stageId+questionId answer matches `answer`,
 * route to nextStageId and optionally set a risk flag.
 */
export interface PgfDecisionNode {
  stageId:     string;
  questionId:  string;
  answer:      string;     // exact match (case-insensitive)
  nextStageId: string;
  addFlag?:    string;     // risk flag to attach to session
}

// ─── Profession config (the heart of the framework) ──────────────────────────

export interface ProfessionConfig {
  // Identity
  sectorId:          string;
  sectorNameAr:      string;
  sectorNameEn:      string;
  professionId:      string;
  professionNameAr:  string;
  professionNameEn:  string;
  icon:              string;   // emoji

  // Professional profile
  description:          string;
  responsibilities:     string[];
  requiredCompetencies: string[];
  requiredAuthorities:  string[];

  // Legal basis — always-applicable references for this profession
  legalBasis:           PgfLegalReference[];

  // Interactive workflow
  workflowStages:  PgfWorkflowStage[];
  decisionTree:    PgfDecisionNode[];

  // Knowledge base
  requiredDocuments: PgfRequiredDocument[];
  commonMistakes:    PgfCommonMistake[];
  riskIndicators:    PgfRiskIndicator[];
  escalationRules:   PgfEscalationRule[];
  bestPractices:     string[];
  thinkingModel:     PgfThinkingStep[];
  finalChecklist:    PgfFinalChecklistItem[];

  // Prompt context — injects profession-specific instructions into the AI
  assessmentContext: string;
}

// ─── Session state ─────────────────────────────────────────────────────────────

export interface PgfSessionAnswers {
  [stageId: string]: {
    [questionId: string]: string | string[] | boolean;
  };
}

// ─── AI Assessment Output ─────────────────────────────────────────────────────

export interface PgfRisk {
  risk:       string;
  severity:   'high' | 'medium' | 'low';
  mitigation: string;
}

export interface PgfFinalChecklistResult {
  id:          string;
  item:        string;
  category:    'legal' | 'procedural' | 'documentation' | 'risk' | 'quality';
  mandatory:   boolean;
  status:      'complete' | 'incomplete' | 'not_applicable';
  note?:       string;
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
  confidenceScore:          number;   // 0–100
  confidenceRationale:      string;
  finalChecklist:           PgfFinalChecklistResult[];
  disclaimer:               string;
}

// ─── Registry helpers ─────────────────────────────────────────────────────────

export interface PgfSectorSummary {
  sectorId:     string;
  sectorNameAr: string;
  sectorNameEn: string;
  icon:         string;
  professions:  PgfProfessionSummary[];
}

export interface PgfProfessionSummary {
  sectorId:         string;
  professionId:     string;
  professionNameAr: string;
  professionNameEn: string;
  icon:             string;
  description:      string;
}
