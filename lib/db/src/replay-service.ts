/**
 * Decision Replay Engine — Service
 * Writes immutable replay event rows after stage completion.
 * Called from the stage-complete API endpoint.
 */
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import {
  decisionReplayEventsTable,
  STAGE_KEY_TO_REPLAY_STAGE,
  type InsertDecisionReplayEvent,
} from "./schema/replay";
import { evidenceLedgerTable } from "./schema/evidence";
import { decisionStagesTable } from "./schema/decisions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecordReplayEventInput {
  decisionId: number;
  stageKey: string;
  actor: string;
  actorRole?: string | null;
  aiModelName?: string | null;
  /** Raw prompt text — will be SHA-256-hashed before storage */
  promptText?: string | null;
  confidenceScore?: number | null;
  legalReferences?: string[];
  constitutionalReferences?: string[];
  adminLawReferences?: string[];
  reasoningNarrative?: string | null;
  appliedLegalWeight?: number | null;
  alShamsiDimensions?: Record<string, unknown> | null;
  riskIndicators?: string[];
  humanInterventionRecord?: Record<string, unknown> | null;
  /** ID of the audit_logs row created for this stage completion */
  immutableLogId?: number | null;
}

export interface ReplayEventRecord {
  id: number;
  decisionId: number;
  replayStageKey: string;
  sourceStageKey: string | null;
  actor: string | null;
  actorRole: string | null;
  aiModelName: string | null;
  promptHash: string | null;
  confidenceScore: number | null;
  legalReferences: string[] | null;
  constitutionalReferences: string[] | null;
  adminLawReferences: string[] | null;
  evidenceSnapshot: Record<string, unknown>[] | null;
  reasoningNarrative: string | null;
  appliedLegalWeight: number | null;
  alShamsiDimensions: Record<string, unknown> | null;
  riskIndicators: string[] | null;
  humanInterventionRecord: Record<string, unknown> | null;
  auditHash: string;
  immutableLogId: number | null;
  recordedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashPrompt(promptText: string): string {
  return createHash("sha256").update(promptText).digest("hex");
}

function computeReplayAuditHash(
  decisionId: number,
  replayStageKey: string,
  actor: string,
  recordedAt: string,
  content: Record<string, unknown>,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ decisionId, replayStageKey, actor, recordedAt, content }))
    .digest("hex");
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Write a decision_replay_events row after a stage is completed.
 * Idempotent: uses ON CONFLICT DO NOTHING (replay key is unique per decision).
 * Never throws — errors are logged but do not block stage completion.
 */
export async function recordReplayEvent(input: RecordReplayEventInput): Promise<void> {
  const replayStageKey = STAGE_KEY_TO_REPLAY_STAGE[input.stageKey];
  if (!replayStageKey) {
    // This stage key has no replay mapping — skip silently
    return;
  }

  const recordedAt = new Date().toISOString();
  const promptHash = input.promptText ? hashPrompt(input.promptText) : null;

  // Snapshot relevant evidence ledger entries for this decision at this moment
  let evidenceSnapshot: Record<string, unknown>[] = [];
  try {
    const evidenceRows = await db
      .select({
        id: evidenceLedgerTable.id,
        action: evidenceLedgerTable.action,
        eventCategory: evidenceLedgerTable.eventCategory,
        evidenceSummaryAr: evidenceLedgerTable.evidenceSummaryAr,
        timestamp: evidenceLedgerTable.timestamp,
        actor: evidenceLedgerTable.actor,
        actorRole: evidenceLedgerTable.actorRole,
        currentHash: evidenceLedgerTable.currentHash,
      })
      .from(evidenceLedgerTable)
      .where(eq(evidenceLedgerTable.decisionId, input.decisionId))
      .limit(20);
    evidenceSnapshot = evidenceRows as unknown as Record<string, unknown>[];
  } catch {
    // Non-fatal — snapshot is advisory
  }

  // Extract legal/constitutional references from stage AI analysis if not provided
  let legalRefs = input.legalReferences ?? [];
  let constRefs = input.constitutionalReferences ?? [];
  let adminRefs = input.adminLawReferences ?? [];
  let reasoning = input.reasoningNarrative;

  if (!reasoning || legalRefs.length === 0) {
    try {
      const [stageRecord] = await db
        .select({
          aiAnalysis: decisionStagesTable.aiAnalysis,
          stageData: decisionStagesTable.stageData,
        })
        .from(decisionStagesTable)
        .where(
          and(
            eq(decisionStagesTable.decisionId, input.decisionId),
            eq(decisionStagesTable.stageKey, input.stageKey),
          ),
        );

      if (stageRecord) {
        const analysis = (stageRecord.aiAnalysis as Record<string, unknown>) ?? {};
        const data = (stageRecord.stageData as Record<string, unknown>) ?? {};

        if (!reasoning) {
          reasoning = (analysis.stageSummary as string) ??
                      (analysis.aiContribution as string) ??
                      null;
        }

        if (legalRefs.length === 0) {
          const cited = analysis.citedInstruments;
          if (Array.isArray(cited)) legalRefs = cited as string[];

          // Extract from stage data fields
          const fields = ["primaryLaw", "specificArticles", "authorityLegalBasis", "regulatoryInstruments"];
          for (const f of fields) {
            if (data[f] && typeof data[f] === "string") {
              legalRefs.push(data[f] as string);
            }
          }
        }

        if (constRefs.length === 0) {
          const cflags = analysis.constitutionalFlags;
          if (Array.isArray(cflags)) constRefs = cflags as string[];
        }
      }
    } catch {
      // Non-fatal
    }
  }

  const contentForHash = {
    stageKey: input.stageKey,
    legalRefs,
    constRefs,
    adminRefs,
    reasoning,
    aiModel: input.aiModelName,
    promptHash,
    weight: input.appliedLegalWeight,
  };

  const auditHash = computeReplayAuditHash(
    input.decisionId,
    replayStageKey,
    input.actor,
    recordedAt,
    contentForHash,
  );

  const row: InsertDecisionReplayEvent = {
    decisionId: input.decisionId,
    replayStageKey,
    sourceStageKey: input.stageKey,
    actor: input.actor,
    actorRole: input.actorRole ?? null,
    aiModelName: input.aiModelName ?? null,
    promptHash,
    confidenceScore: input.confidenceScore ?? null,
    legalReferences: legalRefs.length > 0 ? legalRefs : null,
    constitutionalReferences: constRefs.length > 0 ? constRefs : null,
    adminLawReferences: adminRefs.length > 0 ? adminRefs : null,
    evidenceSnapshot: evidenceSnapshot.length > 0 ? evidenceSnapshot : null,
    reasoningNarrative: reasoning ?? null,
    appliedLegalWeight: input.appliedLegalWeight ?? null,
    alShamsiDimensions: input.alShamsiDimensions ?? null,
    riskIndicators: input.riskIndicators && input.riskIndicators.length > 0 ? input.riskIndicators : null,
    humanInterventionRecord: input.humanInterventionRecord ?? null,
    auditHash,
    immutableLogId: input.immutableLogId ?? null,
    // Explicitly store the SAME timestamp used in auditHash computation so
    // verifyReplayEventHash() can deterministically recompute the hash from
    // the stored row without timestamp drift (DB defaultNow() ≠ app-side timestamp).
    recordedAt: new Date(recordedAt),
  };

  await db
    .insert(decisionReplayEventsTable)
    .values(row)
    .onConflictDoNothing();
}

/**
 * Retrieve all replay events for a decision, ordered by replayStageKey.
 */
export async function getReplayEvents(decisionId: number): Promise<ReplayEventRecord[]> {
  const rows = await db
    .select()
    .from(decisionReplayEventsTable)
    .where(eq(decisionReplayEventsTable.decisionId, decisionId))
    .orderBy(decisionReplayEventsTable.replayStageKey);

  return rows as ReplayEventRecord[];
}

/**
 * Verify the audit hash of a replay event.
 * Returns true if the hash matches the recomputed value.
 */
export function verifyReplayEventHash(event: ReplayEventRecord): boolean {
  const contentForHash = {
    stageKey: event.sourceStageKey ?? event.replayStageKey,
    legalRefs: event.legalReferences ?? [],
    constRefs: event.constitutionalReferences ?? [],
    adminRefs: event.adminLawReferences ?? [],
    reasoning: event.reasoningNarrative,
    aiModel: event.aiModelName,
    promptHash: event.promptHash,
    weight: event.appliedLegalWeight,
  };

  const expected = computeReplayAuditHash(
    event.decisionId,
    event.replayStageKey,
    event.actor ?? "",
    event.recordedAt.toISOString(),
    contentForHash,
  );

  return expected === event.auditHash;
}
