---
name: PGF Institutional Memory v1
description: pgf_institutional_memory table, seed, routes, and frontend section for the Professional Guidance stage panels
---

## Table

`pgf_institutional_memory` — scoped by (sector_id, profession_id, stage_id). DB-level CHECK constraints enforce category enum (7 values), source_type enum (3 values), and confidence BETWEEN 0 AND 100. Migration is in `artifacts/api-server/src/pgf/migration.ts` (additive IF NOT EXISTS).

## 7 categories

`expert_practice | frequent_mistake | lesson_learned | recommended_sequence | practical_tip | success_indicator | failure_indicator`

## Routes

- `GET /pgf/memory/:sectorId/:professionId/:stageId` — requireAnyRole; returns up to 5 entries ordered by confidence DESC
- `POST /pgf/memory` — requireAnyRole + role header check (owner/supervisor only via `req.headers["x-user-role"]`); creates new entry

**Critical**: role in POST must be read from `req.headers["x-user-role"]` — NOT from `req.user`. The roleAuth middleware sets it in the header, not on a user object.

## Seed

`artifacts/api-server/src/pgf/im-seed.ts` — `seedInstitutionalMemory()` called from `seed.ts` after `migratePgf()`. Idempotent by per-entry existence check on (sector_id, profession_id, stage_id, title). No count-based shortcut — always does per-entry checks to avoid skipping valid inserts.

~36 curated entries seeded across: JUDGE (s1_complaint, s2_evidence), ADMIN_DECISION_MAKER (s1_legal_basis), QUALITY_MANAGER (s1_scope), CYBERSECURITY_OFFICER (s1_incident), INTERNAL_AUDITOR (s1_planning), PROSECUTOR (s1_case_review).

## Frontend

`InstitutionalMemorySection` in `pgf-session.tsx`:
- Fetches from `/api/pgf/memory/:sectorId/:professionId/:stageId` via React Query (keyed by `['pgf-im', sectorId, professionId, stageId]`)
- Returns `null` (hidden) when `!isLoading && entries.length === 0` 
- Rendered below `MentorPanel` inside `StageForm`
- `InstitutionalMemoryCard` colours entries by category (7 colour schemes)

Types in `artifacts/legal-research/src/types/pgf.ts`: `InstitutionalMemoryEntry`, `InstitutionalMemoryCategory`, `INSTITUTIONAL_MEMORY_LABELS`, `INSTITUTIONAL_MEMORY_ICONS`.

## lib/db build rule

After adding new files to `lib/db/src/schema/`, run `cd lib/db && npx tsc --build` before running api-server typecheck. The api-server uses project references and needs the dist `.d.ts` files.
