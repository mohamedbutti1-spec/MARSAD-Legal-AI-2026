import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";

/**
 * Professional Guidance Framework (PGF) — session storage.
 *
 * One session = one guided workflow for a specific profession config.
 * Answers accumulate stage-by-stage; AI assessment is generated at finalize.
 */
export const pgfSessionsTable = pgTable("pgf_sessions", {
  id:               serial("id").primaryKey(),
  userId:           integer("user_id").notNull(),

  title:            text("title").notNull(),
  sectorId:         varchar("sector_id",         { length: 80 }).notNull(),
  sectorNameAr:     text("sector_name_ar").notNull(),
  professionId:     varchar("profession_id",      { length: 80 }).notNull(),
  professionNameAr: text("profession_name_ar").notNull(),

  /**
   * Status machine:
   *   draft      — workflow in progress (some stages answered)
   *   finalizing — AI assessment running
   *   complete   — assessment available
   *   error      — assessment failed
   */
  status:           varchar("status", { length: 20 }).notNull().default("draft"),

  /** JSON: PgfSessionAnswers — keyed by stageId then questionId */
  answers:          text("answers"),

  /** JSON string[]: risk flags triggered by decision tree */
  triggeredFlags:   text("triggered_flags"),

  /** ID of the current workflow stage */
  currentStageId:   varchar("current_stage_id", { length: 80 }),

  /** IDs of completed stages (JSON string[]) */
  completedStages:  text("completed_stages"),

  /** JSON: PgfAssessmentOutput */
  output:           text("output"),

  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PgfSession       = typeof pgfSessionsTable.$inferSelect;
export type PgfSessionInsert = typeof pgfSessionsTable.$inferInsert;
