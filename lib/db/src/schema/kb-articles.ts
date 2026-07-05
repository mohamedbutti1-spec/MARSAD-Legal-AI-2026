// Phase 53 — UAE Legal Knowledge Base: Article Segmentation
// Each record is one article / clause / schedule section extracted from a KB document.
// Article-level granularity enables precise citation and targeted semantic retrieval.

import {
  pgTable, text, serial, timestamp, integer,
  varchar, boolean, date,
} from "drizzle-orm/pg-core";
import { kbDocumentsTable } from "./kb-documents.js";

export const kbArticlesTable = pgTable("kb_articles", {
  id: serial("id").primaryKey(),

  // ── Parent document ───────────────────────────────────────────────────────
  documentId: integer("document_id")
    .notNull()
    .references(() => kbDocumentsTable.id, { onDelete: "cascade" }),
  // FK → kb_documents.id — always non-null; every article belongs to one document

  // ── Article identity ──────────────────────────────────────────────────────
  articleNumber:   varchar("article_number", { length: 50 }),
  // "84" | "1 bis" | "Schedule 2, Part A"
  articleNumberAr: varchar("article_number_ar", { length: 50 }),
  // Arabic numeral form: "٨٤"

  heading:   text("heading"),     // English article heading/title
  headingAr: text("heading_ar"),  // Arabic article heading/title

  // ── Bilingual article body ────────────────────────────────────────────────
  bodyEn: text("body_en"),  // English text of this article
  bodyAr: text("body_ar"),  // Arabic text (primary — always populated if available)

  // ── Sequence within document ──────────────────────────────────────────────
  paragraphSequence: integer("paragraph_sequence").notNull(),
  // 1-based position; used to reconstruct article order and for chunk ranges

  // ── Article-level status ──────────────────────────────────────────────────
  isRepealed:    boolean("is_repealed").notNull().default(false),
  effectiveDate: date("effective_date"),
  // Override: date from which this specific article text is effective (for amendments)

  // ── Search fields ─────────────────────────────────────────────────────────
  keywords: text("keywords"),
  // Comma-separated terms — auto-extracted by pipeline from article body

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KbArticle       = typeof kbArticlesTable.$inferSelect;
export type InsertKbArticle = typeof kbArticlesTable.$inferInsert;
