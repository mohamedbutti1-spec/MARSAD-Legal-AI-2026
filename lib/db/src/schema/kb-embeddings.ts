// Phase 53 — UAE Legal Knowledge Base: Embedding Store
//
// Vectors are stored as JSON-serialized float[] for immediate portability.
// The schema is designed for zero-friction migration to pgvector when needed:
//
//   Migration path (when pgvector is available):
//     CREATE EXTENSION IF NOT EXISTS vector;
//     ALTER TABLE kb_embeddings ADD COLUMN vec vector(1536);
//     UPDATE kb_embeddings SET vec = vector_json::vector;
//     CREATE INDEX ON kb_embeddings USING ivfflat (vec vector_cosine_ops);
//     ALTER TABLE kb_embeddings DROP COLUMN vector_json;
//
// Until then, cosine similarity is computed in-process by the retrieval engine.

import {
  pgTable, text, serial, timestamp, integer, varchar,
} from "drizzle-orm/pg-core";

export const kbEmbeddingsTable = pgTable("kb_embeddings", {
  id: serial("id").primaryKey(),

  // ── What is embedded ──────────────────────────────────────────────────────
  entityType: varchar("entity_type", { length: 20 }).notNull(),
  // "document" — embedding of the full document (title + summary + keywords)
  // "article"  — embedding of one article body

  entityId: integer("entity_id").notNull(),
  // FK → kb_documents.id  when entityType = "document"
  // FK → kb_articles.id   when entityType = "article"

  // ── Embedding metadata ────────────────────────────────────────────────────
  language: varchar("language", { length: 5 }).notNull(),
  // "ar" — Arabic text was embedded
  // "en" — English text was embedded

  modelId: varchar("model_id", { length: 100 }).notNull(),
  // e.g. "text-embedding-3-small", "text-embedding-ada-002"

  dimensions: integer("dimensions").notNull(),
  // e.g. 1536 for text-embedding-3-small; 3072 for text-embedding-3-large

  // ── Vector payload ────────────────────────────────────────────────────────
  vectorJson: text("vector_json").notNull(),
  // JSON.stringify(number[]) — portable float array, pgvector-ready

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KbEmbedding       = typeof kbEmbeddingsTable.$inferSelect;
export type InsertKbEmbedding = typeof kbEmbeddingsTable.$inferInsert;
