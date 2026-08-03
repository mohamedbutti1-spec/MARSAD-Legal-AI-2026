---
name: Forced password change after admin reset
description: How the must_change_password gate works and where it must stay in sync
---

## Decision: DB-backed flag, enforced server-side (not just a frontend redirect)

`users.must_change_password` is set true whenever an admin creates an account or resets a password (`POST /users`, `PATCH /users/:id` with a password in `artifacts/api-server/src/routes/users.ts`), and set false only by the self-service `POST /auth/change-password` endpoint. The `authenticate` middleware re-reads this column live (same query as the existing `password_version` check) and 403s every route except `/auth/change-password` while it's true.

**Why:** A frontend-only gate (redirect to a "set password" screen) can be bypassed by calling the API directly. Blocking in `authenticate` means the temporary password genuinely cannot be used for anything except changing itself, regardless of client.

**How to apply:** Any new JWT-issuing route must include `mustChangePassword` in `signToken()` (see `lib/jwt.ts`'s `JwtPayload`) or the compiler will catch it. Any new route that legitimately needs to work *before* the password is changed (like `/auth/change-password` itself) must be added to the path-allowlist check in `authenticate.ts`. `GET /auth/me` bypasses `authenticate` entirely (per the session-invalidation-pattern memory), so it always reflects the token's snapshot, not a live DB read.
