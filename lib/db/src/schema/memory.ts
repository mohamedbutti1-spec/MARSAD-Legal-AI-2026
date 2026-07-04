import {
  pgTable,
  uuid,
  integer,
  text,
  boolean,
  timestamp,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ── decision_memory ────────────────────────────────────────────────────────────
// One row per version of the constitutional memory.  Every amendment creates a
// new row that references the previous one via previousVersion.  Append-only.
// ──────────────────────────────────────────────────────────────────────────────
export const decisionMemoryTable = pgTable(
  'decision_memory',
  {
    memoryId: uuid('memory_id').defaultRandom().primaryKey(),

    // Core identifiers
    decisionId:           integer('decision_id').notNull(),
    constitutionalNumber: text('constitutional_number').notNull(),
    decisionVersion:      integer('decision_version').notNull(),          // 1, 2, 3 …
    previousVersion:      uuid('previous_version'),                       // null for v1

    // Cryptographic integrity
    decisionHash:     text('decision_hash').notNull(),       // SHA-256 of key decision fields
    completeAuditHash: text('complete_audit_hash').notNull(), // SHA-256 of full audit trail

    // Provenance
    createdAt:         timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy:         text('created_by'),                    // userId or system
    governmentEntity:  text('government_entity'),
    governmentUnit:    text('government_unit'),
    issuerRole:        text('issuer_role'),
    humanDecisionMaker: text('human_decision_maker'),

    // AI metadata
    aiEngine:                      text('ai_engine'),
    aiModelVersion:                text('ai_model_version'),
    constitutionalFrameworkVersion: text('constitutional_framework_version'),
    legalFrameworkVersion:         text('legal_framework_version'),

    // Scores (0–100 for indices)
    humanInfluenceIndex: real('human_influence_index'),
    aiActualInfluence:   real('ai_actual_influence'),
    qva:                 real('qva'),                         // Quantitative Validity Assessment
    lsi:                 real('lsi'),                         // Legality Score Index

    // Status fields
    complianceStatus:     text('compliance_status'),          // e.g. "compliant" | "non_compliant" | "pending"
    constitutionalStatus: text('constitutional_status'),      // e.g. "valid" | "challenged" | "annulled"
    decisionStatus:       text('decision_status'),            // e.g. "draft" | "issued" | "appealed" | "closed"
    appealStatus:         text('appeal_status'),              // e.g. "none" | "pending" | "upheld" | "overturned"

    // Sealing & archiving
    sealed:        boolean('sealed').default(false).notNull(),
    sealedAt:      timestamp('sealed_at', { withTimezone: true }),
    archiveStatus: text('archive_status').default('active').notNull(), // "active" | "archived"
  },
  (t) => [
    index('dm_decision_id_idx').on(t.decisionId),
    index('dm_constitutional_number_idx').on(t.constitutionalNumber),
    // Each decision gets exactly one row per version
    uniqueIndex('dm_decision_version_idx').on(t.decisionId, t.decisionVersion),
  ],
);

// ── memory_timeline ────────────────────────────────────────────────────────────
// Append-only event ledger — every constitutional event, forever.
// ──────────────────────────────────────────────────────────────────────────────
export const memoryTimelineTable = pgTable(
  'memory_timeline',
  {
    id:            integer('id').primaryKey().generatedAlwaysAsIdentity(),
    memoryId:      uuid('memory_id').notNull(),   // FK → decision_memory.memory_id
    decisionId:    integer('decision_id').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),

    // Event
    eventType:      text('event_type').notNull(),   // see EVENT_TYPES below
    eventSummaryAr: text('event_summary_ar'),
    eventSummaryEn: text('event_summary_en'),

    // Actor
    actorId:   text('actor_id'),
    actorRole: text('actor_role'),
    actorOrg:  text('actor_org'),

    // Payload (sanitized — no private content stored)
    payload: text('payload'),   // JSON string

    // Cryptography
    eventHash:     text('event_hash').notNull(),    // SHA-256 of this event's fields
    previousHash:  text('previous_hash'),           // links to prior event in this decision's timeline
    chainHash:     text('chain_hash').notNull(),    // cumulative chain hash

    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('mt_decision_id_idx').on(t.decisionId),
    index('mt_memory_id_idx').on(t.memoryId),
    uniqueIndex('mt_decision_seq_idx').on(t.decisionId, t.sequenceNumber),
  ],
);

// ── Allowed event types ────────────────────────────────────────────────────────
export const MEMORY_EVENT_TYPES = [
  'decision.created',
  'stage.completed',
  'dci.generated',
  'car.generated',
  'jdp.generated',
  'human.review',
  'amendment',
  'appeal.filed',
  'court.decision',
  'correction',
  'closure',
  'archive',
  'memory.sealed',
  'memory.verified',
  'custody.event',        // bridge from Phase 3 chain-of-custody
] as const;

export type MemoryEventType = (typeof MEMORY_EVENT_TYPES)[number];
