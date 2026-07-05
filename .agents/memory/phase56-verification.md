---
name: Phase 56 — Retrieval Verification Layer
description: Mandatory citation verification between KB retrieval and AI generation; KB ID offset; fabrication filter; post-hoc audit wiring
---

## What Phase 56 is

A mandatory verification layer inserted between KB retrieval (`kb/retrieval.ts`) and
AI answer generation (`utils/rag.ts`). Every KB hit is DB-verified before entering
the RAG context. Fabricated citations (model-emitted but never provided) are rejected
and logged. All rejections are appended to `artifacts/api-server/logs/citation-audit.jsonl`.

## Key constants

- `KB_ID_OFFSET = 100_000` (exported from `utils/rag.ts`) — maps `kbDocumentsTable.id`
  into the `[SRC:N]` namespace without colliding with `legalSourcesTable` IDs.
  KB doc #34 appears in context as `[SRC:100034]`. Resolved back to DB row 34 in
  `resolveCitations()` when `sourceId ≥ KB_ID_OFFSET`.

## Critical namespace rule: one canonical tag per KB doc

Every KB source tag must be the OFFSET version (`[SRC:{id+100000}]`) everywhere
the model can see it — context lines, authority inventory, annotations.

**Why:** If the raw tag (`[SRC:34]`) appears in the authority inventory while context
lines use `[SRC:100034]`, the model may cite `[SRC:34]`, which `resolveCitations()`
routes to `legalSourcesTable` (wrong table, wrong document).

**Fix applied:** In `buildContext()`, after getting `kbResult`, a `.replace()` regex
rewrites all `[SRC:{rawId}]` in the inventory string to `[SRC:{rawId + KB_ID_OFFSET}]`
before pushing to `parts`.

## Token prefix taxonomy in resolveCitations()

| Token     | Bucket       | Real ID logic                | DB table          |
|-----------|--------------|------------------------------|-------------------|
| DOC:{id}  | docTokens    | sourceId                     | documentsTable    |
| SRC:{id}  id < 100000  | legSrcTokens | sourceId          | legalSourcesTable |
| SRC:{id}  id ≥ 100000  | kbSrcTokens  | sourceId − 100000 | kbDocumentsTable  |
| KB:{id}   always       | kbRawTokens  | sourceId (no offset) | kbDocumentsTable |

Note: `[KB:N]` prefix tags use the RAW id with no offset. `[SRC:N≥100000]` tags use
the OFFSET id. Both resolve to the same `kbDocumentsTable` row.

## Fabrication filter

`resolveCitations()` receives the `sourceIndex` map (from `buildContext()`) which
contains exactly what was given to the AI. Any citation token emitted by the model
whose key (`token` without brackets) is absent from `sourceIndex` is:
1. Excluded from `validTokens` → never returned in the citation list
2. Passed to `verifyGeneratedCitations()` fire-and-forget for audit log

Legacy callers that pass an empty `sourceIndex` (e.g., older routes not yet using
`buildContext()`) bypass the filter (guard: `sourceIndex.size === 0 → use all tokens`).

## Files changed in Phase 56

- **NEW**: `artifacts/api-server/src/kb/verification.ts` — full verification module
- **NEW**: `artifacts/api-server/logs/.gitkeep` — audit log directory
- **MODIFIED**: `artifacts/api-server/src/kb/retrieval.ts` — `buildKbContext()` returns
  `KbContextResult` (was `Array<...>`); runs `verifyRetrievalHits()` before building entries
- **MODIFIED**: `artifacts/api-server/src/utils/rag.ts` — KB integration with offset
  tagging, fabrication filter, `KB:` prefix resolution, inventory tag rewriting

## Verification flow sequence

```
User query
  → buildContext()
      → buildKbContext() [concurrent]
          → retrieveRelevant()
          → verifyRetrievalHits()   ← DB re-verify all hits
          → filter to verified-only
          → annotateContextLine()   ← stamp authority class + confidence
          → buildAuthorityInventory()
      → offset inventory tags: [SRC:{id}] → [SRC:{id+100000}]
      → offset context line tags: same transform
      → populate sourceIndex with offset keys
  → buildContext() returns {context, sourceIndex, verificationReport}
  → AI generation with verified context
  → extractCitationTokens() on generated text
  → resolveCitations(tokens, sourceIndex)
      → fabrication filter against sourceIndex
      → fire-and-forget audit log for fabricated tokens
      → DB lookup for validTokens only
      → return resolved citations
```

## verifyGeneratedCitations() signature

```typescript
verifyGeneratedCitations(
  text: string,           // any text containing [SRC:N]/[DOC:N] tokens
  providedTags: Set<string>, // keys WITHOUT brackets (e.g. "SRC:100034")
  options?: VerificationOptions
): Promise<PostHocVerificationReport>
```

## Audit log

- Path: `artifacts/api-server/logs/citation-audit.jsonl`
- Format: one JSON line per rejection batch; includes `type`, `tokens`, `count`, `timestamp`
- Non-fatal: write errors are caught and swallowed
- Not a DB table — schema is frozen at Phase 53; JSONL file is the correct approach
