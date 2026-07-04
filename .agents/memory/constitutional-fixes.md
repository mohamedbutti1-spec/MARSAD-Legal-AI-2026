---
name: Seven Constitutional Fixes — Module 1
description: Scientific/constitutional validity fixes applied to the DCI framework — what changed, what each field means, and how they are computed.
---

## What was implemented

Seven fixes were applied to make Module 1 constitutionally defensible:

### 1. Binary gates — no numerical scores
- Stage 9 constitutional validation prompt no longer requests `"score": 0` per principle or `"asliPreScore": 0`
- Each principle now returns `{ "passed": boolean, "gateStatus": "مستوفٍ|يحتاج مراجعة|غير مستوفٍ", "notes": string }`
- Frontend AIAnalysisPanel for stage 9 now shows gate chips, not percentages
- JDP section 09 (`constitutionalValidationResults`) no longer shows the `alShamsiScore` field

### 2. QVA — Quantitative Variance Analysis
- Endpoint: `POST /decisions/:id/qva/run`
- Runs constitutional validation AI prompt 3 independent times
- Counts principles where not all 3 runs agree on passed/failed
- Only counts principles present in ALL runs (prevents parse failures from inflating variance)
- Stores results in DCI: `qvaResults`, `qvaRunCount`, `qvaVarianceLevel` (low | moderate | high)

### 3. LSI — Legal Stability Index
- Derived from QVA: `lsiStatus` = stable | variable | highly_variable
- `low` variance → `stable`, `moderate` → `variable`, `high` → `highly_variable`
- Stored on DCI table. Shown in QvaSection component on DCI panel.

### 4. HII — Human Influence Index
- Field: `humanInfluenceIndex` on DCI (pending | human_will | ai_recommendation | joint_decision)
- Computed at Stage 8 (`human_oversight`) completion from stage data fields:
  - `humanJudgmentAdditions` (>15 chars) → `joint_decision`
  - `aiRecommendationAdopted` fully adopted + no human additions → `ai_recommendation`
  - Otherwise → `human_will`

### 5. AI Actual Influence
- Field: `aiActualInfluence` on DCI (pending | confirmed_human_direction | modified_human_direction | materially_changed_outcome)
- Semantic: `confirmed_human_direction` = human would have decided the same without AI
- `modified_human_direction` = AI influenced but didn't fully determine the outcome (when hasHumanAdditions)
- `materially_changed_outcome` = AI recommendations were the primary driver (aiFullyAdopted + no human additions)
- **Key logic**: `aiFullyAdopted && !hasHumanAdditions` → `materially_changed_outcome` (NOT `confirmed_human_direction`)

### 6. CAR — Constitutional Answer Record
- New table: `decision_car` (1:1 with decisions, cascade delete)
- Endpoints: `POST /decisions/:id/car/generate` + `GET /decisions/:id/car`
- Requires sealed DCI. Uses AI to generate 10 transparency sections in plain Arabic.
- Frontend: 4th tab "المساءلة الدستورية CAR" (blue accent) with CarPanel component
- Distinct from JDP: JDP is government legal defense (private, for court); CAR is for affected parties (transparent, public-facing)

### 7. DCI self-certification fix
- `alShamsiFrameworkCompliance` now computed via gate-counting (not ASLI score):
  - 10/10 principles pass → "full"; ≥8 → "substantial"; ≥6 → "partial"; <6 → "non_compliant"

## DB Schema additions (decision_dci table)
New columns: `human_influence_index`, `ai_actual_influence`, `lsi_status`, `qva_variance_level`, `qva_run_count`, `qva_results` (json)
New table: `decision_car` — see decisions.ts for full schema.
New type: `QvaRunResult` (exported from @workspace/db)

## Build notes
- After schema changes: run `cd lib/db && npx tsc --build` BEFORE `pnpm exec tsc --noEmit` in api-server
- The api-server uses TypeScript project references (`references: lib/db`) — the lib/db must be compiled to generate `.d.ts` files before api-server typecheck works
- `pnpm run push` from `lib/db/` applies schema to DB
- Seed script (artifacts/api-server/src/scripts/seed-constitutional-decision.ts) needs re-run after schema push to populate new fields with realistic demo values

**Why:** Without lib/db build, api-server tsc fails with "has no exported member named 'decisionCarTable'" even though the source is correct.
