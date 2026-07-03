import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";

export const libraryItemsTable = pgTable("library_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sourceType: varchar("source_type", { length: 30 }).notNull(), // document | legal_source
  documentId: integer("document_id"),
  legalSourceId: integer("legal_source_id"),
  tags: text("tags").default("[]"), // JSON array of strings
  notes: text("notes"),
  savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LibraryItem = typeof libraryItemsTable.$inferSelect;
