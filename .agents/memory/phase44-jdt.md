---
name: Phase 44 — Judicial Digital Twin (JDT)
description: Architecture decisions, critical bugs fixed, and schema details for the JDT AI judicial simulation module
---

## What was built
- `lib/db/src/schema/jdt.ts` — `jdtSimulationsTable` (1 row per decision, unique on decisionId)
- `lib/db/src/jdt-service.ts` — pure DB service: collectJdtDecisionData, getJdtSimulation, markJdtRunning, saveJdtSimulation, markJdtFailed, buildJdtReport
- `artifacts/api-server/src/routes/jdt.ts` — 4 endpoints: POST /jdt/simulate/:id, GET /jdt/:id, GET /jdt/:id/report, DELETE /jdt/:id
- `artifacts/legal-research/src/pages/jdt.tsx` — full simulation UI (1180 lines)
- `replay_16_jdt_simulation` added to REPLAY_STAGE_KEYS in schema/replay.ts
- 2 new permission flags: `canViewJdtSimulation` / `canRunJdtSimulation` in both permissions.ts files + user-context.tsx

## Critical bug fixed during code review

### Virtual replay event must use direct insert, not recordReplayEvent
`recordReplayEvent` routes through `STAGE_KEY_TO_REPLAY_STAGE` — virtual stages (CIL, JDT) have no entry there so the call silently exits without writing. Always use `db.insert(decisionReplayEventsTable).values({ replayStageKey: "replay_16_jdt_simulation", ... }).onConflictDoNothing()` — same pattern as CIL's replay_15 write in `routes/cil.ts`.

**Why:** STAGE_KEY_TO_REPLAY_STAGE maps decision stage keys → replay stage keys, but virtual AI stages don't have a source decision stage. Calling recordReplayEvent with a virtual stage key returns undefined and exits early.

**How to apply:** Any future virtual phase's replay event must be inserted directly into `decisionReplayEventsTable`, not via `recordReplayEvent`. Always check if `existing.length === 0` first (skip if no prior replay events — means the decision hasn't gone through full workflow).

## AI prompt field name contract (critical)
The JDT AI prompt MUST use the exact field names that match the schema/frontend types:
- `reasoning` (not `reasoningAr`)
- `outcome: "pass|partial|fail|not_assessed"` (not `isDeficient` boolean)
- `uaeLegalReferences: string[]` (not `{law, article, relevance}` objects)
- `constitutionalOutcome: "pass|partial|fail|not_assessed"` (not "compliant|minor_concern|...")
- `constitutionalRef` (not `legalBasisAr`)
- `correctiveActions[].priority: "critical|high|medium|low"` (include "critical")
The 16 dimension keys MUST match `JDT_SHAMSI_DIMENSION_KEYS` exactly (legal_basis_validity, functional_competence, judicial_jurisdiction, procedural_legality, form_and_procedure, legal_cause, legitimate_purpose, proportionality, equality_non_discrimination, defense_guarantees, transparency_reasoning, legal_certainty, public_interest, good_faith, non_abuse_of_power, legitimate_expectation).

**Why:** Subagent-generated prompts often drift from schema field names. The schema validation only checks array lengths and one numeric field, so mismatched field names can be silently stored and render as undefined/null in the frontend.

## JDT DB table migration
Table created via `lib/db/src/migrate-jdt.ts` run with: `node -e "require('child_process').execSync('npx --prefix artifacts/api-server tsx lib/db/src/migrate-jdt.ts', { cwd: '/home/runner/workspace', ... })"`.

## Permission model
canViewJdtSimulation: owner, supervisor, minister, undersecretary, assistant_undersecretary, director_general, legal_department, constitutional_reviewer, internal_auditor, external_auditor, judge
canRunJdtSimulation: owner, supervisor, minister, undersecretary, assistant_undersecretary, legal_department, constitutional_reviewer, judge
