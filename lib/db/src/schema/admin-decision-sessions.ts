import { pgTable, text, serial, timestamp, integer, json, varchar, boolean } from "drizzle-orm/pg-core";

/**
 * Stores each user's administrative decision assessment session.
 * One session = one complete Al-Shamsi 12-dimension evaluation run.
 */
export const adminDecisionSessionsTable = pgTable("admin_decision_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  /** One of the 7 Al-Shamsi roles: government_official | minister | director_general | hr | legal_department | administrative_court | citizen */
  role: varchar("role", { length: 60 }).notNull(),
  decisionTypeId: integer("decision_type_id").notNull(),
  decisionTypeAr: text("decision_type_ar"),
  decisionTypeEn: text("decision_type_en"),
  /** Primary jurisdiction evaluated: uae | france | gcc_sa | … */
  jurisdiction: varchar("jurisdiction", { length: 30 }).notNull().default("uae"),
  /** Record<questionId, string> — the user's answered interview */
  answers: json("answers").$type<Record<string, string>>(),
  /** Full 12-dimension Administrative Decision Brief as returned by validateAdminBrief() */
  brief: json("brief").$type<Record<string, unknown>>(),
  /** Weighted legality score 0–100 */
  legalityScore: integer("legality_score"),
  /** Risk score 0–100 */
  riskScore: integer("risk_score"),
  /** yes | no | conditional */
  canIssueToday: varchar("can_issue_today", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminDecisionSession = typeof adminDecisionSessionsTable.$inferSelect;
