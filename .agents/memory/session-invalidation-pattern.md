---
name: Password-reset session invalidation
description: How stateless JWT sessions are force-invalidated on password reset; where the check does and doesn't apply
---

## Decision: password_version claim compared against live DB row, tolerant of missing rows

The JWT carries a `pwv` claim snapshotting `users.password_version` at issuance. `authenticate` middleware re-fetches the user's current `password_version` on every request; a mismatch (only when a matching row exists) clears the cookie and 401s. `PATCH /users/:id` bumps `password_version` via `sql`${col} + 1`` whenever a password is set.

**Why:** JWTs here are otherwise fully stateless (role/org trusted straight from the signed token, no DB hit). Some flows intentionally use synthetic/non-existent user IDs (tests, and at least one route computing "sessions for a brand-new owner user") that were never expected to resolve to a real `users` row. Rejecting whenever no row is found broke those flows. Rejecting only on a *found* mismatch preserves both the stateless-fast-path behavior for those IDs and real invalidation for genuine accounts.

**How to apply:** Any new place that issues a JWT (`signToken`) must include the current `pwv`. `GET /api/auth/me` intentionally bypasses `authenticate` (it decodes the raw token to answer "am I logged in") — it does NOT reflect password-reset invalidation; use a protected route to verify invalidation, not `/auth/me`.
