---
name: Alpha 1.0 Architecture Freeze
description: P0/P1 fixes applied, Architecture Specification written, release tag created.
---

## What was done (2026-07-04)

All P0 and production-blocking P1 bugs resolved; full Architecture Specification written; release tagged MARSAD Alpha 1.0.

## Critical: dual permissions source of truth

Backend enforces permissions from `lib/db/src/permissions.ts`.  
Frontend uses `artifacts/legal-research/src/lib/permissions.ts`.  
Both must be updated in sync — frontend-only changes are overridden by the server's 403.

**Why:** Code review caught `constitutional_reviewer.canReadJdp` fixed only in frontend; backend still returned 403.

**How to apply:** Any permission change must touch BOTH files simultaneously.

## CORS production gate (app.ts)

Wildcard Replit/localhost origins are only loaded when `NODE_ENV !== "production"`.  
In production, only `process.env.ALLOWED_ORIGIN` is trusted (plus no-origin server-to-server requests).

**Why:** `credentials: true` + broad wildcard origin = cross-origin credential exposure in prod.

## sendError helper

`artifacts/api-server/src/lib/sendError.ts` — standard shape `{ error, code?, details? }`.  
Not yet applied to all existing route handlers (Beta task).  
`ApiErrorCode` union defines the machine-readable code values.

## Platform canonical names

- Arabic: **مرصد (MARSAD)**  
- English: **MARSAD — منصة القرارات الإدارية الذكية**  
- Sub-header: **Al-Shamsi Constitutional Decision Framework™ Alpha 1.0**

## frame-ancestors CSP note

`frame-ancestors` directive is silently ignored inside `<meta http-equiv="Content-Security-Policy">`.  
Set it only via HTTP response headers (Helmet handles this on the API; Vite/nginx handles it on the frontend in production).
