import { pgTable, text, serial, timestamp, integer, varchar, index } from "drizzle-orm/pg-core";

/**
 * Professional Workflow Engine (PWE) — executable workflow steps.
 *
 * Each row defines the full execution map for one (sector, profession, stage)
 * combination: what to do, what to gather, who to notify, and what to expect.
 *
 * Array fields (requiredDocuments, approvals, checkpoints, branchRules,
 * escalationRules) are stored as JSON-stringified TEXT and parsed at the
 * API layer before being returned to the client.
 */
export const pgfWorkflowStepsTable = pgTable(
  "pgf_workflow_steps",
  {
    id:           serial("id").primaryKey(),

    sectorId:     varchar("sector_id",     { length: 80 }).notNull(),
    professionId: varchar("profession_id", { length: 80 }).notNull(),
    stageId:      varchar("stage_id",      { length: 80 }).notNull(),

    /** Ordering within a stage (1-based; most stages have a single step) */
    order:        integer("order").notNull().default(1),

    title:          text("title").notNull(),
    objective:      text("objective").notNull(),
    nextAction:     text("next_action").notNull(),

    /** JSON: string[] */
    requiredDocuments: text("required_documents"),

    /** JSON: string[] */
    approvals:         text("approvals"),

    /** JSON: string[] */
    checkpoints:       text("checkpoints"),

    /** JSON: Array<{ condition: string; outcome: string }> */
    branchRules:       text("branch_rules"),

    /** JSON: Array<{ condition: string; action: string }> */
    escalationRules:   text("escalation_rules"),

    expectedOutput:    text("expected_output").notNull(),
    estimatedDuration: varchar("estimated_duration", { length: 80 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pgf_ws_scope_idx").on(t.sectorId, t.professionId, t.stageId),
    index("pgf_ws_order_idx").on(t.order),
  ],
);

export type PgfWorkflowStep       = typeof pgfWorkflowStepsTable.$inferSelect;
export type PgfWorkflowStepInsert = typeof pgfWorkflowStepsTable.$inferInsert;
