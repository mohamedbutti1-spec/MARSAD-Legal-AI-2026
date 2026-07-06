import {
  pgTable, serial, text, integer, boolean,
  varchar, timestamp, index,
} from "drizzle-orm/pg-core";

/**
 * PCS — Professional Case Simulator
 *
 * pcs_sessions   : one row per simulation run
 * pcs_session_steps: one row per answered step within a session
 */

// ─── Sessions ─────────────────────────────────────────────────────────────────
export const pcsSessionsTable = pgTable(
  "pcs_sessions",
  {
    id:              serial("id").primaryKey(),
    sectorId:        varchar("sector_id",     { length: 80 }).notNull(),
    professionId:    varchar("profession_id", { length: 80 }).notNull(),
    scenarioId:      varchar("scenario_id",   { length: 80 }).notNull(),

    /** "in_progress" | "completed" */
    status:          varchar("status", { length: 20 }).notNull().default("in_progress"),

    /** Owner — resolves from x-user-id header (mirrors PGF pattern) */
    userId:          integer("user_id").notNull().default(0),

    /** 0-based index of the step that should be answered next */
    currentStepIdx:  integer("current_step_idx").notNull().default(0),

    /** 0–100, computed at completion */
    totalScore:      integer("total_score"),

    /** letter grade A / B / C / D / F, set at completion */
    grade:           varchar("grade", { length: 2 }),

    createdAt:   timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("pcs_sess_scope_idx").on(t.sectorId, t.professionId),
    index("pcs_sess_status_idx").on(t.status),
  ],
);

// ─── Session Steps ────────────────────────────────────────────────────────────
export const pcsSessionStepsTable = pgTable(
  "pcs_session_steps",
  {
    id:        serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),

    /** 0-based position within this session's step list */
    stepIdx:   integer("step_idx").notNull(),

    /** Matches SimStep.id from the scenario config */
    stepId:    varchar("step_id", { length: 80 }).notNull(),

    question:   text("question").notNull(),
    userAnswer: text("user_answer").notNull(),

    /** 0–100 */
    aiScore:        integer("ai_score").notNull(),
    aiEvaluation:   text("ai_evaluation").notNull(),
    recommendation: text("recommendation").notNull(),

    /** JSON: string[] */
    missedDocuments: text("missed_documents"),
    /** JSON: string[] */
    missedApprovals: text("missed_approvals"),

    criticalError: boolean("critical_error").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pcs_step_session_idx").on(t.sessionId),
    index("pcs_step_order_idx").on(t.sessionId, t.stepIdx),
  ],
);

export type PcsSession      = typeof pcsSessionsTable.$inferSelect;
export type PcsSessionStep  = typeof pcsSessionStepsTable.$inferSelect;
