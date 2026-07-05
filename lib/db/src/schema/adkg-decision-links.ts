// Phase 58 — Administrative Decision Knowledge Graph: Polymorphic Link Table
// Connects a decision to any external or internal entity (legislation, KB docs, etc.)
import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { adkgDecisionsTable } from "./adkg-decisions.js";

// Every supported link target category
export const ADKG_LINK_TYPES = [
  "legislation",
  "exec_regulation",
  "cabinet_decision",
  "ministerial_decision",
  "case_law",
  "legal_principle",
  "legal_opinion",
  "research_project",
  "other_decision",
  "other",
] as const;

export type AdkgLinkType = (typeof ADKG_LINK_TYPES)[number];

// The concrete table/system the linked entity lives in
export const ADKG_LINKED_ENTITY_TYPES = [
  "kb_document",       // kbDocumentsTable (Phase 53+)
  "legal_source",      // legalSourcesTable (existing)
  "research_project",  // researchProjectsTable (Phase 57)
  "research_item",     // researchItemsTable (Phase 57)
  "adkg_decision",     // adkgDecisionsTable (this phase)
  "external",          // freeform URL / reference
] as const;

export type AdkgLinkedEntityType = (typeof ADKG_LINKED_ENTITY_TYPES)[number];

export const adkgDecisionLinksTable = pgTable("adkg_decision_links", {
  id: serial("id").primaryKey(),

  decisionId: integer("decision_id")
    .notNull()
    .references(() => adkgDecisionsTable.id, { onDelete: "cascade" }),

  // ── Link category ─────────────────────────────────────────────────────────
  linkType:         varchar("link_type", { length: 50 }).notNull(),
  // One of ADKG_LINK_TYPES

  // ── Target entity ─────────────────────────────────────────────────────────
  linkedEntityType: varchar("linked_entity_type", { length: 30 }).notNull(),
  // One of ADKG_LINKED_ENTITY_TYPES

  linkedEntityId:   integer("linked_entity_id"),
  // FK into the target table (nullable — external refs have no DB row)

  linkedEntityRef:  text("linked_entity_ref"),
  // Freeform string: URL, citation text, or external identifier

  // ── Display fields ────────────────────────────────────────────────────────
  titleAr: text("title_ar"),
  titleEn: text("title_en"),

  // ── Authority classification (Phase 56 vocabulary) ────────────────────────
  authorityClass: varchar("authority_class", { length: 20 }).notNull().default("persuasive"),
  // binding | persuasive | non_binding

  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdkgDecisionLink       = typeof adkgDecisionLinksTable.$inferSelect;
export type InsertAdkgDecisionLink = typeof adkgDecisionLinksTable.$inferInsert;
