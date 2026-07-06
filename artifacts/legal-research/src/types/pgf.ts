// ─── Re-export AI output types for frontend consumption ───────────────────────
// These mirror server-side types in pgf/types.ts — kept in sync manually.

export interface PgfLegalReference {
  title:     string;
  reference: string;
  type:      'law' | 'regulation' | 'decree' | 'principle' | 'standard' | 'policy' | 'guideline';
  binding:   boolean;
}

export interface PgfCommonMistake {
  mistake:     string;
  consequence: string;
  remedy:      string;
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
  // ── PME — Professional Mentor Engine ─────────────────────────────────
  mentorPrompt?:              string;
  expertReasoning?:           string;
  whyThisMatters?:            string;
  commonMistakesAtStage?:     string[];
  warningSigns?:              string[];
  escalationTriggers?:        string[];
  expertFirstActions?:        string[];
  doNotDo?:                   string[];
  bestPracticeNotes?:         string[];
  professionalJudgmentNotes?: string;
  requiredDocumentsAtStage?:  string[];
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
  // ── PME additions ──────────────────────────────────────────────────
  expertReasoning?:    string;
  verificationStatus?: string;
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

// ─── Professional Case Simulator (PCS) ───────────────────────────────────────

export interface PcsSimStep {
  stepIdx:           number;
  id:                string;
  question:          string;
  critical:          boolean;
  requiredDocuments: string[];
  requiredApprovals: string[];
  totalSteps:        number;
}

export interface PcsStepEvaluation {
  score:            number;
  evaluation:       string;
  missedDocuments:  string[];
  missedApprovals:  string[];
  recommendation:   string;
  criticalError:    boolean;
}

export interface PcsSession {
  id:              number;
  sectorId:        string;
  professionId:    string;
  scenarioId:      string;
  status:          'in_progress' | 'completed';
  currentStepIdx:  number;
  totalScore:      number | null;
  grade:           string | null;
  createdAt:       string;
  completedAt:     string | null;
}

export interface PcsTimelineEntry {
  stepIdx:       number;
  stepId:        string;
  question:      string;
  score:         number;
  criticalError: boolean;
}

export interface PcsMistake {
  stepIdx:    number;
  question:   string;
  evaluation: string;
}

export interface PcsFinalReport {
  totalScore:      number;
  grade:           string;
  timeline:        PcsTimelineEntry[];
  mistakes:        PcsMistake[];
  missedDocuments: string[];
  missedApprovals: string[];
  recommendations: string[];
  strengths:       string[];
}

export interface PcsAnswerResponse {
  evaluation:  PcsStepEvaluation;
  isLastStep:  boolean;
  nextStep?:   PcsSimStep;
  report?:     PcsFinalReport;
  sessionId?:  number;
}

export interface PcsStartResponse {
  session:         PcsSession;
  currentStep:     PcsSimStep;
  scenarioTitle:   string;
  scenarioContext: string;
}

// ─── Professional Workflow Engine (PWE) ──────────────────────────────────────

export interface WorkflowBranchRule {
  condition: string;
  outcome:   string;
}

export interface WorkflowEscalationRule {
  condition: string;
  action:    string;
}

export interface ProfessionalWorkflowStep {
  id:                number;
  sectorId:          string;
  professionId:      string;
  stageId:           string;
  order:             number;
  title:             string;
  objective:         string;
  nextAction:        string;
  requiredDocuments: string[];
  approvals:         string[];
  checkpoints:       string[];
  branchRules:       WorkflowBranchRule[];
  escalationRules:   WorkflowEscalationRule[];
  expectedOutput:    string;
  estimatedDuration: string;
}

// ─── Institutional Memory ─────────────────────────────────────────────────────

export type InstitutionalMemoryCategory =
  | 'expert_practice'
  | 'frequent_mistake'
  | 'lesson_learned'
  | 'recommended_sequence'
  | 'practical_tip'
  | 'success_indicator'
  | 'failure_indicator';

export const INSTITUTIONAL_MEMORY_LABELS: Record<InstitutionalMemoryCategory, string> = {
  expert_practice:      'الممارسة الخبراتية الشائعة',
  frequent_mistake:     'الأخطاء المتكررة',
  lesson_learned:       'الدروس المستفادة',
  recommended_sequence: 'التسلسل الموصى به',
  practical_tip:        'نصائح عملية',
  success_indicator:    'مؤشرات النجاح',
  failure_indicator:    'مؤشرات الإخفاق',
};

export const INSTITUTIONAL_MEMORY_ICONS: Record<InstitutionalMemoryCategory, string> = {
  expert_practice:      '🏛️',
  frequent_mistake:     '⚠️',
  lesson_learned:       '📖',
  recommended_sequence: '🔢',
  practical_tip:        '💡',
  success_indicator:    '✅',
  failure_indicator:    '🚨',
};

export interface InstitutionalMemoryEntry {
  id:           number;
  sectorId:     string;
  professionId: string;
  stageId:      string;
  title:        string;
  content:      string;
  category:     InstitutionalMemoryCategory;
  confidence:   number;
  sourceType:   'institutional' | 'ai_generated' | 'user_contributed';
  createdAt:    string;
}

// ─── API response shapes ───────────────────────────────────────────────────────

export interface PgfAnswerResponse {
  nextStageId: string | null;
  isComplete:  boolean;
  addedFlag:   string | null;
  session:     PgfSession;
}
