---
name: Phase 3 — Decision Chain of Custody
description: Hash chain design, canonical JSON fix, atomic sequence, RBAC rules, and security decisions for the append-only custody trail.
---

## Core design
- **Algorithm**: SHA-256 with null-byte (`\x00`) field separator. Fields serialized in fixed order (see `buildHashInput` in `lib/db/src/custody-service.ts`).
- **Digital signature**: HMAC-SHA-256 of `currentRecordHash` keyed on `SESSION_SECRET`.
- **Chain hash**: `SHA-256(prevChainHash\x00currentRecordHash)` — cumulative.
- **Genesis record**: `previousRecordHash = null`, `previousChainHash = null`; verified as `GENESIS` in hash input.
- **Append-only enforced in code**: service only does INSERT inside a transaction; no UPDATE/DELETE paths exist.

## Critical fix: Canonical JSON for JSONB fields
**Why:** PostgreSQL JSONB normalizes key order (shortest key first, then lexicographic). `JSON.stringify` on a JS object before insert and after read-back produce different strings → hash mismatch on verify.
**Fix:** `canonicalJson(val)` — recursive, sorts all object keys alphabetically before serializing. Applied to `deviceInfo`, `previousValue`, `newValue` in `buildHashInput`. This is invariant under any JSONB key reordering.
**Location:** `lib/db/src/custody-service.ts` → `canonicalJson`.

## Critical fix: Atomic sequence allocation
**Why:** Fire-and-forget callers issue concurrent inserts for the same decision. Race condition on `SELECT MAX(seq)+1 → INSERT` produces unique constraint violations, silently dropping custody events.
**Fix:** `db.transaction` + `pg_advisory_xact_lock(0x43555354, decisionId)` scoped to the transaction. Lock is released on commit. ADVISORY_SCOPE = 0x4355_5354 ("CUST" in hex).
**Location:** `lib/db/src/custody-service.ts` → `recordCustodyEvent`.

## HMAC key security
- In production (`NODE_ENV=production`): throws if `SESSION_SECRET` is absent — never starts with a predictable fallback.
- In development: logs a prominent WARNING and uses a clearly-labeled insecure fallback.
- **Why:** A missing SESSION_SECRET makes HMAC signatures forgeable; fail-fast prevents silent misconfiguration in production.

## RBAC for custody endpoints
- **Chain read** (`GET /api/custody/:id`): requires `canReadAuditLog || canRunHashVerification`. Excludes minister/viewer/citizen who only have `canViewGovernanceDashboard`.
- **Verify** (`GET /api/custody/:id/verify`): requires `canRunHashVerification` only (external_auditor, owner).
- **Citizen CAR endpoint**: includes `custodySummary` (recordCount, valid, latestChainHash truncated) but custody queries are try-catch wrapped — a custody failure NEVER breaks the primary citizen response.

## Frontend
- `CustodyTimeline` component in `governance-hub.tsx` (before JudgeDashboard).
- Added `custody` tab to JudgeDashboard (judge role).
- `isValid: boolean | null` — null shows "جارٍ التحقق…" spinner while verify resolves; never falsely shows "valid" while loading.
- Citizen portal: `custodySummary` badge below integrity stamp (shows chain record count + validity + truncated hash).

## Fire-and-forget hooks wired in decisions.ts
1. `POST /decisions` → `decision.created`
2. `POST /decisions/:id/stages/:key/complete` → `stage.completed.<key>`
3. `POST /decisions/:id/dci/amend` → `dci.amended`
4. `POST /decisions/:id/qva/run` → `qva.run`
5. `POST /decisions/:id/car/generate` → `car.generated`

## Governance hooks wired in governance.ts
- `POST /governance/decisions/:id/delegate` → `decision.delegated`
- `POST /governance/decisions/:id/undelegate` → `decision.undelegated`

## Export endpoint field name
The export endpoint (`GET /api/custody/:id/export`) returns `chain` (not `records`) as the key for the array of custody records.

## Build sequence
Always run `cd lib/db && npx tsc --build` before running `npx tsc --noEmit` in api-server — api-server imports from the compiled lib/db dist.
