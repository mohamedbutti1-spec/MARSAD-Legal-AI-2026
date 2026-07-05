// Phase 57 — Legal Research Workspace: Citation Refresh / Staleness Tracking
// Tracks whether KB documents cited in a saved answer have changed since
// the answer was generated. Polled on item fetch (not via background job).
import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { researchItemsTable } from "./research-items.js";

export const citationRefreshStatusTable = pgTable("citation_refresh_status", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => researchItemsTable.id, { onDelete: "cascade" })
    .unique(),

  kbDocumentIds: text("kb_document_ids").notNull().default("[]"),
  // JSON: number[] — IDs of kbDocumentsTable rows cited in this answer (raw IDs, no offset)

  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  // When the staleness check was last run

  isStale: boolean("is_stale").notNull().default(false),
  // true if any cited KB doc has been updated since lastCheckedAt

  stalenessReason: text("staleness_reason"),
  // Human-readable description, e.g. "Federal Law No. 11 of 2008 was updated on 2026-06-01"

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CitationRefreshStatus = typeof citationRefreshStatusTable.$inferSelect;
export type InsertCitationRefreshStatus = typeof citationRefreshStatusTable.$inferInsert;
