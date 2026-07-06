/**
 * Phase 57 — Legal Research Workspace migration
 * Creates 6 new tables (additive; all use IF NOT EXISTS).
 * Called at server startup from seed.ts.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger.js";

export async function migrateResearchWorkspace(): Promise<void> {
  logger.info("Running Phase 57 Research Workspace migration…");

  // ── research_projects ──────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_projects (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      owner_id    INTEGER NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS rp_owner_idx ON research_projects (owner_id)
  `);

  // ── research_folders ───────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_folders (
      id               SERIAL PRIMARY KEY,
      project_id       INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      parent_folder_id INTEGER,
      name             TEXT NOT NULL,
      position         INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS rf_project_idx ON research_folders (project_id)
  `);

  // ── research_items ─────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_items (
      id             SERIAL PRIMARY KEY,
      project_id     INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
      folder_id      INTEGER,
      item_type      VARCHAR(30) NOT NULL,
      title          TEXT NOT NULL,
      content        TEXT NOT NULL DEFAULT '{}',
      metadata       TEXT NOT NULL DEFAULT '{}',
      version_number INTEGER NOT NULL DEFAULT 1,
      created_by     INTEGER NOT NULL,
      search_vector  TSVECTOR,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ri_project_idx ON research_items (project_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ri_folder_idx ON research_items (folder_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ri_type_idx ON research_items (item_type)
  `);
  // Add column if table was created in an earlier migration without it
  await db.execute(sql`ALTER TABLE research_items ADD COLUMN IF NOT EXISTS search_vector TSVECTOR`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ri_fts_idx ON research_items USING GIN (search_vector)
  `);

  // ── research_item_versions ─────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_item_versions (
      id             SERIAL PRIMARY KEY,
      item_id        INTEGER NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      content        TEXT NOT NULL DEFAULT '{}',
      metadata       TEXT NOT NULL DEFAULT '{}',
      changed_by     INTEGER NOT NULL,
      changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS riv_item_idx ON research_item_versions (item_id)
  `);

  // ── research_answer_metadata ───────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS research_answer_metadata (
      id                   SERIAL PRIMARY KEY,
      item_id              INTEGER NOT NULL UNIQUE REFERENCES research_items(id) ON DELETE CASCADE,
      cited_authorities    TEXT NOT NULL DEFAULT '[]',
      verification_report  TEXT NOT NULL DEFAULT '{}',
      confidence_level     REAL,
      retrieval_inventory  TEXT NOT NULL DEFAULT '{}',
      generation_timestamp TIMESTAMPTZ,
      model_version        TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ram_item_idx ON research_answer_metadata (item_id)
  `);

  // ── citation_refresh_status ────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS citation_refresh_status (
      id               SERIAL PRIMARY KEY,
      item_id          INTEGER NOT NULL UNIQUE REFERENCES research_items(id) ON DELETE CASCADE,
      kb_document_ids  TEXT NOT NULL DEFAULT '[]',
      last_checked_at  TIMESTAMPTZ,
      is_stale         BOOLEAN NOT NULL DEFAULT FALSE,
      staleness_reason TEXT,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS crs_item_idx ON citation_refresh_status (item_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS crs_stale_idx ON citation_refresh_status (is_stale)
  `);

  logger.info("Phase 57 Research Workspace migration complete");
}
