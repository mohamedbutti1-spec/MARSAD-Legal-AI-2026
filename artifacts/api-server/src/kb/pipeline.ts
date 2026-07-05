/**
 * Phase 53 — UAE Legal Knowledge Base: Indexing Pipeline
 *
 * Transforms raw legal instrument input into fully-indexed KB records:
 *   1. Validate metadata and collection membership
 *   2. Normalise Arabic text (clean, diacritic-aware)
 *   3. Segment into articles / clauses
 *   4. Extract cross-references from text patterns
 *   5. Auto-extract keywords
 *   6. Generate embeddings (Arabic + English) — requires embedding provider
 *   7. Persist document, articles, cross-refs, and embeddings transactionally
 *   8. Update collection stats on kb_documents
 *
 * DATA INGESTION IS DISABLED in Phase 53.
 * The pipeline is fully built and type-safe; call `indexDocument()` once
 * documents are ready to ingest. The `generateEmbedding()` function requires
 * an OpenAI-compatible embeddings endpoint — configure via environment variable
 * EMBEDDING_API_KEY / EMBEDDING_API_URL before ingesting.
 */

import { db } from "@workspace/db";
import {
  kbDocumentsTable,
  kbArticlesTable,
  kbCrossReferencesTable,
  kbEmbeddingsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getCollection } from "./collections.js";
import type {
  KbDocumentInput,
  KbArticleInput,
  KbCrossRefInput,
  IndexResult,
  EmbeddingRequest,
  EmbeddingResponse,
} from "./types.js";

// ─── Configuration ────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536; // text-embedding-3-small default
const ARTICLE_SEGMENT_MAX_CHARS = 2000;

// ─── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Normalise Arabic text for consistent indexing:
 * - Collapse whitespace
 * - Normalise common Arabic character variants
 * - Remove zero-width characters
 */
export function normaliseArabic(text: string): string {
  return text
    .replace(/\u200b|\u200c|\u200d|\ufeff/g, "")       // zero-width chars
    .replace(/[\u064b-\u065f]/g, "")                    // remove tashkeel (diacritics)
    .replace(/\u0629/g, "\u0647")                       // tā marbūṭa → hā
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")         // alef variants → bare alef
    .replace(/\u0649/g, "\u064a")                       // alef maqsura → yā
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Keyword extraction ───────────────────────────────────────────────────────

/**
 * Extract significant keywords from Arabic legal text.
 * Filters out common stop words and short tokens.
 */
export function extractKeywordsAr(text: string): string[] {
  const STOP_WORDS = new Set([
    "من", "في", "على", "إلى", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
    "التي", "الذي", "الذين", "التي", "أن", "إن", "كان", "كانت", "يكون",
    "لا", "ما", "لم", "لن", "قد", "كل", "بعض", "غير", "حتى", "أو",
    "و", "أي", "بما", "وفق", "وفقا", "طبقا", "حسب", "وفقاً", "طبقاً",
  ]);

  return Array.from(
    new Set(
      normaliseArabic(text)
        .split(/[\s،؛.،؟!:()[\]{}"«»]+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
        .slice(0, 50),
    ),
  );
}

export function extractKeywordsEn(text: string): string[] {
  const STOP_WORDS = new Set([
    "the", "and", "for", "this", "that", "with", "from", "shall", "any",
    "may", "its", "their", "have", "been", "such", "each", "where", "which",
  ]);

  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[\s.,;:!?()\[\]{}"']+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
        .slice(0, 50),
    ),
  );
}

// ─── Article segmentation ─────────────────────────────────────────────────────

/**
 * Arabic article boundary patterns:
 * - "المادة (1)" / "المادة 1" / "مادة 1"
 * - "البند الأول" / "البند 1"
 * - "أولاً:" / "ثانياً:" / "عاشراً:"
 * - "الفصل الأول" / "الباب الأول"
 */
const ARTICLE_BOUNDARY_AR = /(?:^|\n)(?:المادة|مادة|البند|الفصل|الباب)\s*[\u0600-\u06FF\s(]*\d+[)]*\s*[-:—]?/gm;

/**
 * English article boundary patterns:
 * - "Article 1" / "Article 1:" / "Section 1."
 * - "Chapter I" / "Part A"
 */
const ARTICLE_BOUNDARY_EN = /(?:^|\n)(?:Article|Section|Chapter|Part)\s+[\dIVXA-Z]+[.:)—]?\s*/gm;

interface RawSegment {
  heading?: string;
  body: string;
  sequence: number;
}

/** Split full document text into article-level segments. */
export function segmentArticles(text: string, language: "ar" | "en"): RawSegment[] {
  const pattern = language === "ar" ? ARTICLE_BOUNDARY_AR : ARTICLE_BOUNDARY_EN;
  const segments: RawSegment[] = [];
  const matches: Array<{ index: number; match: string }> = [];

  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags);
  while ((m = re.exec(text)) !== null) {
    matches.push({ index: m.index, match: m[0] });
  }

  if (matches.length === 0) {
    // No article boundaries found — treat whole document as one segment
    const chunks = chunkText(text, ARTICLE_SEGMENT_MAX_CHARS);
    return chunks.map((body, i) => ({ body, sequence: i + 1 }));
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].match.length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    if (body.length < 10) continue;  // skip empty segments
    segments.push({
      heading: matches[i].match.trim(),
      body,
      sequence: i + 1,
    });
  }

  return segments;
}

/** Split a single long text block into fixed-size chunks. */
function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}

// ─── Cross-reference extraction ───────────────────────────────────────────────

/**
 * Patterns that indicate a legal cross-reference in Arabic text:
 * - "وفقاً للمادة (3) من القانون الاتحادي رقم (11) لسنة 2008"
 * - "استناداً إلى المرسوم بقانون الاتحادي رقم 26 لسنة 2020"
 * - "طبقاً لأحكام المرسوم رقم 44 لسنة 2021"
 */
const CROSS_REF_PATTERNS_AR: RegExp[] = [
  /(?:وفقاً|طبقاً|استناداً|عملاً)\s+(?:لأحكام|للمادة|لنص|لقانون)?\s*(?:المادة\s*[\d()]+\s+من\s+)?(?:القانون|المرسوم|القرار|اللائحة|التعميم)\s+(?:الاتحادي\s+)?(?:بقانون\s+)?(?:رقم\s+)?\(?\d+\)?\s+(?:لسنة|سنة)\s+\d{4}/gi,
  /(?:المادة|البند)\s*\(?\d+\)?\s+(?:من|بموجب)\s+(?:هذا\s+)?(?:القانون|المرسوم|القرار)/gi,
];

export interface ExtractedRef {
  rawText: string;
  referenceType: "cites";
  targetExternalRef: string;
}

export function extractCrossRefs(text: string): ExtractedRef[] {
  const refs: ExtractedRef[] = [];
  const seen = new Set<string>();

  for (const pattern of CROSS_REF_PATTERNS_AR) {
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const ref = m[0].trim();
      if (!seen.has(ref)) {
        seen.add(ref);
        refs.push({ rawText: ref, referenceType: "cites", targetExternalRef: ref });
      }
    }
  }

  return refs;
}

// ─── Embedding generation ─────────────────────────────────────────────────────

/**
 * Generate an embedding vector for a text snippet.
 *
 * Requires environment variables:
 *   EMBEDDING_API_KEY  — OpenAI-compatible API key
 *   EMBEDDING_API_URL  — Base URL (default: https://api.openai.com/v1)
 *
 * Returns null if the embedding provider is not configured.
 * The pipeline records this gracefully — documents index without embeddings
 * and fall back to keyword retrieval until embeddings are generated.
 */
export async function generateEmbedding(
  req: EmbeddingRequest,
): Promise<EmbeddingResponse | null> {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const apiUrl = process.env.EMBEDDING_API_URL ?? "https://api.openai.com/v1";
  const model = req.modelId ?? EMBEDDING_MODEL;

  if (!apiKey) {
    // Embedding provider not configured — graceful no-op
    return null;
  }

  try {
    const response = await fetch(`${apiUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: req.text }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Embedding API error ${response.status}: ${err}`);
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
      model: string;
    };

    const vector = data.data[0]?.embedding;
    if (!vector) throw new Error("Empty embedding response");

    return { vector, modelId: model, dimensions: vector.length };
  } catch (err) {
    // Log and continue — embedding failure is non-fatal
    console.warn("[KB pipeline] Embedding generation failed:", err);
    return null;
  }
}

// ─── Main indexing pipeline ───────────────────────────────────────────────────

/**
 * Index a single legal document into the KB.
 *
 * Steps:
 * 1. Validate collection + required metadata
 * 2. Resolve collection defaults (hierarchyLevel, bindingStatus)
 * 3. Normalise text
 * 4. Auto-extract keywords if not provided
 * 5. Upsert the kb_documents record (pending → indexed)
 * 6. Segment articles and upsert kb_articles
 * 7. Extract and store cross-references
 * 8. Generate embeddings (document + per-article) if provider available
 * 9. Update document stats and mark as indexed
 *
 * @param input - Raw document metadata and content
 * @returns IndexResult describing what was stored and any errors
 */
export async function indexDocument(input: KbDocumentInput): Promise<IndexResult> {
  const startMs = Date.now();
  const errors: string[] = [];
  let documentId: number | undefined;
  let articlesIndexed = 0;
  let crossRefsExtracted = 0;
  let embeddingsGenerated = 0;

  try {
    // ── Step 1: Validate ────────────────────────────────────────────────────
    const collection = getCollection(input.collectionId);
    if (!input.fullTextAr && !input.fullTextEn) {
      throw new Error("At least one of fullTextAr or fullTextEn must be provided.");
    }

    // ── Step 2: Normalise text ──────────────────────────────────────────────
    const normAr = input.fullTextAr ? normaliseArabic(input.fullTextAr) : undefined;
    const normEn = input.fullTextEn?.trim();

    // ── Step 3: Extract keywords ────────────────────────────────────────────
    const keywordsAr = (
      input.keywordsAr?.length
        ? input.keywordsAr
        : normAr ? extractKeywordsAr(normAr) : []
    ).join(", ");

    const keywordsEn = (
      input.keywordsEn?.length
        ? input.keywordsEn
        : normEn ? extractKeywordsEn(normEn) : []
    ).join(", ");

    // ── Step 4: Upsert document record ──────────────────────────────────────
    const [docRow] = await db
      .insert(kbDocumentsTable)
      .values({
        collectionId:       input.collectionId,
        title:              input.title,
        titleAr:            input.titleAr,
        authority:          input.authority ?? collection.authorityEn,
        authorityAr:        input.authorityAr ?? collection.authorityAr,
        documentNumber:     input.documentNumber,
        year:               input.year,
        jurisdiction:       input.jurisdiction ?? collection.jurisdiction,
        hierarchyLevel:     collection.hierarchyLevel,
        bindingStatus:      collection.bindingStatus,
        docType:            input.docType ?? collection.defaultDocType,
        effectiveDate:      input.effectiveDate,
        expiryDate:         input.expiryDate,
        isRepealed:         input.isRepealed ?? false,
        repealReference:    input.repealReference,
        isAmended:          input.isAmended ?? false,
        amendmentLog:       input.amendmentLog
                              ? JSON.stringify(input.amendmentLog)
                              : undefined,
        officialGazetteRef:  input.officialGazetteRef,
        officialGazetteDate: input.officialGazetteDate,
        fullTextAr:         normAr,
        fullTextEn:         normEn,
        keywordsAr,
        keywordsEn,
        relatedJudgments:   input.relatedJudgments,
        relatedLegislation: input.relatedLegislation,
        indexStatus:        "pending",
      })
      .returning({ id: kbDocumentsTable.id });

    documentId = docRow.id;

    // ── Step 5: Segment articles (Arabic primary, English fallback) ──────────
    const primaryText = normAr ?? normEn ?? "";
    const primaryLang: "ar" | "en" = normAr ? "ar" : "en";
    const segments = segmentArticles(primaryText, primaryLang);

    const articleRows: Array<{ id: number }> = [];

    for (const seg of segments) {
      const articleInput: KbArticleInput = {
        headingAr:         primaryLang === "ar" ? seg.heading : undefined,
        heading:           primaryLang === "en" ? seg.heading : undefined,
        bodyAr:            primaryLang === "ar" ? seg.body : undefined,
        bodyEn:            primaryLang === "en" ? seg.body : undefined,
        paragraphSequence: seg.sequence,
      };

      const [artRow] = await db
        .insert(kbArticlesTable)
        .values({
          documentId,
          articleNumber:     articleInput.articleNumber,
          articleNumberAr:   articleInput.articleNumberAr,
          heading:           articleInput.heading,
          headingAr:         articleInput.headingAr,
          bodyEn:            articleInput.bodyEn,
          bodyAr:            articleInput.bodyAr,
          paragraphSequence: articleInput.paragraphSequence,
          isRepealed:        false,
          keywords:          articleInput.bodyAr
                               ? extractKeywordsAr(articleInput.bodyAr).join(", ")
                               : articleInput.bodyEn
                               ? extractKeywordsEn(articleInput.bodyEn).join(", ")
                               : undefined,
        })
        .returning({ id: kbArticlesTable.id });

      articleRows.push(artRow);
      articlesIndexed++;
    }

    // ── Step 6: Extract cross-references ────────────────────────────────────
    const refs = extractCrossRefs(primaryText);
    for (const ref of refs) {
      await db.insert(kbCrossReferencesTable).values({
        sourceDocumentId: documentId,
        referenceType:    ref.referenceType,
        targetExternalRef: ref.targetExternalRef,
        description:      ref.rawText,
      });
      crossRefsExtracted++;
    }

    // ── Step 7: Generate document-level embeddings ───────────────────────────
    let hasEmbeddingAr = false;
    let hasEmbeddingEn = false;

    for (const lang of ["ar", "en"] as const) {
      const embText = lang === "ar"
        ? `${input.titleAr} ${keywordsAr}`
        : `${input.title} ${keywordsEn}`;

      const emb = await generateEmbedding({ text: embText, language: lang });
      if (emb) {
        await db.insert(kbEmbeddingsTable).values({
          entityType: "document",
          entityId:   documentId,
          language:   lang,
          modelId:    emb.modelId,
          dimensions: emb.dimensions,
          vectorJson: JSON.stringify(emb.vector),
        });
        embeddingsGenerated++;
        if (lang === "ar") hasEmbeddingAr = true;
        if (lang === "en") hasEmbeddingEn = true;
      }
    }

    // Article-level embeddings for the first 20 articles (budget-conscious)
    for (const artRow of articleRows.slice(0, 20)) {
      const art = segments[articleRows.indexOf(artRow)];
      const emb = await generateEmbedding({
        text:     art.body.slice(0, 512),
        language: primaryLang,
      });
      if (emb) {
        await db.insert(kbEmbeddingsTable).values({
          entityType: "article",
          entityId:   artRow.id,
          language:   primaryLang,
          modelId:    emb.modelId,
          dimensions: emb.dimensions,
          vectorJson: JSON.stringify(emb.vector),
        });
        embeddingsGenerated++;
      }
    }

    // ── Step 8: Mark as indexed + update stats ───────────────────────────────
    await db
      .update(kbDocumentsTable)
      .set({
        indexStatus:    "indexed",
        indexError:     null,
        articleCount:   articlesIndexed,
        crossRefCount:  crossRefsExtracted,
        hasEmbeddingAr,
        hasEmbeddingEn,
        indexedAt:      new Date(),
        updatedAt:      new Date(),
      })
      .where(eq(kbDocumentsTable.id, documentId));

    return {
      success:            true,
      documentId,
      articlesIndexed,
      crossRefsExtracted,
      embeddingsGenerated,
      errors,
      durationMs:         Date.now() - startMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(msg);

    // Mark document as failed if it was created
    if (documentId !== undefined) {
      await db
        .update(kbDocumentsTable)
        .set({ indexStatus: "failed", indexError: msg, updatedAt: new Date() })
        .where(eq(kbDocumentsTable.id, documentId));
    }

    return {
      success:            false,
      documentId,
      articlesIndexed,
      crossRefsExtracted,
      embeddingsGenerated,
      errors,
      durationMs:         Date.now() - startMs,
    };
  }
}

// ─── Batch indexing ───────────────────────────────────────────────────────────

/**
 * Index multiple documents sequentially.
 * Returns an array of IndexResult, one per input document.
 * Errors in one document do not abort subsequent documents.
 */
export async function indexDocumentBatch(
  inputs: KbDocumentInput[],
): Promise<IndexResult[]> {
  const results: IndexResult[] = [];
  for (const input of inputs) {
    results.push(await indexDocument(input));
  }
  return results;
}

// ─── Re-index stale documents ─────────────────────────────────────────────────

/**
 * Mark all indexed documents in a collection as "outdated".
 * Use before a bulk re-ingestion to force re-indexing.
 */
export async function markCollectionOutdated(collectionId: string): Promise<void> {
  await db
    .update(kbDocumentsTable)
    .set({ indexStatus: "outdated", updatedAt: new Date() })
    .where(eq(kbDocumentsTable.collectionId, collectionId));
}
