---
name: Sealed State Source of Truth
description: The canonical seal flag for decisions is decisionDci.isSealed — decisions.status has no "sealed" value. All sealed checks must use DCI.
---

## The Rule

`decisions.status` NEVER equals `"sealed"`. The DECISION_STATUS_VALUES enum is:
`["draft", "in_progress", "validation_failed", "complete", "signed"]`

The canonical sealed flag is `decision_dci.isSealed` (boolean on `decisionDciTable`).

**Why:** The DCI sealing lifecycle is separate from the decision workflow lifecycle. A decision can be "complete" or "signed" while its DCI is sealed or not sealed independently.

**How to apply:**
- Any sealedOnly access guard: fetch DCI with `db.select({ isSealed: decisionDciTable.isSealed }).from(decisionDciTable).where(eq(decisionDciTable.decisionId, id)).limit(1)` and check `!dciRow?.isSealed`
- Any immutability guard on write paths: use `decision.dciIsSealed` (returned from `assertDecisionAccess` in risk.ts) or fetch DCI separately
- Dashboard filters for sealedOnly roles: LEFT JOIN `decisionDciTable` and use `eq(decisionDciTable.isSealed, true)` — LEFT JOIN preserves non-DCI decisions for non-sealedOnly roles

## Files Where This Pattern Is Applied
- `artifacts/api-server/src/routes/risk.ts` — `assertDecisionAccess()` fetches DCI in parallel, returns `{ ...decision, dciIsSealed }`
- `artifacts/api-server/src/routes/decisions.ts` — replay endpoint (replaySealRow) and ADP export endpoint (adpSealRow) each do a targeted DCI lookup before sealedOnly check

## Pitfall
Using `decision.status === "sealed"` will silently never fire (always false) — no TypeScript error, no runtime error, just broken access control.
