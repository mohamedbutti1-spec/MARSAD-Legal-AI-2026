// Phase 57 — Legal Research Workspace: Answer Provenance Metadata
// Every saved AI answer stores the full Phase 56 verification report and
// all provenance fields required by the spec.
import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { researchItemsTable } from "./research-items.js";

export const researchAnswerMetadataTable = pgTable("research_answer_metadata", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => researchItemsTable.id, { onDelete: "cascade" })
    .unique(),

  // ── Phase 56 provenance ───────────────────────────────────────────────────
  citedAuthorities: text("cited_authorities").notNull().default("[]"),
  // JSON: Array<{ ragTag, documentId, titleAr, authorityClass, confidenceScore, ... }>

  verificationReport: text("verification_report").notNull().default("{}"),
  // JSON: full VerificationReport from Phase 56

  confidenceLevel: real("confidence_level"),
  // Overall confidence: 0.0–1.0 (average of accepted authorities)

  retrievalInventory: text("retrieval_inventory").notNull().default("{}"),
  // JSON: authority inventory block (binding/persuasive/non_binding counts + list)

  generationTimestamp: timestamp("generation_timestamp", { withTimezone: true }),
  // When the AI generated this answer

  modelVersion: text("model_version"),
  // e.g. "claude-sonnet-4-5" or "gemini-2.5-pro"

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResearchAnswerMetadata = typeof researchAnswerMetadataTable.$inferSelect;
export type InsertResearchAnswerMetadata = typeof researchAnswerMetadataTable.$inferInsert;
