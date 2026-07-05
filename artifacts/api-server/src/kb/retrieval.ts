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
} from "@workspace/db";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { generateEmbedding, normaliseArabic, extractKeywordsAr, extractKeywordsEn } from "./pipeline.js";
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
 * Build a RAG context block from KB retrieval results, formatted
 * identically to legalSourcesTable results in rag.ts's buildContext().
 *
 * Call this from buildContext() in rag.ts and append its output to `parts`.
 *
 * @param query    - User query text
 * @param options  - Retrieval filters (optional)
 * @returns Array of formatted context strings, one per hit
 */
export async function buildKbContext(
  query: string,
  options: Omit<RetrievalOptions, "query"> = {},
): Promise<Array<{ tag: string; contextLine: string }>> {
  const result = await retrieveRelevant({ ...options, query, excludeRepealed: true });

  return result.hits.map((hit) => ({
    tag: hit.ragTag,
    contextLine:
      `[${hit.ragTag}] ${hit.titleAr}` +
      (hit.documentNumber ? ` (رقم ${hit.documentNumber})` : "") +
      (hit.year ? `، ${hit.year}` : "") +
      ` — ${hit.jurisdiction} | المستوى ${hit.hierarchyLevel} | ${hit.bindingStatus}` +
      (hit.isRepealed ? " [ملغى]" : "") +
      (hit.isAmended ? " [معدّل]" : "") +
      "\n" +
      (hit.snippet || "(لا يوجد محتوى متاح)"),
  }));
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
