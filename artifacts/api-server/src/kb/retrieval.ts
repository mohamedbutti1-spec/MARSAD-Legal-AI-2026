/**
 * Phase 53 — UAE Legal Knowledge Base: Retrieval Engine
 *
 * Hybrid retrieval: vector cosine similarity (when embeddings are available)
 * combined with keyword BM25-style scoring, with rich metadata filters.
 *
 * Strategy selection:
 *   - "semantic"  — embeddings available for query AND candidates → vector-only
 *   - "keyword"   — no embeddings available → keyword scoring only
 *   - "hybrid"    — embeddings available → 0.6 × semantic + 0.4 × keyword
 *
 * Integration with existing RAG (rag.ts):
 *   Call `buildKbContext()` from rag.ts's buildContext() to merge KB results
 *   into the RAG context block alongside document and legalSourcesTable results.
 *   The returned hits carry `ragTag: "SRC:{id}"` for direct [SRC:N] injection.
 */

import { db } from "@workspace/db";
import {
  kbDocumentsTable,
  kbArticlesTable,
  kbEmbeddingsTable,
  kbCrossReferencesTable,
} from "@workspace/db";
import { and, eq, gte, lte, inArray, or, sql } from "drizzle-orm";
import { generateEmbedding, normaliseArabic, extractKeywordsAr, extractKeywordsEn } from "./pipeline.js";
import {
  verifyRetrievalHits,
  annotateContextLine,
  buildAuthorityInventory,
} from "./verification.js";
import type { VerificationReport, VerificationOptions } from "./verification.js";
import type {
  RetrievalOptions,
  RetrievalResult,
  RetrievalHit,
  KbCollectionId,
  KbHierarchyLevel,
  KbBindingStatus,
} from "./types.js";

// ─── Cosine similarity ────────────────────────────────────────────────────────

/** Compute cosine similarity between two float vectors of equal length. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Keyword scoring ──────────────────────────────────────────────────────────

/** Token set from a mixed Arabic/English query. */
function tokeniseQuery(query: string): Set<string> {
  const ar = new Set(extractKeywordsAr(normaliseArabic(query)));
  const en = new Set(extractKeywordsEn(query));
  return new Set([...ar, ...en]);
}

/** Simple term-overlap keyword score against a bag of text fields. */
function keywordScore(tokens: Set<string>, ...fields: Array<string | null | undefined>): number {
  const haystack = fields
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) hits++;
  }
  return hits;
}

// ─── Filter builder ───────────────────────────────────────────────────────────

function buildWhereConditions(opts: RetrievalOptions) {
  const conditions = [];

  if (opts.collections?.length) {
    conditions.push(inArray(kbDocumentsTable.collectionId, opts.collections));
  }
  if (opts.jurisdictions?.length) {
    conditions.push(inArray(kbDocumentsTable.jurisdiction, opts.jurisdictions));
  }
  if (opts.hierarchyLevels?.length) {
    conditions.push(inArray(kbDocumentsTable.hierarchyLevel, opts.hierarchyLevels));
  }
  if (opts.bindingStatuses?.length) {
    conditions.push(inArray(kbDocumentsTable.bindingStatus, opts.bindingStatuses));
  }
  if (opts.yearFrom !== undefined) {
    conditions.push(gte(kbDocumentsTable.year, opts.yearFrom));
  }
  if (opts.yearTo !== undefined) {
    conditions.push(lte(kbDocumentsTable.year, opts.yearTo));
  }
  if (opts.excludeRepealed) {
    conditions.push(eq(kbDocumentsTable.isRepealed, false));
  }

  // Only return fully indexed documents
  conditions.push(eq(kbDocumentsTable.indexStatus, "indexed"));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

// ─── Main retrieval function ──────────────────────────────────────────────────

/**
 * Retrieve the most relevant KB documents and/or articles for a query.
 *
 * @param opts - Query + filter options
 * @returns RetrievalResult with ranked hits
 */
export async function retrieveRelevant(opts: RetrievalOptions): Promise<RetrievalResult> {
  const startMs = Date.now();
  const topK = opts.topK ?? 8;
  const tokens = tokeniseQuery(opts.query);

  // ── 1. Fetch candidate documents (with metadata) ────────────────────────────
  const where = buildWhereConditions(opts);
  const candidateDocs = await db
    .select({
      id:             kbDocumentsTable.id,
      collectionId:   kbDocumentsTable.collectionId,
      titleAr:        kbDocumentsTable.titleAr,
      title:          kbDocumentsTable.title,
      authorityAr:    kbDocumentsTable.authorityAr,
      hierarchyLevel: kbDocumentsTable.hierarchyLevel,
      bindingStatus:  kbDocumentsTable.bindingStatus,
      jurisdiction:   kbDocumentsTable.jurisdiction,
      documentNumber: kbDocumentsTable.documentNumber,
      year:           kbDocumentsTable.year,
      isRepealed:     kbDocumentsTable.isRepealed,
      isAmended:      kbDocumentsTable.isAmended,
      keywordsAr:     kbDocumentsTable.keywordsAr,
      keywordsEn:     kbDocumentsTable.keywordsEn,
      fullTextAr:     kbDocumentsTable.fullTextAr,
      fullTextEn:     kbDocumentsTable.fullTextEn,
    })
    .from(kbDocumentsTable)
    .where(where);

  if (candidateDocs.length === 0) {
    return { hits: [], totalCandidates: 0, strategy: "keyword", durationMs: Date.now() - startMs };
  }

  // ── 2. Try to generate query embedding ─────────────────────────────────────
  let queryVectorAr: number[] | null = null;
  let queryVectorEn: number[] | null = null;

  if (opts.preferSemantic !== false) {
    const [embAr, embEn] = await Promise.all([
      generateEmbedding({ text: opts.query, language: "ar" }),
      generateEmbedding({ text: opts.query, language: "en" }),
    ]);
    queryVectorAr = embAr?.vector ?? null;
    queryVectorEn = embEn?.vector ?? null;
  }

  const hasEmbeddings = queryVectorAr !== null || queryVectorEn !== null;

  // ── 3. Load stored embeddings for candidates (if we have a query vector) ───
  const embeddingMap = new Map<number, { ar: number[] | null; en: number[] | null }>();
  if (hasEmbeddings) {
    const docIds = candidateDocs.map((d) => d.id);
    const storedEmbs = await db
      .select({
        entityId:   kbEmbeddingsTable.entityId,
        language:   kbEmbeddingsTable.language,
        vectorJson: kbEmbeddingsTable.vectorJson,
      })
      .from(kbEmbeddingsTable)
      .where(
        and(
          eq(kbEmbeddingsTable.entityType, "document"),
          inArray(kbEmbeddingsTable.entityId, docIds),
        ),
      );

    for (const emb of storedEmbs) {
      if (!embeddingMap.has(emb.entityId)) {
        embeddingMap.set(emb.entityId, { ar: null, en: null });
      }
      const entry = embeddingMap.get(emb.entityId)!;
      try {
        const vec = JSON.parse(emb.vectorJson) as number[];
        if (emb.language === "ar") entry.ar = vec;
        else if (emb.language === "en") entry.en = vec;
      } catch {
        // malformed vector — skip
      }
    }
  }

  // ── 4. Score all candidates ─────────────────────────────────────────────────
  const docEmbeddingsFound = embeddingMap.size > 0;
  const strategy = hasEmbeddings && docEmbeddingsFound ? "hybrid" : "keyword";

  type ScoredDoc = {
    doc: typeof candidateDocs[0];
    kwScore: number;
    semScore: number;
    combined: number;
    snippet: string;
  };

  const scored: ScoredDoc[] = candidateDocs.map((doc) => {
    const kwScore = keywordScore(
      tokens,
      doc.titleAr,
      doc.title,
      doc.keywordsAr,
      doc.keywordsEn,
      doc.fullTextAr?.slice(0, 2000),
    );

    let semScore = 0;
    if (hasEmbeddings && docEmbeddingsFound) {
      const embs = embeddingMap.get(doc.id);
      if (embs) {
        if (queryVectorAr && embs.ar) semScore = Math.max(semScore, cosineSimilarity(queryVectorAr, embs.ar));
        if (queryVectorEn && embs.en) semScore = Math.max(semScore, cosineSimilarity(queryVectorEn, embs.en));
      }
    }

    const combined = strategy === "hybrid"
      ? 0.6 * semScore + 0.4 * (kwScore / Math.max(1, tokens.size))
      : kwScore;

    // Extract a relevant snippet
    const fullText = doc.fullTextAr ?? doc.fullTextEn ?? "";
    const snippet = extractSnippet(fullText, tokens, 300);

    return { doc, kwScore, semScore, combined, snippet };
  });

  // ── 5. Sort and take top-K ─────────────────────────────────────────────────
  scored.sort((a, b) => b.combined - a.combined);
  const topHits = scored.slice(0, topK);

  // ── 6. Build RetrievalHit array ────────────────────────────────────────────
  const hits: RetrievalHit[] = topHits.map((s) => ({
    documentId:     s.doc.id,
    collectionId:   s.doc.collectionId as KbCollectionId,
    titleAr:        s.doc.titleAr,
    titleEn:        s.doc.title,
    authorityAr:    s.doc.authorityAr,
    hierarchyLevel: s.doc.hierarchyLevel as KbHierarchyLevel,
    bindingStatus:  s.doc.bindingStatus as KbBindingStatus,
    jurisdiction:   s.doc.jurisdiction,
    documentNumber: s.doc.documentNumber ?? undefined,
    year:           s.doc.year ?? undefined,
    isRepealed:     s.doc.isRepealed,
    isAmended:      s.doc.isAmended,
    snippet:        s.snippet,
    keywordScore:   s.kwScore,
    semanticScore:  strategy !== "keyword" ? s.semScore : undefined,
    combinedScore:  s.combined,
    ragTag:         `SRC:${s.doc.id}`,
  }));

  return {
    hits,
    totalCandidates: candidateDocs.length,
    strategy,
    durationMs: Date.now() - startMs,
  };
}

// ─── Snippet extraction ───────────────────────────────────────────────────────

/**
 * Find the most query-relevant passage within a text block and return a
 * trimmed snippet of `maxChars` characters centred on the first keyword hit.
 */
function extractSnippet(text: string, tokens: Set<string>, maxChars: number): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  let bestPos = 0;
  let bestHits = 0;

  // Scan in windows of maxChars to find densest keyword cluster
  const step = Math.floor(maxChars / 2);
  for (let i = 0; i < text.length; i += step) {
    const window = lower.slice(i, i + maxChars);
    let hits = 0;
    for (const t of tokens) if (window.includes(t)) hits++;
    if (hits > bestHits) { bestHits = hits; bestPos = i; }
  }

  return text.slice(bestPos, bestPos + maxChars).trim();
}

// ─── RAG context builder (for rag.ts integration) ────────────────────────────

/**
 * Phase 56: Result type for buildKbContext().
 * Includes the verification report so callers can log or surface it.
 */
export interface KbContextEntry {
  tag: string;         // e.g. "SRC:34" — the raw KB document ID tag
  contextLine: string; // Formatted context line, annotated with authority class + confidence
  documentId: number;  // Raw kbDocumentsTable.id (before any offset)
  titleAr: string;     // DB-confirmed Arabic title
}

export interface KbContextResult {
  entries: KbContextEntry[];
  report: VerificationReport;
  inventory: string;   // Authority inventory block for pre-prompt injection
  /** Phase 59: Cross-reference hierarchy block (undefined if no cross-refs found). */
  legalContextChain?: string;
}

/**
 * Build a RAG context block from KB retrieval results.
 *
 * Phase 56: All hits pass through verifyRetrievalHits() before being
 * included in the context. Rejected hits are removed and logged to the
 * audit log. Each accepted entry is annotated with authority class and
 * confidence so the AI can use them correctly.
 *
 * @param query    - User query text
 * @param options  - Retrieval + verification filter options
 * @returns KbContextResult with verified entries, report, and inventory
 */
export async function buildKbContext(
  query: string,
  options: Omit<RetrievalOptions, "query"> & {
    /** Phase 56 verification options (pass-through to verifyRetrievalHits) */
    verification?: VerificationOptions;
  } = {},
): Promise<KbContextResult> {
  const { verification: verificationOpts, ...retrievalOpts } = options;

  const result = await retrieveRelevant({ ...retrievalOpts, query, excludeRepealed: true });

  // ── Phase 56: Mandatory verification ──────────────────────────────────────
  const report = await verifyRetrievalHits(result.hits, {
    ...verificationOpts,
    auditLog: verificationOpts?.auditLog ?? true,
  });

  // Stamp the retrieval strategy onto the report
  report.retrievalStrategy = result.strategy;

  // ── Build context entries from verified hits only ─────────────────────────
  const verifiedMap = new Map(report.verified.map((v) => [v.documentId, v]));

  const entries: KbContextEntry[] = [];
  for (const hit of result.hits) {
    const authority = verifiedMap.get(hit.documentId);
    if (!authority) continue; // rejected — not included in context

    const rawLine =
      `[${hit.ragTag}] ${authority.titleAr}` +
      (authority.documentNumber ? ` (رقم ${authority.documentNumber})` : "") +
      (authority.year ? `، ${authority.year}` : "") +
      ` — ${authority.jurisdiction} | المستوى ${authority.hierarchyLevel} | ${authority.bindingStatus}` +
      (authority.isRepealed ? " [ملغى]" : "") +
      (authority.isAmended ? " [معدّل]" : "") +
      "\n" +
      (hit.snippet || "(لا يوجد محتوى متاح)");

    entries.push({
      tag:         hit.ragTag,
      contextLine: annotateContextLine(rawLine, authority),
      documentId:  hit.documentId,
      titleAr:     authority.titleAr,
    });
  }

  const inventory = buildAuthorityInventory(report);

  // ── Phase 59: Cross-reference expansion ───────────────────────────────────
  let legalContextChain: string | undefined;

  if (entries.length > 0) {
    const verifiedDocIds = entries.map((e) => e.documentId);
    const [crossRefMap, amendmentMap] = await Promise.all([
      expandWithCrossRefs(verifiedDocIds),
      resolveAmendmentChain(verifiedDocIds),
    ]);

    // Annotate entries that have been amended with "Current version" note
    for (const entry of entries) {
      const amenders = amendmentMap.get(entry.documentId);
      if (amenders && amenders.length > 0) {
        const amenderList = amenders
          .map((a) =>
            `${a.titleAr}` +
            (a.documentNumber ? ` (رقم ${a.documentNumber})` : "") +
            (a.year ? `، ${a.year}` : ""),
          )
          .join("؛ ");
        entry.contextLine += `\n  [النص الحالي المعدَّل بواسطة: ${amenderList}]`;
      }
    }

    // Build "Legal Context Chain" hierarchy block
    const chainLines: string[] = [];
    let hasChain = false;

    for (const entry of entries) {
      if (entry.documentId === 0) continue; // skip synthetic entries
      const neighbours = crossRefMap.get(entry.documentId);
      if (!neighbours || neighbours.length === 0) continue;

      if (!hasChain) {
        chainLines.push("[LEGAL CONTEXT CHAIN — Cross-Reference Graph]");
        chainLines.push("Format: direction RelType: Document | Level | BindingStatus");
        hasChain = true;
      }

      chainLines.push(`\n${entry.titleAr}:`);
      for (const n of neighbours) {
        const relLabel = CROSS_REF_LABELS[n.referenceType] ?? n.referenceType;
        const dirArrow = n.direction === "outbound" ? "→" : "←";
        chainLines.push(
          `  ${dirArrow} ${relLabel}: ${n.titleAr}` +
          (n.documentNumber ? ` (رقم ${n.documentNumber})` : "") +
          (n.year ? `، ${n.year}` : "") +
          ` | Level ${n.hierarchyLevel} | ${n.bindingStatus}` +
          (n.isRepealed ? " [ملغى]" : ""),
        );
      }
    }

    if (hasChain) {
      legalContextChain = chainLines.join("\n");
    }
  }

  return { entries, report, inventory, legalContextChain };
}

// ─── Cross-reference labels ───────────────────────────────────────────────────

const CROSS_REF_LABELS: Record<string, string> = {
  cites:          "Cited in",
  amends:         "Amends →",
  repeals:        "Repeals",
  implements:     "Implements →",
  supplements:    "Supplements",
  related:        "Related",
  interpreted_by: "Interpreted by",
  appealed_from:  "Appealed from",
};

// ─── Cross-reference expansion types ─────────────────────────────────────────

export interface CrossRefNeighbour {
  neighbourDocumentId: number;
  titleAr: string;
  titleEn: string;
  hierarchyLevel: KbHierarchyLevel;
  bindingStatus: KbBindingStatus;
  jurisdiction: string;
  documentNumber: string | null;
  year: number | null;
  isRepealed: boolean;
  referenceType: string;
  direction: "outbound" | "inbound";
  description: string | null;
}

// ─── Cross-reference expansion ────────────────────────────────────────────────

/**
 * Expand a set of document IDs with their one-hop cross-reference neighbours.
 * Fetches all outbound (source IN docIds) and inbound (target IN docIds) edges
 * in two queries then joins with document metadata — no N+1 fetches.
 *
 * @returns Map: primaryDocId → list of CrossRefNeighbour (0.7× damped)
 */
export async function expandWithCrossRefs(
  docIds: number[],
): Promise<Map<number, CrossRefNeighbour[]>> {
  if (docIds.length === 0) return new Map();

  // Fetch all cross-ref edges touching these documents in one query
  const edges = await db
    .select({
      id:               kbCrossReferencesTable.id,
      sourceDocumentId: kbCrossReferencesTable.sourceDocumentId,
      targetDocumentId: kbCrossReferencesTable.targetDocumentId,
      referenceType:    kbCrossReferencesTable.referenceType,
      description:      kbCrossReferencesTable.description,
    })
    .from(kbCrossReferencesTable)
    .where(
      or(
        inArray(kbCrossReferencesTable.sourceDocumentId, docIds),
        inArray(kbCrossReferencesTable.targetDocumentId, docIds as number[]),
      ),
    );

  if (edges.length === 0) return new Map();

  // Collect neighbour IDs (docs NOT already in the primary result set)
  const docIdSet = new Set(docIds);
  const neighbourIds = new Set<number>();
  for (const edge of edges) {
    if (edge.targetDocumentId !== null && !docIdSet.has(edge.targetDocumentId)) {
      neighbourIds.add(edge.targetDocumentId);
    }
    if (!docIdSet.has(edge.sourceDocumentId)) {
      neighbourIds.add(edge.sourceDocumentId);
    }
  }

  if (neighbourIds.size === 0) return new Map();

  // Batch-fetch neighbour metadata (indexed docs only)
  const neighbourDocs = await db
    .select({
      id:             kbDocumentsTable.id,
      titleAr:        kbDocumentsTable.titleAr,
      title:          kbDocumentsTable.title,
      hierarchyLevel: kbDocumentsTable.hierarchyLevel,
      bindingStatus:  kbDocumentsTable.bindingStatus,
      jurisdiction:   kbDocumentsTable.jurisdiction,
      documentNumber: kbDocumentsTable.documentNumber,
      year:           kbDocumentsTable.year,
      isRepealed:     kbDocumentsTable.isRepealed,
    })
    .from(kbDocumentsTable)
    .where(
      and(
        inArray(kbDocumentsTable.id, [...neighbourIds]),
        eq(kbDocumentsTable.indexStatus, "indexed"),
      ),
    );

  const neighbourMap = new Map(neighbourDocs.map((d) => [d.id, d]));

  // Build result map: primaryDocId → neighbours
  const result = new Map<number, CrossRefNeighbour[]>();

  for (const docId of docIds) {
    const neighbours: CrossRefNeighbour[] = [];

    for (const edge of edges) {
      let neighbourId: number | null = null;
      let direction: "outbound" | "inbound";

      if (edge.sourceDocumentId === docId && edge.targetDocumentId !== null && !docIdSet.has(edge.targetDocumentId)) {
        neighbourId = edge.targetDocumentId;
        direction   = "outbound";
      } else if (edge.targetDocumentId === docId && !docIdSet.has(edge.sourceDocumentId)) {
        neighbourId = edge.sourceDocumentId;
        direction   = "inbound";
      } else {
        continue;
      }

      const doc = neighbourMap.get(neighbourId);
      if (!doc) continue;

      // Avoid duplicates within same primary doc (can occur if multiple edges between same pair)
      if (neighbours.some((n) => n.neighbourDocumentId === doc.id && n.referenceType === edge.referenceType)) {
        continue;
      }

      neighbours.push({
        neighbourDocumentId: doc.id,
        titleAr:             doc.titleAr,
        titleEn:             doc.title,
        hierarchyLevel:      doc.hierarchyLevel as KbHierarchyLevel,
        bindingStatus:       doc.bindingStatus as KbBindingStatus,
        jurisdiction:        doc.jurisdiction,
        documentNumber:      doc.documentNumber,
        year:                doc.year,
        isRepealed:          doc.isRepealed,
        referenceType:       edge.referenceType,
        direction,
        description:         edge.description,
      });
    }

    if (neighbours.length > 0) {
      result.set(docId, neighbours);
    }
  }

  return result;
}

// ─── Amendment chain resolver ─────────────────────────────────────────────────

export interface AmendingInstrument {
  amendingDocId: number;
  titleAr: string;
  documentNumber: string | null;
  year: number | null;
}

/**
 * For a set of document IDs, find any amending instruments that reference them
 * via an "amends" cross-ref edge (source=amending law, target=amended law).
 *
 * @returns Map: amendedDocId → list of amending instruments
 */
export async function resolveAmendmentChain(
  docIds: number[],
): Promise<Map<number, AmendingInstrument[]>> {
  if (docIds.length === 0) return new Map();

  const amendments = await db
    .select({
      sourceDocumentId: kbCrossReferencesTable.sourceDocumentId,
      targetDocumentId: kbCrossReferencesTable.targetDocumentId,
    })
    .from(kbCrossReferencesTable)
    .where(
      and(
        eq(kbCrossReferencesTable.referenceType, "amends"),
        inArray(kbCrossReferencesTable.targetDocumentId, docIds as number[]),
      ),
    );

  if (amendments.length === 0) return new Map();

  const amendingIds = [...new Set(amendments.map((a) => a.sourceDocumentId))];
  const amendingDocs = await db
    .select({
      id:             kbDocumentsTable.id,
      titleAr:        kbDocumentsTable.titleAr,
      documentNumber: kbDocumentsTable.documentNumber,
      year:           kbDocumentsTable.year,
    })
    .from(kbDocumentsTable)
    .where(inArray(kbDocumentsTable.id, amendingIds));

  const amendingDocMap = new Map(amendingDocs.map((d) => [d.id, d]));

  const result = new Map<number, AmendingInstrument[]>();

  for (const edge of amendments) {
    if (edge.targetDocumentId === null) continue;
    const amender = amendingDocMap.get(edge.sourceDocumentId);
    if (!amender) continue;

    const list = result.get(edge.targetDocumentId) ?? [];
    if (!list.some((a) => a.amendingDocId === amender.id)) {
      list.push({
        amendingDocId:  amender.id,
        titleAr:        amender.titleAr,
        documentNumber: amender.documentNumber,
        year:           amender.year,
      });
    }
    result.set(edge.targetDocumentId, list);
  }

  return result;
}

// ─── Collection-scoped retrieval shortcuts ────────────────────────────────────

/** Retrieve only from legislation collections (levels 1–6). */
export async function retrieveLegislation(
  query: string,
  opts?: Omit<RetrievalOptions, "query">,
): Promise<RetrievalResult> {
  return retrieveRelevant({
    ...opts,
    query,
    hierarchyLevels: ["1", "2", "3", "4", "5", "6"],
    excludeRepealed: opts?.excludeRepealed ?? true,
  });
}

/** Retrieve only from case-law collections (levels 7a, 7b, 7c). */
export async function retrieveCaseLaw(
  query: string,
  opts?: Omit<RetrievalOptions, "query">,
): Promise<RetrievalResult> {
  return retrieveRelevant({
    ...opts,
    query,
    hierarchyLevels: ["7a", "7b", "7c"],
  });
}

/** Retrieve constitutional authorities (level 1 only). */
export async function retrieveConstitutional(
  query: string,
  opts?: Omit<RetrievalOptions, "query">,
): Promise<RetrievalResult> {
  return retrieveRelevant({
    ...opts,
    query,
    hierarchyLevels: ["1"],
    bindingStatuses: ["constitutional"],
  });
}
