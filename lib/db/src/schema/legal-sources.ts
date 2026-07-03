import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";

export const legalSourcesTable = pgTable("legal_sources", {
  id: serial("id").primaryKey(),
  jurisdiction: varchar("jurisdiction", { length: 50 }).notNull(), // uae_legislation | uae_caselaw | france | eu
  docType: varchar("doc_type", { length: 50 }).notNull(),          // law | decree | code | regulation | directive | judgment
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  referenceNumber: varchar("reference_number", { length: 200 }),
  year: integer("year"),
  subject: text("subject"),
  subjectAr: text("subject_ar"),
  content: text("content").notNull().default(""),
  summary: text("summary"),
  summaryAr: text("summary_ar"),
  language: varchar("language", { length: 10 }).default("ar"),
  courtLevel: varchar("court_level", { length: 100 }),  // for caselaw
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LegalSource = typeof legalSourcesTable.$inferSelect;
export type InsertLegalSource = typeof legalSourcesTable.$inferInsert;
