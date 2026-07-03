---
name: Legal Research Platform Architecture
description: Key architectural decisions, patterns, and pitfalls for منصة البحث القانوني — the full-stack AI legal research platform.
---

## Role-based auth

Role enforcement uses `X-User-Role` and `X-User-Id` request headers. `setRoleGetter` and `setUserIdGetter` are called in `artifacts/legal-research/src/main.tsx` so every API call from the generated hooks carries these headers automatically. Middleware lives in `artifacts/api-server/src/middlewares/roleAuth.ts`.

**Why:** No JWT/session auth in scope; header-based role lets the demo UI gate features without a full auth implementation.

**How to apply:** Every sensitive route imports `requireOwner`, `requireSupervisorOrOwner`, or `requireAnyRole` and adds it as inline middleware before the handler. For production: replace with a JWT verification step in roleAuth.ts.

## Custom fetch header injection

`lib/api-client-react/src/custom-fetch.ts` exports `setRoleGetter(getter)` and `setUserIdGetter(getter)`. These getters are invoked before each fetch and inject `X-User-Role` / `X-User-Id` headers unless already present. Registered in `main.tsx` from `localStorage`.

**How to apply:** If auth changes to JWT, replace the role getter with a token parser; the header injection plumbing is already in place.

## File upload not in OpenAPI spec

`/api/documents/upload` uses Multer (`multipart/form-data`) and is intentionally **excluded** from `lib/api-spec/openapi.yaml`.

**Why:** `format: binary` inside the spec causes `File`/`Blob` TypeScript errors in Orval codegen.

**How to apply:** Never add `format: binary` parameters to the spec. Upload is called manually with `fetch()` from the frontend.

## Export route pattern

`POST /api/export` returns JSON `{ downloadUrl, filename, generatedAt }` where `downloadUrl` points to `GET /api/export/download/:filename`. This matches the OpenAPI spec and works correctly with the generated mutation hooks.

## Typecheck order for libs

Always run `pnpm run typecheck:libs` (`tsc --build` at workspace root) before per-package `typecheck` inside `artifacts/*`. Stale `lib/*` `.d.ts` declarations cause false "module has no exported member" TS errors.

## PDF content extraction

Uses dynamic `import("pdf-parse")` with a cast: `(pdfMod as any).default ?? pdfMod` because the ESM build of pdf-parse does not have a `.default` export property in the TypeScript types.

## uploadsByDay not in generated DocumentStats type

The backend `/api/documents/stats` returns `uploadsByDay` (added for charts) but this field is not in the OpenAPI spec or the generated `DocumentStats` type. Access it with a cast: `(stats as typeof stats & { uploadsByDay?: Record<string, number> })`.

**Why:** Re-running codegen would require updating the spec. The quick fix avoids spec churn for a single extra field.

## Audit log

- Table: `audit_logs` in `lib/db/src/schema/audit-logs.ts`
- `logAudit(req, action, opts)` in `middlewares/auditLog.ts` — fire-and-forget, never throws
- Auto-log middleware captures all successful POST/PATCH/PUT/DELETE via `res.on('finish')`
- Explicit `logAudit` calls in route handlers for semantically named events (e.g. `ai.search`, `document.upload`)

## Caching

`artifacts/api-server/src/lib/cache.ts` — simple in-memory Map with TTL. Document lists expire in 2 min, stats in 30 s, settings in 10 min. All document mutations call `cache.delPattern("documents:")` to invalidate.

## DB seeding

`artifacts/api-server/src/seed.ts` runs on server startup (idempotent). Seeds: owner محمد الشامسي (userId=1), 2 additional users, 1 sample comparison, 1 settings row.

## AI key usage

`ANTHROPIC_API_KEY` is a Replit Secret. All AI calls are server-side in `artifacts/api-server/src/routes/ai.ts`. Routes return 503 when the key is absent. AI routes are rate-limited to 15 req/min (separate from global 200 req/min limiter).

## RAG / Semantic search

Documents are chunked into ~500-word segments with `[DOC:{id} CHUNK:{n}]` tags. Claude is asked to cite specific chunk tags in its response. Results include `section` field (e.g. "Chunk 3") and `excerpt` (verbatim quote) alongside `relevance` score.

## Backup

`POST /api/backup` runs `pg_dump` via child_process. Files saved to `./backups/` directory. Download via `GET /api/backup/download/:filename`. Owner-only.

## Production security

- `helmet` for security headers (CSP disabled for API-only server)
- `compression` for gzip
- `express-rate-limit`: 200/min global, 15/min for `/api/ai/*`
- Role middleware returns 401 for unknown roles, 403 for insufficient permissions

## Tests

Integration test suite in `artifacts/api-server/src/test/api.test.ts`. Run with `pnpm --filter @workspace/api-server run test`. Uses node:test against the live Express app (no mocking). Tests role enforcement, CRUD, export, audit log, and citations.

## Health check endpoint

Route is `/api/healthz` (not `/api/health`). Defined in `routes/health.ts`.
