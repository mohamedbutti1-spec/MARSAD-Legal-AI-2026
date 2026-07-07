import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Private Beta — reviewer feedback table.
 * Idempotent: safe to run on every startup.
 */
export async function migrateBeta(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS beta_feedback (
      id               SERIAL       PRIMARY KEY,
      reviewer_user_id INTEGER      NOT NULL DEFAULT 0,
      reviewer_role    VARCHAR(60)  NOT NULL DEFAULT 'unknown',
      page_path        TEXT         NOT NULL DEFAULT '',
      page_title       TEXT         NOT NULL DEFAULT '',
      category         VARCHAR(40)  NOT NULL DEFAULT 'other'
                         CHECK (category IN (
                           'bug', 'ui_ux', 'performance',
                           'feature_request', 'security', 'content', 'other'
                         )),
      description      TEXT         NOT NULL,
      severity         VARCHAR(20)  NOT NULL DEFAULT 'medium'
                         CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      browser_info     TEXT,
      created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS beta_feedback_user_idx
      ON beta_feedback (reviewer_user_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS beta_feedback_severity_idx
      ON beta_feedback (severity, created_at DESC)
  `);
}
