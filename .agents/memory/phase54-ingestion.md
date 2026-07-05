---
name: Phase 54 — UAE Legal Knowledge Base Ingestion
description: Ingestion run details, amendment graph design, migration additive columns, idempotency pattern.
---

# Phase 54 — UAE Legal Knowledge Base Ingestion

## What was ingested (22 documents, 12 of 17 collections)
Indexed in priority order 1-8. All zero failures.

| Collection | Docs | Articles |
|---|---|---|
| uae_constitution | 1 | 11 |
| federal_decree_laws | 5 | 7 |
| federal_laws | 4 | 4 |
| executive_regulations | 2 | 2 |
| cabinet_decisions | 2 | 2 |
| ministerial_decisions | 1 | 1 |
| official_gazette | 2 | 2 |
| uae_supreme_court | 1 | 1 |
| federal_supreme_court | 1 | 2 |
| constitutional_judgments | 1 | 1 |
| explanatory_memoranda | 1 | 1 |
| official_guidance | 1 | 1 |

Coverage gaps (not yet seeded): circulars, federal_admin_judiciary, abu_dhabi_courts, dubai_courts, rak_courts

## Amendment graph design
- `amendmentLog[].amendedBy` matches against both `titleAr` AND `title` AND `documentNumber`
- When amending instrument NOT found in KB → insert external-ref edge (`targetDocumentId: null`, `targetExternalRef: amendedBy`) — do NOT create self-referential edge
- When found AND not self → insert `sourceDocumentId: amenderId, targetDocumentId: doc.id, referenceType: "amends"`
- Idempotent: unique index `kb_xref_unique_edge_idx` on `(source_document_id, reference_type, COALESCE(target_document_id,-1), COALESCE(target_article_id,-1))`

## Migration additive pattern (Phase 54 lesson)
- Phase 53 created tables via `CREATE TABLE IF NOT EXISTS` — cannot add new columns this way
- Phase 54 columns added via `ADDITIVE_COLUMNS: string[]` — each `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` run individually (not batched in one `client.query()`)
- DO NOT use `DO $$ ... END $$` with node-postgres — dollar quoting causes syntax errors

## Ingestion idempotency
- Runner default: `skipExisting: true` — checks `kb_documents.titleAr + indexStatus === "indexed"` before calling `indexDocument()`
- `--force` flag re-indexes everything
- Amendment graph builder always runs (idempotent via unique index)

## Report accuracy rule
- Run-scoped counters (`runIndexed`, `runFailed`, `runSkipped`) come from `runResults` array, NOT DB aggregates
- DB aggregates used only for cumulative totals (articles, cross-refs, embeddings, per-collection breakdown)

**Why:** DB totals include documents indexed in previous runs, making run-scoped math wrong if mixed with attempted count.

## Embedding status
- `EMBEDDING_API_KEY` not set → 0 embeddings → keyword-only retrieval active
- Set `EMBEDDING_API_KEY` and re-run with `--force` to enable hybrid retrieval
