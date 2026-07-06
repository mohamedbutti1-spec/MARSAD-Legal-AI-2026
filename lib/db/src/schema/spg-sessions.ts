import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";

/**
 * Smart Professional Guidance (SPG) — session storage.
 *
 * One session = one guided decision-tree workflow for a specific
 * professional role and sector, including wizard answers and AI output.
 */
export const spgSessionsTable = pgTable("spg_sessions", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull(),

  /** Auto-generated or user-supplied title */
  title:        text("title").notNull(),

  /** Sector identifier, e.g. "law_judiciary" */
  sectorId:     varchar("sector_id", { length: 60 }).notNull(),

  /** Arabic sector name, e.g. "القانون والقضاء" */
  sectorNameAr: text("sector_name_ar").notNull(),

  /** Role identifier, e.g. "judge" */
  roleId:       varchar("role_id", { length: 60 }).notNull(),

  /** Arabic role name, e.g. "القاضي" */
  roleNameAr:   text("role_name_ar").notNull(),

  /**
   * Session status:
   *   "draft"     — wizard not yet submitted
   *   "analyzing" — AI guidance generation in progress
   *   "complete"  — guidance available
   *   "error"     — generation failed
   */
  status:       varchar("status", { length: 20 }).notNull().default("draft"),

  /**
   * TEXT JSON — wizard answers.
   * Shape: SpgWizardAnswers
   */
  answers:      text("answers"),

  /**
   * TEXT JSON — AI-generated guidance output.
   * Shape: SpgGuidanceOutput
   */
  output:       text("output"),

  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpgSession       = typeof spgSessionsTable.$inferSelect;
export type SpgSessionInsert = typeof spgSessionsTable.$inferInsert;
