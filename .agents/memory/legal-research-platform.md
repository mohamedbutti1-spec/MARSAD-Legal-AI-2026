---
name: Legal Research Platform Architecture
description: Key architectural decisions, patterns, and pitfalls for منصة البحث القانوني — the full-stack AI legal research platform.
---

## Role-based auth

Role enforcement uses `X-User-Role` and `X-User-Id` request headers. `setRoleGetter` and `setUserIdGetter` are called in `artifacts/legal-research/src/main.tsx`. Middleware in `artifacts/api-server/src/middlewares/roleAuth.ts`.

**Why:** No JWT/session auth in scope; header-based role lets the demo UI gate features without a full auth implementation.

**How to apply:** Every sensitive route imports `requireOwner`, `requireSupervisorOrOwner`, or `requireAnyRole`. For production: replace with a JWT verification step in roleAuth.ts.

## Raw fetch() calls must use apiFetch()

Any `fetch('/api/...')` call in the frontend must use `artifacts/legal-research/src/lib/api-fetch.ts` (`apiFetch()`), not bare `fetch()`. The generated API-client hooks use `customFetch` which injects headers automatically, but multipart uploads and manual fetch calls bypass it.

**Why:** This was the root cause of the upload 403 bug — missing X-User-Role header.

**How to apply:** `grep -rn "fetch('/api"` in frontend src to catch violations. The only place bare fetch is allowed is inside `api-fetch.ts` itself.

## AI provider abstraction layer

All AI calls go through `artifacts/api-server/src/ai/` — routes must NEVER import Anthropic/Perplexity/OpenAI SDKs directly.

Directory layout:
- `tasks.ts` — `TaskType` enum + `TASK_ROUTING` table (which task → which provider(s))
- `providers/interface.ts` — `AIProvider` interface + `AITaskContext` + `AIProviderResult` + `stripCodeFences` + `parseModelJson` helpers
- `providers/claude.provider.ts` — live Claude implementation
- `providers/perplexity.provider.ts` — placeholder (throws NotImplemented, awaiting approval)
- `providers/openai.provider.ts` — placeholder (reserved for future use)
- `key-service.ts` — resolves keys: env var first (Replit Secret), then DB settings table; 60s in-process cache; `invalidateKeyCache()`; `getKeyStatus()` returns booleans only
- `router.ts` — `AIRouter` singleton; `routeFor(task)` → single provider; `routeAll(task)` → array; exhaustive switch with `never` guard
- `index.ts` — public barrel; import from here, never from sub-files

**How to apply:** `import { aiRouter, TaskType } from "../ai"` in any route. Do not add new task types without updating both `TaskType` enum and `TASK_ROUTING` record.

## Task routing table

| Task type | Provider |
|---|---|
| DOCUMENT_SEARCH, RAG, LITERATURE_REVIEW, CITATION, DOCUMENT_COMPARE | Claude |
| LIVE_WEB_SEARCH, LATEST_LEGISLATION, COURT_DECISIONS, LEGAL_NEWS | Perplexity (placeholder) |
| MIXED | Claude + Perplexity |

## AI key security invariant

`GET /settings` NEVER returns `claudeApiKey` or `perplexityApiKey` from the DB row. `sanitizeForClient()` strips them and adds boolean flags (`claude: bool`, `perplexity: bool`). This invariant is tested in the integration test suite.

Key resolution order:
1. `process.env.ANTHROPIC_API_KEY` / `PERPLEXITY_API_KEY` (Replit Secrets — highest priority)
2. DB `settings.claudeApiKey` / `settings.perplexityApiKey` (set via PATCH /settings/api-keys)

**Why:** Keys must never reach the browser. The DB path allows key rotation without redeployment.

## Settings table — single-row pattern

`settingsTable` always has exactly one row (enforced by `ensureSettings()`). All PATCH operations must target by `WHERE id = current.id` to avoid accidental multi-row updates.

**How to apply:** Both `PATCH /settings` and `PATCH /settings/api-keys` use `.where(eq(settingsTable.id, current.id))`.

## File upload not in OpenAPI spec

`/api/documents/upload` uses Multer (`multipart/form-data`) and is intentionally excluded from `lib/api-spec/openapi.yaml`.

**Why:** `format: binary` in spec causes TypeScript errors in Orval codegen.

## Export route pattern

`POST /api/export` returns `{ downloadUrl, filename, generatedAt }` where `downloadUrl` points to `GET /api/export/download/:filename`.

## Typecheck order for libs

Always run `pnpm run typecheck:libs` (`tsc --build` at workspace root) before per-package typecheck. Stale `.d.ts` declarations cause false "module has no exported member" errors.

## PDF content extraction

Dynamic `import("pdf-parse")` with cast: `(pdfMod as any).default ?? pdfMod` — the ESM build doesn't have a `.default` export in its TypeScript types.

## uploadsByDay not in generated DocumentStats type

Cast: `(stats as typeof stats & { uploadsByDay?: Record<string, number> })`. Adding to OpenAPI spec would require codegen re-run.

## Audit log

- Table: `audit_logs` in `lib/db/src/schema/audit-logs.ts`
- `logAudit(req, action, opts)` in `middlewares/auditLog.ts` — fire-and-forget, never throws
- Explicit `logAudit` calls in route handlers with named events (e.g. `ai.search`, `document.upload`)

## Caching

`artifacts/api-server/src/lib/cache.ts` — in-memory Map with TTL. Document lists expire 2 min, stats 30 s, settings 10 min. Document mutations call `cache.delPattern("documents:")`.

## DB seeding

`artifacts/api-server/src/seed.ts` runs on server startup (idempotent). Seeds: owner محمد الشامسي (userId=1), 2 additional users, 1 sample comparison, 1 settings row.

## AI key usage

`ANTHROPIC_API_KEY` is a Replit Secret. All AI calls are server-side in `artifacts/api-server/src/routes/ai.ts` via the AIRouter. Routes return 503 when the key is absent. AI routes are rate-limited to 15 req/min.

## RAG / Semantic search

Documents chunked into ~500-word segments with `[DOC:{id} CHUNK:{n}]` tags. Claude cites specific chunk tags. Results include `section` and `excerpt` fields. Each AI response now includes `_meta: { provider, model }` for observability.

## Backup

`POST /api/backup` runs `pg_dump`. Files saved to `./backups/`. Owner-only.

## Production security

- `helmet`, `compression`, `express-rate-limit` (200/min global, 15/min for `/api/ai/*`)
- Role middleware: 401 for unknown roles, 403 for insufficient permissions

## Tests

Integration test suite in `artifacts/api-server/src/test/api.test.ts`. Run with `pnpm --filter @workspace/api-server run test`. Uses node:test against live Express app. Includes security invariant tests for the AI provider abstraction (key not exposed in GET /settings, api-keys endpoint returns only boolean flags, unknown fields rejected).

## Health check endpoint

Route is `/api/healthz` (not `/api/health`). Defined in `routes/health.ts`.

## Perplexity integration — PENDING APPROVAL

`PerplexityProvider` is implemented as a placeholder. All Perplexity-routed tasks throw `NotImplemented`. Do not implement until the user explicitly approves the integration sprint. The key storage and routing infrastructure is already in place.
