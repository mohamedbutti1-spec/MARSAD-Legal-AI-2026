---
name: PWE — Professional Workflow Engine
description: pgf_workflow_steps table, seed, route, and WorkflowSection UI for executable stage workflows
---

## Table

`pgf_workflow_steps` — one row per (sector_id, profession_id, stage_id, order).
Unique constraint `pgf_ws_unique_step` on (sector_id, profession_id, stage_id, "order").
Array fields (requiredDocuments, approvals, checkpoints, branchRules, escalationRules) stored as JSON TEXT; parsed via `parseJson<T>()` with fallback `[]` in service layer.
Migration in `artifacts/api-server/src/pgf/migration.ts` (additive IF NOT EXISTS + DO $$ constraint guard).

## Field types

- `branchRules`: `Array<{ condition: string; outcome: string }>` — note **outcome** (not "action")
- `escalationRules`: `Array<{ condition: string; action: string }>` — note **action** (not "outcome")
- These differ and must not be confused; TypeScript enforces this but the seed had a typo that was caught by tsc.

## Route

`GET /pgf/workflow/:sectorId/:professionId/:stageId` — requireAnyRole; returns parsed steps ordered by `order ASC`. No write route (data populated by seed only).

## Seed

`artifacts/api-server/src/pgf/pwe-seed.ts` — `seedProfessionalWorkflows()` called from `seed.ts` after `seedInstitutionalMemory()`.
Idempotent by existence check on (sector_id, profession_id, stage_id, title) — full scope, not just profession+stage.
26 curated Arabic steps across 7 professions:
- JUDGE (judiciary): s1_case, s2_proceedings, s3_evidence, s4_law, s5_risk
- PROSECUTOR (public_prosecution): s1_incident, s2_investigation, s3_decision
- POLICE_OFFICER (police): s1_scene, s2_evidence, s3_report
- ADMIN_DECISION_MAKER (government): s1_mandate, s2_legal_basis, s3_documentation, s4_risk
- INTERNAL_AUDITOR (governance): s1_scope, s2_evidence, s3_findings
- QUALITY_MANAGER (quality_tech): s1_scope, s2_assessment, s3_action
- STRATEGY_OFFICER (strategic_planning): s1_context, s2_objectives, s3_risks

## Frontend

`WorkflowSection` in `pgf-session.tsx`:
- Fetches from `/api/pgf/workflow/:sectorId/:professionId/:stageId` via React Query (keyed by `['pgf-workflow', sectorId, professionId, stageId]`)
- Returns `null` when `!isLoading && steps.length === 0`
- Rendered below `InstitutionalMemorySection` inside `StageForm`
- `WorkflowStep` renders 9 data blocks: objective, nextAction, requiredDocuments, approvals, checkpoints, branchRules, escalationRules, expectedOutput, estimatedDuration
- Each block hidden when its array is empty (conditional rendering)

## lib/db build rule

After schema changes, `cd lib/db && npx tsc --build`. Verbose flag shows if up-to-date. Exit code 1 with no output = already current.
