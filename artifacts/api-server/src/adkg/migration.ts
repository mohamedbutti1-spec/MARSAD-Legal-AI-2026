/**
 * Phase 58 — Administrative Decision Knowledge Graph migration
 * Creates 4 new tables (additive; all use IF NOT EXISTS).
 * Called at server startup from seed.ts.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger.js";

export async function migrateAdkg(): Promise<void> {
  logger.info("Running Phase 58 ADKG migration…");

  // ── adkg_decisions ─────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS adkg_decisions (
      id                   SERIAL PRIMARY KEY,
      decision_number      TEXT NOT NULL,
      title                TEXT NOT NULL,
      title_ar             TEXT NOT NULL,
      issuer_org           TEXT,
      issuer_org_ar        TEXT,
      subject              TEXT,
      subject_ar           TEXT,
      status               VARCHAR(30) NOT NULL DEFAULT 'draft',
      issued_date          TEXT,
      effective_date       TEXT,
      expiry_date          TEXT,
      content              TEXT NOT NULL DEFAULT '{}',
      metadata             TEXT NOT NULL DEFAULT '{}',
      cited_authorities    TEXT NOT NULL DEFAULT '[]',
      verification_report  TEXT NOT NULL DEFAULT '{}',
      confidence_level     REAL,
      owner_id             INTEGER NOT NULL,
      search_vector        TSVECTOR,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkg_owner_idx      ON adkg_decisions (owner_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkg_status_idx     ON adkg_decisions (status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkg_number_idx     ON adkg_decisions (decision_number)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkg_fts_idx        ON adkg_decisions USING GIN (search_vector)`);

  // ── adkg_decision_links ────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS adkg_decision_links (
      id                  SERIAL PRIMARY KEY,
      decision_id         INTEGER NOT NULL REFERENCES adkg_decisions(id) ON DELETE CASCADE,
      link_type           VARCHAR(50) NOT NULL,
      linked_entity_type  VARCHAR(30) NOT NULL,
      linked_entity_id    INTEGER,
      linked_entity_ref   TEXT,
      title_ar            TEXT,
      title_en            TEXT,
      authority_class     VARCHAR(20) NOT NULL DEFAULT 'persuasive',
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkgl_decision_idx ON adkg_decision_links (decision_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkgl_type_idx     ON adkg_decision_links (link_type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkgl_entity_idx   ON adkg_decision_links (linked_entity_type, linked_entity_id)`);

  // ── adkg_timeline_events ───────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS adkg_timeline_events (
      id             SERIAL PRIMARY KEY,
      decision_id    INTEGER NOT NULL REFERENCES adkg_decisions(id) ON DELETE CASCADE,
      event_type     VARCHAR(40) NOT NULL,
      event_date     TEXT NOT NULL,
      description    TEXT,
      description_ar TEXT,
      metadata       TEXT NOT NULL DEFAULT '{}',
      created_by     INTEGER NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkgt_decision_idx ON adkg_timeline_events (decision_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkgt_date_idx     ON adkg_timeline_events (event_date)`);

  // ── adkg_graph_edges ───────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS adkg_graph_edges (
      id                  SERIAL PRIMARY KEY,
      from_decision_id    INTEGER NOT NULL REFERENCES adkg_decisions(id) ON DELETE CASCADE,
      to_decision_id      INTEGER NOT NULL REFERENCES adkg_decisions(id) ON DELETE CASCADE,
      relationship_type   VARCHAR(30) NOT NULL,
      notes               TEXT,
      confidence          REAL,
      created_by          INTEGER NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkge_from_idx ON adkg_graph_edges (from_decision_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkge_to_idx   ON adkg_graph_edges (to_decision_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS adkge_type_idx ON adkg_graph_edges (relationship_type)`);

  logger.info("Phase 58 ADKG migration complete");
}
