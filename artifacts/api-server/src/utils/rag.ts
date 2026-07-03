/**
 * Shared RAG utilities — used by both /assistant and /legal-os routes.
 * Exported so both routers can import without duplicating code.
 */

import { eq, and, inArray } from "drizzle-orm";
import { db, documentsTable, legalSourcesTable } from "@workspace/db";

/** Characters per chunk when splitting large documents */
export const CHUNK_CHARS = 1200;
/** Chunk overlap to preserve sentence context */
export const CHUNK_OVERLAP = 150;
/** Number of most-relevant document chunks to include per source */
export const CHUNKS_PER_SOURCE = 3;
/** Top-K sources to include in the final RAG context */
export const TOP_K = 8;

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
}> {
  const queryTokens = tokenise(query);
  const sourceIndex = new Map<string, { title: string; type: "document" | "legal_source" }>();

  const [metaDocs, metaSrcs] = await Promise.all([
    db
      .select({ id: documentsTable.id, name: documentsTable.originalName, keywords: documentsTable.keywords })
      .from(documentsTable)
      .where(eq(documentsTable.uploadedById, userId)),
    db
      .select({
        id: legalSourcesTable.id,
        title: legalSourcesTable.title,
        titleAr: legalSourcesTable.titleAr,
        jurisdiction: legalSourcesTable.jurisdiction,
        referenceNumber: legalSourcesTable.referenceNumber,
        year: legalSourcesTable.year,
        keywords: legalSourcesTable.subject,
        summaryAr: legalSourcesTable.summaryAr,
        summary: legalSourcesTable.summary,
      })
      .from(legalSourcesTable),
  ]);

  const scoredDocIds = metaDocs
    .map((d) => ({
      id: d.id,
      name: d.name,
      score: pinnedDocIds.includes(d.id)
        ? 9999
        : relevanceScore(queryTokens, `${d.name} ${d.keywords ?? ""}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((d) => ({ id: d.id, name: d.name }));

  const scoredSrcIds = metaSrcs
    .map((s) => ({
      id: s.id,
      title: s.titleAr ?? s.title,
      titleEn: s.title,
      jurisdiction: s.jurisdiction,
      referenceNumber: s.referenceNumber,
      year: s.year,
      summaryText: s.summaryAr ?? s.summary ?? "",
      score: pinnedSrcIds.includes(s.id)
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
    const chunks = topChunks(content, queryTokens);
    const tag = `DOC:${doc.id}`;
    sourceIndex.set(tag, { title: doc.name, type: "document" });
    parts.push(
      `[${tag}] ${doc.name}\n` +
      (chunks.length > 0 ? chunks.join("\n…\n") : "(no text content available)"),
    );
  }

  for (const src of scoredSrcIds) {
    const text = srcContentMap.get(src.id) ?? src.summaryText;
    const chunks = topChunks(text, queryTokens, 2);
    const tag = `SRC:${src.id}`;
    sourceIndex.set(tag, { title: src.title, type: "legal_source" });
    parts.push(
      `[${tag}] ${src.title}` +
      (src.referenceNumber ? ` (${src.referenceNumber})` : "") +
      (src.year ? `, ${src.year}` : "") +
      ` — ${src.jurisdiction}\n` +
      (chunks.length > 0 ? chunks.join("\n…\n") : "(no content available)"),
    );
  }

  return {
    context: parts.join("\n\n" + "─".repeat(50) + "\n\n"),
    sourceIndex,
  };
}

// ─── Citation helpers ──────────────────────────────────────────────────────────

export function extractCitationTokens(text: string): Array<{ token: string; prefix: string; sourceId: number }> {
  const pattern = /\[(DOC|SRC):(\d+)\]/g;
  const seen = new Set<string>();
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
  const title = doc.originalName.replace(/\.[^.]+$/, "");
  const year = doc.uploadedAt ? new Date(doc.uploadedAt).getFullYear() : new Date().getFullYear();
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
  const year = src.year ?? new Date().getFullYear();
  const ref = src.referenceNumber ? ` رقم ${src.referenceNumber}،` : "";
  return {
    harvard: `${titleAr} (${year}). ${src.jurisdiction}.`,
    apa:     `${titleAr}. (${year}). ${src.jurisdiction}.`,
    uaeGov:  `${titleAr}،${ref} سنة ${year}، ${src.jurisdiction}`,
  };
}

export async function resolveCitations(
  tokens: Array<{ token: string; prefix: string; sourceId: number }>,
  _sourceIndex: Map<string, { title: string; type: "document" | "legal_source" }>,
  /** Scopes DOC lookups to this user's uploaded documents to prevent cross-user metadata leakage. */
  userId?: number,
): Promise<Array<{ token: string; title: string; type: "document" | "legal_source"; sourceId: number; formats: Record<string, string> }>> {
  const docTokens  = tokens.filter((t) => t.prefix === "DOC");
  const srcTokens  = tokens.filter((t) => t.prefix === "SRC");

  const [docRows, srcRows] = await Promise.all([
    docTokens.length > 0
      ? db.select({ id: documentsTable.id, originalName: documentsTable.originalName, uploadedAt: documentsTable.uploadedAt })
          .from(documentsTable)
          .where(
            userId !== undefined
              ? and(inArray(documentsTable.id, docTokens.map((t) => t.sourceId)), eq(documentsTable.uploadedById, userId))
              : inArray(documentsTable.id, docTokens.map((t) => t.sourceId)),
          )
      : Promise.resolve([]),
    srcTokens.length > 0
      ? db.select({ id: legalSourcesTable.id, title: legalSourcesTable.title, titleAr: legalSourcesTable.titleAr, referenceNumber: legalSourcesTable.referenceNumber, year: legalSourcesTable.year, jurisdiction: legalSourcesTable.jurisdiction })
          .from(legalSourcesTable)
          .where(inArray(legalSourcesTable.id, srcTokens.map((t) => t.sourceId)))
      : Promise.resolve([]),
  ]);

  const docMap = new Map(docRows.map((d) => [d.id, d]));
  const srcMap = new Map(srcRows.map((s) => [s.id, s]));

  type CitRow = { token: string; title: string; type: "document" | "legal_source"; sourceId: number; formats: Record<string, string> };
  const results: CitRow[] = [];
  for (const { token, prefix, sourceId } of tokens) {
    if (prefix === "DOC") {
      const doc = docMap.get(sourceId);
      if (doc) results.push({ token, title: doc.originalName, type: "document", sourceId, formats: makeDocCitations(doc) });
    } else {
      const src = srcMap.get(sourceId);
      if (src) results.push({ token, title: src.titleAr ?? src.title, type: "legal_source", sourceId, formats: makeSrcCitations(src) });
    }
  }
  return results;
}
