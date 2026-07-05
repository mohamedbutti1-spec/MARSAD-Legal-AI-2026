/**
 * Phase 53 — UAE Legal Knowledge Base: Database Migration
 *
 * Creates the four KB tables if they do not already exist.
 * Safe to run multiple times (IF NOT EXISTS semantics).
 *
 * Tables created:
 *   kb_documents       — primary document store (17 metadata fields)
 *   kb_articles        — article-level segments
 *   kb_cross_references — cross-reference graph edges
 *   kb_embeddings      — vector embedding store (pgvector-ready)
 *
 * Usage:
 *   import { runKbMigration } from "./migration.js";
 *   await runKbMigration();  // call on server startup or as a standalone script
 *
 * To run as a standalone script:
 *   cd artifacts/api-server
 *   npx tsx src/kb/migration.ts
 */

import { pool } from "@workspace/db";

const MIGRATION_SQL = /* sql */ `
-- ─── kb_documents ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_documents (
  id                   SERIAL PRIMARY KEY,
  collection_id        VARCHAR(60)   NOT NULL,
  title                TEXT          NOT NULL,
  title_ar             TEXT          NOT NULL,
  authority            TEXT          NOT NULL,
  authority_ar         TEXT          NOT NULL,
  document_number      VARCHAR(200),
  year                 INTEGER,
  jurisdiction         VARCHAR(100)  NOT NULL,
  hierarchy_level      VARCHAR(10)   NOT NULL,
  binding_status       VARCHAR(30)   NOT NULL,
  doc_type             VARCHAR(50)   NOT NULL,
  effective_date       DATE,
  expiry_date          DATE,
  is_repealed          BOOLEAN       NOT NULL DEFAULT FALSE,
  repeal_reference     TEXT,
  is_amended           BOOLEAN       NOT NULL DEFAULT FALSE,
  amendment_log        TEXT,
  official_gazette_ref VARCHAR(300),
  official_gazette_date DATE,
  full_text_en         TEXT,
  full_text_ar         TEXT,
  keywords_ar          TEXT,
  keywords_en          TEXT,
  article_count        INTEGER       NOT NULL DEFAULT 0,
  cross_ref_count      INTEGER       NOT NULL DEFAULT 0,
  related_judgments    TEXT,
  related_legislation  TEXT,
  has_embedding_ar     BOOLEAN       NOT NULL DEFAULT FALSE,
  has_embedding_en     BOOLEAN       NOT NULL DEFAULT FALSE,
  index_status         VARCHAR(20)   NOT NULL DEFAULT 'pending',
  index_error          TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  indexed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS kb_documents_collection_idx  ON kb_documents (collection_id);
CREATE INDEX IF NOT EXISTS kb_documents_jurisdiction_idx ON kb_documents (jurisdiction);
CREATE INDEX IF NOT EXISTS kb_documents_level_idx        ON kb_documents (hierarchy_level);
CREATE INDEX IF NOT EXISTS kb_documents_binding_idx      ON kb_documents (binding_status);
CREATE INDEX IF NOT EXISTS kb_documents_year_idx         ON kb_documents (year);
CREATE INDEX IF NOT EXISTS kb_documents_status_idx       ON kb_documents (index_status);
CREATE INDEX IF NOT EXISTS kb_documents_repealed_idx     ON kb_documents (is_repealed);

-- ─── kb_articles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_articles (
  id                   SERIAL PRIMARY KEY,
  document_id          INTEGER       NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  article_number       VARCHAR(50),
  article_number_ar    VARCHAR(50),
  heading              TEXT,
  heading_ar           TEXT,
  body_en              TEXT,
  body_ar              TEXT,
  paragraph_sequence   INTEGER       NOT NULL,
  is_repealed          BOOLEAN       NOT NULL DEFAULT FALSE,
  effective_date       DATE,
  keywords             TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kb_articles_document_idx  ON kb_articles (document_id);
CREATE INDEX IF NOT EXISTS kb_articles_sequence_idx  ON kb_articles (document_id, paragraph_sequence);

-- ─── kb_cross_references ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_cross_references (
  id                   SERIAL PRIMARY KEY,
  source_document_id   INTEGER       NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  source_article_id    INTEGER       REFERENCES kb_articles(id) ON DELETE SET NULL,
  target_document_id   INTEGER       REFERENCES kb_documents(id) ON DELETE SET NULL,
  target_article_id    INTEGER       REFERENCES kb_articles(id) ON DELETE SET NULL,
  target_external_ref  TEXT,
  reference_type       VARCHAR(30)   NOT NULL,
  description          TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kb_xref_source_doc_idx  ON kb_cross_references (source_document_id);
CREATE INDEX IF NOT EXISTS kb_xref_target_doc_idx  ON kb_cross_references (target_document_id);
CREATE INDEX IF NOT EXISTS kb_xref_type_idx        ON kb_cross_references (reference_type);

-- ─── kb_embeddings ─────────────────────────────────────────────────────────────
-- Vectors stored as JSON-serialized float arrays.
-- pgvector migration: see kb-embeddings.ts for the upgrade path.
CREATE TABLE IF NOT EXISTS kb_embeddings (
  id           SERIAL PRIMARY KEY,
  entity_type  VARCHAR(20)   NOT NULL,
  entity_id    INTEGER       NOT NULL,
  language     VARCHAR(5)    NOT NULL,
  model_id     VARCHAR(100)  NOT NULL,
  dimensions   INTEGER       NOT NULL,
  vector_json  TEXT          NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kb_embeddings_entity_idx ON kb_embeddings (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS kb_embeddings_lang_idx   ON kb_embeddings (language);
`;

/**
 * Phase 54 additive column migration.
 * ADD COLUMN IF NOT EXISTS is a no-op when the column already exists (PG 9.6+).
 * Each statement is run individually so a pre-existing column does not abort the batch.
 */
const ADDITIVE_COLUMNS: string[] = [
  // Phase 54 — new kb_documents columns
  `ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS related_judgments   TEXT`,
  `ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS related_legislation  TEXT`,
  `ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS has_embedding_ar    BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE kb_documents ADD COLUMN IF NOT EXISTS has_embedding_en    BOOLEAN NOT NULL DEFAULT FALSE`,
  // Phase 54 / Phase 55 — unique constraint on cross-references.
  // The index MUST include the external-ref column so that multiple external-ref
  // edges with the same (source, type, NULL target) but different targetExternalRef
  // values can coexist. Without it, only one external-ref edge per (source, type)
  // is stored and subsequent onConflictDoNothing() calls silently drop the rest.
  //
  // Drop the overly-coarse Phase 54 index first (no-op if it was never created).
  `DROP INDEX IF EXISTS kb_xref_unique_edge_idx`,
  // Create the correct index that distinguishes external refs from each other.
  `CREATE UNIQUE INDEX IF NOT EXISTS kb_xref_unique_edge_v2_idx
     ON kb_cross_references (
       source_document_id,
       reference_type,
       COALESCE(target_document_id,   -1),
       COALESCE(target_article_id,    -1),
       LEFT(COALESCE(target_external_ref, ''), 200)
     )`,
];

/** Run the KB migration. Safe to call multiple times — all statements are idempotent. */
export async function runKbMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    // Phase 53 — create tables and indices
    await client.query("BEGIN");
    await client.query(MIGRATION_SQL);
    await client.query("COMMIT");

    // Phase 54 — add new columns to existing tables (each run individually)
    for (const stmt of ADDITIVE_COLUMNS) {
      await client.query(stmt);
    }

    console.log("[KB migration] All 4 KB tables + Phase 54 columns applied (idempotent).");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw new Error(`[KB migration] Failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    client.release();
  }
}

// ─── Standalone execution ─────────────────────────────────────────────────────
// Run: npx tsx src/kb/migration.ts

const isMain = process.argv[1]?.endsWith("migration.ts") || process.argv[1]?.endsWith("migration.js");
if (isMain) {
  runKbMigration()
    .then(() => {
      console.log("[KB migration] Complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[KB migration] Error:", err);
      process.exit(1);
    });
}
