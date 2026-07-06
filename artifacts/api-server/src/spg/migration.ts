import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Idempotent migration for the Smart Professional Guidance (SPG) tables.
 * Called from seed.ts at server startup — safe to run multiple times.
 */
export async function migrateSpg(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS spg_sessions (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER     NOT NULL,
      title          TEXT        NOT NULL,
      sector_id      VARCHAR(60) NOT NULL,
      sector_name_ar TEXT        NOT NULL,
      role_id        VARCHAR(60) NOT NULL,
      role_name_ar   TEXT        NOT NULL,
      status         VARCHAR(20) NOT NULL DEFAULT 'draft',
      answers        TEXT,
      output         TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS spg_sessions_user_id_idx ON spg_sessions (user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS spg_sessions_status_idx ON spg_sessions (status)
  `);
}
