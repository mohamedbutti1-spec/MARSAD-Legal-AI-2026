import { pgTable, serial, timestamp, integer, json } from "drizzle-orm/pg-core";

/**
 * Stores the full Administrative Decision Brief separately from the session,
 * enabling future export tracking, tamper-detection hashing (Phase 5), and
 * versioning without bloating the sessions table.
 */
export const adminDecisionBriefsTable = pgTable("admin_decision_briefs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  /** Complete 12-dimension brief data, identical to the brief JSONB in the session */
  briefData: json("brief_data").$type<Record<string, unknown>>().notNull(),
  /** Set when the user exports to PDF (Phase 5) */
  exportedAt: timestamp("exported_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminDecisionBrief = typeof adminDecisionBriefsTable.$inferSelect;
