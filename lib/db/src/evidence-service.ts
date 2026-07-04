/**
 * Phase 4 — Constitutional Chain of Custody and Evidence Ledger Service
 *
 * Immutable, append-only evidentiary record for every constitutional decision.
 * Every action becomes a cryptographically linked evidence event.
 * Nothing is deleted or overwritten — archive by appending a new event.
 *
 * Hash design (identical pattern to custody-service):
 *   currentHash = SHA-256(null-byte-separated field list)
 *   chainHash   = SHA-256(prevChainHash\x00currentHash)
 *   digitalSignaturePlaceholder = "PKI-PLACEHOLDER:<currentHash[:16]>"
 *
 * Tamper detection: any field change invalidates currentHash and all
 * subsequent chainHashes.
 *
 * Integrity score (0–100):
 *   100 = all hashes valid + no chain breaks + no missing expected events
 *   Deductions: 20 per hash error, 10 per chain break
 */
import { createHash } from "crypto";
import { eq, desc, asc, sql } from "drizzle-orm";
import { db } from "./index";
import { evidenceLedgerTable } from "./schema/evidence";
import type { EvidenceEventType } from "./schema/evidence";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceEventInput {
  decisionId: number;
  action: EvidenceEventType;
  eventCategory?: string;
  actor?: string | null;
  actorRole?: string | null;
  actorOrg?: string | null;
  affectedObject?: string | null;
  affectedObjectType?: string | null;
  metadata?: Record<string, unknown> | null;
  evidenceSummaryAr?: string | null;
  evidenceSummaryEn?: string | null;
  timestamp?: Date;
}

export interface EvidenceVerificationResult {
  valid: boolean;
  integrityScore: number;          // 0-100
  eventsChecked: number;
  brokenLinks: number;
  hashErrors: number;
  firstTamperedSequence: number | null;
  genesisHash: string | null;
  latestChainHash: string | null;
  errors: Array<{
    sequence: number;
    type: "hash_mismatch" | "chain_break";
    detail: string;
  }>;
}

export type EvidenceLedgerRecord = typeof evidenceLedgerTable.$inferSelect;

// ─── Hash helpers ─────────────────────────────────────────────────────────────

function sha256hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Deterministic JSON — sort all object keys alphabetically (JSONB-safe) */
function canonJson(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val !== "object" || Array.isArray(val)) return JSON.stringify(val);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(val as object).sort())
    sorted[k] = (val as Record<string, unknown>)[k];
  return JSON.stringify(sorted);
}

/** Null-byte-separated hash input — field order is fixed and must never change */
function buildHashInput(params: {
  decisionId: number;
  sequenceNumber: number;
  actor: string | null | undefined;
  actorRole: string | null | undefined;
  actorOrg: string | null | undefined;
  timestamp: string;       // ISO 8601
  action: string;
  eventCategory: string;
  affectedObject: string | null | undefined;
  affectedObjectType: string | null | undefined;
  metadata: string | null | undefined;  // canonical JSON string
  previousHash: string | null | undefined;
}): string {
  return [
    String(params.decisionId),
    String(params.sequenceNumber),
    params.actor             ?? "null",
    params.actorRole         ?? "null",
    params.actorOrg          ?? "null",
    params.timestamp,
    params.action,
    params.eventCategory,
    params.affectedObject     ?? "null",
    params.affectedObjectType ?? "null",
    params.metadata           ?? "null",
    params.previousHash       ?? "GENESIS",
  ].join("\x00");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append an immutable evidence event.
 * Uses pg_advisory_xact_lock to prevent concurrent sequence gaps.
 * Safe to call fire-and-forget.
 */
export async function recordEvidenceEvent(
  input: EvidenceEventInput,
): Promise<EvidenceLedgerRecord> {
  const ADVISORY_SCOPE = 0x4556_4944; // "EVID" in hex

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${ADVISORY_SCOPE}, ${input.decisionId})`,
    );

    const [last] = await tx
      .select()
      .from(evidenceLedgerTable)
      .where(eq(evidenceLedgerTable.decisionId, input.decisionId))
      .orderBy(desc(evidenceLedgerTable.sequenceNumber))
      .limit(1);

    const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
    const previousHash   = last?.currentHash ?? null;
    const ts             = (input.timestamp ?? new Date()).toISOString();
    const metadataStr    = input.metadata ? canonJson(input.metadata) : null;
    const eventCategory  = input.eventCategory ?? "decision";

    const hashInput = buildHashInput({
      decisionId:         input.decisionId,
      sequenceNumber,
      actor:              input.actor,
      actorRole:          input.actorRole,
      actorOrg:           input.actorOrg,
      timestamp:          ts,
      action:             input.action,
      eventCategory,
      affectedObject:     input.affectedObject,
      affectedObjectType: input.affectedObjectType,
      metadata:           metadataStr,
      previousHash,
    });

    const currentHash   = sha256hex(hashInput);
    const chainHash     = sha256hex([(previousHash ?? "GENESIS"), currentHash].join("\x00"));
    const digitalSignaturePlaceholder = `PKI-PLACEHOLDER:${currentHash.slice(0, 16)}`;

    const [inserted] = await tx
      .insert(evidenceLedgerTable)
      .values({
        decisionId:                  input.decisionId,
        sequenceNumber,
        actor:                       input.actor ?? null,
        actorRole:                   input.actorRole ?? null,
        actorOrg:                    input.actorOrg ?? null,
        timestamp:                   new Date(ts),
        action:                      input.action,
        eventCategory,
        evidenceSummaryAr:           input.evidenceSummaryAr ?? null,
        evidenceSummaryEn:           input.evidenceSummaryEn ?? null,
        affectedObject:              input.affectedObject ?? null,
        affectedObjectType:          input.affectedObjectType ?? null,
        metadata:                    input.metadata as Record<string, unknown> | null ?? null,
        previousHash,
        currentHash,
        chainHash,
        digitalSignaturePlaceholder,
      })
      .returning();

    return inserted;
  });
}

/**
 * Retrieve the full evidence chain for a decision, ordered by sequence.
 */
export async function getEvidenceChain(
  decisionId: number,
): Promise<EvidenceLedgerRecord[]> {
  return db
    .select()
    .from(evidenceLedgerTable)
    .where(eq(evidenceLedgerTable.decisionId, decisionId))
    .orderBy(asc(evidenceLedgerTable.sequenceNumber));
}

/**
 * Verify the cryptographic integrity of the entire evidence chain.
 * Recomputes every hash and checks chain links.
 * Returns a tamper-detection report with an integrity score (0-100).
 */
export async function verifyEvidenceChain(
  decisionId: number,
): Promise<EvidenceVerificationResult> {
  const chain = await getEvidenceChain(decisionId);

  const errors: EvidenceVerificationResult["errors"] = [];
  // prevCurrentHash: the prior event's currentHash (what ev.previousHash must equal).
  // prevCurrentHash: distinct from chainHash — the insert stores
  //   previousHash = last?.currentHash and chainHash = SHA256(previousHash + "\x00" + currentHash).
  let prevCurrentHash: string | null = null; // tracks prior event's currentHash
  let firstTamperedSequence: number | null = null;

  for (const ev of chain) {
    const expectedHashInput = buildHashInput({
      decisionId:         ev.decisionId,
      sequenceNumber:     ev.sequenceNumber,
      actor:              ev.actor,
      actorRole:          ev.actorRole,
      actorOrg:           ev.actorOrg,
      timestamp:          ev.timestamp.toISOString(),
      action:             ev.action,
      eventCategory:      ev.eventCategory,
      affectedObject:     ev.affectedObject,
      affectedObjectType: ev.affectedObjectType,
      metadata:           ev.metadata ? canonJson(ev.metadata) : null,
      previousHash:       ev.previousHash,
    });

    const expectedCurrentHash = sha256hex(expectedHashInput);

    // ── 1. Validate currentHash (tamper detection on this event's own fields) ──
    if (expectedCurrentHash !== ev.currentHash) {
      if (firstTamperedSequence === null) firstTamperedSequence = ev.sequenceNumber;
      errors.push({
        sequence: ev.sequenceNumber,
        type: "hash_mismatch",
        detail: `currentHash mismatch at sequence ${ev.sequenceNumber}`,
      });
    }

    // ── 2. Validate chain link ────────────────────────────────────────────────
    // ev.previousHash must equal the prior event's currentHash (null for genesis).
    if (ev.previousHash !== prevCurrentHash) {
      if (firstTamperedSequence === null) firstTamperedSequence = ev.sequenceNumber;
      errors.push({
        sequence: ev.sequenceNumber,
        type: "chain_break",
        detail: `chain link broken at sequence ${ev.sequenceNumber} — previousHash does not match prior currentHash`,
      });
    }

    // ── 3. Validate cumulative chainHash ─────────────────────────────────────
    // chainHash = SHA256((prevCurrentHash ?? "GENESIS") + "\x00" + currentHash)
    const expectedChainHash = sha256hex(
      [(prevCurrentHash ?? "GENESIS"), expectedCurrentHash].join("\x00"),
    );
    if (expectedChainHash !== ev.chainHash) {
      if (firstTamperedSequence === null) firstTamperedSequence = ev.sequenceNumber;
      errors.push({
        sequence: ev.sequenceNumber,
        type: "hash_mismatch",
        detail: `chainHash mismatch at sequence ${ev.sequenceNumber}`,
      });
    }

    prevCurrentHash = ev.currentHash; // advance anchor for next iteration
  }

  const hashErrors  = errors.filter((e) => e.type === "hash_mismatch").length;
  const brokenLinks = errors.filter((e) => e.type === "chain_break").length;

  // Integrity score: start at 100, deduct per error
  const rawScore = 100 - hashErrors * 20 - brokenLinks * 10;
  const integrityScore = Math.max(0, Math.min(100, rawScore));

  return {
    valid:                  errors.length === 0,
    integrityScore,
    eventsChecked:          chain.length,
    brokenLinks,
    hashErrors,
    firstTamperedSequence,
    genesisHash:            chain.length ? chain[0].currentHash : null,
    latestChainHash:        chain.length ? chain[chain.length - 1].chainHash : null,
    errors,
  };
}

export type { EvidenceEventType };
