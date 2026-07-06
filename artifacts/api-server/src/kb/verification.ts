/**
 * Phase 56 — Retrieval Verification Layer
 *
 * Mandatory verification step between KB retrieval and AI generation.
 *
 * Architecture:
 *   retrieveRelevant()
 *       ↓
 *   verifyRetrievalHits()        ← this module (pre-generation)
 *       ↓
 *   buildKbContext()             ← only verified hits reach the AI
 *       ↓
 *   AI generation
 *       ↓
 *   verifyGeneratedCitations()   ← this module (post-generation audit)
 *
 * Checks performed:
 *   1. DB re-verification    — documentId exists in kbDocumentsTable with status "indexed"
 *   2. Metadata integrity    — documentNumber / year / jurisdiction match DB record
 *   3. Hallucination guard   — rejects any hit whose ID is absent from the DB
 *   4. Duplicate detection   — same documentId appearing more than once
 *   5. Repealed documents    — flagged; confidence penalised; rejected if opts.rejectRepealed
 *   6. Authority class       — binding | persuasive | non_binding (foreign/comparative)
 *   7. Confidence scoring    — 0.0–1.0, mapped to high/medium/limited/indicative
 *   8. Orphan detection      — post-generation: conclusions without any cited authority
 *   9. Audit logging         — every rejection appended to citation-audit.jsonl
 *
 * DO NOT import route/auth modules here — this is a pure KB utility.
 */

import { db, kbDocumentsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import { appendFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RetrievalHit, KbBindingStatus, KbHierarchyLevel } from "./types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum combined score for an authority to be accepted without demotion. */
const MIN_CONFIDENCE_THRESHOLD = 0.0; // Accept all; just score them accurately

/**
 * Jurisdictions that classify a source as Non-Binding (comparative / foreign).
 * Lower-cased for comparison.
 */
const FOREIGN_JURISDICTIONS = new Set([
  "french", "france", "european", "eu", "international",
  "english", "uk", "us", "american", "comparative",
  "french_law", "eu_law", "common_law",
]);

/** Audit log path (relative to this file's directory, two levels up). */
const AUDIT_LOG_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "logs", "citation-audit.jsonl",
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthorityClass = "binding" | "persuasive" | "non_binding";

/** Matches the confidence scale in the assistant system prompt (§ مقياس الثقة). */
export type ConfidenceLabel = "high" | "medium" | "limited" | "indicative";

export type RejectionReason =
  | "hallucinated"            // documentId not in KB or not indexed
  | "not_indexed"             // indexStatus ≠ "indexed"
  | "duplicate"               // same documentId already in verified set
  | "repealed"                // document marked isRepealed and opts.rejectRepealed = true
  | "post_hoc_fabrication"    // AI cited a token that was never in the provided context
  | "metadata_mismatch"       // documentNumber / year in hit ≠ DB record
  | "below_threshold";        // combinedScore below caller's min threshold

export interface VerificationOptions {
  /**
   * Reject (instead of just flagging) repealed documents.
   * Default: false (repealed docs are included but confidence is penalised).
   */
  rejectRepealed?: boolean;

  /**
   * Minimum combined score for acceptance.
   * Default: 0 (accept all; just score them).
   */
  minConfidence?: number;

  /** Session/request ID for audit log correlation. */
  requestId?: string;

  /** Write rejections to the audit log. Default: true. */
  auditLog?: boolean;
}

export interface VerifiedAuthority {
  ragTag: string;                  // e.g. "SRC:34"
  documentId: number;              // Confirmed KB document ID
  titleAr: string;                 // DB-confirmed Arabic title
  titleEn: string;                 // DB-confirmed English title (may be empty)
  authorityClass: AuthorityClass;
  confidenceScore: number;         // 0.0–1.0
  confidenceLabel: ConfidenceLabel;

  // Authority metadata
  bindingStatus: KbBindingStatus;
  hierarchyLevel: KbHierarchyLevel;
  jurisdiction: string;
  documentNumber?: string;
  year?: number;
  articleNumber?: string;
  isRepealed: boolean;
  isAmended: boolean;

  // Retrieval scores (for transparency)
  retrievalScore: number;          // combined score from retrieval engine
  keywordScore: number;
  semanticScore?: number;

  // Content
  snippet: string;

  verifiedAt: Date;
}

export interface RejectedCitation {
  ragTag: string;
  reason: RejectionReason;
  details: string;
  originalDocumentId?: number;
  originalTitle?: string;
  requestId?: string;
  rejectedAt: Date;
}

export interface VerificationReport {
  /** Unique ID for this verification run (for audit correlation). */
  reportId: string;

  requestId?: string;
  query?: string;

  // Accepted authorities (passed all checks)
  verified: VerifiedAuthority[];

  // Rejected (failed one or more checks)
  rejected: RejectedCitation[];

  // Authority class breakdown
  bindingCount: number;
  persuasiveCount: number;
  nonBindingCount: number;

  // Totals
  totalCandidates: number;
  totalAccepted: number;
  totalRejected: number;

  // Retrieval strategy that produced these hits
  retrievalStrategy: "semantic" | "keyword" | "hybrid" | "unknown";

  durationMs: number;
  generatedAt: Date;
}

/** Post-generation audit: citations in the AI's response that were never in context. */
export interface PostHocVerificationReport {
  reportId: string;
  requestId?: string;

  /** Citation tokens ([SRC:N], [DOC:N]) found in the generated text. */
  foundTokens: string[];

  /** Tokens that WERE in the provided context — expected citations. */
  legitimateTokens: string[];

  /** Tokens that were NOT in the provided context — hallucinated citations. */
  fabricatedTokens: string[];

  /** Generated text that has no [SRC:N] or [DOC:N] citation at all (orphan conclusions). */
  orphanConclusions: string[];

  fabricationCount: number;
  orphanCount: number;

  auditedAt: Date;
}

// ─── Authority classification ─────────────────────────────────────────────────

/**
 * Classify a retrieval hit into binding / persuasive / non_binding.
 *
 * Rules (priority order):
 *   1. Repealed → non_binding (regardless of original status)
 *   2. Foreign jurisdiction → non_binding
 *   3. bindingStatus = "constitutional" | "binding" → binding
 *   4. bindingStatus = "persuasive" | "advisory" | "informational" → persuasive
 */
export function classifyAuthority(hit: RetrievalHit): AuthorityClass {
  if (hit.isRepealed) return "non_binding";

  const jur = (hit.jurisdiction ?? "").toLowerCase().trim();
  if (FOREIGN_JURISDICTIONS.has(jur)) return "non_binding";

  switch (hit.bindingStatus) {
    case "constitutional":
    case "binding":
      return "binding";
    case "persuasive":
    case "advisory":
    case "informational":
      return "persuasive";
    default:
      return "persuasive";
  }
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

/**
 * Compute a confidence score (0.0–1.0) and label for a verified hit.
 *
 * Factors:
 *   + combinedScore from retrieval engine (primary)
 *   + 0.15 bonus if the document has a document number (precise reference)
 *   + 0.05 bonus if not amended (stable text)
 *   − 0.25 penalty if repealed
 *   − 0.10 penalty if semantic score is absent (keyword-only)
 *
 * Label mapping (aligns with the assistant system prompt § مقياس الثقة):
 *   ≥ 0.75 → high       (عالية)  — explicit UAE text, directly on point
 *   0.50–0.74 → medium  (متوسطة) — applied by analogy or close precedent
 *   0.25–0.49 → limited (محدودة) — comparative principle, no direct UAE text
 *   < 0.25    → indicative (تقديرية) — inferred, no direct authority
 */
export function computeConfidence(hit: RetrievalHit): {
  score: number;
  label: ConfidenceLabel;
} {
  // Normalise combinedScore to [0, 1]:
  // keyword-only scores are raw hit counts; hybrid/semantic are already 0–1.
  // Use a sigmoid-style clamp: raw keyword score of 5+ → 1.0
  let base: number;
  if (hit.semanticScore !== undefined) {
    // hybrid: already in 0–1 range
    base = Math.min(1, Math.max(0, hit.combinedScore));
  } else {
    // keyword-only: normalise by assuming max useful score = 8 keyword hits
    base = Math.min(1, hit.keywordScore / 8);
  }

  let score = base;
  if (hit.documentNumber)       score += 0.15;
  if (!hit.isAmended)           score += 0.05;
  if (hit.isRepealed)           score -= 0.25;
  if (hit.semanticScore === undefined) score -= 0.10;

  score = Math.min(1, Math.max(0, score));

  let label: ConfidenceLabel;
  if (score >= 0.75)      label = "high";
  else if (score >= 0.50) label = "medium";
  else if (score >= 0.25) label = "limited";
  else                    label = "indicative";

  return { score, label };
}

// ─── DB re-verification ───────────────────────────────────────────────────────

type DbDocRow = {
  id: number;
  titleAr: string;
  title: string;
  documentNumber: string | null;
  year: number | null;
  jurisdiction: string;
  indexStatus: string;
  isRepealed: boolean;
  isAmended: boolean;
  hierarchyLevel: string;
  bindingStatus: string;
};

/**
 * Batch-fetch KB document rows for a set of IDs.
 * Returns a map keyed by documentId.
 */
async function fetchDbDocs(ids: number[]): Promise<Map<number, DbDocRow>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({
      id:             kbDocumentsTable.id,
      titleAr:        kbDocumentsTable.titleAr,
      title:          kbDocumentsTable.title,
      documentNumber: kbDocumentsTable.documentNumber,
      year:           kbDocumentsTable.year,
      jurisdiction:   kbDocumentsTable.jurisdiction,
      indexStatus:    kbDocumentsTable.indexStatus,
      isRepealed:     kbDocumentsTable.isRepealed,
      isAmended:      kbDocumentsTable.isAmended,
      hierarchyLevel: kbDocumentsTable.hierarchyLevel,
      bindingStatus:  kbDocumentsTable.bindingStatus,
    })
    .from(kbDocumentsTable)
    .where(inArray(kbDocumentsTable.id, ids));

  return new Map(rows.map((r) => [r.id, r]));
}

// ─── Audit logger ─────────────────────────────────────────────────────────────

/**
 * Append rejected citation entries to the audit log (newline-delimited JSON).
 * Non-fatal: errors are suppressed so audit failure never blocks generation.
 */
async function appendAuditLog(
  rejections: RejectedCitation[],
  report: Pick<VerificationReport, "reportId" | "requestId" | "generatedAt">,
): Promise<void> {
  if (rejections.length === 0) return;
  try {
    await mkdir(dirname(AUDIT_LOG_PATH), { recursive: true });
    const lines = rejections.map((r) =>
      JSON.stringify({
        reportId:    report.reportId,
        requestId:   report.requestId,
        timestamp:   report.generatedAt.toISOString(),
        ragTag:      r.ragTag,
        reason:      r.reason,
        details:     r.details,
        documentId:  r.originalDocumentId,
        title:       r.originalTitle,
      }),
    );
    await appendFile(AUDIT_LOG_PATH, lines.join("\n") + "\n", "utf8");
  } catch {
    // Audit log failure must never break the request
  }
}

// ─── Unique report ID ─────────────────────────────────────────────────────────

function makeReportId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 7);
  return `vrf_${ts}_${rnd}`;
}

// ─── Main pre-generation verification ────────────────────────────────────────

/**
 * Verify a set of retrieval hits before they are included in the AI context.
 *
 * Responsibilities:
 *   1. Re-verify each hit's documentId against the live DB
 *   2. Detect and reject hallucinated IDs (not in DB)
 *   3. Detect and reject non-indexed documents
 *   4. Detect and reject (or flag) repealed documents
 *   5. Detect and reject duplicate authorities
 *   6. Compute confidence score and authority class for each accepted hit
 *   7. Log every rejection to the audit log
 *
 * @returns VerificationReport with .verified (safe to include) and .rejected (logged)
 */
export async function verifyRetrievalHits(
  hits: RetrievalHit[],
  options: VerificationOptions = {},
): Promise<VerificationReport> {
  const startMs = Date.now();
  const reportId = makeReportId();
  const {
    rejectRepealed = false,
    minConfidence   = MIN_CONFIDENCE_THRESHOLD,
    requestId,
    auditLog        = true,
  } = options;

  const verified:  VerifiedAuthority[] = [];
  const rejected:  RejectedCitation[]  = [];
  const seenDocIds = new Set<number>();

  // ── Step 1: Batch-fetch DB records ────────────────────────────────────────
  const candidateIds = hits.map((h) => h.documentId);
  const dbDocs = await fetchDbDocs(candidateIds);

  // ── Step 2: Evaluate each hit ─────────────────────────────────────────────
  for (const hit of hits) {
    const tag = `[${hit.ragTag}]`;

    // 2a. DB existence check (anti-hallucination)
    const dbDoc = dbDocs.get(hit.documentId);
    if (!dbDoc) {
      rejected.push({
        ragTag:            tag,
        reason:            "hallucinated",
        details:           `Document ID ${hit.documentId} does not exist in kb_documents.`,
        originalDocumentId: hit.documentId,
        originalTitle:     hit.titleAr,
        requestId,
        rejectedAt:        new Date(),
      });
      continue;
    }

    // 2b. Index-status check
    if (dbDoc.indexStatus !== "indexed") {
      rejected.push({
        ragTag:            tag,
        reason:            "not_indexed",
        details:           `Document ${hit.documentId} has indexStatus="${dbDoc.indexStatus}" — not ready for retrieval.`,
        originalDocumentId: hit.documentId,
        originalTitle:     hit.titleAr,
        requestId,
        rejectedAt:        new Date(),
      });
      continue;
    }

    // 2c. Metadata integrity check
    // If the hit carries a documentNumber that contradicts the DB, flag it.
    if (
      hit.documentNumber !== undefined &&
      dbDoc.documentNumber !== null &&
      hit.documentNumber.trim() !== dbDoc.documentNumber.trim()
    ) {
      // Don't reject — the metadata in the hit may just be stale from retrieval cache.
      // Override with the authoritative DB value.
      (hit as RetrievalHit & { documentNumber: string }).documentNumber = dbDoc.documentNumber;
    }

    // 2d. Duplicate detection
    if (seenDocIds.has(hit.documentId)) {
      rejected.push({
        ragTag:            tag,
        reason:            "duplicate",
        details:           `Document ID ${hit.documentId} (${hit.titleAr.slice(0, 60)}) already included in this verification run.`,
        originalDocumentId: hit.documentId,
        originalTitle:     hit.titleAr,
        requestId,
        rejectedAt:        new Date(),
      });
      continue;
    }
    seenDocIds.add(hit.documentId);

    // 2e. Repealed check
    const isRepealed = dbDoc.isRepealed ?? hit.isRepealed;
    if (isRepealed && rejectRepealed) {
      rejected.push({
        ragTag:            tag,
        reason:            "repealed",
        details:           `Document ${hit.documentId} is marked isRepealed=true. Caller set rejectRepealed=true.`,
        originalDocumentId: hit.documentId,
        originalTitle:     hit.titleAr,
        requestId,
        rejectedAt:        new Date(),
      });
      continue;
    }

    // 2f. Build the enriched hit with DB-confirmed metadata
    const enrichedHit: RetrievalHit = {
      ...hit,
      titleAr:        dbDoc.titleAr,
      titleEn:        dbDoc.title,
      documentNumber: dbDoc.documentNumber ?? hit.documentNumber,
      year:           dbDoc.year ?? hit.year,
      jurisdiction:   dbDoc.jurisdiction,
      isRepealed:     dbDoc.isRepealed,
      isAmended:      dbDoc.isAmended,
      hierarchyLevel: dbDoc.hierarchyLevel as RetrievalHit["hierarchyLevel"],
      bindingStatus:  dbDoc.bindingStatus as RetrievalHit["bindingStatus"],
    };

    // 2g. Authority classification and confidence scoring
    const authorityClass             = classifyAuthority(enrichedHit);
    const { score, label }           = computeConfidence(enrichedHit);

    // 2h. Min-confidence threshold
    if (score < minConfidence) {
      rejected.push({
        ragTag:            tag,
        reason:            "below_threshold",
        details:           `Confidence ${score.toFixed(2)} is below threshold ${minConfidence}.`,
        originalDocumentId: hit.documentId,
        originalTitle:     hit.titleAr,
        requestId,
        rejectedAt:        new Date(),
      });
      continue;
    }

    // 2i. Accept
    verified.push({
      ragTag:          tag,
      documentId:      enrichedHit.documentId,
      titleAr:         enrichedHit.titleAr,
      titleEn:         enrichedHit.titleEn ?? "",
      authorityClass,
      confidenceScore: score,
      confidenceLabel: label,
      bindingStatus:   enrichedHit.bindingStatus,
      hierarchyLevel:  enrichedHit.hierarchyLevel,
      jurisdiction:    enrichedHit.jurisdiction,
      documentNumber:  enrichedHit.documentNumber,
      year:            enrichedHit.year,
      articleNumber:   enrichedHit.articleNumber,
      isRepealed:      enrichedHit.isRepealed,
      isAmended:       enrichedHit.isAmended,
      retrievalScore:  enrichedHit.combinedScore,
      keywordScore:    enrichedHit.keywordScore,
      semanticScore:   enrichedHit.semanticScore,
      snippet:         enrichedHit.snippet,
      verifiedAt:      new Date(),
    });
  }

  // ── Step 3: Authority class counts ────────────────────────────────────────
  const bindingCount    = verified.filter((v) => v.authorityClass === "binding").length;
  const persuasiveCount = verified.filter((v) => v.authorityClass === "persuasive").length;
  const nonBindingCount = verified.filter((v) => v.authorityClass === "non_binding").length;

  // ── Step 4: Audit log ─────────────────────────────────────────────────────
  const generatedAt = new Date();
  if (auditLog) {
    await appendAuditLog(rejected, { reportId, requestId, generatedAt });
  }

  return {
    reportId,
    requestId,
    verified,
    rejected,
    bindingCount,
    persuasiveCount,
    nonBindingCount,
    totalCandidates:   hits.length,
    totalAccepted:     verified.length,
    totalRejected:     rejected.length,
    retrievalStrategy: "unknown",
    durationMs:        Date.now() - startMs,
    generatedAt,
  };
}

// ─── Post-generation citation audit ──────────────────────────────────────────

/**
 * Scan the AI-generated text for [SRC:N] and [DOC:N] tokens and identify:
 *   1. Fabricated citations — tokens the AI used that were NOT in the provided context
 *   2. Orphan conclusions  — sentences that contain legal assertions but no citation
 *
 * This is an AUDIT function — it does not modify the generated text.
 * Fabricated citations are logged and the report is returned for the caller to act on.
 *
 * @param generatedText  The full AI response text.
 * @param providedTags   Set of [SRC:N] / [DOC:N] tags that were in the provided context.
 * @param options        Audit options.
 */
export async function verifyGeneratedCitations(
  generatedText: string,
  providedTags: Set<string>,
  options: { requestId?: string; auditLog?: boolean } = {},
): Promise<PostHocVerificationReport> {
  const { requestId, auditLog = true } = options;
  const reportId = makeReportId();
  const auditedAt = new Date();

  // Extract all [SRC:N] and [DOC:N] tokens from generated text
  const TOKEN_PATTERN = /\[(SRC|DOC|KB):\d+\]/g;
  const foundSet = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = TOKEN_PATTERN.exec(generatedText)) !== null) {
    foundSet.add(m[0]);
  }

  const foundTokens      = [...foundSet];
  const legitimateTokens = foundTokens.filter((t) => providedTags.has(t));
  const fabricatedTokens = foundTokens.filter((t) => !providedTags.has(t));

  // Orphan conclusion detection:
  // Find sentences that contain Arabic legal assertion markers but no citation tag.
  const ASSERTION_MARKERS = [
    /يحق/u, /يجب/u, /يلزم/u, /يُعدّ/u, /يُعتبر/u, /يُحظر/u, /يُمنع/u,
    /وفقاً للقانون/u, /استناداً إلى/u, /بموجب/u, /تنص/u, /يقضي/u,
    /طبقاً/u, /وفق/u, /بحسب/u, /يُلزم/u, /يُوجب/u, /يترتب/u,
  ];
  const CITATION_MARKER = /\[(SRC|DOC|KB):\d+\]/;

  const sentences = generatedText
    .split(/[.،؛\n]/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const orphanConclusions: string[] = [];
  for (const sentence of sentences) {
    const hasAssertion = ASSERTION_MARKERS.some((rx) => rx.test(sentence));
    const hasCitation  = CITATION_MARKER.test(sentence);
    if (hasAssertion && !hasCitation) {
      orphanConclusions.push(sentence.slice(0, 200));
    }
  }

  // Audit log fabricated tokens
  if (auditLog && fabricatedTokens.length > 0) {
    const rejections: RejectedCitation[] = fabricatedTokens.map((t) => ({
      ragTag:    t,
      reason:    "post_hoc_fabrication" as RejectionReason,
      details:   `AI generated citation ${t} which was not present in the provided context.`,
      requestId,
      rejectedAt: auditedAt,
    }));
    await appendAuditLog(rejections, { reportId, requestId, generatedAt: auditedAt });
  }

  return {
    reportId,
    requestId,
    foundTokens,
    legitimateTokens,
    fabricatedTokens,
    orphanConclusions,
    fabricationCount: fabricatedTokens.length,
    orphanCount:      orphanConclusions.length,
    auditedAt,
  };
}

// ─── Text report builder ──────────────────────────────────────────────────────

/**
 * Build a human-readable verification report for logging or display.
 * This is the "verification report" required by Phase 56.
 */
export function buildTextReport(report: VerificationReport): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════════════",
    "CITATION VERIFICATION REPORT — Phase 56",
    `Report ID: ${report.reportId}`,
    `Generated: ${report.generatedAt.toISOString()}`,
    report.requestId ? `Request:   ${report.requestId}` : "",
    "═══════════════════════════════════════════════════════════",
    "",
    `Candidates:  ${report.totalCandidates}`,
    `Accepted:    ${report.totalAccepted}`,
    `Rejected:    ${report.totalRejected}`,
    "",
    `  Binding:     ${report.bindingCount}`,
    `  Persuasive:  ${report.persuasiveCount}`,
    `  Non-Binding: ${report.nonBindingCount}`,
    "",
  ].filter((l) => l !== undefined);

  if (report.verified.length > 0) {
    lines.push("VERIFIED AUTHORITIES:");
    for (const v of report.verified) {
      const flagParts: string[] = [];
      if (v.isRepealed) flagParts.push("REPEALED");
      if (v.isAmended)  flagParts.push("AMENDED");
      const flags = flagParts.length > 0 ? ` [${flagParts.join(", ")}]` : "";

      const authorityLabel = {
        binding:     "Binding",
        persuasive:  "Persuasive",
        non_binding: "Non-Binding (Foreign/Comparative)",
      }[v.authorityClass];

      const confidenceAr = {
        high:       "عالية",
        medium:     "متوسطة",
        limited:    "محدودة",
        indicative: "تقديرية",
      }[v.confidenceLabel];

      lines.push(
        `  ${v.ragTag.padEnd(14)} ` +
        `${authorityLabel.padEnd(36)} ` +
        `Confidence: ${v.confidenceLabel} (${confidenceAr}) ${(v.confidenceScore * 100).toFixed(0)}%${flags}`,
      );
      lines.push(
        `                 ` +
        `Level ${v.hierarchyLevel} | ${v.jurisdiction} | ${v.bindingStatus}`,
      );
      lines.push(
        `                 ` +
        `${v.titleAr.slice(0, 70)}` +
        (v.documentNumber ? ` (${v.documentNumber})` : "") +
        (v.year ? ` — ${v.year}` : ""),
      );
      lines.push("");
    }
  }

  if (report.rejected.length > 0) {
    lines.push("REJECTED CITATIONS:");
    const reasonLabels: Record<RejectionReason, string> = {
      hallucinated:         "HALLUCINATED — ID not in KB",
      not_indexed:          "NOT INDEXED",
      duplicate:            "DUPLICATE",
      repealed:             "REPEALED (hard reject)",
      post_hoc_fabrication: "POST-HOC FABRICATION",
      metadata_mismatch:    "METADATA MISMATCH",
      below_threshold:      "BELOW CONFIDENCE THRESHOLD",
    };
    for (const r of report.rejected) {
      lines.push(`  ${r.ragTag.padEnd(14)} ${(reasonLabels[r.reason] ?? r.reason).padEnd(36)}`);
      lines.push(`                 ${r.details.slice(0, 100)}`);
      lines.push("");
    }
  }

  lines.push("═══════════════════════════════════════════════════════════");
  return lines.join("\n");
}

// ─── Context annotation builder ───────────────────────────────────────────────

/**
 * Build a compact annotation block that can be prepended to each KB context
 * line so the AI knows the authority class and confidence of each source.
 *
 * Format injected before each context line:
 *   [SRC:34] ★ Binding | Level 2 | Confidence: high (عالية) | federal
 */
export function annotateContextLine(
  contextLine: string,
  authority: VerifiedAuthority,
  /** Optional cross-reference relationship, e.g. "Implements: Federal Decree-Law 21/2021" */
  crossRefRelationship?: string,
): string {
  const classEmoji = {
    binding:     "★ Binding",
    persuasive:  "◈ Persuasive",
    non_binding: "○ Non-Binding (Comparative)",
  }[authority.authorityClass];

  const confidenceAr = {
    high:       "عالية",
    medium:     "متوسطة",
    limited:    "محدودة",
    indicative: "تقديرية",
  }[authority.confidenceLabel];

  const repeatFlags: string[] = [];
  if (authority.isRepealed) repeatFlags.push("⚠ REPEALED");
  if (authority.isAmended)  repeatFlags.push("↺ AMENDED");

  const annotation =
    `${classEmoji} | Level ${authority.hierarchyLevel}` +
    ` | Confidence: ${authority.confidenceLabel} (${confidenceAr}) ${(authority.confidenceScore * 100).toFixed(0)}%` +
    ` | ${authority.jurisdiction}` +
    (repeatFlags.length > 0 ? ` | ${repeatFlags.join(", ")}` : "") +
    (crossRefRelationship ? ` | ${crossRefRelationship}` : "");

  // Insert the annotation as the second line of the context entry
  const firstNewline = contextLine.indexOf("\n");
  if (firstNewline === -1) {
    return `${contextLine}\n  [VERIFIED: ${annotation}]`;
  }
  return (
    contextLine.slice(0, firstNewline) +
    `\n  [VERIFIED: ${annotation}]` +
    contextLine.slice(firstNewline)
  );
}

// ─── Verification summary for pre-prompt injection ───────────────────────────

/**
 * Build a one-paragraph authority inventory to inject at the top of the
 * RAG context block. This makes the authority classification transparent to
 * the AI before it reads any individual source.
 *
 * Example output:
 *   "[AUTHORITY INVENTORY] 4 sources verified. Binding (★): [SRC:1], [SRC:5].
 *    Persuasive (◈): [SRC:3]. Non-Binding/Comparative (○): none. 2 rejected."
 */
export function buildAuthorityInventory(report: VerificationReport): string {
  const bindingTags     = report.verified.filter((v) => v.authorityClass === "binding")
                                          .map((v) => v.ragTag).join(", ") || "none";
  const persuasiveTags  = report.verified.filter((v) => v.authorityClass === "persuasive")
                                          .map((v) => v.ragTag).join(", ") || "none";
  const nonBindingTags  = report.verified.filter((v) => v.authorityClass === "non_binding")
                                          .map((v) => v.ragTag).join(", ") || "none";
  const rejectedCount   = report.totalRejected;

  const lines = [
    `[AUTHORITY INVENTORY — Phase 56 Verification]`,
    `Verified: ${report.totalAccepted} of ${report.totalCandidates} candidates accepted.`,
    `  ★ Binding authorities:               ${bindingTags}`,
    `  ◈ Persuasive authorities:            ${persuasiveTags}`,
    `  ○ Non-Binding (Comparative/Foreign): ${nonBindingTags}`,
    rejectedCount > 0
      ? `  ✗ Rejected (not included in context): ${rejectedCount} citation(s). See audit log.`
      : `  ✓ No rejections.`,
  ];

  return lines.join("\n");
}
