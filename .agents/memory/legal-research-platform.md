---
name: Legal Research Platform Architecture
description: Key architectural decisions for منصة البحث القانوني — auth, codegen, file upload, export, and seeding patterns.
---

## Role-based auth

Role enforcement uses `X-User-Role` request header (set from localStorage on the frontend). Middleware lives in `artifacts/api-server/src/middlewares/roleAuth.ts`. For production, replace with a JWT/session verification step.

**Why:** No auth system was set up in scope; header-based role lets the demo UI gate features without a full auth implementation.

**How to apply:** Every sensitive route imports `requireOwner`, `requireSupervisorOrOwner`, or `requireAnyRole` and adds it as inline middleware before the handler.

## File upload not in OpenAPI spec

`/api/documents/upload` uses Multer (`multipart/form-data`) and is intentionally **excluded** from `lib/api-spec/openapi.yaml`.

**Why:** `format: binary` inside the spec causes `File`/`Blob` TypeScript errors in Orval codegen. The endpoint is called manually with `fetch()` from the frontend.

**How to apply:** Never add `format: binary` parameters to the spec. Keep upload logic in `artifacts/api-server/src/routes/documents.ts` as a manual route.

## Export route pattern

`POST /api/export` returns JSON `{ downloadUrl, filename, generatedAt }` where `downloadUrl` points to `GET /api/export/download/:filename`.

**Why:** Returning binary directly from POST breaks the generated React Query mutation hooks (they expect JSON). The two-step approach keeps the spec clean and the client simple.

## Typecheck order for libs

Always run `pnpm run typecheck:libs` (i.e. `tsc --build` at workspace root) before running per-package `typecheck` inside `artifacts/*`. Stale `lib/*` `.d.ts` declarations cause false "module has no exported member" TS errors.

## DB seeding

`artifacts/api-server/src/seed.ts` runs on server startup via `seedDatabase()` in `index.ts`. It seeds: owner user محمد الشامسي, 2 sample users, 1 comparison table row, and 1 settings row — all idempotent (only inserts when table is empty).

## AI key usage

`ANTHROPIC_API_KEY` is a Replit Secret. All AI calls are server-side in `artifacts/api-server/src/routes/ai.ts`. Routes return 503 with a descriptive message when the key is absent — never expose the key to the browser.
