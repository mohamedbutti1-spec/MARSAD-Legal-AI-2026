import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function migratePcs(): Promise<void> {
  // ── pcs_sessions ────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pcs_sessions (
      id               SERIAL      PRIMARY KEY,
      sector_id        VARCHAR(80) NOT NULL,
      profession_id    VARCHAR(80) NOT NULL,
      scenario_id      VARCHAR(80) NOT NULL,
      user_id          INTEGER     NOT NULL DEFAULT 0,
      status           VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                         CHECK (status IN ('in_progress', 'completed')),
      current_step_idx INTEGER     NOT NULL DEFAULT 0,
      total_score      INTEGER,
      grade            VARCHAR(2),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at     TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pcs_sess_scope_idx
      ON pcs_sessions (sector_id, profession_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pcs_sess_status_idx
      ON pcs_sessions (status)
  `);

  // ── pcs_session_steps ───────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pcs_session_steps (
      id               SERIAL      PRIMARY KEY,
      session_id       INTEGER     NOT NULL,
      step_idx         INTEGER     NOT NULL,
      step_id          VARCHAR(80) NOT NULL,
      question         TEXT        NOT NULL,
      user_answer      TEXT        NOT NULL,
      ai_score         INTEGER     NOT NULL,
      ai_evaluation    TEXT        NOT NULL,
      recommendation   TEXT        NOT NULL,
      missed_documents TEXT,
      missed_approvals TEXT,
      critical_error   BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT pcs_step_session_order UNIQUE (session_id, step_idx),
      CONSTRAINT pcs_step_score_range   CHECK  (ai_score BETWEEN 0 AND 100),
      CONSTRAINT pcs_step_session_fk    FOREIGN KEY (session_id)
        REFERENCES pcs_sessions(id) ON DELETE CASCADE
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS pcs_step_session_idx ON pcs_session_steps (session_id)
  `);
}
