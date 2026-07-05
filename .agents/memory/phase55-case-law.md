---
name: Phase 55 — UAE Case Law Corpus
description: uae_case_law collection, case-law-runner architecture, graph builder design decisions, and lessons from code review fixes.
---

# Phase 55 — UAE Case Law Corpus

## Collection
- New `uae_case_law` collection added to `KbCollectionId` union and `COLLECTIONS` registry
- hierarchyLevel: "7a" · bindingStatus: "binding" · jurisdiction: "multi"
- 11 documents indexed: Civil, Commercial, Penal, Constitutional chambers; Dubai/Abu Dhabi/RAK cassation; Federal Administrative Judiciary

## New types.ts fields
- `relatedJudgments?: string` (JSON array: `{court, number, year, topic}[]`)
- `relatedLegislation?: string` (JSON array: `{title, documentNumber?, articles?}[]`)
- Both optional on `KbDocumentInput`; pipeline.ts maps them to existing DB columns

## Case-law-runner.ts architecture
- `detectDuplicate()` — checks by titleAr AND by `documentNumber+year+jurisdiction`; avoids false positives (cross-jurisdiction)
- `buildCitationGraph()` — indexes by `authorityAr|documentNumber|year`; looks up by CITED court (cite.court, not sourceDoc.jurisdiction); `.returning()` for idempotent counter
- `buildLegislationLinks()` — RESOLVED: `legislation ──interpreted_by──▶ judgment`; UNRESOLVED: `judgment ──cites──▶ external` (different type, consistent direction); `.returning()` for idempotent counter
- `detectOverruledPrinciples()` — 7 regexes; `يتعارض مع` excluded (over-broad); `.returning()` for idempotent counter
- `runCaseLawIngestion()` — standalone runner, wired into `runner.ts` as Priority 9

## Code review lessons
- Citation resolution: always key the lookup index by the CITED court's authority (not source document's jurisdiction); digest docs don't have individual case numbers so most citations will be external refs — that's correct
- Legislation linkage: when legislation isn't in KB, switch from `interpreted_by` to `cites` to avoid semantic direction inversion under same edge type
- Counter idempotency: use `.returning()` after `onConflictDoNothing()` to count only genuinely-new edges; without it, reruns inflate counters

## Critical unique index fix (Phase 55)
- The Phase 54 unique index on `kb_cross_references` was: `(source_document_id, reference_type, COALESCE(target_document_id,-1), COALESCE(target_article_id,-1))`
- This is TOO COARSE: all external-ref rows (NULL target) collapse to the same key `(src, type, -1, -1)`, so only ONE external ref per (source, type) is stored; all subsequent `onConflictDoNothing()` calls silently drop the rest
- Fix: `kb_xref_unique_edge_v2_idx` adds `LEFT(COALESCE(target_external_ref,''),200)` to the index so different external refs coexist
- The old index was dropped and replaced in the Phase 55 additive migration
- Symptom of the bug: citation/legislation edge counters showed inflated numbers on first run but 0 on rerun; the opposite of what idempotent counters should show

## Report coverage gaps (no official published digests available)
- Sharjah, Ajman, Umm Al Quwain, Fujairah Courts of Cassation

## Ingestion result (final run after fixes)
- 11 documents indexed, 0 failed
- Citation edges, legislation linkage edges, overruled markers all correctly counted
