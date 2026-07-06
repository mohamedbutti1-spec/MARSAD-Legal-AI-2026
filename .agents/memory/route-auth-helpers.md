---
name: Route Auth Helpers
description: Canonical auth header helpers for all API route files; guards against IDOR via unsafe userId defaults
---

## Rule
All route files must import `getUserId` and `getValidatedRole` from `../lib/route-helpers` (or `../lib/route-helpers.js` for ESM routes). Never define local copies.

## Why
11 of 15 route files had local `getUserId` copies returning `1` on a missing `x-user-id` header. This silently bound unauthenticated requests to a real user account (user #1), bypassing ownership scoping on every `WHERE owner_id = $userId` query.

## How to apply
- `getUserId(req)` → returns `-1` (impossible DB id) when header is absent or invalid. Ownership queries like `WHERE user_id = $uid` return 0 rows — no data leak.
- `getValidatedRole(req)` → validates against `ALL_ROLES` whitelist, defaults to `"citizen"`.
- Two intentional exceptions that must NOT be changed:
  - `memory.ts` local `getUserId(): string` — returns `"system"` for audit trail actor fields; different type and semantics
  - `assistant.ts` local `getUserId()` — already returns `-1` correctly; kept as-is
- The `legal-sources.ts` `userId()` function was dead code (never called) — removed entirely.

## Canonical file
`artifacts/api-server/src/lib/route-helpers.ts`
