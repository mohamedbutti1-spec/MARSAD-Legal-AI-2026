/**
 * Phase 54 — UAE Legal Knowledge Base: Ingestion Runner
 *
 * Orchestrates the full ingestion run in priority order:
 *   Priority 1:  UAE Constitution
 *   Priority 2:  Federal Decree-Laws
 *   Priority 3:  Federal Laws
 *   Priority 4:  Executive Regulations
 *   Priority 5:  Cabinet Decisions + Ministerial Decisions
 *   Priority 6:  Official Gazette
 *   Priority 7:  Supreme Court Principles
 *   Priority 8:  Explanatory Memoranda + Official Guidance
 *
 * For each document:
 *   ✦ Validates metadata
 *   ✦ Detects amendments automatically (via amendmentLog field)
 *   ✦ Detects repealed legislation (via isRepealed flag)
 *   ✦ Builds article-by-article segmentation
 *   ✦ Extracts cross-references from text
 *   ✦ Generates Arabic + English semantic embeddings (if provider configured)
 *   ✦ Builds amendment graph edges (repeals / amends cross-reference types)
 *   ✦ Records in the legal hierarchy graph
 *
 * Usage (standalone):
 *   cd artifacts/api-server
 *   npx tsx src/kb/ingestion/runner.ts
 *
 * Usage (programmatic):
 *   import { runIngestion } from "./ingestion/runner.js";
 *   const report = await runIngestion();
 */

import { indexDocument } from "../pipeline.js";
import { generateIngestionReport, printReport } from "./report.js";
import type { KbDocumentInput, IndexResult } from "../types.js";

// ─── Seed imports ─────────────────────────────────────────────────────────────

import { UAE_CONSTITUTION_SEED }     from "./seeds/uae-constitution.js";
import { FEDERAL_DECREE_LAWS_SEED }  from "./seeds/federal-decree-laws.js";
import { FEDERAL_LAWS_SEED }         from "./seeds/federal-laws.js";
import { EXECUTIVE_REGULATIONS_SEED } from "./seeds/executive-regulations.js";
import { CABINET_MINISTERIAL_SEED }  from "./seeds/cabinet-ministerial.js";
import { OFFICIAL_GAZETTE_SEED }     from "./seeds/official-gazette.js";
import { SUPREME_COURT_PRINCIPLES_SEED } from "./seeds/supreme-court-principles.js";
import { OFFICIAL_GUIDANCE_SEED }    from "./seeds/official-guidance.js";

// ─── Ingestion manifest ───────────────────────────────────────────────────────

/**
 * Complete ordered ingestion manifest.
 * Documents are processed in the order listed here.
 * Priority 1 first (constitution), advisory material last.
 */
const INGESTION_MANIFEST: Array<{
  priority: number;
  label: string;
  documents: KbDocumentInput[];
}> = [
  { priority: 1, label: "UAE Constitution",           documents: [UAE_CONSTITUTION_SEED] },
  { priority: 2, label: "Federal Decree-Laws",        documents: FEDERAL_DECREE_LAWS_SEED },
  { priority: 3, label: "Federal Laws",               documents: FEDERAL_LAWS_SEED },
  { priority: 4, label: "Executive Regulations",      documents: EXECUTIVE_REGULATIONS_SEED },
  { priority: 5, label: "Cabinet & Ministerial",      documents: CABINET_MINISTERIAL_SEED },
  { priority: 6, label: "Official Gazette",           documents: OFFICIAL_GAZETTE_SEED },
  { priority: 7, label: "Court Principles",           documents: SUPREME_COURT_PRINCIPLES_SEED },
  { priority: 8, label: "Guidance & Memoranda",       documents: OFFICIAL_GUIDANCE_SEED },
];

// ─── Amendment graph builder ──────────────────────────────────────────────────

/**
 * After indexing all documents, scan for amendment and repeal relationships
 * and build the cross-reference graph edges between them.
 * This is called after the primary indexing pass.
 */
async function buildAmendmentGraph(
  _indexed: Map<string, number>,
): Promise<number> {
  const { db } = await import("@workspace/db");
  const { kbDocumentsTable, kbCrossReferencesTable } = await import("@workspace/db");
  const { eq, or } = await import("drizzle-orm");

  let edgesCreated = 0;

  // Find all amended documents and link to their amending documents.
  const amendedDocs = await db
    .select({
      id:           kbDocumentsTable.id,
      titleAr:      kbDocumentsTable.titleAr,
      title:        kbDocumentsTable.title,
      amendmentLog: kbDocumentsTable.amendmentLog,
    })
    .from(kbDocumentsTable)
    .where(eq(kbDocumentsTable.isAmended, true));

  // Pre-build a lookup map: both Arabic and English titles → document id.
  const allDocs = await db
    .select({
      id:     kbDocumentsTable.id,
      titleAr: kbDocumentsTable.titleAr,
      title:   kbDocumentsTable.title,
      docNum:  kbDocumentsTable.documentNumber,
    })
    .from(kbDocumentsTable);

  const byTitle = new Map<string, number>();
  for (const d of allDocs) {
    if (d.titleAr) byTitle.set(d.titleAr.trim(), d.id);
    if (d.title)   byTitle.set(d.title.trim(),   d.id);
    if (d.docNum)  byTitle.set(d.docNum.trim(),   d.id);
  }

  for (const doc of amendedDocs) {
    if (!doc.amendmentLog) continue;
    try {
      const amendments = JSON.parse(doc.amendmentLog) as Array<{
        amendedBy: string; article?: string; date?: string; description?: string;
      }>;
      for (const amendment of amendments) {
        // Look up the amending instrument by title (Arabic or English) or number.
        const amenderId = byTitle.get(amendment.amendedBy.trim());

        if (!amenderId) {
          // Amending document not indexed yet — record as external ref only.
          // Do NOT create a self-referential edge.
          await db.insert(kbCrossReferencesTable).values({
            sourceDocumentId:  doc.id,
            targetDocumentId:  null,
            referenceType:     "amends",
            targetExternalRef: amendment.amendedBy,
            description:       amendment.description ?? amendment.article
              ? `يُعدّل ${amendment.article ?? amendment.amendedBy}`
              : "تعديل — المصدر خارج قاعدة المعرفة",
          }).onConflictDoNothing();
        } else if (amenderId !== doc.id) {
          // The amending document references the amended (target) document.
          // Edge: amender ──amends──▶ doc (which was amended)
          await db.insert(kbCrossReferencesTable).values({
            sourceDocumentId:  amenderId,
            targetDocumentId:  doc.id,
            referenceType:     "amends",
            description:       amendment.description ?? amendment.article
              ? `يُعدّل المادة ${amendment.article}`
              : "تعديل عام",
          }).onConflictDoNothing();
        }
        edgesCreated++;
      }
    } catch {
      // Malformed amendmentLog — skip silently
    }
  }

  return edgesCreated;
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export interface RunIngestionOptions {
  /** Only run specific priority groups (1–8). Empty = run all. */
  priorities?: number[];
  /** Skip documents whose titleAr is already indexed (idempotent). */
  skipExisting?: boolean;
  /** Maximum documents to process per group (useful for testing). */
  limitPerGroup?: number;
}

export async function runIngestion(
  opts: RunIngestionOptions = {},
): Promise<ReturnType<typeof generateIngestionReport>> {
  const startMs = Date.now();
  const runResults: Array<{ title: string; result: IndexResult }> = [];

  const { db } = await import("@workspace/db");
  const { kbDocumentsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  console.log("\n[KB Ingestion] Starting UAE Legal Knowledge Base ingestion...");
  console.log(`[KB Ingestion] ${new Date().toISOString()}\n`);

  // Build a map of already-indexed titleAr → documentId for deduplication
  const existingDocs = await db
    .select({ titleAr: kbDocumentsTable.titleAr, id: kbDocumentsTable.id, status: kbDocumentsTable.indexStatus })
    .from(kbDocumentsTable);
  const existingMap = new Map(existingDocs.map((d) => [d.titleAr, { id: d.id, status: d.status }]));

  for (const group of INGESTION_MANIFEST) {
    if (opts.priorities?.length && !opts.priorities.includes(group.priority)) continue;

    console.log(`[KB Ingestion] Priority ${group.priority}: ${group.label} (${group.documents.length} documents)`);

    const docs = opts.limitPerGroup
      ? group.documents.slice(0, opts.limitPerGroup)
      : group.documents;

    for (const doc of docs) {
      // Skip if already indexed and skipExisting is set
      if (opts.skipExisting) {
        const existing = existingMap.get(doc.titleAr);
        if (existing?.status === "indexed") {
          console.log(`  ↩ Skipped (already indexed): ${doc.titleAr.slice(0, 60)}`);
          runResults.push({
            title: doc.titleAr,
            result: {
              success: true, documentId: existing.id,
              articlesIndexed: 0, crossRefsExtracted: 0, embeddingsGenerated: 0,
              errors: [], durationMs: 0,
            },
          });
          continue;
        }
      }

      console.log(`  → Indexing: ${doc.titleAr.slice(0, 70)}...`);

      try {
        const result = await indexDocument(doc);
        runResults.push({ title: doc.titleAr, result });

        if (result.success) {
          const embNote = result.embeddingsGenerated > 0
            ? ` | ${result.embeddingsGenerated} embeddings`
            : " | no embeddings (provider not configured)";
          console.log(
            `  ✓ Indexed: doc #${result.documentId}` +
            ` | ${result.articlesIndexed} articles` +
            ` | ${result.crossRefsExtracted} cross-refs` +
            embNote +
            ` | ${result.durationMs}ms`,
          );
        } else {
          console.error(`  ✗ Failed:  ${result.errors.join("; ")}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ Unexpected error: ${msg}`);
        runResults.push({
          title: doc.titleAr,
          result: {
            success: false, articlesIndexed: 0, crossRefsExtracted: 0,
            embeddingsGenerated: 0, errors: [msg], durationMs: 0,
          },
        });
      }
    }
    console.log("");
  }

  // Build amendment graph after all documents are indexed
  console.log("[KB Ingestion] Building amendment cross-reference graph...");
  const indexed = new Map(
    existingDocs
      .filter((d) => d.status === "indexed")
      .map((d) => [d.titleAr, d.id]),
  );
  const amendEdges = await buildAmendmentGraph(indexed);
  console.log(`[KB Ingestion] Amendment graph: ${amendEdges} edges created\n`);

  // Generate and print report
  const report = await generateIngestionReport(runResults, startMs);
  printReport(report);

  return report;
}

// ─── Standalone execution ─────────────────────────────────────────────────────

const isMain =
  process.argv[1]?.endsWith("runner.ts") ||
  process.argv[1]?.endsWith("runner.js");

if (isMain) {
  const skipExisting = !process.argv.includes("--force");
  runIngestion({ skipExisting })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[KB Ingestion] Fatal error:", err);
      process.exit(1);
    });
}
