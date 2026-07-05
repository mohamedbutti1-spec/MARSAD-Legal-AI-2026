/**
 * Decision Replay Engine — Schema
 * Phase: Decision Replay Engine
 *
 * One new table: decision_replay_events
 * Written once when a stage is completed; never updated (immutable).
 * Stores the fields that have no home in existing tables:
 * actor, ai_model_name, prompt_hash, legal_references, constitutional_references,
 * admin_law_references, evidence_snapshot, confidence_score, audit_hash, immutable_log_id.
 *
 * The GET /decisions/:id/replay API assembles the full 14-stage timeline by joining
 * this table with decision_stages, audit_logs, evidence_ledger, judicial_reviews,
 * and decision_memory.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Replay Stage Keys ────────────────────────────────────────────────────────
// 14-stage replay lifecycle — maps to existing decision stages + derived stages.

export const REPLAY_STAGE_KEYS = [
  "replay_01_request_received",       // → administrative_request stage
  "replay_02_evidence_collection",    // → facts_evidence stage
  "replay_03_data_validation",        // → validation audit log events (virtual)
  "replay_04_jurisdiction_check",     // → legal_authority stage
  "replay_05_legal_basis_check",      // → legal_basis stage
  "replay_06_cause_analysis",         // → administrative_objective stage
  "replay_07_subject_matter",         // → discretionary_power stage
  "replay_08_purpose_analysis",       // → proportionality stage
  "replay_09_alshamsi_engine",        // → constitutional_validation + judicial_reviews
  "replay_10_legal_weight",           // → judicial_reviews legalWeightScore (virtual)
  "replay_11_algorithmic_bias",       // → judicial_reviews algorithmic_bias dim (virtual)
  "replay_12_legitimacy_index",       // → decision_memory lsi field (virtual)
  "replay_13_human_oversight",        // → human_oversight stage
  "replay_14_decision_issued",        // → decision_drafting / final_review + signed
] as const;

export type ReplayStageKey = (typeof REPLAY_STAGE_KEYS)[number];

/** Maps a decision stage key → the replay stage key it writes a row for */
export const STAGE_KEY_TO_REPLAY_STAGE: Record<string, ReplayStageKey> = {
  administrative_request:   "replay_01_request_received",
  facts_evidence:           "replay_02_evidence_collection",
  legal_authority:          "replay_04_jurisdiction_check",
  legal_basis:              "replay_05_legal_basis_check",
  administrative_objective: "replay_06_cause_analysis",
  discretionary_power:      "replay_07_subject_matter",
  proportionality:          "replay_08_purpose_analysis",
  constitutional_validation:"replay_09_alshamsi_engine",
  human_oversight:          "replay_13_human_oversight",
  decision_drafting:        "replay_14_decision_issued",
  final_review:             "replay_14_decision_issued",
};

/** Arabic labels for all 14 replay stages */
export const REPLAY_STAGE_LABELS_AR: Record<ReplayStageKey, string> = {
  replay_01_request_received:    "استقبال الطلب",
  replay_02_evidence_collection: "جمع الأدلة",
  replay_03_data_validation:     "التحقق من البيانات",
  replay_04_jurisdiction_check:  "فحص الاختصاص",
  replay_05_legal_basis_check:   "فحص السند القانوني",
  replay_06_cause_analysis:      "تحليل السبب",
  replay_07_subject_matter:      "تحليل موضوع القرار",
  replay_08_purpose_analysis:    "تحليل الغاية",
  replay_09_alshamsi_engine:     "محرك نظرية الشامسي",
  replay_10_legal_weight:        "حساب الثقل القانوني",
  replay_11_algorithmic_bias:    "تقييم التحيز الخوارزمي",
  replay_12_legitimacy_index:    "مؤشر الشرعية LSI",
  replay_13_human_oversight:     "الرقابة البشرية",
  replay_14_decision_issued:     "إصدار القرار",
};

// ─── Table ─────────────────────────────────────────────────────────────────────

export const decisionReplayEventsTable = pgTable(
  "decision_replay_events",
  {
    id: serial("id").primaryKey(),

    /** FK to decisions table */
    decisionId: integer("decision_id").notNull(),

    /** Which of the 14 replay stages this row represents */
    replayStageKey: text("replay_stage_key").notNull(),

    /** The actual decision stage key that triggered this event (e.g. "legal_basis") */
    sourceStageKey: text("source_stage_key"),

    // ── Actor ──────────────────────────────────────────────────────────────
    /** User ID or system identifier of the actor who completed this stage */
    actor: text("actor"),
    /** Role of the actor */
    actorRole: text("actor_role"),

    // ── AI Contribution ───────────────────────────────────────────────────
    /** Name of the AI model that ran analysis for this stage */
    aiModelName: text("ai_model_name"),
    /** SHA-256 of the prompt used (for auditability, not the prompt text itself) */
    promptHash: text("prompt_hash"),
    /** One-line confidence score description or numeric string */
    confidenceScore: real("confidence_score"),

    // ── Legal References ──────────────────────────────────────────────────
    /** Legal articles cited at this stage */
    legalReferences: jsonb("legal_references").$type<string[]>(),
    /** Constitutional references cited */
    constitutionalReferences: jsonb("constitutional_references").$type<string[]>(),
    /** Administrative law references cited */
    adminLawReferences: jsonb("admin_law_references").$type<string[]>(),

    // ── Evidence ──────────────────────────────────────────────────────────
    /** Snapshot of evidence ledger entries relevant at stage time */
    evidenceSnapshot: jsonb("evidence_snapshot").$type<Record<string, unknown>[]>(),

    // ── Reasoning ─────────────────────────────────────────────────────────
    /** Full Arabic reasoning narrative for this stage */
    reasoningNarrative: text("reasoning_narrative"),
    /** Applied legal weight value (e.g. from legalWeightScore) */
    appliedLegalWeight: real("applied_legal_weight"),
    /** Al-Shamsi dimension scores JSON */
    alShamsiDimensions: jsonb("al_shamsi_dimensions").$type<Record<string, unknown>>(),
    /** Risk indicators identified at this stage */
    riskIndicators: jsonb("risk_indicators").$type<string[]>(),
    /** Human intervention record */
    humanInterventionRecord: jsonb("human_intervention_record").$type<Record<string, unknown>>(),

    // ── Integrity ─────────────────────────────────────────────────────────
    /** SHA-256 audit hash over the replay event content */
    auditHash: text("audit_hash").notNull(),
    /** Reference to the audit_logs row that records this stage completion */
    immutableLogId: integer("immutable_log_id"),

    /** Timestamp when this replay event was recorded */
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One row per replay stage per decision (each stage can only complete once)
    uniqueIndex("dre_decision_stage_idx").on(t.decisionId, t.replayStageKey),
    index("dre_decision_id_idx").on(t.decisionId),
  ],
);

export type DecisionReplayEvent = typeof decisionReplayEventsTable.$inferSelect;
export type InsertDecisionReplayEvent = typeof decisionReplayEventsTable.$inferInsert;
