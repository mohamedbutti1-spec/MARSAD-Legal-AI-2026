---
name: PCS — Professional Case Simulator
description: Architecture notes for the PCS module — session scoping, AI evaluator trust boundary, DB constraints
---

## Key Decisions

### Session Isolation (IDOR prevention)
`pcs_sessions` has `user_id INTEGER NOT NULL` set from `x-user-id` header (same `getUserId()` pattern as PGF).
Every read/write route ANDs `eq(pcsSessionsTable.userId, uid)` with the session ID condition.
The unused `sql` import was removed in the rewrite after code review caught the IDOR.

### criticalError Trust Boundary
`criticalError` is **computed server-side** in `evaluateStep()` as `step.critical && score < 50`.
The model is explicitly told NOT to include `criticalError` in its JSON output.
This prevents prompt-influenced model output from bypassing critical-step semantics.

### DB Constraints
- `pcs_sessions.status` has CHECK constraint `IN ('in_progress', 'completed')`
- `pcs_session_steps.ai_score` has CHECK `BETWEEN 0 AND 100`
- `pcs_session_steps.session_id` has FK → `pcs_sessions(id) ON DELETE CASCADE`

### Scenario Configs
7 professions with 5–6 steps each: judge, prosecutor, police_officer, admin_decision_maker, internal_auditor, quality_manager, strategy_officer.
`findScenario(sectorId, professionId)` is the lookup; returns `undefined` for unsupported professions (frontend hides section).
`expectedAnswerHint` is NOT returned to the frontend — server-side only.

### Frontend
`SimulatorSection` is shown only on `stageIndex === 0` to avoid repetition across all stages.
It checks scenario existence via GET /pcs/scenarios/:sectorId/:professionId and returns `null` if none found.
State machine: idle → loading → active → evaluating → showing_eval (loop) → completed.

### lib/db Rebuild Reminder
After adding fields to `lib/db/src/schema/pcs.ts`, run `cd lib/db && npx tsc --build --force` before api-server typecheck.
