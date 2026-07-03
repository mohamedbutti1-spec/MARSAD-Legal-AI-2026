---
name: Legal Research Platform Architecture
description: Key architectural decisions, patterns, and pitfalls for مرصد | Marsad — a full-stack AI legal research platform.
---

## Platform Identity

Name: **مرصد | Marsad** — منصة البحث القانوني المتكاملة
Ministry of Justice visual identity: deep navy sidebar, gold accent, light grey background.

## MoJ Design System

### Palette (CSS vars in `artifacts/legal-research/src/index.css`)
- Primary (navy): `hsl(var(--primary))` → #1B2A4A equivalent (hsl 220 47% 20%)
- Gold accent: `hsl(var(--gold))` → #C9A84C equivalent (hsl 43 49% 54%)
- Background: `hsl(var(--background))` → #F5F6FA equivalent (hsl 230 23% 97%)
- Sidebar dark: hsl(220 52% 13%)
- Active sidebar items use `.nav-item-active` utility (gold right-border + gradient bg)

### Typography
- Primary: IBM Plex Sans Arabic (`var(--app-font-sans)`)
- Display: Amiri (`var(--app-font-serif)`)

### Shared components (all in `artifacts/legal-research/src/components/ui/`)
- `module-coming-soon.tsx` — professional placeholder with feature list, for stub pages
- `empty-state.tsx` — dashed-border with icon/title/description/action
- `loading-card.tsx` — `LoadingCard`, `LoadingGrid`, `LoadingTable` skeleton loaders
- `error-boundary.tsx` — `ErrorBoundary` (class) + `ErrorMessage` (functional)
- `status-badge.tsx` — `StatusBadge` + `RoleBadge` with role variants
- `route-guard.tsx` — `RouteGuard` component (client-side role check, UX only)

**Why:** Backend is the real authz source; RouteGuard is UX convenience, not security.

## Navigation Architecture (13 modules)

Sidebar groups (`artifacts/legal-research/src/components/layout/sidebar.tsx`):
- **الرئيسية** → Dashboard `/`
- **أدوات البحث** → Legal Research `/research`, AI Assistant `/assistant`, Literature Review `/literature-review`
- **المصادر القانونية** → UAE Legislation `/legislation/uae`, UAE Case Law `/caselaw/uae`, French Law `/law/france`, EU Law `/law/eu`
- **أدوات الإنتاجية** → Citation Generator `/citations`, Document Comparison `/comparison`, Personal Library `/library`
- **الإدارة** → User Management `/admin/users`, Settings `/settings`

Legacy routes kept for backwards compat (old URLs still work).

## Route Guard Pattern

`RouteGuard` wraps restricted routes in `App.tsx`. Pass `allow={canUseAi}` etc. — shows a 403 page + redirects when false.

```tsx
<Route path="/research">
  <RouteGuard allow={canUseAi}><LegalResearch /></RouteGuard>
</Route>
```

**Why:** Prevents URL-bar navigation to restricted modules by unauthorized roles.

## Language / RTL

- `UserContext` exposes `lang: 'ar'|'en'` and `dir: 'rtl'|'ltr'`
- `setLang()` persists to localStorage and updates `document.documentElement` dir + lang
- `useT()` hook: `const t = useT(); t('عربي', 'English')` — returns string based on lang
- `AppLayout` sets `dir={dir}` on the root flex container
- Sidebar uses `border-inline-end` for the active indicator (RTL-aware)
- Mobile drawer slides from `start-0` (RTL-aware via `dir` attribute)

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

Key files:
- `tasks.ts` — `TaskType` enum + `TASK_ROUTING` table
- `providers/claude.provider.ts` — live Claude implementation
- `providers/perplexity.provider.ts` — placeholder (throws NotImplemented, awaiting approval)
- `key-service.ts` — resolves keys: env var first (Replit Secret), then DB settings table; 60s cache
- `router.ts` — `AIRouter` singleton: `routeFor(task)` / `routeAll(task)`
- `index.ts` — public barrel; import from here only

**Correct call pattern:**
```typescript
const provider = await aiRouter.routeFor(TaskType.RAG);
const result = await provider.complete({ taskType: TaskType.RAG, prompt, systemPrompt });
// result has: { text, provider, model, usage }
// Build _meta yourself: { provider: result.provider, model: result.model }
```

## AI key security invariant

`GET /settings` NEVER returns `claudeApiKey` or `perplexityApiKey`. Only boolean flags (`claude: bool`, `perplexity: bool`) are exposed. Tests in integration test suite verify this invariant.

## Settings table — single-row pattern

`settingsTable` always has exactly one row (enforced by `ensureSettings()`). All PATCH operations use `.where(eq(settingsTable.id, current.id))`.

## File upload

`/api/documents/upload` uses Multer (`multipart/form-data`) and is intentionally excluded from `lib/api-spec/openapi.yaml`. Must use `apiFetch()` not bare `fetch()`.

## Export route pattern

`POST /api/export` returns `{ downloadUrl, filename, generatedAt }` where `downloadUrl` points to `GET /api/export/download/:filename`.

## Typecheck order for libs

Run `cd lib/db && npx tsc -b` before per-package typecheck when schema changes are made. The DB package is a TypeScript composite project (`composite: true`, `emitDeclarationOnly: true`) — it has no pnpm build script, use `npx tsc -b` directly. Stale `.d.ts` declarations cause false "no exported member" errors.

**Why:** Adding new tables to `lib/db/src/schema/index.ts` is not enough — the declaration files in `lib/db/dist/` must be rebuilt or the api-server TypeScript compiler won't see new exports.

## Express 5 params typing

`req.params[key]` is `string | string[]` under Express 5 types. Use `(req.params.id as string)` cast for route params. `req.headers["x-user-id"]` is also `string | string[] | undefined`; use `if (!h) return 1; return parseInt(Array.isArray(h) ? h[0] : h)`.

## Assistant session IDOR pattern

All session-scoped message endpoints MUST verify ownership before reading or writing. Always resolve the session with `and(eq(sessionId, ...), eq(userId, currentUserId))` first.

**Why:** `GET /messages` and `POST /messages` without userId check allows any authenticated user to read/write another user's chat history (broken access control).

**How to apply:** Fetch session row with both id AND userId constraint. Return 404 if missing (don't reveal that the session exists). Delete messages only AFTER confirming ownership.

## Audit log

- Table: `audit_logs` in `lib/db/src/schema/audit-logs.ts`
- `logAudit(req, action, opts)` — fire-and-forget, never throws
- `canViewAudit` permission in `UserContext` (owner + supervisor only)

## Caching

`artifacts/api-server/src/lib/cache.ts` — in-memory Map with TTL. Constants: `TTL.SHORT` (30s), `TTL.MED` (2min), `TTL.LONG` (10min). No `TTL.MEDIUM` or `cache.clear()`. Use `cache.delPattern("prefix:")` to invalidate a namespace.

## AI key usage

`ANTHROPIC_API_KEY` is a Replit Secret. All AI calls are server-side. Routes return 503 when key absent. AI routes rate-limited to 15 req/min.

## RAG / Semantic search

Documents chunked into ~500-word segments. Each AI response includes `_meta: { provider, model }` for observability. The `_meta` field is NOT part of `AIProviderResult` — build it from `result.provider` and `result.model`.

## Health check

Route is `/api/healthz` (not `/api/health`).

## Perplexity integration — PENDING APPROVAL

`PerplexityProvider.complete()` throws `NotImplemented`. Do not implement until user explicitly approves. Infrastructure (key storage, routing) is already in place.

## Legal OS — AI Legal Operating System (legacy)

`/legal-os` — original 4-screen workflow, preserved but superseded by Admin OS at `/admin-os`. Do not remove (existing sessions reference it).

## Admin Decision OS — Al-Shamsi Theory (Phase 1 foundation)

Backend engine for the government-grade Administrative Decision OS. Routes all at `/api/admin-os/*`.

### DB tables (3 new, pushed)
- `admin_decision_types` — seed catalog of ≥30 UAE decision types (6 domains: personnel, regulatory, procurement, appeals, citizen, digital)
- `admin_decision_sessions` — one row per user assessment; stores brief JSONB + legalityScore + riskScore + canIssueToday
- `admin_decision_briefs` — stores brief separately for future export tracking; cascade-delete when session deleted (manual, no FK)

### Seed
Run: `cd artifacts/api-server && /home/runner/workspace/scripts/node_modules/.bin/tsx --tsconfig tsconfig.json src/scripts/seed-admin-os.ts`
Seed data lives in `artifacts/api-server/src/data/admin-os-seed.ts`. Idempotent (clears UAE rows before re-seeding).

### 12-Dimension evaluator
`artifacts/api-server/src/utils/admin-os-evaluator.ts` exports:
- `buildEvaluatorPrompt()` — constructs bilingual system+user prompt for Claude
- `validateAdminBrief()` — checks all 12 dimensions (status enum, score 0–100 bounds, explanationAr + explanationEn, arrays); returns 422 string or null
- `computeLegalityScore()` — weighted average (Jurisdiction 20%, Cause 15%, Form 10%, Subject Matter 10%, Purpose 10%, Human Will 8%, Digital Will 5%, Algo Weight 5%, Algo Bias 5%, Explainability 4%, Oversight 4%, Judicial 4%)
- `computeRiskScore()` — inverted legality + non-compliant penalty + missing-req penalty × inherentRisk multiplier
- `VALID_ROLES` set — 7 allowed roles enforced server-side in POST /assess

### API endpoints
- `GET /api/admin-os/decision-types?jurisdiction=uae&domain=&risk_level=` — returns flat list + grouped by domain
- `GET /api/admin-os/sessions` — user-scoped history (userId from x-user-id header)
- `GET /api/admin-os/sessions/:id` — single session with full brief
- `DELETE /api/admin-os/sessions/:id` — cascade-deletes linked brief row
- `POST /api/admin-os/assess` — runs Al-Shamsi eval, saves session + brief, returns {session, brief, citations}
- `POST /api/admin-os/followup` — chat on saved session

### Auth note
Header-based identity (x-user-id / x-user-role) is a pre-existing platform pattern, not introduced here. For production: replace getUserId() with JWT/session verification in roleAuth.ts.

### RAG
Admin OS reuses `utils/rag.ts` (shared with assistant + legal-os). buildContext() called with uid to scope DOC lookups.

## Tests

Integration test suite in `artifacts/api-server/src/test/api.test.ts`. Run with `pnpm --filter @workspace/api-server run test`. Includes security invariant tests for AI provider abstraction.
