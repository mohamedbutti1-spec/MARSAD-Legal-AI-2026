import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent migration for the Professional Guidance Framework (PGF) tables.
 * Safe to run multiple times — all statements use IF NOT EXISTS.
 */
export async function migratePgf(): Promise<void> {
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
}
