/**
 * Phase 3 — Decision Chain of Custody Service
 * Append-only, cryptographically chained audit trail.
 * Nothing is ever deleted or overwritten — every write is INSERT-only.
 *
 * Hash chain design:
 *   currentRecordHash = SHA-256(null-byte-separated field list)
 *   digitalSignature  = HMAC-SHA-256(currentRecordHash, SESSION_SECRET)
 *   chainHash         = SHA-256("GENESIS|…|prevChainHash\x00currentRecordHash")
 *
 * Tamper detection: any field change invalidates the record hash which
 * invalidates the chain hash for every subsequent record.
 */
import { createHash, createHmac } from "crypto";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "./index";
import { chainOfCustodyTable } from "./schema/custody";
import type { ChainOfCustodyRecord } from "./schema/custody";

// ─── HMAC key — must come from SESSION_SECRET in production ───────────────────
// Fail fast in production so a misconfigured deployment can't silently produce
// predictable HMAC signatures (which would allow signature forgery).
const HMAC_KEY: string = (() => {
  const key = process.env.SESSION_SECRET;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[MARSAD] FATAL: SESSION_SECRET is required for Chain-of-Custody HMAC " +
        "signatures in production.  Set the secret before starting the server.",
      );
    }
    // Development fallback — intentionally weak so no one copies it to prod
    console.warn(
      "[MARSAD] WARN: SESSION_SECRET not set. " +
      "Using insecure dev-only HMAC fallback — NEVER use in production.",
    );
  }
  return key ?? "marsad-chain-of-custody-phase3-dev-only-DO-NOT-USE-IN-PROD";
})();

// ─── Public types ──────────────────────────────────────────────────────────────

export interface CustodyEventInput {
  decisionId: number;
  userId?: number | null;
  userRole?: string | null;
  organization?: string | null;
  action: string;
  actionCategory?: string;
  deviceInfo?: Record<string, unknown> | null;
  ipAddress?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  legalJustification?: string | null;
  aiRecommendation?: string | null;
  humanModification?: string | null;
  timestamp?: Date;
}

export interface CustodyVerificationResult {
  valid: boolean;
  recordsChecked: number;
  firstTamperedSequence: number | null;
  genesisHash: string | null;
  latestChainHash: string | null;
  errors: Array<{
    sequence: number;
    type: "hash_mismatch" | "chain_break" | "signature_invalid";
    detail: string;
  }>;
}

// ─── Canonical JSON (deterministic key-sorted serialisation) ──────────────────
//
// PostgreSQL JSONB stores keys in a normalised order (shortest first, then
// lexicographic for equal lengths).  If we call JSON.stringify on a JS object
// and then verify by calling JSON.stringify on the DB-returned value the two
// strings can differ because the key order changed.
// We solve this by always sorting object keys alphabetically before serialising,
// which is invariant under any key-reordering that JSONB may apply.

function canonicalJson(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (Array.isArray(val)) return "[" + val.map(canonicalJson).join(",") + "]";
  if (typeof val === "object") {
    const sorted = Object.keys(val as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((val as Record<string, unknown>)[k])}`);
    return `{${sorted.join(",")}}`;
  }
  return JSON.stringify(val);
}

// ─── Internal hash helpers ─────────────────────────────────────────────────────

type HashFields = {
  sequenceNumber: number;
  decisionId: number;
  userId?: number | null;
  userRole?: string | null;
  organization?: string | null;
  action: string;
  actionCategory: string;
  timestamp: Date;
  deviceInfo?: unknown;
  ipAddress?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  legalJustification?: string | null;
  aiRecommendation?: string | null;
  humanModification?: string | null;
  previousRecordHash?: string | null;
};

/** Deterministic null-byte-separated serialisation (null byte cannot appear in valid JSON). */
function buildHashInput(r: HashFields): string {
  return [
    String(r.sequenceNumber),
    String(r.decisionId),
    String(r.userId ?? ""),
    r.userRole      ?? "",
    r.organization  ?? "",
    r.action,
    r.actionCategory,
    r.timestamp.toISOString(),
    canonicalJson(r.deviceInfo   ?? null),
    r.ipAddress     ?? "",
    canonicalJson(r.previousValue ?? null),
    canonicalJson(r.newValue      ?? null),
    r.legalJustification ?? "",
    r.aiRecommendation   ?? "",
    r.humanModification  ?? "",
    r.previousRecordHash ?? "GENESIS",
  ].join("\x00");
}

function sha256hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hmacSha256hex(input: string): string {
  return createHmac("sha256", HMAC_KEY).update(input, "utf8").digest("hex");
}

function computeChainHash(prevChainHash: string | null, currentRecordHash: string): string {
  return sha256hex(`${prevChainHash ?? "GENESIS"}\x00${currentRecordHash}`);
}

// ─── Core operations ───────────────────────────────────────────────────────────

/**
 * Append an immutable record to the decision's chain of custody.
 * Uses INSERT only — never UPDATE or DELETE.
 *
 * Safe to call fire-and-forget:
 *   recordCustodyEvent(event).catch(console.error);
 */
export async function recordCustodyEvent(
  event: CustodyEventInput,
): Promise<ChainOfCustodyRecord> {
  const timestamp = event.timestamp ?? new Date();

  // ── Atomic sequence allocation with PostgreSQL advisory lock ─────────────
  // pg_advisory_xact_lock(scope, key) holds an exclusive lock scoped to the
  // current transaction, preventing concurrent inserts for the same decision
  // from racing on the sequence number and producing a unique-constraint
  // violation (which would silently drop the custody event in fire-and-forget
  // callers).  The lock is released automatically at transaction commit.
  const ADVISORY_SCOPE = 0x4355_5354; // "CUST" in hex — custody namespace

  const record = await db.transaction(async (tx) => {
    // Acquire per-decision advisory lock — blocks until prior lock releases
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${ADVISORY_SCOPE}, ${event.decisionId})`,
    );

    const [last] = await tx
      .select()
      .from(chainOfCustodyTable)
      .where(eq(chainOfCustodyTable.decisionId, event.decisionId))
      .orderBy(desc(chainOfCustodyTable.sequenceNumber))
      .limit(1);

    const sequenceNumber     = (last?.sequenceNumber ?? 0) + 1;
    const previousRecordHash = last?.currentRecordHash ?? null;
    const previousChainHash  = last?.chainHash ?? null;

    // Compute cryptographic fields
    const hashInput = buildHashInput({
      sequenceNumber,
      decisionId:         event.decisionId,
      userId:             event.userId,
      userRole:           event.userRole,
      organization:       event.organization,
      action:             event.action,
      actionCategory:     event.actionCategory ?? "decision",
      timestamp,
      deviceInfo:         event.deviceInfo,
      ipAddress:          event.ipAddress,
      previousValue:      event.previousValue,
      newValue:           event.newValue,
      legalJustification: event.legalJustification,
      aiRecommendation:   event.aiRecommendation,
      humanModification:  event.humanModification,
      previousRecordHash,
    });

    const currentRecordHash = sha256hex(hashInput);
    const digitalSignature  = hmacSha256hex(currentRecordHash);
    const chainHash         = computeChainHash(previousChainHash, currentRecordHash);

    // INSERT only — append to chain
    const [inserted] = await tx
      .insert(chainOfCustodyTable)
      .values({
        decisionId:         event.decisionId,
        sequenceNumber,
        userId:             event.userId ?? null,
        userRole:           event.userRole ?? null,
        organization:       event.organization ?? null,
        action:             event.action,
        actionCategory:     event.actionCategory ?? "decision",
        timestamp,
        deviceInfo:         (event.deviceInfo ?? null) as Record<string, unknown> | null,
        ipAddress:          event.ipAddress ?? null,
        previousValue:      (event.previousValue ?? null) as Record<string, unknown> | null,
        newValue:           (event.newValue ?? null) as Record<string, unknown> | null,
        legalJustification: event.legalJustification ?? null,
        aiRecommendation:   event.aiRecommendation ?? null,
        humanModification:  event.humanModification ?? null,
        digitalSignature,
        previousRecordHash,
        currentRecordHash,
        chainHash,
      })
      .returning();

    return inserted;
  });

  return record;
}

/**
 * Verify the cryptographic integrity of the entire custody chain.
 * Recomputes every hash from stored fields and checks chain links.
 * Returns a detailed tamper-detection report.
 */
export async function verifyCustodyChain(
  decisionId: number,
): Promise<CustodyVerificationResult> {
  const records = await db
    .select()
    .from(chainOfCustodyTable)
    .where(eq(chainOfCustodyTable.decisionId, decisionId))
    .orderBy(chainOfCustodyTable.sequenceNumber);

  const errors: CustodyVerificationResult["errors"] = [];
  let firstTamperedSequence: number | null = null;
  let prevChainHash:  string | null = null;
  let prevRecordHash: string | null = null;

  const flag = (err: CustodyVerificationResult["errors"][number]) => {
    errors.push(err);
    if (!firstTamperedSequence) firstTamperedSequence = err.sequence;
  };

  for (const r of records) {
    const ts = new Date(r.timestamp);

    // (a) Recompute currentRecordHash from stored fields
    const recomputed = sha256hex(buildHashInput({
      sequenceNumber:     r.sequenceNumber,
      decisionId:         r.decisionId,
      userId:             r.userId,
      userRole:           r.userRole,
      organization:       r.organization,
      action:             r.action,
      actionCategory:     r.actionCategory,
      timestamp:          ts,
      deviceInfo:         r.deviceInfo,
      ipAddress:          r.ipAddress,
      previousValue:      r.previousValue,
      newValue:           r.newValue,
      legalJustification: r.legalJustification,
      aiRecommendation:   r.aiRecommendation,
      humanModification:  r.humanModification,
      previousRecordHash: r.previousRecordHash,
    }));

    if (recomputed !== r.currentRecordHash) {
      flag({ sequence: r.sequenceNumber, type: "hash_mismatch",
        detail: `Record hash mismatch at seq ${r.sequenceNumber}: stored ${r.currentRecordHash.slice(0,16)}… ≠ computed ${recomputed.slice(0,16)}…` });
    }

    // (b) Verify chain link — previousRecordHash must equal prior record's currentRecordHash
    if (r.previousRecordHash !== prevRecordHash) {
      flag({ sequence: r.sequenceNumber, type: "chain_break",
        detail: `Chain link broken at seq ${r.sequenceNumber}: expected prev=${prevRecordHash?.slice(0,8) ?? "GENESIS"} stored=${r.previousRecordHash?.slice(0,8) ?? "null"}` });
    }

    // (c) Verify cumulative chain hash
    const expectedChain = computeChainHash(prevChainHash, r.currentRecordHash);
    if (expectedChain !== r.chainHash) {
      flag({ sequence: r.sequenceNumber, type: "hash_mismatch",
        detail: `Chain hash mismatch at seq ${r.sequenceNumber}` });
    }

    // (d) Verify HMAC digital signature
    const expectedSig = hmacSha256hex(r.currentRecordHash);
    if (expectedSig !== r.digitalSignature) {
      flag({ sequence: r.sequenceNumber, type: "signature_invalid",
        detail: `Digital signature invalid at seq ${r.sequenceNumber}` });
    }

    prevChainHash  = r.chainHash;
    prevRecordHash = r.currentRecordHash;
  }

  return {
    valid:                errors.length === 0,
    recordsChecked:       records.length,
    firstTamperedSequence,
    genesisHash:          records[0]?.currentRecordHash ?? null,
    latestChainHash:      records.at(-1)?.chainHash ?? null,
    errors,
  };
}

/** Fetch the full ordered chain for a decision (ascending by sequence). */
export async function getDecisionCustody(
  decisionId: number,
): Promise<ChainOfCustodyRecord[]> {
  return db
    .select()
    .from(chainOfCustodyTable)
    .where(eq(chainOfCustodyTable.decisionId, decisionId))
    .orderBy(chainOfCustodyTable.sequenceNumber);
}

export { type ChainOfCustodyRecord };
