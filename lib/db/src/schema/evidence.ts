import {
  pgTable,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ── evidence_ledger ────────────────────────────────────────────────────────────
// Phase 4 — Constitutional Chain of Custody and Evidence Ledger
// Immutable, append-only evidentiary chain for every constitutional decision.
// Every action becomes a cryptographically linked evidence event.
// Nothing is ever deleted or updated — archive by adding a new event.
// ──────────────────────────────────────────────────────────────────────────────
export const evidenceLedgerTable = pgTable(
  'evidence_ledger',
  {
    id:             integer('id').primaryKey().generatedAlwaysAsIdentity(),
    decisionId:     integer('decision_id').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),

    // ── Actor provenance ────────────────────────────────────────────────────
    actor:     text('actor'),         // userId or system identifier
    actorRole: text('actor_role'),
    actorOrg:  text('actor_org'),

    // ── Event ───────────────────────────────────────────────────────────────
    timestamp:      timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    action:         text('action').notNull(),
    eventCategory:  text('event_category').notNull().default('decision'),
    evidenceSummaryAr: text('evidence_summary_ar'),
    evidenceSummaryEn: text('evidence_summary_en'),

    // ── Affected object ─────────────────────────────────────────────────────
    affectedObject:     text('affected_object'),      // e.g. "decision:6", "dci:3"
    affectedObjectType: text('affected_object_type'), // "decision"|"dci"|"stage"|"car"|"jdp"|"qva"

    // ── Payload ─────────────────────────────────────────────────────────────
    metadata: jsonb('metadata'),  // sanitised supplemental data

    // ── Cryptographic chain ─────────────────────────────────────────────────
    previousHash:              text('previous_hash'),          // links to prior event's currentHash
    currentHash:               text('current_hash').notNull(), // SHA-256 of this event's fields
    chainHash:                 text('chain_hash').notNull(),   // cumulative chain hash
    digitalSignaturePlaceholder: text('digital_signature_placeholder'), // reserved for PKI
  },
  (t) => [
    uniqueIndex('el_decision_seq_idx').on(t.decisionId, t.sequenceNumber),
    index('el_decision_id_idx').on(t.decisionId),
    index('el_action_idx').on(t.action),
  ],
);

// ── Canonical action catalogue ─────────────────────────────────────────────────
export const EVIDENCE_EVENT_TYPES = [
  // Creation
  'decision.created',
  // Stage lifecycle
  'stage.completed',
  // Identity
  'dci.generated',
  'dci.amended',
  // Constitutional Answer Record
  'car.generated',
  // Judicial Defense Package
  'jdp.generated',
  // Quantitative Validity Assessment
  'qva.executed',
  // Governance
  'decision.delegated',
  'decision.undelegated',
  'decision.reviewed',
  'decision.approved',
  'decision.rejected',
  // Judicial
  'judicial.export',
  // Archive / closure
  'decision.archived',
  'evidence.verified',
] as const;

export type EvidenceEventType = (typeof EVIDENCE_EVENT_TYPES)[number];

// Map event type → Arabic label
export const EVIDENCE_EVENT_LABELS_AR: Record<EvidenceEventType, string> = {
  'decision.created':    'إنشاء القرار',
  'stage.completed':     'استكمال مرحلة',
  'dci.generated':       'إنشاء الهوية الدستورية',
  'dci.amended':         'تعديل الهوية الدستورية',
  'car.generated':       'إنشاء سجل المساءلة',
  'jdp.generated':       'إنشاء الحزمة الدفاعية',
  'qva.executed':        'تنفيذ تحليل التباين الكمي',
  'decision.delegated':  'تفويض القرار',
  'decision.undelegated':'إلغاء التفويض',
  'decision.reviewed':   'مراجعة القرار',
  'decision.approved':   'اعتماد القرار',
  'decision.rejected':   'رفض القرار',
  'judicial.export':     'تصدير قضائي',
  'decision.archived':   'أرشفة القرار',
  'evidence.verified':   'التحقق من الأدلة',
};
