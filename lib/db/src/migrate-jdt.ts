/**
 * Phase 44 — Judicial Digital Twin (JDT)
 * Migration script — CREATE TABLE IF NOT EXISTS jdt_simulations
 */
import { sql } from "drizzle-orm";
import { db } from "./index";

async function migrateJdt() {
  console.log("Running JDT migration — creating jdt_simulations table...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jdt_simulations (
      id                          SERIAL PRIMARY KEY,
      decision_id                 INTEGER NOT NULL UNIQUE REFERENCES decisions(id) ON DELETE CASCADE,
      status                      TEXT NOT NULL DEFAULT 'pending',
      simulation_version          INTEGER NOT NULL DEFAULT 0,
      triggered_by                TEXT,
      completed_at                TIMESTAMPTZ,
      review_stages               JSON,
      shamsi_dimensions           JSON,
      shamsi_overall_score        INTEGER,
      constitutional_score        INTEGER,
      constitutional_outcome      TEXT,
      constitutional_reasoning    TEXT,
      risk_integration_score      INTEGER,
      risk_reasoning              TEXT,
      probability_annulment       INTEGER,
      probability_dismissal       INTEGER,
      probability_correction      INTEGER,
      judicial_success_probability INTEGER,
      overall_risk_level          TEXT,
      judicial_reasoning          TEXT,
      strengths                   JSON,
      weaknesses                  JSON,
      missing_evidence            JSON,
      corrective_actions          JSON,
      overall_assessment          TEXT,
      cil_integration             JSON,
      nrme_integration            JSON,
      replay_integration          JSON,
      ai_model                    TEXT,
      audit_hash                  TEXT,
      error_message               TEXT,
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jdt_decision_id_idx ON jdt_simulations (decision_id)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jdt_status_idx ON jdt_simulations (status)
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS jdt_risk_level_idx ON jdt_simulations (overall_risk_level)
  `);

  console.log("JDT migration completed successfully.");
}

migrateJdt()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("JDT migration failed:", err);
    process.exit(1);
  });
