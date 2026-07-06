---
name: V1.0 Production Hardening
description: Lessons from the V1.0 production hardening session — rate limiting pattern, migration ALTER TABLE IF NOT EXISTS pattern, isNaN guard pattern, null safety pattern
---

## Rate Limiting Pattern (express-rate-limit v8)
File: `artifacts/api-server/src/middlewares/rateLimits.ts`
Three tiers: `aiSessionLimit` (10/min for full pipeline), `aiAnalysisLimit` (30/min for single AI calls), `kbSearchLimit` (60/min).
**How to apply:** Add the appropriate limit as middleware in the route chain, AFTER auth middleware, BEFORE the async handler.
Example: `router.post("/route", requireAnyRole, aiAnalysisLimit, async (req, res) => { ... })`
**Why:** Auth must fire first to avoid consuming rate limit quota on unauthenticated requests.

## Migration: ALTER TABLE IF NOT EXISTS before GIN index
GIN full-text search indexes on `search_vector TSVECTOR` fail if the table was previously created without the column.
**Fix pattern:** Always add `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;` immediately before the `CREATE INDEX ... USING GIN (search_vector)` statement.
**Why:** Migrations run with `CREATE TABLE IF NOT EXISTS`, which skips the column definition if the table already exists. The ALTER TABLE handles the upgrade path idempotently.

## Migration: node-pg dollar-quoting for DO blocks
node-pg does not support `DO $ BEGIN ... END $` (single `$` as delimiter). Must use `DO $$ BEGIN ... END $$`.
**Why:** The pg driver splits on `$` as a parameter placeholder. `$$` is the standard PostgreSQL anonymous block delimiter.

## isNaN Guard Pattern for Route Parameters
After every `parseInt(req.params.X)` or `parseInt(req.query.X)`, add:
```typescript
if (isNaN(id)) { e400(res, "Invalid id"); return; }
```
For optional query params, guard at assignment:
```typescript
const _raw = req.query.folderId ? parseInt(req.query.folderId as string, 10) : undefined;
const folderId = _raw !== undefined && isNaN(_raw) ? undefined : _raw;
```
For limit params (Math.min wrapper), use `|| defaultValue` fallback:
```typescript
const limit = Math.min(parseInt(req.query.limit as string || "20", 10) || 20, 50);
```
**Why:** `Math.min(NaN, 50) = NaN` which passes as SQL LIMIT and may error or return all rows.

## Frontend Null Safety: API Response Sub-Objects
Never assume array fields on API response objects are non-null, even if TypeScript interface says required.
**Pattern:**
- Length check: `{(field?.length ?? 0) > 0 && (...)}`
- Map call: `{(field ?? []).map(...)}`
- Object iteration: `Object.values(field ?? {})`, `Object.entries(field ?? {})`
**Why:** AI-generated response fields are often omitted or null when the AI skips optional sections.
