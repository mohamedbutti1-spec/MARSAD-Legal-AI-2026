/**
 * Phase 3 — Al-Shamsi Constitutional Memory (CM) Service
 * الذاكرة الدستورية للقرار الإداري الذكي
 *
 * Append-only constitutional memory — every administrative decision leaves a
 * permanent, cryptographically chained legal history.  Nothing is overwritten.
 * Every version references its predecessor.  Tampering invalidates the chain.
 *
 * Hash design:
 *   decisionHash      = SHA-256(key decision fields, null-byte separated)
 *   completeAuditHash = SHA-256(decisionHash + prevCompleteAuditHash)
 *   eventHash         = SHA-256(all timeline event fields, null-byte separated)
 *   chainHash         = SHA-256(prevChainHash\x00eventHash)
 */
import { createHash } from "crypto";
import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "./index";
import { decisionMemoryTable, memoryTimelineTable } from "./schema/memory";
import type { MemoryEventType } from "./schema/memory";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateMemoryInput {
  decisionId: number;
  governmentEntity?: string | null;
  governmentUnit?: string | null;
  issuerRole?: string | null;
  humanDecisionMaker?: string | null;
  createdBy?: string | null;
  aiEngine?: string;
  aiModelVersion?: string;
  humanInfluenceIndex?: number | null;
  aiActualInfluence?: number | null;
  qva?: number | null;
  lsi?: number | null;
  complianceStatus?: string | null;
  constitutionalStatus?: string | null;
  decisionStatus?: string | null;
  appealStatus?: string | null;
}

export interface RecordMemoryEventInput {
  decisionId: number;
  eventType: MemoryEventType;
  eventSummaryAr?: string | null;
  eventSummaryEn?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  actorOrg?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface ConstitutionalMemory {
  current: typeof decisionMemoryTable.$inferSelect;
  versions: (typeof decisionMemoryTable.$inferSelect)[];
  timeline: (typeof memoryTimelineTable.$inferSelect)[];
  integrity: MemoryIntegrityResult;
}

export interface MemoryIntegrityResult {
  valid: boolean;
  versionsChecked: number;
  timelineChecked: number;
  firstTamperedSequence: number | null;
  latestChainHash: string | null;
  errors: Array<{ location: string; type: string; detail: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CM_FRAMEWORK_VERSION = "MARSAD-CM-v3.0";
const LEGAL_FRAMEWORK_VERSION = "UAE-Admin-Law-2026";

function sha256hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Deterministic JSON — sort all object keys alphabetically (JSONB-safe) */
function canonJson(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val !== "object" || Array.isArray(val)) return JSON.stringify(val);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(val as object).sort()) sorted[k] = (val as Record<string, unknown>)[k];
  return JSON.stringify(sorted);
}

/** Null-byte-separated hash input for a memory version record */
function buildDecisionHashInput(params: {
  decisionId: number;
  decisionVersion: number;
  constitutionalNumber: string;
  createdBy: string | null | undefined;
  governmentEntity: string | null | undefined;
  governmentUnit: string | null | undefined;
  issuerRole: string | null | undefined;
  humanDecisionMaker: string | null | undefined;
  aiEngine: string | null | undefined;
  humanInfluenceIndex: number | null | undefined;
  aiActualInfluence: number | null | undefined;
  qva: number | null | undefined;
  lsi: number | null | undefined;
  complianceStatus: string | null | undefined;
  constitutionalStatus: string | null | undefined;
  decisionStatus: string | null | undefined;
  appealStatus: string | null | undefined;
  previousVersion: string | null | undefined;
  previousCompleteAuditHash: string | null | undefined;
}): string {
  return [
    String(params.decisionId),
    String(params.decisionVersion),
    params.constitutionalNumber,
    params.createdBy ?? "null",
    params.governmentEntity ?? "null",
    params.governmentUnit ?? "null",
    params.issuerRole ?? "null",
    params.humanDecisionMaker ?? "null",
    params.aiEngine ?? "null",
    String(params.humanInfluenceIndex ?? "null"),
    String(params.aiActualInfluence ?? "null"),
    String(params.qva ?? "null"),
    String(params.lsi ?? "null"),
    params.complianceStatus ?? "null",
    params.constitutionalStatus ?? "null",
    params.decisionStatus ?? "null",
    params.appealStatus ?? "null",
    params.previousVersion ?? "GENESIS",
    params.previousCompleteAuditHash ?? "GENESIS",
  ].join("\x00");
}

/** Null-byte-separated hash input for a timeline event */
function buildEventHashInput(params: {
  decisionId: number;
  sequenceNumber: number;
  eventType: string;
  eventSummaryAr: string | null | undefined;
  eventSummaryEn: string | null | undefined;
  actorId: string | null | undefined;
  actorRole: string | null | undefined;
  actorOrg: string | null | undefined;
  payload: string | null | undefined;
  previousHash: string | null | undefined;
  recordedAt: string;
}): string {
  return [
    String(params.decisionId),
    String(params.sequenceNumber),
    params.eventType,
    params.eventSummaryAr ?? "null",
    params.eventSummaryEn ?? "null",
    params.actorId ?? "null",
    params.actorRole ?? "null",
    params.actorOrg ?? "null",
    params.payload ?? "null",
    params.previousHash ?? "GENESIS",
    params.recordedAt,
  ].join("\x00");
}

/** Generate constitutional number: CM-UAE-YYYY-NNNNN */
function generateConstitutionalNumber(decisionId: number): string {
  const year = new Date().getFullYear();
  const padded = String(decisionId).padStart(5, "0");
  return `CM-UAE-${year}-${padded}`;
}

// ─── Internal tx-aware version insert (no advisory lock — caller holds it) ────

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Insert a new memory version row inside an ALREADY-OPEN transaction.
 * The caller must hold the CMEM advisory lock before calling this.
 * Never call from outside a db.transaction block.
 */
async function _insertMemoryVersionInTx(
  tx: TxClient,
  input: CreateMemoryInput,
): Promise<typeof decisionMemoryTable.$inferSelect> {
  const [latest] = await tx
    .select()
    .from(decisionMemoryTable)
    .where(eq(decisionMemoryTable.decisionId, input.decisionId))
    .orderBy(desc(decisionMemoryTable.decisionVersion))
    .limit(1);

  const decisionVersion = (latest?.decisionVersion ?? 0) + 1;
  const previousVersion = latest?.memoryId ?? null;
  const previousCompleteAuditHash = latest?.completeAuditHash ?? null;
  const constitutionalNumber =
    latest?.constitutionalNumber ?? generateConstitutionalNumber(input.decisionId);

  // ── Normalize fields that have defaults ────────────────────────────────────
  // CRITICAL: every field used in the hash MUST be normalized to its final
  // stored value BEFORE computing the hash. Using input.xxx directly when
  // the INSERT applies a default (e.g. aiEngine ?? "Claude …") produces a
  // hash over "null" while the DB stores "Claude …", causing verify failures.
  const normalizedAiEngine             = input.aiEngine             ?? "Claude Sonnet (Anthropic)";
  const normalizedComplianceStatus     = input.complianceStatus     ?? "pending";
  const normalizedConstitutionalStatus = input.constitutionalStatus ?? "valid";
  const normalizedDecisionStatus       = input.decisionStatus       ?? "draft";
  const normalizedAppealStatus         = input.appealStatus         ?? "none";

  const hashInput = buildDecisionHashInput({
    decisionId: input.decisionId,
    decisionVersion,
    constitutionalNumber,
    createdBy:            input.createdBy,
    governmentEntity:     input.governmentEntity,
    governmentUnit:       input.governmentUnit,
    issuerRole:           input.issuerRole,
    humanDecisionMaker:   input.humanDecisionMaker,
    aiEngine:             normalizedAiEngine,
    humanInfluenceIndex:  input.humanInfluenceIndex,
    aiActualInfluence:    input.aiActualInfluence,
    qva:                  input.qva,
    lsi:                  input.lsi,
    complianceStatus:     normalizedComplianceStatus,
    constitutionalStatus: normalizedConstitutionalStatus,
    decisionStatus:       normalizedDecisionStatus,
    appealStatus:         normalizedAppealStatus,
    previousVersion,
    previousCompleteAuditHash,
  });

  const decisionHash = sha256hex(hashInput);
  const completeAuditHash = sha256hex(
    [previousCompleteAuditHash ?? "GENESIS", decisionHash].join("\x00"),
  );

  const [inserted] = await tx
    .insert(decisionMemoryTable)
    .values({
      decisionId: input.decisionId,
      constitutionalNumber,
      decisionVersion,
      previousVersion,
      decisionHash,
      completeAuditHash,
      createdBy:                      input.createdBy ?? null,
      governmentEntity:               input.governmentEntity ?? null,
      governmentUnit:                 input.governmentUnit ?? null,
      issuerRole:                     input.issuerRole ?? null,
      humanDecisionMaker:             input.humanDecisionMaker ?? null,
      aiEngine:                       normalizedAiEngine,
      aiModelVersion:                 input.aiModelVersion ?? "claude-sonnet-4-5",
      constitutionalFrameworkVersion: CM_FRAMEWORK_VERSION,
      legalFrameworkVersion:          LEGAL_FRAMEWORK_VERSION,
      humanInfluenceIndex:            input.humanInfluenceIndex ?? null,
      aiActualInfluence:              input.aiActualInfluence ?? null,
      qva:                            input.qva ?? null,
      lsi:                            input.lsi ?? null,
      complianceStatus:               normalizedComplianceStatus,
      constitutionalStatus:           normalizedConstitutionalStatus,
      decisionStatus:                 normalizedDecisionStatus,
      appealStatus:                   normalizedAppealStatus,
      sealed:                         false,
      archiveStatus:                  "active",
    })
    .returning();

  return inserted;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create or update the Constitutional Memory for a decision.
 * On first call: creates version 1.
 * On subsequent calls: creates version N+1 referencing version N.
 * Safe to call fire-and-forget.
 */
export async function createOrUpdateMemory(
  input: CreateMemoryInput,
): Promise<typeof decisionMemoryTable.$inferSelect> {
  const ADVISORY_SCOPE = 0x434d_454d; // "CMEM" in hex

  return db.transaction(async (tx) => {
    // Acquire per-decision advisory lock — held for the duration of the tx
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${ADVISORY_SCOPE}, ${input.decisionId})`,
    );
    return _insertMemoryVersionInTx(tx, input);
  });
}

/**
 * Record a constitutional event on the timeline.
 * Links to the latest memory version for this decision.
 * If no memory version exists yet, bootstraps one atomically within the SAME
 * transaction — no nested db.transaction() call.
 * Append-only — uses advisory lock to prevent sequence gaps.
 */
export async function recordMemoryEvent(
  input: RecordMemoryEventInput,
): Promise<typeof memoryTimelineTable.$inferSelect> {
  // Combined advisory lock scope covering both CMEM and CMTL operations so
  // the bootstrap version insert and event insert are fully atomic.
  const ADVISORY_SCOPE_VER  = 0x434d_454d; // "CMEM"
  const ADVISORY_SCOPE_EVT  = 0x434d_544c; // "CMTL"

  return db.transaction(async (tx) => {
    // Acquire both locks upfront — order is consistent (VER < EVT) to avoid deadlock
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${ADVISORY_SCOPE_VER}, ${input.decisionId})`,
    );
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${ADVISORY_SCOPE_EVT}, ${input.decisionId})`,
    );

    // Get the current memory version for this decision
    const [latest] = await tx
      .select()
      .from(decisionMemoryTable)
      .where(eq(decisionMemoryTable.decisionId, input.decisionId))
      .orderBy(desc(decisionMemoryTable.decisionVersion))
      .limit(1);

    // If no memory exists yet, bootstrap WITHIN THIS TRANSACTION (no nesting)
    let memoryId: string;
    if (!latest) {
      const bootstrapped = await _insertMemoryVersionInTx(tx, {
        decisionId: input.decisionId,
        decisionStatus: "draft",
      });
      memoryId = bootstrapped.memoryId;
    } else {
      memoryId = latest.memoryId;
    }

    // Get the last event to chain from
    const [lastEvent] = await tx
      .select()
      .from(memoryTimelineTable)
      .where(eq(memoryTimelineTable.decisionId, input.decisionId))
      .orderBy(desc(memoryTimelineTable.sequenceNumber))
      .limit(1);

    const sequenceNumber = (lastEvent?.sequenceNumber ?? 0) + 1;
    const previousHash = lastEvent?.chainHash ?? null;
    const payloadStr = input.payload ? canonJson(input.payload) : null;
    const recordedAt = new Date().toISOString();

    const eventHashInput = buildEventHashInput({
      decisionId: input.decisionId,
      sequenceNumber,
      eventType: input.eventType,
      eventSummaryAr: input.eventSummaryAr,
      eventSummaryEn: input.eventSummaryEn,
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorOrg: input.actorOrg,
      payload: payloadStr,
      previousHash,
      recordedAt,
    });

    const eventHash = sha256hex(eventHashInput);
    const chainHash = sha256hex(
      [(previousHash ?? "GENESIS"), eventHash].join("\x00"),
    );

    const [inserted] = await tx
      .insert(memoryTimelineTable)
      .values({
        memoryId,
        decisionId: input.decisionId,
        sequenceNumber,
        eventType: input.eventType,
        eventSummaryAr: input.eventSummaryAr ?? null,
        eventSummaryEn: input.eventSummaryEn ?? null,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        actorOrg: input.actorOrg ?? null,
        payload: payloadStr,
        eventHash,
        previousHash,
        chainHash,
        recordedAt: new Date(recordedAt),
      })
      .returning();

    return inserted;
  });
}

/**
 * Get the full constitutional memory for a decision.
 * Includes all versions, the full timeline, and an integrity report.
 */
export async function getConstitutionalMemory(
  decisionId: number,
): Promise<ConstitutionalMemory | null> {
  const versions = await db
    .select()
    .from(decisionMemoryTable)
    .where(eq(decisionMemoryTable.decisionId, decisionId))
    .orderBy(asc(decisionMemoryTable.decisionVersion));

  if (!versions.length) return null;

  const timeline = await db
    .select()
    .from(memoryTimelineTable)
    .where(eq(memoryTimelineTable.decisionId, decisionId))
    .orderBy(asc(memoryTimelineTable.sequenceNumber));

  const current = versions[versions.length - 1];
  const integrity = verifyMemoryIntegritySync(versions, timeline);

  return { current, versions, timeline, integrity };
}

/**
 * Verify the cryptographic integrity of the constitutional memory chain.
 * Recomputes every hash and checks chain links.
 */
function verifyMemoryIntegritySync(
  versions: (typeof decisionMemoryTable.$inferSelect)[],
  timeline: (typeof memoryTimelineTable.$inferSelect)[],
): MemoryIntegrityResult {
  const errors: MemoryIntegrityResult["errors"] = [];
  let firstTamperedSequence: number | null = null;

  // ── Verify version chain ──────────────────────────────────────────────────
  let prevCompleteAuditHash: string | null = null;
  let prevVersionId: string | null = null;

  for (const ver of versions) {
    const expectedHashInput = buildDecisionHashInput({
      decisionId: ver.decisionId,
      decisionVersion: ver.decisionVersion,
      constitutionalNumber: ver.constitutionalNumber,
      createdBy: ver.createdBy,
      governmentEntity: ver.governmentEntity,
      governmentUnit: ver.governmentUnit,
      issuerRole: ver.issuerRole,
      humanDecisionMaker: ver.humanDecisionMaker,
      aiEngine: ver.aiEngine,
      humanInfluenceIndex: ver.humanInfluenceIndex,
      aiActualInfluence: ver.aiActualInfluence,
      qva: ver.qva,
      lsi: ver.lsi,
      complianceStatus: ver.complianceStatus,
      constitutionalStatus: ver.constitutionalStatus,
      decisionStatus: ver.decisionStatus,
      appealStatus: ver.appealStatus,
      previousVersion: ver.previousVersion,
      previousCompleteAuditHash: prevCompleteAuditHash,
    });

    const expectedDecisionHash = sha256hex(expectedHashInput);
    if (expectedDecisionHash !== ver.decisionHash) {
      errors.push({
        location: `version:${ver.decisionVersion}`,
        type: "decision_hash_mismatch",
        detail: `decisionHash mismatch on version ${ver.decisionVersion}`,
      });
    }

    const expectedCompleteAuditHash = sha256hex(
      [(prevCompleteAuditHash ?? "GENESIS"), ver.decisionHash].join("\x00"),
    );
    if (expectedCompleteAuditHash !== ver.completeAuditHash) {
      errors.push({
        location: `version:${ver.decisionVersion}`,
        type: "audit_hash_mismatch",
        detail: `completeAuditHash mismatch on version ${ver.decisionVersion}`,
      });
    }

    // Check previous version link
    if (ver.previousVersion !== prevVersionId) {
      errors.push({
        location: `version:${ver.decisionVersion}`,
        type: "version_chain_break",
        detail: `previousVersion link broken on version ${ver.decisionVersion}`,
      });
    }

    prevCompleteAuditHash = ver.completeAuditHash;
    prevVersionId = ver.memoryId;
  }

  // ── Verify timeline chain ─────────────────────────────────────────────────
  let prevChainHash: string | null = null;

  for (const ev of timeline) {
    const expectedEventHashInput = buildEventHashInput({
      decisionId: ev.decisionId,
      sequenceNumber: ev.sequenceNumber,
      eventType: ev.eventType,
      eventSummaryAr: ev.eventSummaryAr,
      eventSummaryEn: ev.eventSummaryEn,
      actorId: ev.actorId,
      actorRole: ev.actorRole,
      actorOrg: ev.actorOrg,
      payload: ev.payload,
      previousHash: ev.previousHash,
      recordedAt: ev.recordedAt.toISOString(),
    });

    const expectedEventHash = sha256hex(expectedEventHashInput);
    if (expectedEventHash !== ev.eventHash) {
      if (firstTamperedSequence === null) firstTamperedSequence = ev.sequenceNumber;
      errors.push({
        location: `timeline:${ev.sequenceNumber}`,
        type: "event_hash_mismatch",
        detail: `eventHash mismatch on timeline sequence ${ev.sequenceNumber}`,
      });
    }

    if (ev.previousHash !== prevChainHash) {
      errors.push({
        location: `timeline:${ev.sequenceNumber}`,
        type: "chain_break",
        detail: `chain link broken at timeline sequence ${ev.sequenceNumber}`,
      });
    }

    const expectedChainHash = sha256hex(
      [(prevChainHash ?? "GENESIS"), ev.eventHash].join("\x00"),
    );
    if (expectedChainHash !== ev.chainHash) {
      errors.push({
        location: `timeline:${ev.sequenceNumber}`,
        type: "chain_hash_mismatch",
        detail: `chainHash mismatch at timeline sequence ${ev.sequenceNumber}`,
      });
    }

    prevChainHash = ev.chainHash;
  }

  const latestChainHash = timeline.length
    ? timeline[timeline.length - 1].chainHash
    : (versions[versions.length - 1]?.completeAuditHash ?? null);

  return {
    valid: errors.length === 0,
    versionsChecked: versions.length,
    timelineChecked: timeline.length,
    firstTamperedSequence,
    latestChainHash,
    errors,
  };
}

/**
 * Seal a constitutional memory record — makes it immutable.
 * A sealed record blocks further amendments.
 */
export async function sealMemory(
  decisionId: number,
): Promise<typeof decisionMemoryTable.$inferSelect | null> {
  const [latest] = await db
    .select()
    .from(decisionMemoryTable)
    .where(eq(decisionMemoryTable.decisionId, decisionId))
    .orderBy(desc(decisionMemoryTable.decisionVersion))
    .limit(1);

  if (!latest) return null;
  if (latest.sealed) return latest; // already sealed

  const [updated] = await db
    .update(decisionMemoryTable)
    .set({ sealed: true, sealedAt: new Date() })
    .where(eq(decisionMemoryTable.memoryId, latest.memoryId))
    .returning();

  // Record the seal event
  await recordMemoryEvent({
    decisionId,
    eventType: "memory.sealed",
    eventSummaryAr: "تم ختم الذاكرة الدستورية — لا يمكن إجراء مزيد من التعديلات",
    eventSummaryEn: "Constitutional memory sealed — no further amendments permitted",
  }).catch(console.error);

  return updated;
}

/**
 * Archive a decision's constitutional memory.
 * Sets archiveStatus = "archived" on the current version.
 */
export async function archiveMemory(
  decisionId: number,
  actorId?: string,
  actorRole?: string,
): Promise<typeof decisionMemoryTable.$inferSelect | null> {
  const [latest] = await db
    .select()
    .from(decisionMemoryTable)
    .where(eq(decisionMemoryTable.decisionId, decisionId))
    .orderBy(desc(decisionMemoryTable.decisionVersion))
    .limit(1);

  if (!latest) return null;

  // Update ONLY the current/latest version row (by memoryId, not decisionId)
  // so that historical version rows retain their original archiveStatus.
  const [updated] = await db
    .update(decisionMemoryTable)
    .set({ archiveStatus: "archived" })
    .where(eq(decisionMemoryTable.memoryId, latest.memoryId))
    .returning();

  await recordMemoryEvent({
    decisionId,
    eventType: "archive",
    eventSummaryAr: "تم أرشفة الذاكرة الدستورية",
    eventSummaryEn: "Constitutional memory archived",
    actorId,
    actorRole,
  }).catch(console.error);

  return updated;
}

/**
 * Get the history of constitutional memory across all decisions.
 * Filtered version for governance dashboard.
 */
export async function getMemoryHistory(opts: {
  limit?: number;
  offset?: number;
}): Promise<{
  records: (typeof decisionMemoryTable.$inferSelect)[];
  total: number;
}> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;

  const records = await db
    .select()
    .from(decisionMemoryTable)
    .orderBy(desc(decisionMemoryTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(decisionMemoryTable);

  return { records, total: count };
}

export type { MemoryEventType };
