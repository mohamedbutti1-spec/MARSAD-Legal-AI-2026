---
name: Pino async transport log loss at startup
description: >
  pino's async worker thread is not ready during the first ~2 s of server startup.
  Any logger.info/error() call made during that window is silently dropped from
  deployment logs — including migration success/failure messages. This caused
  user_sessions table creation failures to be invisible in production.
---

## The rule

Never rely on `logger.info/error()` alone for critical startup outcomes.
Use `console.log/error()` (synchronous, direct stdout) for any message that MUST
appear in production deployment logs at startup.

**Why:** pino uses an async worker thread transport. Calls made before the worker
is ready are queued; if the process exits or the deployment collector takes a snapshot
before flush, those messages are lost. `console.log/error()` bypasses the worker
and writes directly to stdout — always captured.

## How to apply

For any critical startup step (table creation, secret validation, migration):
```typescript
// BAD: may be lost in production
logger.error({ err }, "Migration failed");

// GOOD: always captured
console.error('[module] CRITICAL: migration failed:', err);
logger.error({ err }, "Migration failed"); // keep both for structured logging
```

## Second lesson: belt-and-suspenders for DDL migrations

If a table is required by a route, create it at ROUTE MODULE LOAD TIME as a
module-level promise (not just in seed.ts). Use `db.execute(sql\`...\`)` (Drizzle,
which has SSL configured) rather than `pool.query()` directly. Await the promise
at the start of the first function that needs the table.

Pattern used in auth.ts:
```typescript
const _tableReady: Promise<void> = (async () => {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ...`);
    console.log('[auth] table ready');
  } catch (err) {
    console.error('[auth] CRITICAL: table init failed:', err);
  }
})();

async function writeToTable(...) {
  await _tableReady; // no-op if already done
  // ... rest of function
}
```
