import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent migration for the Judicial Reasoning Engine (JRE) tables.
 * Called from seed.ts at server startup — safe to run multiple times.
 */
export async function migrateJre(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jre_sessions (
      id                 SERIAL PRIMARY KEY,
      user_id            INTEGER     NOT NULL,
      title              TEXT        NOT NULL,
      dispute_summary    TEXT        NOT NULL,
      parties            TEXT        NOT NULL DEFAULT '{}',
      dispute_type       VARCHAR(60) NOT NULL DEFAULT 'annulment',
      has_ai_decision    VARCHAR(5)  NOT NULL DEFAULT 'false',
      theory_lens_id     VARCHAR(60),
      theory_lens_name   TEXT,
      custom_theory_text TEXT,
      status             VARCHAR(20) NOT NULL DEFAULT 'pending',
      stage_data         TEXT,
      judgment           TEXT,
      legality_score     INTEGER,
      risk_score         INTEGER,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jre_sessions_user_id_idx ON jre_sessions (user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jre_sessions_status_idx ON jre_sessions (status)
  `);
}
