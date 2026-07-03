import { pgTable, text, serial, timestamp, integer, json, varchar } from "drizzle-orm/pg-core";

export const legalOsSessionsTable = pgTable("legal_os_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  role: varchar("role", { length: 60 }).notNull(),
  scenarioId: varchar("scenario_id", { length: 120 }).notNull(),
  scenarioTitleAr: text("scenario_title_ar"),
  scenarioTitleEn: text("scenario_title_en"),
  answers: json("answers"), // Record<questionId, string>
  report: json("report"),   // DecisionBrief
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LegalOsSession = typeof legalOsSessionsTable.$inferSelect;
