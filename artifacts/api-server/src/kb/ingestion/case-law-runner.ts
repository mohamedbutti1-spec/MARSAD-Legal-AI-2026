/**
 * Phase 55 — UAE Case Law Corpus: Dedicated Case Law Ingestion Runner
 *
 * Orchestrates ingestion of officially published UAE judicial materials in
 * priority order, then builds:
 *   • Duplicate detection  — by documentNumber + year + jurisdiction
 *   • Citation graph       — cites cross-refs from relatedJudgments JSON
 *   • Precedent graph      — resolved links from cited judgments in KB
 *   • Legislation linkage  — interpreted_by cross-refs from relatedLegislation JSON
 *   • Overruled detection  — scans text for supersession markers → related cross-refs
 *
 * Usage (standalone):
 *   cd artifacts/api-server
 *   npx tsx src/kb/ingestion/case-law-runner.ts
 *   npx tsx src/kb/ingestion/case-law-runner.ts --force   # re-index all
 *
 * Usage (programmatic):
 *   import { runCaseLawIngestion } from "./ingestion/case-law-runner.js";
 *   const report = await runCaseLawIngestion();
 */

import { indexDocument } from "../pipeline.js";
import type { KbDocumentInput, IndexResult } from "../types.js";

// ─── Seed imports ─────────────────────────────────────────────────────────────

import { CASE_LAW_FEDERAL_SUPREME_COURT_SEED }    from "./seeds/case-law-federal-supreme-court.js";
import { CASE_LAW_CONSTITUTIONAL_SEED }            from "./seeds/case-law-constitutional.js";
import { CASE_LAW_DUBAI_CASSATION_SEED }           from "./seeds/case-law-dubai-cassation.js";
import { CASE_LAW_ABU_DHABI_CASSATION_SEED }       from "./seeds/case-law-abu-dhabi-cassation.js";
import { CASE_LAW_RAK_CASSATION_SEED }             from "./seeds/case-law-rak-cassation.js";
import { CASE_LAW_FEDERAL_ADMIN_SEED }             from "./seeds/case-law-federal-admin.js";
import { CASE_LAW_FEDERAL_ADMIN_EXPANDED_SEED }    from "./seeds/case-law-federal-admin-expanded.js";

// ─── Ingestion manifest ───────────────────────────────────────────────────────

const CASE_LAW_MANIFEST: Array<{
  priority: number;
  label: string;
  documents: KbDocumentInput[];
}> = [
  { priority: 1, label: "Federal Supreme Court (Civil / Commercial / Penal / Labour / Administrative)",
    documents: CASE_LAW_FEDERAL_SUPREME_COURT_SEED },
  { priority: 2, label: "Federal Constitutional Decisions",
    documents: CASE_LAW_CONSTITUTIONAL_SEED },
  { priority: 3, label: "Dubai Court of Cassation Published Principles",
    documents: CASE_LAW_DUBAI_CASSATION_SEED },
  { priority: 4, label: "Abu Dhabi Court of Cassation Published Principles",
    documents: CASE_LAW_ABU_DHABI_CASSATION_SEED },
  { priority: 5, label: "Ras Al Khaimah Court of Cassation Published Principles",
    documents: CASE_LAW_RAK_CASSATION_SEED },
  { priority: 6, label: "Federal Administrative Judiciary Published Principles",
    documents: CASE_LAW_FEDERAL_ADMIN_SEED },
  { priority: 7, label: "Federal Administrative Judiciary — Expanded Corpus (Phase 58)",
    documents: CASE_LAW_FEDERAL_ADMIN_EXPANDED_SEED },
];

// ─── Duplicate detection ──────────────────────────────────────────────────────

/**
 * Detect whether a judgment is already indexed.
 * Checks by (1) titleAr exact match and (2) documentNumber + year + jurisdiction
 * to catch the same decision indexed under a different title translation.
 */
async function detectDuplicate(doc: KbDocumentInput): Promise<{
  isDuplicate: boolean;
  existingId?: number;
  reason?: string;
}> {
  const { db } = await import("@workspace/db");
  const { kbDocumentsTable } = await import("@workspace/db");
  const { and, eq, isNotNull } = await import("drizzle-orm");

  // 1. Exact title match (idempotent run protection)
  const [byTitle] = await db
    .select({ id: kbDocumentsTable.id, status: kbDocumentsTable.indexStatus })
    .from(kbDocumentsTable)
    .where(eq(kbDocumentsTable.titleAr, doc.titleAr))
    .limit(1);

  if (byTitle?.status === "indexed") {
    return { isDuplicate: true, existingId: byTitle.id, reason: "title-match" };
  }

  // 2. documentNumber + year + jurisdiction — catches same decision, different title
  if (doc.documentNumber && doc.year) {
    const [byNum] = await db
      .select({ id: kbDocumentsTable.id, status: kbDocumentsTable.indexStatus })
      .from(kbDocumentsTable)
      .where(
        and(
          eq(kbDocumentsTable.documentNumber, doc.documentNumber),
          eq(kbDocumentsTable.year, doc.year),
          eq(kbDocumentsTable.jurisdiction, doc.jurisdiction),
          isNotNull(kbDocumentsTable.id),
        ),
      )
      .limit(1);

    if (byNum?.status === "indexed") {
      return { isDuplicate: true, existingId: byNum.id, reason: "docnum-year-jurisdiction" };
    }
  }

  return { isDuplicate: false };
}

// ─── Citation graph builder ───────────────────────────────────────────────────

/**
 * After all documents are indexed, resolve relatedJudgments JSON on each
 * document and create `cites` cross-reference edges.
 *
 * For citations within the KB → targetDocumentId is set.
 * For citations outside the KB → targetExternalRef is set (no self-ref).
 *
 * Returns total edges created.
 */
async function buildCitationGraph(): Promise<number> {
  const { db } = await import("@workspace/db");
  const { kbDocumentsTable, kbCrossReferencesTable } = await import("@workspace/db");
  const { eq, and } = await import("drizzle-orm");

  let edgesCreated = 0;

  // Load all indexed case law documents with relatedJudgments metadata
  const caseLawDocs = await db
    .select({
      id:               kbDocumentsTable.id,
      titleAr:          kbDocumentsTable.titleAr,
      authorityAr:      kbDocumentsTable.authorityAr,
      documentNumber:   kbDocumentsTable.documentNumber,
      year:             kbDocumentsTable.year,
      relatedJudgments: kbDocumentsTable.relatedJudgments,
    })
    .from(kbDocumentsTable)
    .where(
      and(
        eq(kbDocumentsTable.collectionId, "uae_case_law"),
        eq(kbDocumentsTable.indexStatus, "indexed"),
      ),
    );

  // Pre-build lookup: authorityAr_normalized|caseNumber_normalized|year → docId
  // Digest documents don't carry individual case numbers, so resolution is typically
  // external. Index is built for future individual judgment entries.
  const caseIndex = new Map<string, number>();
  for (const doc of caseLawDocs) {
    // Key: normalised authority + documentNumber + year
    if (doc.documentNumber && doc.year && doc.authorityAr) {
      const key = `${doc.authorityAr.trim()}|${doc.documentNumber.trim()}|${doc.year}`
        .toLowerCase().replace(/\s+/g, " ");
      caseIndex.set(key, doc.id);
    }
  }

  for (const sourceDoc of caseLawDocs) {
    if (!sourceDoc.relatedJudgments) continue;

    let citations: Array<{
      court?: string;
      number?: string;
      year?: number;
      topic?: string;
    }>;

    try {
      citations = JSON.parse(sourceDoc.relatedJudgments);
    } catch {
      continue; // Malformed JSON — skip
    }

    for (const cite of citations) {
      if (!cite.number && !cite.court) continue;

      // Attempt to resolve within KB using CITED court (not source jurisdiction)
      const lookupKey = cite.court && cite.number && cite.year
        ? `${cite.court.trim()}|${cite.number.trim()}|${cite.year}`
            .toLowerCase().replace(/\s+/g, " ")
        : undefined;

      const targetId = lookupKey ? caseIndex.get(lookupKey) : undefined;

      // Skip self-references
      if (targetId !== undefined && targetId === sourceDoc.id) continue;

      const inserted = await db.insert(kbCrossReferencesTable).values({
        sourceDocumentId: sourceDoc.id,
        targetDocumentId: targetId ?? null,
        referenceType:    "cites",
        targetExternalRef: targetId
          ? undefined
          : [cite.court, cite.number, cite.year].filter(Boolean).join(" / "),
        description: cite.topic
          ? `يستشهد بـ: ${cite.topic}`
          : "استشهاد قضائي",
      }).onConflictDoNothing().returning({ id: kbCrossReferencesTable.id });

      // Only count edges that were actually inserted (not conflicts)
      if (inserted.length > 0) edgesCreated++;
    }
  }

  return edgesCreated;
}

// ─── Legislation linkage builder ─────────────────────────────────────────────

/**
 * Resolve relatedLegislation JSON on each case law document and create
 * `interpreted_by` cross-reference edges linking the LEGISLATION → the JUDGMENT.
 *
 * Edge direction: legislation ──interpreted_by──▶ judgment
 * (Who interprets the legislation? This judgment.)
 *
 * Returns total edges created.
 */
async function buildLegislationLinks(): Promise<number> {
  const { db } = await import("@workspace/db");
  const { kbDocumentsTable, kbCrossReferencesTable } = await import("@workspace/db");
  const { eq, and } = await import("drizzle-orm");

  let edgesCreated = 0;

  const caseLawDocs = await db
    .select({
      id:                 kbDocumentsTable.id,
      relatedLegislation: kbDocumentsTable.relatedLegislation,
    })
    .from(kbDocumentsTable)
    .where(
      and(
        eq(kbDocumentsTable.collectionId, "uae_case_law"),
        eq(kbDocumentsTable.indexStatus, "indexed"),
      ),
    );

  // Pre-build legislation lookup: documentNumber → docId, title → docId
  const allLeg = await db
    .select({
      id:           kbDocumentsTable.id,
      titleAr:      kbDocumentsTable.titleAr,
      documentNumber: kbDocumentsTable.documentNumber,
    })
    .from(kbDocumentsTable)
    .where(eq(kbDocumentsTable.indexStatus, "indexed"));

  const legByNum   = new Map<string, number>();
  const legByTitle = new Map<string, number>();
  for (const leg of allLeg) {
    if (leg.documentNumber) legByNum.set(leg.documentNumber.trim(), leg.id);
    if (leg.titleAr)        legByTitle.set(leg.titleAr.trim(),      leg.id);
  }

  for (const judgmentDoc of caseLawDocs) {
    if (!judgmentDoc.relatedLegislation) continue;

    let refs: Array<{
      title?: string;
      documentNumber?: string;
      articles?: string[];
    }>;

    try {
      refs = JSON.parse(judgmentDoc.relatedLegislation);
    } catch {
      continue;
    }

    for (const ref of refs) {
      const legislationId =
        (ref.documentNumber && legByNum.get(ref.documentNumber.trim())) ||
        (ref.title          && legByTitle.get(ref.title.trim()))         ||
        undefined;

      let inserted: Array<{ id: number }>;

      if (legislationId && legislationId !== judgmentDoc.id) {
        // Resolved: legislation ──interpreted_by──▶ judgment
        // Edge direction is consistent: the legislation is interpreted by the judgment.
        inserted = await db.insert(kbCrossReferencesTable).values({
          sourceDocumentId: legislationId,
          targetDocumentId: judgmentDoc.id,
          referenceType:    "interpreted_by",
          description: ref.articles?.length
            ? `تفسير المادة/المواد: ${ref.articles.slice(0, 5).join("، ")}`
            : "تفسير قضائي",
        }).onConflictDoNothing().returning({ id: kbCrossReferencesTable.id });
      } else {
        // Unresolved: judgment ──cites──▶ external legislation
        // Use "cites" (not "interpreted_by") to avoid inverting edge semantics
        // when we don't have the legislation's document ID.
        const extRef = [ref.documentNumber, ref.title].filter(Boolean).join(" — ");
        if (!extRef) continue; // skip if nothing to reference
        inserted = await db.insert(kbCrossReferencesTable).values({
          sourceDocumentId:  judgmentDoc.id,
          targetDocumentId:  null,
          referenceType:     "cites",
          targetExternalRef: extRef,
          description: ref.articles?.length
            ? `يستشهد بالتشريع: ${ref.articles.slice(0, 5).join("، ")}`
            : "استشهاد بتشريع — المصدر خارج قاعدة المعرفة",
        }).onConflictDoNothing().returning({ id: kbCrossReferencesTable.id });
      }

      // Only count edges actually inserted (not conflicts on rerun)
      if (inserted.length > 0) edgesCreated++;
    }
  }

  return edgesCreated;
}

// ─── Overruled / superseded principle detection ───────────────────────────────

/**
 * Scan the full text of all indexed case law documents for supersession
 * markers (Arabic and English). When found, create a `related` cross-reference
 * annotated as "supersedes" / "نُسخ" between the relevant documents.
 *
 * Markers detected:
 *   Arabic:  نُسخ بـ | مستبدل بـ | أُلغي بـ | عُدّل بـ | يتعارض مع | خالف
 *   English: superseded by | overruled by | overturned by | contrary to
 *
 * Returns count of overruled links created.
 */
async function detectOverruledPrinciples(): Promise<number> {
  const { db } = await import("@workspace/db");
  const { kbDocumentsTable, kbCrossReferencesTable } = await import("@workspace/db");
  const { eq, and } = await import("drizzle-orm");

  // Patterns must be specific to avoid false positives in ordinary doctrinal text.
  // "يتعارض مع" is excluded — too common in normal comparative analysis.
  const SUPERSESSION_PATTERNS = [
    /نُسخ بـ (.{10,80})/gu,
    /مستبدل بـ (.{10,80})/gu,
    /أُلغي بموجب (.{10,80})/gu,
    /خالف ما استقر عليه الاجتهاد في (.{10,80})/gu,
    /superseded by ([^.]{10,120})/giu,
    /overruled by ([^.]{10,120})/giu,
    /overturned by ([^.]{10,120})/giu,
  ];

  const docs = await db
    .select({
      id:       kbDocumentsTable.id,
      fullTextAr: kbDocumentsTable.fullTextAr,
    })
    .from(kbDocumentsTable)
    .where(
      and(
        eq(kbDocumentsTable.collectionId, "uae_case_law"),
        eq(kbDocumentsTable.indexStatus, "indexed"),
      ),
    );

  let linksCreated = 0;

  for (const doc of docs) {
    const text = doc.fullTextAr ?? "";
    const supersededRefs: string[] = [];

    for (const pattern of SUPERSESSION_PATTERNS) {
      pattern.lastIndex = 0; // reset global regex
      for (const match of text.matchAll(pattern)) {
        supersededRefs.push(match[1]?.trim() ?? "");
      }
    }

    for (const ref of supersededRefs) {
      if (!ref) continue;
      const inserted = await db.insert(kbCrossReferencesTable).values({
        sourceDocumentId:  doc.id,
        targetDocumentId:  null,
        referenceType:     "related",
        targetExternalRef: ref,
        description:       `مبدأ منسوخ أو مُستبدَل — الإشارة: ${ref.slice(0, 120)}`,
      }).onConflictDoNothing().returning({ id: kbCrossReferencesTable.id });
      if (inserted.length > 0) linksCreated++;
    }
  }

  return linksCreated;
}

// ─── Ingestion report ─────────────────────────────────────────────────────────

function printCaseLawReport(
  runResults: Array<{ title: string; result: IndexResult; skipped?: boolean }>,
  duplicatesSkipped: number,
  citationEdges: number,
  legislationEdges: number,
  overruledLinks: number,
  durationMs: number,
): void {
  const indexed  = runResults.filter((r) => r.result.success && !r.skipped).length;
  const failed   = runResults.filter((r) => !r.result.success).length;
  const skipped  = runResults.filter((r) => r.skipped).length;

  const lines = [
    "═══════════════════════════════════════════════════════════",
    "UAE CASE LAW CORPUS — INGESTION REPORT (Phase 55)",
    "═══════════════════════════════════════════════════════════",
    "",
    `This run:         ${runResults.length} attempted | ${indexed} indexed | ${failed} failed | ${skipped} skipped`,
    `Duplicates:       ${duplicatesSkipped} duplicate judgments detected and skipped`,
    "",
    `Citation graph:   ${citationEdges} cites edges built`,
    `Legislation links: ${legislationEdges} interpreted_by edges built`,
    `Overruled links:  ${overruledLinks} supersession markers detected`,
    "",
    `Duration:         ${(durationMs / 1000).toFixed(1)}s`,
    "",
    "Courts covered:",
    "  ✓ Federal Supreme Court — Civil, Commercial, Penal, Labour, Administrative Chambers",
    "  ✓ Federal Supreme Court — Constitutional Chamber",
    "  ✓ Dubai Court of Cassation",
    "  ✓ Abu Dhabi Court of Cassation",
    "  ✓ Ras Al Khaimah Court of Cassation",
    "  ✓ Federal Administrative Judiciary (original + expanded corpus)",
    "",
    "Courts not yet covered (no official published digests available):",
    "  ○ Sharjah Court of Cassation",
    "  ○ Ajman Court of Cassation",
    "  ○ Umm Al Quwain Court of Cassation",
    "  ○ Fujairah Court of Cassation",
    "═══════════════════════════════════════════════════════════",
  ];

  console.log(lines.join("\n"));

  if (failed > 0) {
    console.log("\nFailed documents:");
    for (const r of runResults.filter((r) => !r.result.success)) {
      console.log(`  ✗ ${r.title}`);
      for (const e of r.result.errors) console.log(`      ${e}`);
    }
  }
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export interface CaseLawIngestionOptions {
  priorities?: number[];
  skipExisting?: boolean;
  limitPerGroup?: number;
}

export async function runCaseLawIngestion(
  opts: CaseLawIngestionOptions = {},
): Promise<void> {
  const startMs = Date.now();
  const runResults: Array<{ title: string; result: IndexResult; skipped?: boolean }> = [];
  let duplicatesSkipped = 0;

  console.log("\n[Case Law Ingestion] Starting UAE Case Law Corpus ingestion...");
  console.log(`[Case Law Ingestion] ${new Date().toISOString()}\n`);

  for (const group of CASE_LAW_MANIFEST) {
    if (opts.priorities?.length && !opts.priorities.includes(group.priority)) continue;

    console.log(
      `[Case Law Ingestion] Priority ${group.priority}: ${group.label} (${group.documents.length} documents)`,
    );

    const docs = opts.limitPerGroup
      ? group.documents.slice(0, opts.limitPerGroup)
      : group.documents;

    for (const doc of docs) {
      // ── Duplicate detection ────────────────────────────────────────────────
      if (opts.skipExisting !== false) {
        const dup = await detectDuplicate(doc);
        if (dup.isDuplicate) {
          const reason = dup.reason === "docnum-year-jurisdiction"
            ? `doc# ${doc.documentNumber}/${doc.year}`
            : "title";
          console.log(`  ↩ Duplicate (${reason}): ${doc.titleAr.slice(0, 60)}`);
          duplicatesSkipped++;
          runResults.push({
            title:   doc.titleAr,
            skipped: true,
            result: {
              success: true, documentId: dup.existingId,
              articlesIndexed: 0, crossRefsExtracted: 0,
              embeddingsGenerated: 0, errors: [], durationMs: 0,
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
            : " | no embeddings (set EMBEDDING_API_KEY)";
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

  // ── Post-processing: build graphs ────────────────────────────────────────────
  console.log("[Case Law Ingestion] Building citation graph...");
  const citationEdges = await buildCitationGraph();
  console.log(`[Case Law Ingestion] Citation graph: ${citationEdges} cites edges`);

  console.log("[Case Law Ingestion] Building legislation linkage...");
  const legislationEdges = await buildLegislationLinks();
  console.log(`[Case Law Ingestion] Legislation links: ${legislationEdges} interpreted_by edges`);

  console.log("[Case Law Ingestion] Detecting overruled / superseded principles...");
  const overruledLinks = await detectOverruledPrinciples();
  console.log(`[Case Law Ingestion] Overruled detection: ${overruledLinks} markers found`);

  console.log("");

  printCaseLawReport(
    runResults,
    duplicatesSkipped,
    citationEdges,
    legislationEdges,
    overruledLinks,
    Date.now() - startMs,
  );
}

// ─── Standalone execution ─────────────────────────────────────────────────────

const isMain =
  process.argv[1]?.endsWith("case-law-runner.ts") ||
  process.argv[1]?.endsWith("case-law-runner.js");

if (isMain) {
  const skipExisting = !process.argv.includes("--force");
  runCaseLawIngestion({ skipExisting })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Case Law Ingestion] Fatal error:", err);
      process.exit(1);
    });
}
