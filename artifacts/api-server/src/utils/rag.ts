/**
 * Shared RAG utilities — used by both /assistant and /legal-os routes.
 * Exported so both routers can import without duplicating code.
 *
 * Phase 56 additions:
 *   • KB_ID_OFFSET (100000) — separates kbDocumentsTable IDs from legalSourcesTable IDs
 *     in the [SRC:N] tag namespace so the two sources never collide.
 *   • buildContext() now calls buildKbContext() concurrently and merges verified
 *     KB sources into the RAG context block under [SRC:{id + KB_ID_OFFSET}] tags.
 *     The authority inventory from buildAuthorityInventory() has its raw [SRC:{id}] tags
 *     rewritten to [SRC:{id + KB_ID_OFFSET}] (idempotent: only IDs < KB_ID_OFFSET are offset).
 *   • resolveCitations() handles the extended range: sourceId ≥ KB_ID_OFFSET →
 *     look up kbDocumentsTable; sourceId < KB_ID_OFFSET → legalSourcesTable (unchanged).
 *     Also handles [KB:N] prefix (raw KB doc ID, no offset). Fabricated citations
 *     (tokens not in sourceIndex) are filtered out and logged to citation-audit.jsonl.
 *   • buildContext() returns an optional verificationReport for callers that want
 *     to log or surface the Phase 56 verification results.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db, documentsTable, legalSourcesTable, kbDocumentsTable } from "@workspace/db";
import { buildKbContext } from "../kb/retrieval.js";
import { verifyGeneratedCitations } from "../kb/verification.js";
import type { VerificationReport } from "../kb/verification.js";

/** Characters per chunk when splitting large documents */
export const CHUNK_CHARS = 1200;
/** Chunk overlap to preserve sentence context */
export const CHUNK_OVERLAP = 150;
/** Number of most-relevant document chunks to include per source */
export const CHUNKS_PER_SOURCE = 3;
/** Top-K sources to include in the final RAG context */
export const TOP_K = 8;

/**
 * Phase 56 — ID offset that maps kbDocumentsTable IDs into the [SRC:N] namespace
 * without colliding with legalSourcesTable IDs.
 *
 * legalSourcesTable IDs: 1 … (small, manually curated)
 * kbDocumentsTable IDs:  1 … N (can grow to thousands)
 *
 * A KB document with id=34 appears in context as [SRC:100034] and is resolved
 * back to kbDocumentsTable row 34 when sourceId ≥ KB_ID_OFFSET.
 */
export const KB_ID_OFFSET = 100_000;

/** Number of KB sources to include per buildContext() call (alongside legacy sources). */
const KB_TOP_K = 5;

// ─── Keyword relevance scoring ─────────────────────────────────────────────────

export function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function relevanceScore(query: Set<string>, text: string): number {
  if (!text) return 0;
  const words = tokenise(text);
  let hits = 0;
  for (const q of query) if (words.has(q)) hits++;
  return hits;
}

/**
 * Split text into overlapping chunks and return the K most query-relevant ones.
 */
export function topChunks(text: string, query: Set<string>, k = CHUNKS_PER_SOURCE): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
    chunks.push(text.slice(i, i + CHUNK_CHARS));
    if (chunks.length > 200) break;
  }
  if (chunks.length <= k) return chunks;
  return chunks
    .map((c) => ({ c, score: relevanceScore(query, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c);
}

// ─── Query-aware RAG context builder ──────────────────────────────────────────

export async function buildContext(
  query: string,
  userId: number,
  pinnedDocIds: number[] = [],
  pinnedSrcIds: number[] = [],
): Promise<{
  context: string;
  sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>;
  /** Phase 56: Verification report from KB retrieval (undefined if KB returned no hits). */
  verificationReport?: VerificationReport;
}> {
  const queryTokens = tokenise(query);
  const sourceIndex = new Map<string, { title: string; type: "document" | "legal_source" }>();

  // ── Phase 56: Kick off KB retrieval concurrently alongside legacy sources ──
  const kbContextPromise = buildKbContext(query, { topK: KB_TOP_K }).catch(() => null);

  const [metaDocs, metaSrcs] = await Promise.all([
    db
      .select({ id: documentsTable.id, name: documentsTable.originalName, keywords: documentsTable.keywords })
      .from(documentsTable)
      .where(eq(documentsTable.uploadedById, userId)),
    db
      .select({
        id:              legalSourcesTable.id,
        title:           legalSourcesTable.title,
        titleAr:         legalSourcesTable.titleAr,
        jurisdiction:    legalSourcesTable.jurisdiction,
        referenceNumber: legalSourcesTable.referenceNumber,
        year:            legalSourcesTable.year,
        keywords:        legalSourcesTable.subject,
        summaryAr:       legalSourcesTable.summaryAr,
        summary:         legalSourcesTable.summary,
      })
      .from(legalSourcesTable),
  ]);

  const scoredDocIds = metaDocs
    .map((d) => ({
      id:    d.id,
      name:  d.name,
      score: pinnedDocIds.includes(d.id)
        ? 9999
        : relevanceScore(queryTokens, `${d.name} ${d.keywords ?? ""}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((d) => ({ id: d.id, name: d.name }));

  const scoredSrcIds = metaSrcs
    .map((s) => ({
      id:          s.id,
      title:       s.titleAr ?? s.title,
      titleEn:     s.title,
      jurisdiction: s.jurisdiction,
      referenceNumber: s.referenceNumber,
      year:        s.year,
      summaryText: s.summaryAr ?? s.summary ?? "",
      score:       pinnedSrcIds.includes(s.id)
        ? 9999
        : relevanceScore(queryTokens, `${s.title} ${s.titleAr ?? ""} ${s.summaryAr ?? s.summary ?? ""} ${s.keywords ?? ""}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  const [fullDocs, fullSrcs] = await Promise.all([
    scoredDocIds.length > 0
      ? db
          .select({ id: documentsTable.id, content: documentsTable.content })
          .from(documentsTable)
          .where(inArray(documentsTable.id, scoredDocIds.map((d) => d.id)))
      : Promise.resolve([]),
    scoredSrcIds.length > 0
      ? db
          .select({ id: legalSourcesTable.id, content: legalSourcesTable.content, summaryAr: legalSourcesTable.summaryAr, summary: legalSourcesTable.summary })
          .from(legalSourcesTable)
          .where(inArray(legalSourcesTable.id, scoredSrcIds.map((s) => s.id)))
      : Promise.resolve([]),
  ]);

  const docContentMap = new Map(fullDocs.map((d) => [d.id, d.content]));
  const srcContentMap = new Map(fullSrcs.map((s) => [s.id, s.summaryAr ?? s.summary ?? s.content]));

  const parts: string[] = [];

  for (const doc of scoredDocIds) {
    const content = docContentMap.get(doc.id) ?? "";
    const chunks  = topChunks(content, queryTokens);
    const tag     = `DOC:${doc.id}`;
    sourceIndex.set(tag, { title: doc.name, type: "document" });
    parts.push(
      `[${tag}] ${doc.name}\n` +
      (chunks.length > 0 ? chunks.join("\n…\n") : "(no text content available)"),
    );
  }

  for (const src of scoredSrcIds) {
    const text   = srcContentMap.get(src.id) ?? src.summaryText;
    const chunks = topChunks(text, queryTokens, 2);
    const tag    = `SRC:${src.id}`;
    sourceIndex.set(tag, { title: src.title, type: "legal_source" });
    parts.push(
      `[${tag}] ${src.title}` +
      (src.referenceNumber ? ` (${src.referenceNumber})` : "") +
      (src.year ? `, ${src.year}` : "") +
      ` — ${src.jurisdiction}\n` +
      (chunks.length > 0 ? chunks.join("\n…\n") : "(no content available)"),
    );
  }

  // ── Phase 56: Merge verified KB sources ────────────────────────────────────
  const kbResult = await kbContextPromise;
  let verificationReport: VerificationReport | undefined;

  if (kbResult && kbResult.entries.length > 0) {
    verificationReport = kbResult.report;

    // Fix 1: Replace every raw [SRC:{rawId}] tag in the authority inventory
    // with the offset version [SRC:{rawId + KB_ID_OFFSET}] so the model only
    // ever sees the canonical offset tag — preventing resolution misrouting.
    // Guard: only offset IDs that are < KB_ID_OFFSET (idempotent — prevents
    // double-offsetting if a tag is somehow already in the offset range).
    const offsetInventory = kbResult.inventory.replace(
      /\[SRC:(\d+)\]/g,
      (match, rawIdStr) => {
        const rawId = parseInt(rawIdStr, 10);
        return rawId < KB_ID_OFFSET ? `[SRC:${rawId + KB_ID_OFFSET}]` : match;
      },
    );
    parts.push("─".repeat(50) + "\n" + offsetInventory);

    for (const entry of kbResult.entries) {
      // Offset the document ID to avoid collision with legalSourcesTable IDs.
      const offsetId  = entry.documentId + KB_ID_OFFSET;
      const offsetTag = `SRC:${offsetId}`;

      // Replace the original [SRC:{id}] tag in the context line with the offset tag.
      const offsetContextLine = entry.contextLine.replace(
        new RegExp(`\\[${entry.tag}\\]`, "g"),
        `[${offsetTag}]`,
      );

      sourceIndex.set(offsetTag, { title: entry.titleAr, type: "legal_source" });
      parts.push(offsetContextLine);
    }
  }

  return {
    context: parts.join("\n\n" + "─".repeat(50) + "\n\n"),
    sourceIndex,
    verificationReport,
  };
}

// ─── Citation helpers ──────────────────────────────────────────────────────────

export function extractCitationTokens(text: string): Array<{ token: string; prefix: string; sourceId: number }> {
  const pattern = /\[(DOC|SRC|KB):(\d+)\]/g;
  const seen    = new Set<string>();
  const results: Array<{ token: string; prefix: string; sourceId: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const token = match[0];
    if (seen.has(token)) continue;
    seen.add(token);
    results.push({ token, prefix: match[1], sourceId: parseInt(match[2], 10) });
  }
  return results;
}

export function makeDocCitations(doc: { originalName: string; uploadedAt: Date | string | null }): Record<string, string> {
  const title    = doc.originalName.replace(/\.[^.]+$/, "");
  const year     = doc.uploadedAt ? new Date(doc.uploadedAt).getFullYear() : new Date().getFullYear();
  const accessed = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return {
    harvard: `Unknown Author (${year}) '${title}'. [Document] (Accessed: ${accessed}).`,
    apa:     `Unknown Author. (${year}). ${title}. [Document].`,
    uaeGov:  `${title}، ${year}، الإمارات العربية المتحدة`,
  };
}

export function makeSrcCitations(src: {
  title: string; titleAr: string | null;
  referenceNumber: string | null; year: number | null; jurisdiction: string;
}): Record<string, string> {
  const titleAr = src.titleAr ?? src.title;
  const year    = src.year ?? new Date().getFullYear();
  const ref     = src.referenceNumber ? ` رقم ${src.referenceNumber}،` : "";
  return {
    harvard: `${titleAr} (${year}). ${src.jurisdiction}.`,
    apa:     `${titleAr}. (${year}). ${src.jurisdiction}.`,
    uaeGov:  `${titleAr}،${ref} سنة ${year}، ${src.jurisdiction}`,
  };
}

/** Build citation formats from a kbDocumentsTable row. */
function makeKbDocCitations(row: {
  titleAr: string; title: string;
  documentNumber: string | null; year: number | null; jurisdiction: string;
  authorityAr: string; hierarchyLevel: string; bindingStatus: string;
}): Record<string, string> {
  const titleAr = row.titleAr;
  const year    = row.year ?? new Date().getFullYear();
  const ref     = row.documentNumber ? ` رقم ${row.documentNumber}،` : "";
  return {
    harvard: `${titleAr} (${year}). ${row.jurisdiction}.`,
    apa:     `${titleAr}. (${year}). ${row.jurisdiction}.`,
    uaeGov:  `${titleAr}،${ref} سنة ${year}، ${row.jurisdiction} — المستوى ${row.hierarchyLevel} | ${row.bindingStatus}`,
  };
}

export async function resolveCitations(
  tokens: Array<{ token: string; prefix: string; sourceId: number }>,
  /**
   * Source index built by buildContext() — contains every [TAG:ID] that was
   * actually provided in the RAG context. Used here (Phase 56) to detect
   * fabricated citations: any token the model emits that is NOT in this index
   * was never given to it and is therefore a hallucination.
   */
  sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>,
  /** Scopes DOC lookups to this user's uploaded documents to prevent cross-user metadata leakage. */
  userId?: number,
): Promise<Array<{ token: string; title: string; type: "document" | "legal_source"; sourceId: number; formats: Record<string, string> }>> {

  // ── Phase 56 Fix 3: Fabrication filter ────────────────────────────────────
  // If sourceIndex is populated (i.e. buildContext() was called), any citation
  // token the model emits that is not in sourceIndex was never provided in the
  // context — it is a fabricated citation and must be rejected.
  // Tokens whose key is absent are logged via verifyGeneratedCitations() and
  // excluded from the resolved results returned to the caller.
  const fabricatedTokens: Array<{ token: string; prefix: string; sourceId: number }> = [];
  const validTokens = sourceIndex.size === 0
    ? tokens  // sourceIndex not available — skip fabrication check (legacy path)
    : tokens.filter((t) => {
        // Strip brackets to get the sourceIndex key: [SRC:100034] → SRC:100034
        const key = t.token.replace(/^\[|\]$/g, "");
        if (sourceIndex.has(key)) return true;
        fabricatedTokens.push(t);
        return false;
      });

  // Fire-and-forget: log fabricated tokens to citation-audit.jsonl
  if (fabricatedTokens.length > 0) {
    const fakeGeneratedText = fabricatedTokens.map((t) => t.token).join(" ");
    // verifyGeneratedCitations() compares against bracketed tags (e.g. "[SRC:100034]"),
    // so normalize sourceIndex keys (which are unbracketed) by adding brackets.
    const providedTagSet = new Set([...sourceIndex.keys()].map((k) => `[${k}]`));
    verifyGeneratedCitations(fakeGeneratedText, providedTagSet, { auditLog: true }).catch(() => {/* non-fatal */});
  }

  // ── Phase 56: Partition valid tokens into four buckets ────────────────────
  // DOC:{id}                            → user-uploaded documents
  // SRC:{id}    id < KB_ID_OFFSET       → legalSourcesTable
  // SRC:{id}    id ≥ KB_ID_OFFSET       → kbDocumentsTable (realId = id − KB_ID_OFFSET)
  // KB:{id}     always raw              → kbDocumentsTable (realId = id, no offset)
  const docTokens    = validTokens.filter((t) => t.prefix === "DOC");
  const legSrcTokens = validTokens.filter((t) => t.prefix === "SRC" && t.sourceId < KB_ID_OFFSET);
  const kbSrcTokens  = validTokens.filter((t) => t.prefix === "SRC" && t.sourceId >= KB_ID_OFFSET);
  const kbRawTokens  = validTokens.filter((t) => t.prefix === "KB");

  // Real kbDocumentsTable IDs for each bucket
  const kbDocRealIds = [
    ...kbSrcTokens.map((t) => t.sourceId - KB_ID_OFFSET),
    ...kbRawTokens.map((t) => t.sourceId),          // [KB:34] → realId = 34 (no offset)
  ];

  const [docRows, srcRows, kbRows] = await Promise.all([
    docTokens.length > 0
      ? db.select({ id: documentsTable.id, originalName: documentsTable.originalName, uploadedAt: documentsTable.uploadedAt })
          .from(documentsTable)
          .where(
            userId !== undefined
              ? and(inArray(documentsTable.id, docTokens.map((t) => t.sourceId)), eq(documentsTable.uploadedById, userId))
              : inArray(documentsTable.id, docTokens.map((t) => t.sourceId)),
          )
      : Promise.resolve([]),

    legSrcTokens.length > 0
      ? db.select({ id: legalSourcesTable.id, title: legalSourcesTable.title, titleAr: legalSourcesTable.titleAr, referenceNumber: legalSourcesTable.referenceNumber, year: legalSourcesTable.year, jurisdiction: legalSourcesTable.jurisdiction })
          .from(legalSourcesTable)
          .where(inArray(legalSourcesTable.id, legSrcTokens.map((t) => t.sourceId)))
      : Promise.resolve([]),

    kbDocRealIds.length > 0
      ? db.select({
            id:             kbDocumentsTable.id,
            titleAr:        kbDocumentsTable.titleAr,
            title:          kbDocumentsTable.title,
            documentNumber: kbDocumentsTable.documentNumber,
            year:           kbDocumentsTable.year,
            jurisdiction:   kbDocumentsTable.jurisdiction,
            authorityAr:    kbDocumentsTable.authorityAr,
            hierarchyLevel: kbDocumentsTable.hierarchyLevel,
            bindingStatus:  kbDocumentsTable.bindingStatus,
          })
          .from(kbDocumentsTable)
          .where(inArray(kbDocumentsTable.id, kbDocRealIds))
      : Promise.resolve([]),
  ]);

  const docMap = new Map(docRows.map((d) => [d.id, d]));
  const srcMap = new Map(srcRows.map((s) => [s.id, s]));
  const kbMap  = new Map(kbRows.map((k) => [k.id, k]));  // keyed by REAL id (before any offset)

  type CitRow = { token: string; title: string; type: "document" | "legal_source"; sourceId: number; formats: Record<string, string> };
  const results: CitRow[] = [];

  for (const { token, prefix, sourceId } of validTokens) {
    if (prefix === "DOC") {
      const doc = docMap.get(sourceId);
      if (doc) results.push({ token, title: doc.originalName, type: "document", sourceId, formats: makeDocCitations(doc) });

    } else if (prefix === "SRC" && sourceId >= KB_ID_OFFSET) {
      // Fix 2: de-offset the ID — [SRC:100034] → kbDocumentsTable row 34
      const realId = sourceId - KB_ID_OFFSET;
      const kbRow  = kbMap.get(realId);
      if (kbRow) results.push({ token, title: kbRow.titleAr || kbRow.title, type: "legal_source", sourceId, formats: makeKbDocCitations(kbRow) });

    } else if (prefix === "SRC") {
      const src = srcMap.get(sourceId);
      if (src) results.push({ token, title: src.titleAr ?? src.title, type: "legal_source", sourceId, formats: makeSrcCitations(src) });

    } else if (prefix === "KB") {
      // Fix 2: [KB:34] → kbDocumentsTable row 34 (sourceId IS the real ID, no offset)
      const kbRow = kbMap.get(sourceId);
      if (kbRow) results.push({ token, title: kbRow.titleAr || kbRow.title, type: "legal_source", sourceId, formats: makeKbDocCitations(kbRow) });
    }
  }

  return results;
}
