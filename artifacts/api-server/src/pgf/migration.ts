import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent migration for the Professional Guidance Framework (PGF) tables.
 * Safe to run multiple times — all statements use IF NOT EXISTS.
 */
export async function migratePgf(): Promise<void> {
  // ── pgf_sessions ────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pgf_sessions (
      id                SERIAL PRIMARY KEY,
      user_id           INTEGER     NOT NULL,
      title             TEXT        NOT NULL,
      sector_id         VARCHAR(80) NOT NULL,
      sector_name_ar    TEXT        NOT NULL,
      profession_id     VARCHAR(80) NOT NULL,
      profession_name_ar TEXT       NOT NULL,
      status            VARCHAR(20) NOT NULL DEFAULT 'draft',
      answers           TEXT,
      triggered_flags   TEXT,
      current_stage_id  VARCHAR(80),
      completed_stages  TEXT,
      output            TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pgf_sessions_user_id_idx ON pgf_sessions (user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pgf_sessions_status_idx ON pgf_sessions (status)
  `);

  // ── pgf_institutional_memory ─────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pgf_institutional_memory (
      id            SERIAL      PRIMARY KEY,
      sector_id     VARCHAR(80) NOT NULL,
      profession_id VARCHAR(80) NOT NULL,
      stage_id      VARCHAR(80) NOT NULL,
      title         TEXT        NOT NULL,
      content       TEXT        NOT NULL,
      category      VARCHAR(40) NOT NULL
                    CHECK (category IN (
                      'expert_practice','frequent_mistake','lesson_learned',
                      'recommended_sequence','practical_tip',
                      'success_indicator','failure_indicator'
                    )),
      confidence    INTEGER     NOT NULL DEFAULT 80
                    CHECK (confidence BETWEEN 0 AND 100),
      source_type   VARCHAR(40) NOT NULL DEFAULT 'institutional'
                    CHECK (source_type IN ('institutional','ai_generated','user_contributed')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pgf_im_scope_idx
      ON pgf_institutional_memory (sector_id, profession_id, stage_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pgf_im_confidence_idx
      ON pgf_institutional_memory (confidence)
  `);
}
