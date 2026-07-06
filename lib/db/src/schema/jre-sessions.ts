import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";

/**
 * Judicial Reasoning Engine — session storage.
 *
 * One session = one complete simulated judicial analysis of an administrative
 * dispute, including all reasoning stages and the final draft judgment.
 */
export const jreSessionsTable = pgTable("jre_sessions", {
  id:               serial("id").primaryKey(),
  userId:           integer("user_id").notNull(),

  /** User-supplied title for this session */
  title:            text("title").notNull(),

  /** Full narrative dispute summary provided by the user */
  disputeSummary:   text("dispute_summary").notNull(),

  /**
   * Structured parties as TEXT JSON:
   * { applicant: string; respondent: string; applicantAr: string; respondentAr: string }
   */
  parties:          text("parties").notNull().default("{}"),

  /**
   * Dispute classification:
   *   "annulment" | "compensation" | "disciplinary" | "licensing" |
   *   "procurement" | "civil_service" | "expropriation" | "other"
   */
  disputeType:      varchar("dispute_type", { length: 60 }).notNull().default("annulment"),

  /**
   * Whether an AI / algorithmic system was involved in the challenged decision.
   * When "true", the AI-decision review stage is activated.
   */
  hasAiDecision:    varchar("has_ai_decision", { length: 5 }).notNull().default("false"),

  /**
   * Active theory lens ID:
   *   "al_shamsi" | "comparative_french" | "custom" | null
   * When non-null, the theory analysis stage is activated (non-binding).
   */
  theoryLensId:     varchar("theory_lens_id", { length: 60 }),

  /** Display name of the selected theory lens */
  theoryLensName:   text("theory_lens_name"),

  /** User-supplied custom theory text (only when theoryLensId = "custom") */
  customTheoryText: text("custom_theory_text"),

  /**
   * Analysis pipeline status:
   *   "pending"   — created, analysis not yet started
   *   "analyzing" — AI pipeline in progress
   *   "complete"  — full judgment available
   *   "error"     — analysis failed
   */
  status:           varchar("status", { length: 20 }).notNull().default("pending"),

  /**
   * TEXT JSON — all intermediate stage outputs.
   * Shape: { stage1Facts?, stage2Retrieval?, stage3Analysis?, stage4AiReview?, stage5Theory?, stage6Judgment? }
   */
  stageData:        text("stage_data"),

  /**
   * TEXT JSON — the final structured JudgmentOutput.
   * Populated when status = "complete".
   */
  judgment:         text("judgment"),

  /** Legality score (0–100) if AI-decision review stage ran */
  legalityScore:    integer("legality_score"),

  /** Risk score (0–100) if AI-decision review stage ran */
  riskScore:        integer("risk_score"),

  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JreSession      = typeof jreSessionsTable.$inferSelect;
export type JreSessionInsert = typeof jreSessionsTable.$inferInsert;
