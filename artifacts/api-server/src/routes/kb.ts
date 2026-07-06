/**
 * Phase 59 — KB Cross-Reference Graph Traversal: HTTP Routes
 *
 * Endpoints:
 *   GET /kb/search?q=...&topK=...&collections=...&hierarchyLevels=...
 *     Full KB hybrid search with cross-reference expansion.
 *
 *   GET /kb/document/:id/context-chain
 *     Returns one-hop cross-reference graph for a single KB document.
 *     Used by the Legal Context panel on KB search result cards.
 *
 * Auth: X-User-Id header (same convention as all other routes).
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db, kbDocumentsTable, kbCrossReferencesTable } from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  retrieveRelevant,
  expandWithCrossRefs,
  resolveAmendmentChain,
} from "../kb/retrieval.js";
import type { KbCollectionId, KbHierarchyLevel } from "../kb/types.js";
import { getUserId } from "../lib/route-helpers.js";

const router: IRouter = Router();

// ─── GET /kb/search ───────────────────────────────────────────────────────────

router.get("/kb/search", async (req: Request, res: Response) => {
  try {
    const query = String(Array.isArray(req.query.q) ? req.query.q[0] ?? "" : req.query.q ?? "").trim();
    if (!query) {
      return res.status(400).json({ error: "Query parameter q is required" });
    }

    const topK = Math.min(parseInt(String(req.query.topK ?? "8"), 10), 20);
    const rawCollections = String(req.query.collections ?? "");
    const collections = rawCollections
      ? rawCollections.split(",").filter(Boolean) as KbCollectionId[]
      : undefined;
    const rawLevels = String(req.query.hierarchyLevels ?? "");
    const hierarchyLevels = rawLevels
      ? rawLevels.split(",").filter(Boolean) as KbHierarchyLevel[]
      : undefined;
    const excludeRepealed = req.query.excludeRepealed !== "false";

    const result = await retrieveRelevant({
      query,
      topK,
      collections,
      hierarchyLevels,
      excludeRepealed,
    });

    // Phase 59: Attach cross-ref expansion to results
    const docIds = result.hits.map((h) => h.documentId);
    const [crossRefMap, amendmentMap] = await Promise.all([
      expandWithCrossRefs(docIds),
      resolveAmendmentChain(docIds),
    ]);

    const enrichedHits = result.hits.map((hit) => ({
      ...hit,
      crossRefs:   crossRefMap.get(hit.documentId) ?? [],
      amendments:  amendmentMap.get(hit.documentId) ?? [],
    }));

    return res.json({
      hits:            enrichedHits,
      totalCandidates: result.totalCandidates,
      strategy:        result.strategy,
      durationMs:      result.durationMs,
      query,
    });
  } catch (err) {
    console.error("[kb/search]", err);
    return res.status(500).json({ error: "KB search failed" });
  }
});

// ─── GET /kb/document/:id/context-chain ──────────────────────────────────────

router.get("/kb/document/:id/context-chain", async (req: Request, res: Response) => {
  try {
    const docId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(docId) || docId <= 0) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    // Fetch the primary document
    const [doc] = await db
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
        isAmended:      kbDocumentsTable.isAmended,
        collectionId:   kbDocumentsTable.collectionId,
        indexStatus:    kbDocumentsTable.indexStatus,
      })
      .from(kbDocumentsTable)
      .where(eq(kbDocumentsTable.id, docId));

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Expand cross-references (one hop)
    const [crossRefMap, amendmentMap] = await Promise.all([
      expandWithCrossRefs([docId]),
      resolveAmendmentChain([docId]),
    ]);

    const neighbours = crossRefMap.get(docId) ?? [];
    const amendments = amendmentMap.get(docId) ?? [];

    // Group neighbours by relationship type for easy frontend rendering
    type GroupedRefs = Record<string, typeof neighbours>;
    const byRelType: GroupedRefs = {};
    for (const n of neighbours) {
      if (!byRelType[n.referenceType]) byRelType[n.referenceType] = [];
      byRelType[n.referenceType].push(n);
    }

    return res.json({
      document: doc,
      contextChain: {
        neighbours,
        byRelationshipType: byRelType,
        amendments,
        totalNeighbours: neighbours.length,
      },
    });
  } catch (err) {
    console.error("[kb/document/context-chain]", err);
    return res.status(500).json({ error: "Failed to fetch context chain" });
  }
});

export default router;
