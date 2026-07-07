---
name: iOS SameSite Auth + CORS same-origin blindspot
description: SameSite=Strict + no-origin gates + CORS rejection of no-origin break iOS Safari/PWA login. Full root cause and fix documented here.
---

## Rule 1 — Cookie SameSite
Never use `SameSite: "strict"` for a JWT session cookie in a same-domain SPA.
Use `SameSite: "lax"` instead.

**Why:** iOS Safari in PWA standalone mode treats a post-form-submit `window.location.href = '/'`
hard navigation as a cross-context event. Cookies with `SameSite=Strict` are suppressed on the
subsequent navigation; the first `GET /api/auth/me` sees no cookie → 401/403 → redirect to login.

**How to apply:**
- Cookie options: `{ sameSite: "lax", httpOnly: true, secure: IS_PRODUCTION, path: "/" }`
- BOTH the login Set-Cookie AND logout clearCookie must use the same SameSite attribute.
- Post-login: call `refreshSession()` from UserContext then wouter `navigate('/')` instead of
  `window.location.href`. This keeps the session in the same fetch context.

## Rule 2 — CORS no-origin blindspot (the real root cause of the iOS redirect loop)

Browsers do NOT send the `Origin` header on same-origin `fetch()` calls.
`Origin` is only sent for cross-origin requests. When the frontend and API share
the same hostname (*.replit.app deployment), `GET /api/auth/me` from JavaScript
arrives at the server with NO Origin header.

Any gate that rejects no-origin requests in production kills the session check.

**Two independent blocks both caused 403 on GET /api/auth/me:**
1. Middleware gate: `if (!origin && !referer) → 403`
2. CORS callback: `if (!origin) return cb(new Error("CORS_NO_ORIGIN"))`

**Fix:**
- Allow no-origin in CORS callback: `if (!origin) return cb(null, true)`
- Remove the no-origin middleware gate entirely
- Cross-origin attacks always include Origin — CORS rejects those. Requests without
  Origin are same-origin and protected by SameSite=Lax + HttpOnly + JWT.

**Why POST /login worked but GET /auth/me didn't:**
POST with `Content-Type: application/json` triggers a CORS preflight OPTIONS
request, which always includes Origin (by spec). After preflight succeeds, the
actual POST also includes Origin → CORS allows → 200. GET /auth/me is a "simple"
same-origin request — no preflight, no Origin header → blocked by no-origin gates.

**Diagnostic symptom in production logs:**
```
POST /api/auth/login → 200   (login succeeds — preflight included Origin)
GET  /api/auth/me   → 403   (session check fails — same-origin GET has no Origin)
```
This pattern repeating means no-origin gate or CORS_NO_ORIGIN is the cause.

## Rule 3 — Wildcard CORS danger
`*.replit.app` with `credentials: true` lets any sibling Replit app read
authenticated API responses (cross-origin authenticated data exfiltration).

**Fix:** In production, allow ONLY exact origins from the `ALLOWED_ORIGIN` env var.
No wildcard regex. If env var is unset → log a warning and fail closed (empty allowlist).
