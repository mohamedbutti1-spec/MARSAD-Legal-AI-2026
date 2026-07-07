---
name: JWT Auth Architecture
description: Cookie-based JWT session management — implementation decisions and security model for MARSAD v1.1
---

## Decision: HTTP-only cookie JWT session (not localStorage or Authorization header)

Cookie named `marsad_session`, signed HS256, `SESSION_SECRET` env var, 8-hour expiry.  
`httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production.

**Why:** SameSite=Strict eliminates CSRF without a token. httpOnly prevents XSS token theft. Cookies are sent automatically on every request so the frontend needs zero token management.

**How to apply:** All API routes are protected by the `authenticate` middleware in `src/middlewares/authenticate.ts`. Auth routes and `/api/healthz` are exempt (hardcoded path checks in `src/app.ts`).

---

## Decision: Strip-then-backfill pattern for legacy header reads

Many routes directly read `x-user-role`, `x-user-id`, `x-user-org` from headers (pre-JWT legacy code). Instead of rewriting all 30+ route files:

1. **Global strip middleware** (in `app.ts`, runs first): deletes all three headers from every incoming request
2. **`authenticate` middleware** (after strip): verifies JWT, sets `req.user`, then **backfills** `req.headers["x-user-role/id/org"]` from the verified JWT payload

**Why:** Prevents header spoofing without touching 30+ route files. Legacy route code continues to work but now reads server-verified values.

**How to apply:** Any new route should prefer `getValidatedRole(req)` / `getUserId(req)` from `lib/route-helpers.ts`. Never read `x-user-*` headers in new code.

---

## Decision: Demo accounts seeded at startup (not migration)

`migrateAuth()` in `seed.ts` runs at every startup. It:
- Adds `username` / `password_hash` columns via `ALTER TABLE IF NOT EXISTS` (idempotent)
- Checks `password_hash IS NOT NULL` before hashing — skips re-hashing on restart
- 14 demo accounts, one per role; pattern: `<Role>@MARSAD2024` (e.g. `Admin@MARSAD2024`)

**Why:** bcrypt hash takes ~100ms per account; the null-check means startup only hashes on first boot.

**How to apply:** Always call `migrateAuth()` FIRST in `seedDatabase()` — other migrations may need the users table to exist with auth columns.

---

## Security model: double-check table

| Source of truth | Field | Where read |
|----------------|-------|-----------|
| JWT (server-signed) | userId | `req.user.userId` via `getUserId(req)` |
| JWT | role | `req.user.role` via `getValidatedRole(req)` |
| JWT | org | `req.user.org` via `getUserOrg(req)` in governance.ts |
| Stripped (never trusted) | x-user-role header from client | Deleted in global strip middleware |
| Stripped (never trusted) | x-user-id header from client | Deleted in global strip middleware |
| Stripped (never trusted) | x-user-org header from client | Deleted in global strip middleware |

---

## Cookie helpers

```typescript
import { COOKIE_NAME, COOKIE_MAX_AGE_MS } from "../lib/jwt";
// signToken(payload) → string
// verifyToken(token) → { userId, role, org }
```

---

## Frontend session management

`src/lib/user-context.tsx` calls `GET /api/auth/me` on mount. Exposes `isLoaded`, `isAuthenticated`, `refreshSession`.  
`src/App.tsx` wraps everything in `<AuthGate>` — shows spinner while loading, `<Login>` if unauthenticated.  
`custom-fetch.ts` passes `credentials: "include"` on every fetch so the cookie is sent cross-origin in Vite dev.

---

## Known deferred items (v1.2)

- xlsx CVE (H2): replace with exceljs
- Zod runtime validation on JRE/JDC/SPG/PGF session routes (M1)
- File upload MIME validation (M2)
- Remove demo credential autofill before customer hand-off (L1)
