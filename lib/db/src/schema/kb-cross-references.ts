// Phase 53 — UAE Legal Knowledge Base: Cross-Reference Graph
// Directed edges between KB documents and/or specific articles.
// Enables "related legislation", "related judgments", and amendment chain traversal.

import {
  pgTable, text, serial, timestamp, integer, varchar,
} from "drizzle-orm/pg-core";
import { kbDocumentsTable } from "./kb-documents.js";
import { kbArticlesTable } from "./kb-articles.js";

/**
 * Semantic type of the relationship between two legal instruments.
 * - cites:          source references target (citation)
 * - amends:         source modifies target (amendment)
 * - repeals:        source nullifies target
 * - implements:     source operationalises target (regulation ← law)
 * - supplements:    source adds to target without amending it
 * - related:        generic semantic proximity
 * - interpreted_by: target is a judgment interpreting source
 * - appealed_from:  source is an appeal of target judgment
 */
export type KbReferenceType =
  | "cites"
  | "amends"
  | "repeals"
  | "implements"
  | "supplements"
  | "related"
  | "interpreted_by"
  | "appealed_from";

export const kbCrossReferencesTable = pgTable("kb_cross_references", {
  id: serial("id").primaryKey(),

  // ── Source side ───────────────────────────────────────────────────────────
  sourceDocumentId: integer("source_document_id")
    .notNull()
    .references(() => kbDocumentsTable.id, { onDelete: "cascade" }),
  sourceArticleId: integer("source_article_id")
    .references(() => kbArticlesTable.id, { onDelete: "set null" }),
  // null means the reference is at document level

  // ── Target side ───────────────────────────────────────────────────────────
  targetDocumentId: integer("target_document_id")
    .references(() => kbDocumentsTable.id, { onDelete: "set null" }),
  // null if target is not yet indexed (use targetExternalRef)
  targetArticleId: integer("target_article_id")
    .references(() => kbArticlesTable.id, { onDelete: "set null" }),
  // null means the reference is at document level

  targetExternalRef: text("target_external_ref"),
  // For references to documents not yet in the KB:
  // e.g. "Federal Law No. 5 of 1985 (Civil Transactions)" — used for gap analysis

  // ── Relationship ──────────────────────────────────────────────────────────
  referenceType: varchar("reference_type", { length: 30 }).notNull(),
  // One of KbReferenceType

  description: text("description"),
  // Optional: human-readable explanation, e.g. "Article 3 was amended by this decree"

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KbCrossReference       = typeof kbCrossReferencesTable.$inferSelect;
export type InsertKbCrossReference = typeof kbCrossReferencesTable.$inferInsert;
