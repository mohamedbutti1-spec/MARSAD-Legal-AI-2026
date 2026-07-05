/**
 * Phase 54 — UAE Legal Knowledge Base: Ingestion Report Generator
 *
 * Produces a structured, human-readable ingestion report after a batch run.
 * The report covers:
 *   - Collection-level summary (documents indexed, articles, cross-refs, embeddings)
 *   - Per-document status (indexed / failed / skipped)
 *   - Coverage gaps (what was planned but not ingested)
 *   - Amendment graph statistics
 *   - Embedding coverage
 */

import { db } from "@workspace/db";
import { kbDocumentsTable, kbArticlesTable, kbCrossReferencesTable, kbEmbeddingsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import type { IndexResult } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionStats {
  collectionId: string;
  documentsIndexed: number;
  documentsFailed: number;
  documentsPending: number;
  totalArticles: number;
  totalCrossRefs: number;
  embeddingsArCount: number;
  embeddingsEnCount: number;
}

export interface IngestionReport {
  timestamp: string;
  durationMs: number;
  totalDocumentsAttempted: number;
  totalDocumentsIndexed: number;
  totalDocumentsFailed: number;
  totalArticlesIndexed: number;
  totalCrossRefsExtracted: number;
  totalEmbeddingsGenerated: number;
  byCollection: CollectionStats[];
  failedDocuments: Array<{ title: string; errors: string[] }>;
  coverageGaps: string[];
  amendmentGraphEdges: number;
  hierarchyLevelsRepresented: string[];
  jurisdictionsCovered: string[];
  summary: string;
}

// ─── Collection summary query ─────────────────────────────────────────────────

async function getCollectionStats(): Promise<CollectionStats[]> {
  const rows = await db
    .select({
      collectionId: kbDocumentsTable.collectionId,
      indexStatus:  kbDocumentsTable.indexStatus,
      docCount:     count(kbDocumentsTable.id),
    })
    .from(kbDocumentsTable)
    .groupBy(kbDocumentsTable.collectionId, kbDocumentsTable.indexStatus);

  const collectionMap = new Map<string, CollectionStats>();

  for (const row of rows) {
    if (!collectionMap.has(row.collectionId)) {
      collectionMap.set(row.collectionId, {
        collectionId:     row.collectionId,
        documentsIndexed: 0,
        documentsFailed:  0,
        documentsPending: 0,
        totalArticles:    0,
        totalCrossRefs:   0,
        embeddingsArCount: 0,
        embeddingsEnCount: 0,
      });
    }
    const cs = collectionMap.get(row.collectionId)!;
    if (row.indexStatus === "indexed")  cs.documentsIndexed = Number(row.docCount);
    if (row.indexStatus === "failed")   cs.documentsFailed  = Number(row.docCount);
    if (row.indexStatus === "pending")  cs.documentsPending = Number(row.docCount);
  }

  // Article counts per collection
  const articleRows = await db
    .select({
      collectionId: kbDocumentsTable.collectionId,
      articleCount: sql<number>`SUM(${kbDocumentsTable.articleCount})`,
    })
    .from(kbDocumentsTable)
    .groupBy(kbDocumentsTable.collectionId);

  for (const r of articleRows) {
    const cs = collectionMap.get(r.collectionId);
    if (cs) cs.totalArticles = Number(r.articleCount) || 0;
  }

  // Cross-ref counts per collection
  const xrefRows = await db
    .select({
      collectionId: kbDocumentsTable.collectionId,
      xrefCount:    sql<number>`SUM(${kbDocumentsTable.crossRefCount})`,
    })
    .from(kbDocumentsTable)
    .groupBy(kbDocumentsTable.collectionId);

  for (const r of xrefRows) {
    const cs = collectionMap.get(r.collectionId);
    if (cs) cs.totalCrossRefs = Number(r.xrefCount) || 0;
  }

  // Embedding flags per collection
  const embArRows = await db
    .select({
      collectionId: kbDocumentsTable.collectionId,
      arCount: sql<number>`COUNT(*) FILTER (WHERE ${kbDocumentsTable.hasEmbeddingAr} = TRUE)`,
      enCount: sql<number>`COUNT(*) FILTER (WHERE ${kbDocumentsTable.hasEmbeddingEn} = TRUE)`,
    })
    .from(kbDocumentsTable)
    .groupBy(kbDocumentsTable.collectionId);

  for (const r of embArRows) {
    const cs = collectionMap.get(r.collectionId);
    if (cs) {
      cs.embeddingsArCount = Number(r.arCount) || 0;
      cs.embeddingsEnCount = Number(r.enCount) || 0;
    }
  }

  return Array.from(collectionMap.values()).sort((a, b) =>
    a.collectionId.localeCompare(b.collectionId),
  );
}

// ─── Main report generator ────────────────────────────────────────────────────

export async function generateIngestionReport(
  runResults: Array<{ title: string; result: IndexResult }>,
  startMs: number,
): Promise<IngestionReport> {
  const durationMs = Date.now() - startMs;
  const byCollection = await getCollectionStats();

  // Run-scoped counters (derived from this run's results, not DB totals)
  const runIndexed  = runResults.filter((r) => r.result.success).length;
  const runFailed   = runResults.filter((r) => !r.result.success).length;
  const runSkipped  = runResults.length - runIndexed - runFailed;

  // Cumulative DB totals (all-time, across all runs)
  const totalArticles = byCollection.reduce((s, c) => s + c.totalArticles, 0);
  const totalXrefs    = byCollection.reduce((s, c) => s + c.totalCrossRefs, 0);

  // Cross-ref graph stats
  const [{ count: xrefTotal }] = await db
    .select({ count: count() })
    .from(kbCrossReferencesTable);

  // Amendment graph: edges of type "amends"
  const [{ count: amendCount }] = await db
    .select({ count: count() })
    .from(kbCrossReferencesTable)
    .where(eq(kbCrossReferencesTable.referenceType, "amends"));

  // Hierarchy levels and jurisdictions represented
  const levelRows = await db
    .selectDistinct({ level: kbDocumentsTable.hierarchyLevel })
    .from(kbDocumentsTable)
    .where(eq(kbDocumentsTable.indexStatus, "indexed"));

  const jurisdRows = await db
    .selectDistinct({ jur: kbDocumentsTable.jurisdiction })
    .from(kbDocumentsTable)
    .where(eq(kbDocumentsTable.indexStatus, "indexed"));

  // Failed documents
  const failedDocs = runResults
    .filter((r) => !r.result.success)
    .map((r) => ({ title: r.title, errors: r.result.errors }));

  // Embedding totals
  const [{ count: embTotal }] = await db
    .select({ count: count() })
    .from(kbEmbeddingsTable);

  // Coverage gaps: collections with 0 indexed documents
  const ALL_COLLECTIONS = [
    "uae_constitution", "federal_laws", "federal_decree_laws",
    "executive_regulations", "cabinet_decisions", "ministerial_decisions",
    "circulars", "explanatory_memoranda", "uae_supreme_court",
    "federal_supreme_court", "federal_admin_judiciary", "abu_dhabi_courts",
    "dubai_courts", "rak_courts", "constitutional_judgments",
    "official_gazette", "official_guidance",
  ];
  const indexedCollections = new Set(
    byCollection.filter((c) => c.documentsIndexed > 0).map((c) => c.collectionId),
  );
  const coverageGaps = ALL_COLLECTIONS.filter((c) => !indexedCollections.has(c));

  const report: IngestionReport = {
    timestamp:                  new Date().toISOString(),
    durationMs,
    totalDocumentsAttempted:    runResults.length,
    totalDocumentsIndexed:      runIndexed,
    totalDocumentsFailed:       runFailed,
    totalArticlesIndexed:       totalArticles,
    totalCrossRefsExtracted:    Number(xrefTotal) || totalXrefs,
    totalEmbeddingsGenerated:   Number(embTotal) || 0,
    byCollection,
    failedDocuments:            failedDocs,
    coverageGaps,
    amendmentGraphEdges:        Number(amendCount) || 0,
    hierarchyLevelsRepresented: levelRows.map((r) => r.level ?? "").filter(Boolean),
    jurisdictionsCovered:       jurisdRows.map((r) => r.jur ?? "").filter(Boolean),
    summary:                    buildSummaryText(
      runResults.length, runIndexed, runFailed, runSkipped,
      totalArticles, Number(xrefTotal) || totalXrefs,
      Number(embTotal), coverageGaps, durationMs,
    ),
  };

  return report;
}

function buildSummaryText(
  attempted: number, indexed: number, failed: number, skipped: number,
  articles: number, xrefs: number, embeddings: number,
  gaps: string[], durationMs: number,
): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════════════",
    "UAE LEGAL KNOWLEDGE BASE — INGESTION REPORT",
    "═══════════════════════════════════════════════════════════",
    "",
    `This run:      ${attempted} attempted | ${indexed} indexed | ${failed} failed | ${skipped} skipped`,
    `Articles:      ${articles} article segments indexed`,
    `Cross-refs:    ${xrefs} cross-reference edges extracted`,
    `Embeddings:    ${embeddings} vectors generated`,
    `Duration:      ${(durationMs / 1000).toFixed(1)}s`,
    "",
    gaps.length > 0
      ? `Coverage gaps (${gaps.length} collections not yet populated):\n  • ${gaps.join("\n  • ")}`
      : "✓ All 17 collections have at least one indexed document",
    "",
    embeddings === 0
      ? "⚠  Semantic embeddings not generated — set EMBEDDING_API_KEY to enable vector search"
      : `✓ Semantic embeddings available (keyword + vector hybrid retrieval active)`,
    "═══════════════════════════════════════════════════════════",
  ];
  return lines.join("\n");
}

// ─── Print report to console ──────────────────────────────────────────────────

export function printReport(report: IngestionReport): void {
  console.log(report.summary);
  console.log("\nPer-collection breakdown:");
  console.log(
    report.byCollection
      .filter((c) => c.documentsIndexed + c.documentsFailed + c.documentsPending > 0)
      .map(
        (c) =>
          `  ${c.collectionId.padEnd(30)} ` +
          `docs: ${String(c.documentsIndexed).padStart(3)} indexed` +
          (c.documentsFailed  > 0 ? ` | ${c.documentsFailed} FAILED` : "") +
          (c.totalArticles    > 0 ? ` | ${c.totalArticles} articles` : "") +
          (c.embeddingsArCount > 0 ? ` | emb-ar: ${c.embeddingsArCount}` : ""),
      )
      .join("\n"),
  );

  if (report.failedDocuments.length > 0) {
    console.log("\nFailed documents:");
    for (const f of report.failedDocuments) {
      console.log(`  ✗ ${f.title}`);
      for (const e of f.errors) console.log(`      ${e}`);
    }
  }
}
