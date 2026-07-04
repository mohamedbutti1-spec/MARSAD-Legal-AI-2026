/**
 * Phase 3 — Decision Chain of Custody
 * Append-only, cryptographically chained audit records for every action
 * performed on an administrative decision.  Nothing is ever deleted or
 * overwritten; every modification creates a new immutable record.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { decisionsTable } from "./decisions";

export const chainOfCustodyTable = pgTable(
  "chain_of_custody",
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    id:             serial("id").primaryKey(),
    decisionId:     integer("decision_id").notNull().references(() => decisionsTable.id, { onDelete: "restrict" }),
    sequenceNumber: integer("sequence_number").notNull(),  // monotonically increasing per decision

    // ── Actor ─────────────────────────────────────────────────────────────────
    userId:       integer("user_id"),
    userRole:     text("user_role"),
    organization: text("organization"),

    // ── Event ─────────────────────────────────────────────────────────────────
    action:         text("action").notNull(),
    actionCategory: text("action_category").notNull().default("decision"),
    timestamp:      timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),

    // ── Device context ────────────────────────────────────────────────────────
    deviceInfo: jsonb("device_info"),  // { userAgent, browser, os }
    ipAddress:  text("ip_address"),

    // ── Change tracking ───────────────────────────────────────────────────────
    previousValue: jsonb("previous_value"),
    newValue:      jsonb("new_value"),

    // ── Legal metadata ────────────────────────────────────────────────────────
    legalJustification: text("legal_justification"),
    aiRecommendation:   text("ai_recommendation"),
    humanModification:  text("human_modification"),

    // ── Cryptographic integrity ───────────────────────────────────────────────
    // digitalSignature:   HMAC-SHA256(currentRecordHash, SESSION_SECRET)
    // previousRecordHash: currentRecordHash of the preceding record (null = genesis)
    // currentRecordHash:  SHA256 of all record fields (deterministic serialisation)
    // chainHash:          SHA256(previousChainHash || currentRecordHash) — cumulative
    digitalSignature:   text("digital_signature").notNull(),
    previousRecordHash: text("previous_record_hash"),
    currentRecordHash:  text("current_record_hash").notNull(),
    chainHash:          text("chain_hash").notNull(),
  },
  (t) => ({
    uniqSeq: uniqueIndex("coc_decision_seq_uidx").on(t.decisionId, t.sequenceNumber),
  }),
);

export type ChainOfCustodyRecord    = typeof chainOfCustodyTable.$inferSelect;
export type InsertChainOfCustodyRecord = typeof chainOfCustodyTable.$inferInsert;
