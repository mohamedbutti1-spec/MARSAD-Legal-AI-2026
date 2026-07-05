---
name: Version 1.0 Freeze
description: What was fixed for v1.0 production readiness, what is deferred to v2.0, and standing platform constraints
---

## V1.0 is feature-frozen

No new modules, dashboards, AI features, analytics, simulations, legal engines, or architectural changes.
Only permitted work: bug fixes, stability, validation, testing, documentation.

## What was fixed for V1.0

1. **JDT replay guard removed** — removed `if (existing.length === 0) return;` from JDT virtual replay write. JDT events must always be recorded (unlike CIL which requires prior workflow stages).
2. **markJdtRunning race condition** — replaced read-then-write pattern with atomic `onConflictDoUpdate` upsert using `sql\`${table.col} + 1\`` for version increment.
3. **jdt.ts logging** — all `console.error` calls replaced with `logger.error({ err }, "...")` using pino.
4. **replit.md** — fully rewritten to document MARSAD v1.0: all modules, roles, schema, AI integration, architecture decisions, gotchas, and version history.
5. **Both TypeScript checks pass clean** — @workspace/db, @workspace/api-server, @workspace/legal-research all zero errors.

## Known deferred to V2.0 (do not implement unless user schedules)

- API versioning (`/api/v1/...`)
- Zod validation for AI response payloads
- JWT / UAE Pass / session-based auth (current: header-based RBAC)
- `catchAsync` wrapper for all Express routes
- Unified logger across all route files (99 console.error references across routes)
- Drizzle Kit migration manager for schema evolution
- CORS strict production hardening

## Platform constraints (Alpha 1.0 — inherited, not bugs)

- Auth is header-based (`X-User-Role`, `X-User-Id`, `X-User-Org`) — accepted for alpha
- seedDatabase() is fire-and-forget (intentional — seeding is idempotent, must not block startup)
- 8.5mb API bundle — inherent to the full dependency set, not actionable without tree-shaking refactor
