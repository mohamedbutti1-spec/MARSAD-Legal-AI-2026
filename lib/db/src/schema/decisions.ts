import { pgTable, text, serial, timestamp, integer, json, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Stage Keys (ordered) ─────────────────────────────────────────────────────

export const DECISION_STAGE_KEYS = [
  "administrative_request",
  "legal_authority",
  "facts_evidence",
  "legal_basis",
  "administrative_objective",
  "discretionary_power",
  "proportionality",
  "human_oversight",
  "constitutional_validation",
  "decision_drafting",
  "final_review",
] as const;

export type DecisionStageKey = (typeof DECISION_STAGE_KEYS)[number];

// ─── Decision Status ──────────────────────────────────────────────────────────

export const DECISION_STATUS_VALUES = [
  "draft",
  "in_progress",
  "validation_failed",
  "complete",
  "signed",
] as const;

export type DecisionStatus = (typeof DECISION_STATUS_VALUES)[number];

// ─── Decisions Table ──────────────────────────────────────────────────────────
// Each row represents one administrative decision case, from first request
// through final signed output. Case number format: MARSAD-YYYY-NNNN.

export const decisionsTable = pgTable("decisions", {
  id: serial("id").primaryKey(),

  /** Unique immutable reference. Format: MARSAD-YYYY-NNNN */
  caseNumber: text("case_number").unique().notNull(),

  /** Official Arabic title of the decision */
  titleAr: text("title_ar").notNull(),

  /** Optional English title */
  titleEn: text("title_en"),

  /** Lifecycle status */
  status: text("status").notNull().default("in_progress"),

  /** Key of the stage the decision is currently at */
  currentStage: text("current_stage").notNull().default("administrative_request"),

  /** Array of stage keys that have been completed */
  stagesCompleted: json("stages_completed").$type<string[]>().default([]),

  /** Jurisdiction key (e.g., "uae", "sa", "fr") */
  jurisdiction: text("jurisdiction").notNull(),

  /** Type of administrative decision (appointment, revocation, penalty, etc.) */
  decisionType: text("decision_type").notNull(),

  /** Name of the issuing administrative unit / ministry */
  organizationUnit: text("organization_unit").notNull(),

  /** Name / position of the issuing authority official */
  issuingAuthority: text("issuing_authority"),

  /** User ID of creator */
  createdBy: integer("created_by"),

  /** Additional metadata (tags, priority, etc.) */
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionSchema = createInsertSchema(decisionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDecision = z.infer<typeof insertDecisionSchema>;
export type Decision = typeof decisionsTable.$inferSelect;

// ─── Decision Stages Table ────────────────────────────────────────────────────
// Each row is an immutable stage record. Once completed, a stage is never
// overwritten — only superseded by a new row (re-do flow). The audit_hash
// provides tamper-evidence for each individual stage record.

export const decisionStagesTable = pgTable("decision_stages", {
  id: serial("id").primaryKey(),

  /** FK to decisionsTable */
  decisionId: integer("decision_id").notNull(),

  /** Stage identifier matching DECISION_STAGE_KEYS */
  stageKey: text("stage_key").notNull(),

  /** Stage order (1-indexed) */
  stageNumber: integer("stage_number").notNull(),

  /** All form fields submitted for this stage */
  stageData: json("stage_data").$type<Record<string, unknown>>().notNull().default({}),

  /** Formal Arabic statement of what AI contributed */
  aiContribution: text("ai_contribution"),

  /** Full AI analysis response (structured) */
  aiAnalysis: json("ai_analysis").$type<Record<string, unknown>>().default({}),

  /** Whether the human official overrode an AI recommendation */
  humanOverride: boolean("human_override").default(false),

  /** Reason for override, if applicable */
  overrideReason: text("override_reason"),

  /** pending | passed | failed */
  validationStatus: text("validation_status").default("pending"),

  /** Structured validation results per-dimension */
  validationDetails: json("validation_details").$type<Record<string, unknown>>().default({}),

  validatedAt: timestamp("validated_at", { withTimezone: true }),
  validatedBy: integer("validated_by"),

  /** SHA-256(decisionId + stageKey + stageData + timestamp + userId) */
  auditHash: text("audit_hash"),

  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecisionStageSchema = createInsertSchema(decisionStagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDecisionStage = z.infer<typeof insertDecisionStageSchema>;
export type DecisionStage = typeof decisionStagesTable.$inferSelect;
