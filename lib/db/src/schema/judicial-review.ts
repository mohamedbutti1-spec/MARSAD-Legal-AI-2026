/**
 * Phase 5 — Constitutional Judicial Intelligence (CJI)
 *
 * Stores the result of the AI-powered constitutional review engine.
 * One row per decision (upserted on each run). Read-only for all callers
 * except the generation service. Never modifies decision data.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  json,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { decisionsTable } from "./decisions";

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type JudicialDimensionStatus =
  | "compliant"
  | "minor_concern"
  | "significant_concern"
  | "deficient"
  | "not_assessed";

export type JudicialDimension = {
  /** Dimension key — one of the 16 constitutional review dimensions */
  dimension:
    | "jurisdiction"
    | "procedure"
    | "form"
    | "cause"
    | "subject"
    | "purpose"
    | "human_influence"
    | "ai_influence"
    | "constitutional_compliance"
    | "transparency"
    | "explainability"
    | "proportionality"
    | "algorithmic_bias"
    | "due_process"
    | "equality"
    | "fundamental_rights";
  /** Human-readable label (Arabic) */
  labelAr: string;
  /** Human-readable label (English) */
  labelEn: string;
  /** Review status */
  status: JudicialDimensionStatus;
  /** Risk score 0-100 for this dimension (0 = no risk) */
  riskScore: number;
  /** Detailed judicial finding for this dimension */
  finding: string;
  /** Specific article or principle violated / upheld */
  legalReference?: string | null;
};

export type DefectSeverity = "critical" | "major" | "minor" | "advisory";
export type DefectType =
  | "missing_reasons"
  | "proportionality_defect"
  | "procedural_defect"
  | "competence_defect"
  | "constitutional_conflict"
  | "ai_overreach"
  | "unlawful_delegation"
  | "hidden_algorithmic_influence"
  | "other";

export type ConstitutionalDefect = {
  defectType: DefectType;
  severity: DefectSeverity;
  titleAr: string;
  titleEn: string;
  description: string;
  affectedDimension: JudicialDimension["dimension"] | null;
  remedyHint: string;
};

export type OutcomeLabel =
  | "likely_lawful"
  | "likely_partially_unlawful"
  | "likely_void"
  | "requires_further_review";

export type OutcomePrediction = {
  outcome: OutcomeLabel;
  confidencePercentage: number;
  reasoning: string;
  primaryRisk: string | null;
};

export type RemedyLabel =
  | "uphold"
  | "annul"
  | "partial_annulment"
  | "remit_for_reconsideration"
  | "request_further_evidence";

export type RemedyRecommendation = {
  remedy: RemedyLabel;
  urgency: "immediate" | "standard" | "advisory";
  explanation: string;
  conditions: string[];
};

export type RiskLevel = "low" | "moderate" | "high" | "critical";

// ─── Table ────────────────────────────────────────────────────────────────────

export const judicialReviewsTable = pgTable("judicial_reviews", {
  id: serial("id").primaryKey(),

  /** FK to decisionsTable — one active review per decision. */
  decisionId: integer("decision_id")
    .notNull()
    .unique()
    .references(() => decisionsTable.id, { onDelete: "cascade" }),

  /**
   * Review lifecycle status.
   * Values: pending | running | completed | failed
   */
  status: text("status").notNull().default("pending"),

  /** Monotonically incremented each time the review is re-run. */
  reviewVersion: integer("review_version").notNull().default(0),

  /** ISO timestamp of the last successful generation. */
  generatedAt: timestamp("generated_at", { withTimezone: true }),

  /** Role of the user who triggered the last run. */
  triggeredBy: text("triggered_by"),

  // ─── Risk Assessment ──────────────────────────────────────────────────────

  /** Overall constitutional risk score 0-100 (0 = no risk, 100 = maximum). */
  constitutionalRiskScore: integer("constitutional_risk_score"),

  /** risk level derived from riskScore */
  riskLevel: text("risk_level").$type<RiskLevel>(),

  // ─── 16-Dimension Analysis ────────────────────────────────────────────────

  dimensions: json("dimensions").$type<JudicialDimension[]>(),

  // ─── Defect Detection ─────────────────────────────────────────────────────

  detectedDefects: json("detected_defects").$type<ConstitutionalDefect[]>(),

  // ─── Judicial Opinion ─────────────────────────────────────────────────────

  findingsOfFact: json("findings_of_fact").$type<string[]>(),
  findingsOfLaw: json("findings_of_law").$type<string[]>(),
  constitutionalObservations: json("constitutional_observations").$type<string[]>(),
  aiObservations: json("ai_observations").$type<string[]>(),
  humanOversightObservations: json("human_oversight_observations").$type<string[]>(),
  suggestedJudicialReasoning: text("suggested_judicial_reasoning"),

  // ─── Outcome Prediction ───────────────────────────────────────────────────

  outcomePrediction: json("outcome_prediction").$type<OutcomePrediction>(),

  // ─── Remedy ───────────────────────────────────────────────────────────────

  remedyRecommendation: json("remedy_recommendation").$type<RemedyRecommendation>(),

  // ─── Error state ──────────────────────────────────────────────────────────

  errorMessage: text("error_message"),

  // ─── Metadata ─────────────────────────────────────────────────────────────

  /** Whether the review has been reviewed / acknowledged by a human judge */
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JudicialReview = typeof judicialReviewsTable.$inferSelect;
export type JudicialReviewInsert = typeof judicialReviewsTable.$inferInsert;
