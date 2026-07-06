import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent migration for the Judicial Deliberation Chamber (JDC) tables.
 * Called from seed.ts at server startup — safe to run multiple times.
 */
export async function migrateJdc(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jdc_chambers (
      id                 SERIAL       PRIMARY KEY,
      user_id            INTEGER      NOT NULL,
      title              TEXT         NOT NULL,
      panel_size         INTEGER      NOT NULL DEFAULT 3,
      dispute_type       VARCHAR(60)  NOT NULL DEFAULT 'annulment',
      dispute_summary    TEXT         NOT NULL,
      parties            TEXT         NOT NULL DEFAULT '{}',
      has_ai_decision    VARCHAR(5)   NOT NULL DEFAULT 'false',
      theory_lens_id     VARCHAR(60),
      theory_lens_name   TEXT,
      custom_theory_text TEXT,
      status             VARCHAR(20)  NOT NULL DEFAULT 'deliberating',
      deliberation       TEXT,
      legality_score     INTEGER,
      risk_score         INTEGER,
      created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jdc_chambers_user_id_idx ON jdc_chambers (user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jdc_chambers_status_idx ON jdc_chambers (status)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jdc_chambers_panel_size_idx ON jdc_chambers (panel_size)
  `);
}
