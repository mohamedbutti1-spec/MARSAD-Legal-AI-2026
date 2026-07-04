---
name: Phase 5 — Constitutional Judicial Intelligence (CJI)
description: Architecture decisions, gotchas, and durable rules for the CJI AI review engine
---

## Rule: AI call lives in the API route, not lib/db
`lib/db` is a pure data layer with no Anthropic dependency. The route file (`judicial-review.ts`) imports `@anthropic-ai/sdk` directly, calls `runAiReview()`, and then writes results via the DB service functions.

**Why:** Adding Anthropic to lib/db would require all consumers of that package to bundle the SDK, and would make the data layer impure for testing.

**How to apply:** Any future AI-powered features should follow this pattern — DB service provides read/write helpers, route orchestrates the AI call.

---

## Rule: trimDecisionData must cap ALL large fields with a hard 20 000-char budget
The first attempt used partial trimming (leaving `dci.qvaResults`, full `evidenceChain.events`, `custodyChain` records, and full `constitutionalMemory`). This produced 37 000+ character prompts that caused Claude to return truncated/unterminated JSON.

Fix: `trimDecisionData` whitelists only named scalar fields from DCI, caps evidence events to 10 (summary only), and applies a two-tier fallback (strip car/jdp prose → decision+DCI-only) enforced by `MAX_DATA_CHARS = 20_000`.

**Why:** Claude's output is limited to 8192 tokens. If the input payload is too large, the model fills its context with the input and truncates the JSON output mid-string.

**How to apply:** Every AI-calling route that serialises DB data into a prompt must measure `JSON.stringify(payload).length` before sending, and enforce a budget.

---

## Gotcha: `ConstitutionalMemory` wraps the row inside `.current`
```typescript
interface ConstitutionalMemory {
  current: typeof decisionMemoryTable.$inferSelect; // ← actual row here
  versions: ...;
  timeline: ...;
  integrity: ...;
}
```
Accessing `memory.memoryId` is wrong — use `memory.current.memoryId`.

---

## Gotcha: `req.params.decisionId` types as `string | string[]`
In this Express/TypeScript version, `req.params[key]` returns `string | string[]`. Dot notation (`req.params.decisionId`) has the same type. Fix: `parseInt(String(req.params.decisionId ?? ""), 10)`.

---

## Gotcha: stale export in lib/db/src/index.ts after service refactor
When a function is removed from a service file but its name stays in the barrel export (`index.ts`), TypeScript raises TS2724 "has no exported member". Always check the index exports after renaming or removing service functions.

---

## Concurrent guard: no advisory lock needed
Unlike Evidence Ledger (which uses PostgreSQL advisory lock `0x4556_4944`), CJI uses a simpler application-level guard: `POST /run` returns 409 if the existing `status === 'running'`. This is acceptable because:
- Generation is idempotent (upsert on decisionId)
- A failed/stuck `running` row can be recovered by re-POSTing after `markJudicialReviewFailed`

---

## One row per decision (upsert pattern)
`judicial_reviews` has a unique constraint on `decisionId`. The flow is:
1. `markJudicialReviewRunning(id)` — upserts with status='running'
2. Claude generates the analysis
3. `saveJudicialReview(id, result)` — updates the row with completed data
4. On any error: `markJudicialReviewFailed(id, message)` — updates status='failed'

This means `/run` can be called multiple times safely; each call replaces the previous result.

---

## Frontend: JudgeDashboard tab union must include 'judicial'
```typescript
useState<'stages' | 'jdp' | 'dci' | 'car' | 'audit' | 'custody' | 'memory' | 'evidence' | 'judicial'>
```
And the TABS array must include `{ key: 'judicial', label: '⚖️ الذكاء القضائي' }`.

---

## Prompt output size discipline
The prompt asks Claude to be concise (1-2 sentence findings per dimension, 150-250 word reasoning). Removing minimum-word-count requirements and replacing with concise guides keeps output well under 8192 tokens.
