---
name: Phase 42 — Constitutional Intelligence Layer (CIL)
description: Architecture decisions and gotchas for the CIL module (Phase 42) — 12-principle constitutional AI assessor
---

## Core Design

- **CIL is separate from CJI** — CJI (`judicial_reviews` table) predicts court outcomes; CIL (`constitutional_assessments` + `constitutional_warnings`) scores 12 constitutional principles with 6 structured scores.
- **AI lives in the route** (`artifacts/api-server/src/routes/cil.ts`), never in the DB service (`lib/db/src/cil-service.ts`). The service is pure DB I/O.
- **Assessment is async** — `POST /cil/assess/:id` returns 202 immediately; caller polls `GET /cil/assess/:id` for status transitions: `pending → running → completed | failed`.

## Type Naming Trap

- `lib/db/src/schema/decisions.ts` already exports `PrincipleResult` (for constitutional gate checks in existing decisions).
- CIL uses `CilPrincipleResult` (different shape) — must never re-export as `PrincipleResult` from `lib/db/src/index.ts` or `cil-service.ts`.
- **Why:** TypeScript module boundary collision causes `TS2308: Module has already exported a member named 'PrincipleResult'`.

## Security Rules

- `POST /cil/warnings/:warningId/resolve` — **must** load `constitutionalWarningsTable` to find the warning's `decisionId`, then call `assertCilAccess(req, decisionId)` before resolving. Skipping this creates an IDOR where any org can resolve another org's warnings.
- `GET /cil/dashboard` — must pass `{ organizationUnit, sealedOnly }` filter to `getCilDashboardStats()` based on role permissions (`perms.seeOwnOrgOnly`, `perms.sealedOnly`). Global aggregate without scoping leaks cross-org intelligence.
- `assertCilAccess()` pattern: loads decision + DCI, applies `perms.sealedOnly` (DCI isSealed, not decision.status) and `perms.seeOwnOrgOnly` filters.

## Replay Integration

- Stage key: `replay_15_cil_assessment` — written directly by the CIL route (virtual stage, not driven by a real decision stage).
- Non-fatal: skip if no replay events exist yet for the decision (decision must have gone through at least some stages first).
- The stage was added to `REPLAY_STAGE_KEYS` array and `REPLAY_STAGE_LABELS_AR` map in `lib/db/src/schema/replay.ts`.

## ADP Integration

- CIL assessment is fetched in `assembleAdpData()` as `cilRows` (latest completed assessment only).
- `buildCilSection()` renders Section 11 of the PDF: 6 score meters, 12-principle table with compliance bars, warnings, constitutional reasoning.
- `badge()` only accepts: `"green" | "amber" | "red" | "blue" | "grey" | "navy"` — never `"emerald"`.

## Permission Matrix Notes

- `constitutional_reviewer`, `owner`, `supervisor` get `canRunCilAssessment` + `canAcknowledgeCilWarnings` — full CIL power.
- `department_director`, `viewer`, `citizen` get NO CIL access (all 4 flags false).
- `judge` gets `canAcknowledgeCilWarnings` but NOT `canRunCilAssessment` (can resolve warnings but not trigger AI).
- `minister`, `undersecretary`, `director_general` get read + dashboard but not run/acknowledge.

## AI Router Pattern

- Use `aiRouter.routeFor(TaskType.CONSTITUTIONAL_ASSESSMENT)` then `provider.complete({ taskType, prompt, systemPrompt, maxTokens: 8000 })`.
- Never call `aiRouter(...)` directly — it's a class instance, not a callable.
- `parseModelJson()` returns `{ ok: true, data: T } | { ok: false, raw: string }` — check `.ok` before using `.data`.

## Frontend Warnings Panel

- `CilWarningsPanel` in `decision-workspace.tsx` — rendered for `human_oversight` and `final_review` stages only.
- Advisory if no critical warnings; shows prominent blocker UI if `hasCritical` is true.
- Uses `useQuery` with staleTime 60s to avoid hammering the API on every render.
