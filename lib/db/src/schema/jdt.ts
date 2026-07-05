/**
 * Phase 44 — Judicial Digital Twin (JDT)
 *
 * Simulates the full judicial review of an administrative decision.
 * Evaluates across 8 review stages and 16 Al-Shamsi constitutional dimensions,
 * producing judicial outcome probabilities and corrective actions.
 *
 * One simulation row per decision (upserted on each run).
 */
import {
  pgTable,
  serial,
  integer,
  text,
  json,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { decisionsTable } from "./decisions";

// ─── JDT Review Stage Keys ────────────────────────────────────────────────────

export const JDT_REVIEW_STAGE_KEYS = [
  "admissibility",
  "jurisdiction",
  "procedural_legality",
  "competence",
  "form",
  "reason",
  "purpose",
  "proportionality",
] as const;

export type JdtReviewStageKey = (typeof JDT_REVIEW_STAGE_KEYS)[number];

export const JDT_REVIEW_STAGE_LABELS_AR: Record<JdtReviewStageKey, string> = {
  admissibility:        "القبول الشكلي",
  jurisdiction:         "الاختصاص القضائي",
  procedural_legality:  "المشروعية الإجرائية",
  competence:           "الاختصاص الوظيفي",
  form:                 "الشكل القانوني",
  reason:               "السبب القانوني",
  purpose:              "الغاية المشروعة",
  proportionality:      "التناسب",
};

export const JDT_REVIEW_STAGE_LABELS_EN: Record<JdtReviewStageKey, string> = {
  admissibility:        "Admissibility",
  jurisdiction:         "Judicial Jurisdiction",
  procedural_legality:  "Procedural Legality",
  competence:           "Functional Competence",
  form:                 "Legal Form",
  reason:               "Legal Cause",
  purpose:              "Legitimate Purpose",
  proportionality:      "Proportionality",
};

// ─── JDT Al-Shamsi Dimension Keys ─────────────────────────────────────────────

export const JDT_SHAMSI_DIMENSION_KEYS = [
  "legal_basis_validity",
  "functional_competence",
  "judicial_jurisdiction",
  "procedural_legality",
  "form_and_procedure",
  "legal_cause",
  "legitimate_purpose",
  "proportionality",
  "equality_non_discrimination",
  "defense_guarantees",
  "transparency_reasoning",
  "legal_certainty",
  "public_interest",
  "good_faith",
  "non_abuse_of_power",
  "legitimate_expectation",
] as const;

export type JdtShamsiDimensionKey = (typeof JDT_SHAMSI_DIMENSION_KEYS)[number];

export const JDT_SHAMSI_DIMENSION_LABELS_AR: Record<JdtShamsiDimensionKey, string> = {
  legal_basis_validity:         "الأساس القانوني",
  functional_competence:        "الاختصاص الوظيفي",
  judicial_jurisdiction:        "الاختصاص القضائي",
  procedural_legality:          "المشروعية الإجرائية",
  form_and_procedure:           "الشكل والإجراء",
  legal_cause:                  "السبب القانوني",
  legitimate_purpose:           "الغاية المشروعة",
  proportionality:              "التناسب",
  equality_non_discrimination:  "المساواة وعدم التمييز",
  defense_guarantees:           "ضمانات الدفاع",
  transparency_reasoning:       "الشفافية والتسبيب",
  legal_certainty:              "اليقين القانوني",
  public_interest:              "المصلحة العامة",
  good_faith:                   "حسن النية",
  non_abuse_of_power:           "عدم الانحراف بالسلطة",
  legitimate_expectation:       "التوقع المشروع",
};

export const JDT_SHAMSI_DIMENSION_LABELS_EN: Record<JdtShamsiDimensionKey, string> = {
  legal_basis_validity:         "Legal Basis Validity",
  functional_competence:        "Functional Competence",
  judicial_jurisdiction:        "Judicial Jurisdiction",
  procedural_legality:          "Procedural Legality",
  form_and_procedure:           "Form and Procedure",
  legal_cause:                  "Legal Cause",
  legitimate_purpose:           "Legitimate Purpose",
  proportionality:              "Proportionality",
  equality_non_discrimination:  "Equality and Non-Discrimination",
  defense_guarantees:           "Defense Guarantees",
  transparency_reasoning:       "Transparency and Reasoning",
  legal_certainty:              "Legal Certainty",
  public_interest:              "Public Interest",
  good_faith:                   "Good Faith",
  non_abuse_of_power:           "Non-Abuse of Power",
  legitimate_expectation:       "Legitimate Expectation",
};

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type JdtStageOutcome = "pass" | "partial" | "fail" | "not_assessed";

export type JdtRiskLevel = "low" | "moderate" | "high" | "critical";

export type JdtReviewStageResult = {
  stageKey: JdtReviewStageKey;
  labelAr: string;
  labelEn: string;
  /** Score 0-100 for this stage */
  score: number;
  outcome: JdtStageOutcome;
  reasoning: string;
  findings: string[];
  uaeLegalReferences: string[];
  remedyAr?: string | null;
  /** Whether a defect at this stage would independently cause annulment */
  isBlockingAnnulment: boolean;
};

export type JdtShamsiDimensionResult = {
  dimensionKey: JdtShamsiDimensionKey;
  labelAr: string;
  labelEn: string;
  /** Score 0-100 for this dimension */
  score: number;
  outcome: JdtStageOutcome;
  reasoning: string;
  constitutionalRef?: string;
};

export type JdtCorrectiveAction = {
  priority: "critical" | "high" | "medium" | "low";
  action: string;
  targetStage: string;
  deadline: string;
};

// ─── JDT Simulations Table ────────────────────────────────────────────────────

export const jdtSimulationsTable = pgTable(
  "jdt_simulations",
  {
    id: serial("id").primaryKey(),

    /** FK to decisions — cascade delete on decision removal */
    decisionId: integer("decision_id")
      .notNull()
      .unique()
      .references(() => decisionsTable.id, { onDelete: "cascade" }),

    /**
     * Simulation lifecycle.
     * Values: pending | running | completed | failed
     */
    status: text("status").notNull().default("pending"),

    /** Monotonically incremented on each re-run */
    simulationVersion: integer("simulation_version").notNull().default(0),

    /** Role / user who triggered this simulation run */
    triggeredBy: text("triggered_by"),

    /** ISO timestamp of the last successful simulation */
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // ─── 8 Review Stage Results ───────────────────────────────────────────

    /** Full result for each of the 8 judicial review stages */
    reviewStages: json("review_stages").$type<JdtReviewStageResult[]>(),

    // ─── 16 Al-Shamsi Dimension Results ──────────────────────────────────

    /** Full result for each of the 16 Al-Shamsi constitutional dimensions */
    shamsiDimensions: json("shamsi_dimensions").$type<JdtShamsiDimensionResult[]>(),

    /** Composite Al-Shamsi overall score 0-100 */
    shamsiOverallScore: integer("shamsi_overall_score"),

    // ─── Constitutional Analysis ──────────────────────────────────────────

    /** Constitutional compliance score 0-100 */
    constitutionalScore: integer("constitutional_score"),

    /** Overall constitutional outcome */
    constitutionalOutcome: text("constitutional_outcome").$type<JdtStageOutcome>(),

    /** Constitutional reasoning narrative */
    constitutionalReasoning: text("constitutional_reasoning"),

    // ─── Risk Integration ─────────────────────────────────────────────────

    /** NRME risk integration score 0-100 */
    riskIntegrationScore: integer("risk_integration_score"),

    /** Risk integration reasoning */
    riskReasoning: text("risk_reasoning"),

    // ─── Judicial Outcome Probabilities ──────────────────────────────────

    /** Probability 0-100 the court annuls the decision */
    probabilityAnnulment: integer("probability_annulment"),

    /** Probability 0-100 the court dismisses the challenge */
    probabilityDismissal: integer("probability_dismissal"),

    /** Probability 0-100 the court orders correction (partial remedy) */
    probabilityCorrection: integer("probability_correction"),

    /** Probability 0-100 the decision survives judicial review fully */
    judicialSuccessProbability: integer("judicial_success_probability"),

    /** Aggregate risk level derived from outcome probabilities */
    overallRiskLevel: text("overall_risk_level").$type<JdtRiskLevel>(),

    /** Judicial reasoning narrative (Arabic) */
    judicialReasoning: text("judicial_reasoning"),

    // ─── Qualitative Analysis ─────────────────────────────────────────────

    /** Key legal strengths of the decision */
    strengths: json("strengths").$type<string[]>(),

    /** Key legal weaknesses of the decision */
    weaknesses: json("weaknesses").$type<string[]>(),

    /** Missing evidence or documentation identified */
    missingEvidence: json("missing_evidence").$type<string[]>(),

    /** Prioritised list of corrective actions */
    correctiveActions: json("corrective_actions").$type<JdtCorrectiveAction[]>(),

    /** Overall assessment narrative (Arabic) */
    overallAssessment: text("overall_assessment"),

    // ─── Cross-module Integration ─────────────────────────────────────────

    /** CIL constitutional assessment cross-reference */
    cilIntegration: json("cil_integration").$type<{
      cilScore: number | null;
      cilRiskLevel: string | null;
      alignmentNote: string;
    }>(),

    /** NRME risk assessment cross-reference */
    nrmeIntegration: json("nrme_integration").$type<{
      nriScore: number | null;
      riskLevel: string | null;
      alignmentNote: string;
    }>(),

    /** Replay engine cross-reference */
    replayIntegration: json("replay_integration").$type<{
      stagesAnalysed: number;
      criticalStageKeys: string[];
      replayHash: string;
    }>(),

    // ─── Integrity ────────────────────────────────────────────────────────

    /** AI model used for this simulation run */
    aiModel: text("ai_model"),

    /** SHA-256 audit hash over the complete simulation payload */
    auditHash: text("audit_hash"),

    // ─── Error state ──────────────────────────────────────────────────────
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("jdt_decision_id_idx").on(t.decisionId),
    index("jdt_status_idx").on(t.status),
    index("jdt_risk_level_idx").on(t.overallRiskLevel),
  ],
);

export type JdtSimulation = typeof jdtSimulationsTable.$inferSelect;
export type JdtSimulationInsert = typeof jdtSimulationsTable.$inferInsert;
