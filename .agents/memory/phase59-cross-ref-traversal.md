---
name: Phase 59 — Cross-Reference Graph Traversal
description: expandWithCrossRefs / resolveAmendmentChain wired into retrieval; KB search endpoint; legalContextChain in RAG; kb-search.tsx frontend page.
---

## Rule
One-hop cross-ref expansion is computed AFTER retrieval scoring — it never affects the primary ranking. Expanded neighbours are annotated only (not added to the verified hit list or the source index).

**Why:** Expanding into the source index would inflate context size and confuse the fabrication filter, since expanded doc IDs are not part of the retrieval-verified set.

## How to apply
- `expandWithCrossRefs(docIds)` fetches outbound+inbound edges for a doc set in two DB queries; returns `Map<primaryDocId, CrossRefNeighbour[]>`.
- `resolveAmendmentChain(docIds)` finds docs whose `referenceType = "amends"` points at any of the given IDs.
- `buildKbContext()` calls both concurrently after verification, appends amendment notes inline to `entry.contextLine`, and builds a `legalContextChain` string block (separate from `inventory`).
- `rag.ts` injects `kbResult.legalContextChain` as a separate separator-delimited block after the KB source entries.
- `annotateContextLine` accepts an optional 3rd arg `crossRefRelationship?: string` appended to the VERIFIED annotation.

## Endpoints added
- `GET /api/kb/search?q=&topK=&collections=&hierarchyLevels=&excludeRepealed=` — returns hits with `crossRefs[]` and `amendments[]` arrays attached.
- `GET /api/kb/document/:id/context-chain` — returns document + `contextChain.neighbours`, `contextChain.byRelationshipType`, `contextChain.amendments`.

## Frontend
- `/kb-search` route → `artifacts/legal-research/src/pages/kb-search.tsx`
- Route registered in `App.tsx`; **not yet in the sidebar nav** (deferred — see follow-up task).
- `LegalContextPanel` fetches context-chain on first expand; uses `useQuery` with 5-min stale time.
