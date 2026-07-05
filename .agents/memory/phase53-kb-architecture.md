---
name: Phase 53 — KB Architecture
description: UAE Legal Knowledge Base — schema, pipeline, retrieval engine. No data ingested yet.
---

# UAE Legal Knowledge Base Architecture

## Tables (4 new, created by migration.ts)
- `kb_documents` — primary store; 17 metadata fields + FK-backed summary fields
- `kb_articles` — article-level segments; FK → kb_documents (CASCADE)
- `kb_cross_references` — directed graph edges; FKs with CASCADE/SET NULL
- `kb_embeddings` — vector store (JSON float[], pgvector-ready migration path documented in kb-embeddings.ts)

## 17 collections (all defined in artifacts/api-server/src/kb/collections.ts)
uae_constitution · federal_laws · federal_decree_laws · executive_regulations ·
cabinet_decisions · ministerial_decisions · circulars · explanatory_memoranda ·
uae_supreme_court · federal_supreme_court · federal_admin_judiciary ·
abu_dhabi_courts · dubai_courts · rak_courts · constitutional_judgments ·
official_gazette · official_guidance

## Key rules
- lib/db must be built (`tsc --build`) before api-server typecheck sees new tables
- Migration is idempotent (IF NOT EXISTS) — safe to re-run
- EMBEDDING_API_KEY unset → generateEmbedding() returns null → graceful no-op
- has_embedding_ar / has_embedding_en on kb_documents updated by pipeline on Step 8
- related_judgments / related_legislation are JSON text summary columns on kb_documents; detail lives in kb_cross_references
- Retrieval strategy: "hybrid" (0.6×semantic + 0.4×keyword) when embeddings present; "keyword" fallback otherwise
- buildKbContext() in retrieval.ts is the integration point for rag.ts (returns ragTag: "SRC:{id}" strings)

**Why:** No data yet — Phase 53 is architecture-only. Ingestion comes next.
