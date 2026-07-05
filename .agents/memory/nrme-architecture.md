---
name: NRME Architecture
description: National Risk Modeling Engine — key design decisions, replay integration pattern, and access control rules
---

## Core design

- 9 DB tables in `lib/db/src/schema/risk.ts` (risk_categories, risks, risk_assessments, risk_scenarios, risk_treatments, risk_owners, risk_monitoring, risk_reviews, risk_history)
- 4 permission flags: `canReadRiskAssessment`, `canWriteRiskTreatment`, `canRecalculateRisk`, `canViewRiskDashboard` — in both `lib/db/src/permissions.ts` AND `artifacts/legal-research/src/lib/permissions.ts`
- `RiskLevel` type lives in `judicial-review.ts`; risk.ts re-exports it via `export type { RiskLevel } from "./judicial-review"` — do NOT redefine it (causes TS2308 ambiguous export error)

## Lazy calculation pattern

Assessment row created immediately on `POST /decisions` with `status=pending`. Full AI scoring triggers on first GET (`getRiskAssessment` calls `calculateRiskScores` when status is pending). Status polling with `refetchInterval` in frontend (3s while pending/calculating).

## Replay integration — CRITICAL rule

Virtual stage `replay_12_legitimacy_index` must be written with a **direct DB insert** to `decisionReplayEventsTable` — NOT via `recordReplayEvent()`.

**Why:** `recordReplayEvent()` looks up the stageKey in `STAGE_KEY_TO_REPLAY_STAGE` which only maps *decision* stage keys (e.g. "legal_basis"). Virtual stages like "nrme_risk_assessment" are not in that map, so the function returns early silently. Virtual stages must bypass the map and insert directly.

**How to apply:** Any service that needs to write a virtual replay stage (stages 3, 10, 11, 12) must import `decisionReplayEventsTable` from `@workspace/db` and insert directly with `auditHash` computed via SHA-256.

## Access control

`assertDecisionAccess` in `routes/risk.ts` enforces both `sealedOnly` (external_auditor sees only sealed decisions) and `seeOwnOrgOnly` (dept_director/department_director sees own org). Dashboard endpoint also applies both filters in the Drizzle `.where()` clause.

## refetchInterval in TanStack Query v5

The `refetchInterval` callback receives a `Query` object, not the data. Access current data via `query.state.data`:
```ts
refetchInterval: (query) => {
  const status = (query.state.data as MyType | undefined)?.field;
  return condition ? 3000 : false;
}
```
