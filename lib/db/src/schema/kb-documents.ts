// Phase 53 — UAE Legal Knowledge Base: Document Store
// Each record is one primary legal instrument (law, decree, judgment, circular, etc.)
// across 17 indexed collections covering the full UAE legal hierarchy.

import {
  pgTable, text, serial, timestamp, integer,
  varchar, boolean, date,
} from "drizzle-orm/pg-core";

// ─── Canonical value types ────────────────────────────────────────────────────

/** Pipeline lifecycle state for a KB document */
export type KbIndexStatus = "pending" | "indexed" | "failed" | "outdated";

/** Binding force of a legal instrument in the UAE hierarchy */
export type KbBindingStatus =
  | "constitutional"  // Hierarchy level 1 — supreme
  | "binding"         // Levels 2–7 — enforceable
  | "persuasive"      // Comparative law, academic — non-binding
  | "advisory"        // Guidance, circulars — non-mandatory
  | "informational";  // Official gazette entries, memoranda

/**
 * UAE legal hierarchy level as used in the Phase 52 reasoning engine.
 * Maps to authority levels 1–8, with case-law split into 7a/7b/7c.
 */
export type KbHierarchyLevel = "1" | "2" | "3" | "4" | "5" | "6" | "7a" | "7b" | "7c" | "8";

/** The 17 independent indexed collections */
export type KbCollectionId =
  | "uae_constitution"
  | "federal_laws"
  | "federal_decree_laws"
  | "executive_regulations"
  | "cabinet_decisions"
  | "ministerial_decisions"
  | "circulars"
  | "explanatory_memoranda"
  | "uae_supreme_court"
  | "federal_supreme_court"
  | "federal_admin_judiciary"
  | "abu_dhabi_courts"
  | "dubai_courts"
  | "rak_courts"
  | "constitutional_judgments"
  | "official_gazette"
  | "official_guidance";

/** Type of legal instrument */
export type KbDocType =
  | "constitution" | "law" | "decree_law" | "decree" | "regulation"
  | "cabinet_decision" | "ministerial_decision" | "circular"
  | "explanatory_memorandum" | "judgment" | "gazette_notice" | "guidance";

// ─── Main KB document table ───────────────────────────────────────────────────

export const kbDocumentsTable = pgTable("kb_documents", {
  id: serial("id").primaryKey(),

  // ── Collection membership ─────────────────────────────────────────────────
  collectionId: varchar("collection_id", { length: 60 }).notNull(),
  // e.g. "federal_laws", "dubai_courts" — matches KbCollectionId

  // ── Bilingual identity ────────────────────────────────────────────────────
  title:      text("title").notNull(),      // English title
  titleAr:    text("title_ar").notNull(),   // Arabic title (primary)
  authority:  text("authority").notNull(),  // Issuing authority (English)
  authorityAr: text("authority_ar").notNull(), // Issuing authority (Arabic)

  // ── Reference numbers ─────────────────────────────────────────────────────
  documentNumber: varchar("document_number", { length: 200 }),
  // Legislation: "11 of 2008"; Judgments: "2023/456/ADM"; Gazette: "issue 783"
  year: integer("year"),

  // ── Legal classification ──────────────────────────────────────────────────
  jurisdiction:   varchar("jurisdiction", { length: 100 }).notNull(),
  // "federal" | "abu_dhabi" | "dubai" | "sharjah" | "rak" | "ajman" | "fujairah" | "uaq"
  hierarchyLevel: varchar("hierarchy_level", { length: 10 }).notNull(),
  // "1" | "2" | "3" | "4" | "5" | "6" | "7a" | "7b" | "7c" | "8"
  bindingStatus:  varchar("binding_status", { length: 30 }).notNull(),
  // "constitutional" | "binding" | "persuasive" | "advisory" | "informational"
  docType:        varchar("doc_type", { length: 50 }).notNull(),
  // "law" | "decree_law" | "regulation" | "judgment" | "circular" | etc.

  // ── Temporal validity ─────────────────────────────────────────────────────
  effectiveDate: date("effective_date"),
  expiryDate:    date("expiry_date"),

  // ── Repeal / amendment status ─────────────────────────────────────────────
  isRepealed:      boolean("is_repealed").notNull().default(false),
  repealReference: text("repeal_reference"),
  // Identifier of the instrument that repealed this document

  isAmended:    boolean("is_amended").notNull().default(false),
  amendmentLog: text("amendment_log"),
  // JSON array: [{ amendedBy: "Law 5 of 2015", article: "3", date: "2015-06-01" }, ...]

  // ── Official publication ──────────────────────────────────────────────────
  officialGazetteRef:  varchar("official_gazette_ref", { length: 300 }),
  officialGazetteDate: date("official_gazette_date"),

  // ── Full text content ─────────────────────────────────────────────────────
  fullTextEn: text("full_text_en"),  // English full text (may be null for Arabic-only docs)
  fullTextAr: text("full_text_ar"),  // Arabic full text (primary)

  // ── Search fields ─────────────────────────────────────────────────────────
  keywordsAr: text("keywords_ar"),
  // Comma-separated Arabic keywords for keyword retrieval
  keywordsEn: text("keywords_en"),
  // Comma-separated English keywords for keyword retrieval

  // ── Article segmentation stats ────────────────────────────────────────────
  articleCount:  integer("article_count").notNull().default(0),
  crossRefCount: integer("cross_ref_count").notNull().default(0),

  // ── Related instruments (summary fields — detail lives in kb_cross_references) ──
  relatedJudgments: text("related_judgments"),
  // JSON array of related judgment references (IDs or external refs)
  // e.g. [{ "id": 42, "titleAr": "حكم المحكمة الاتحادية..." }, ...]
  relatedLegislation: text("related_legislation"),
  // JSON array of related legislation references
  // e.g. [{ "id": 7, "titleAr": "القانون الاتحادي رقم 11 لسنة 2008" }, ...]

  // ── Embedding availability flags ──────────────────────────────────────────
  hasEmbeddingAr: boolean("has_embedding_ar").notNull().default(false),
  // True once an Arabic embedding is stored in kb_embeddings for this document
  hasEmbeddingEn: boolean("has_embedding_en").notNull().default(false),
  // True once an English embedding is stored in kb_embeddings for this document

  // ── Pipeline lifecycle ────────────────────────────────────────────────────
  indexStatus: varchar("index_status", { length: 20 }).notNull().default("pending"),
  // "pending" | "indexed" | "failed" | "outdated"
  indexError:  text("index_error"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  indexedAt: timestamp("indexed_at", { withTimezone: true }),
});

export type KbDocument    = typeof kbDocumentsTable.$inferSelect;
export type InsertKbDocument = typeof kbDocumentsTable.$inferInsert;
