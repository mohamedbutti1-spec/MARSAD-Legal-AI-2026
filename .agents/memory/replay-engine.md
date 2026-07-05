---
name: Decision Replay Engine
description: Durable access-control and hash-integrity rules for the replay timeline feature
---

# Decision Replay Engine — Durable Decisions

## Access control pattern for replay (and similar read-detail governance endpoints)

**Rule:** Never use `requireAnyRole` (owner/supervisor/viewer only) for endpoints that governance roles must access. Use `requirePermission('canReplayDecision')` (or the relevant flag) which evaluates all 14 roles against the RBAC matrix.

**Why:** `requireAnyRole` silently blocks all 11 governance roles. The mistake is easy to make because `requireAnyRole` is the convenience default for "anyone logged in" — but it only covers the 3 legacy roles.

**How to apply:** After `requirePermission`, do NOT call `assertDecisionAccess` — it also only allows owner/supervisor/creator. Instead write an inline check:
1. Fetch the decision directly (404 if missing)
2. If `permissions.seeOwnOrgOnly`: read `x-user-org` header (canonical; matches `getCustodyCtx`); deny-by-default if header is absent, empty, or doesn't exactly match `decision.organizationUnit`
3. If `permissions.sealedOnly`: deny if `decision.status !== 'sealed'`

## Hash determinism rule

**Rule:** When writing a row with an app-computed timestamp for later re-verification, always store that exact timestamp explicitly in the insert instead of relying on DB `defaultNow()`.

**Why:** `defaultNow()` runs at DB commit time, which differs by milliseconds from the app-side `new Date().toISOString()` used in the hash computation. `verifyReplayEventHash()` reads `recordedAt` from the DB row — if it differs from the hashed value, every verification will fail.

**How to apply:** Set `recordedAt: new Date(recordedAt)` in the insert, using the same `recordedAt` string that was fed into `computeReplayAuditHash()`.

## Virtual vs. written stages

14 replay stage keys, but only 11 trigger DB writes. Stages 03/data-validation, 10/legal-weight, 11/algo-bias, 12/LSI are assembled at GET time from `audit_logs`, `judicial_reviews`, and `decision_memory`. Write events are non-fatal (try/catch) — they must never block stage completion.
