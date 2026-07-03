import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";

export const citationsLogTable = pgTable("citations_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sourceType: varchar("source_type", { length: 30 }).notNull(), // document | legal_source | manual
  sourceId: integer("source_id"),
  rawText: text("raw_text"),
  harvard: text("harvard"),
  apa: text("apa"),
  uaeGov: text("uae_gov"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CitationLog = typeof citationsLogTable.$inferSelect;
