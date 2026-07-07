---
name: MLOS Stage 5 — Smart Administrative Court Simulation
description: Court mode on AI Assistant — 4-phase NDJSON streaming, 9 sections, scoring dashboard, supreme court review
---

## What was built
- Backend: `artifacts/api-server/src/routes/court.ts`
  - `POST /court/simulate`: 4-phase sequential AI calls, NDJSON streaming per-phase
  - `POST /court/supreme-review`: single AI call, JSON, 7-tier layered review
- Frontend types: `artifacts/legal-research/src/lib/court-types.ts`
- Frontend component: `artifacts/legal-research/src/components/research/court-session-panel.tsx`
- Edits to `ai-assistant.tsx`: courtMode/supremeCourtMode state, runCourtSession, runSupremeReview

## Streaming format (court/simulate)
NDJSON lines in sequence:
- `{"type":"section","id":"facts","data":{...}}` — from Phase 1
- `{"type":"section","id":"issues","data":{...}}` — from Phase 1
- `{"type":"section","id":"claimant","data":[...]}` — from Phase 2
- `{"type":"section","id":"admin","data":[...]}` — from Phase 2
- `{"type":"section","id":"commissioner","data":{...}}` — from Phase 3
- `{"type":"section","id":"shamsi","data":[...]}` — from Phase 3
- `{"type":"section","id":"judgment","data":{...}}` — from Phase 4
- `{"type":"section","id":"operative","data":{...}}` — from Phase 4
- `{"type":"section","id":"appeal","data":{...}}` — from Phase 4
- `{"type":"section","id":"scores","data":{...}}` — from Phase 4
- `{"type":"done","model":"..."}` — terminal

## Court UI rendering rule (critical)
The court panel check MUST come BEFORE `messages.length === 0` check in the render tree.
Otherwise, empty-session court mode is hidden by the pre-analysis/suggestions panel.
Correct order: loadingMessages → courtMode check → messages.length===0 → messages list.

## Runtime type guard pattern for streamed data
```typescript
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
// For object sections:
if (id === 'facts' && isObj(data)) next.facts = data as unknown as CourtSessionData['facts'];
// For array sections (claimant, admin, shamsi):
if (id === 'claimant' && Array.isArray(data)) next.claimantDefenses = data as unknown as CourtSessionData['claimantDefenses'];
```
Double-cast through `unknown` required — TypeScript rejects direct cast from `Record<string,unknown>` to structured types.

## Backend phase validation pattern
On parse failure: emit error line and immediately end response (do NOT continue to next phase).
```typescript
if (!px.ok || !px.data || typeof px.data !== "object") {
  writeLine(res, { type: "error", message: "Phase N parse failed" }); res.end(); return;
}
```

## supremeCourtMode wiring
When `supremeCourtMode` is ON: auto-trigger `runSupremeReview(text)` after streaming completes.
Use `setTimeout(() => runSupremeReview(text), 0)` in the finally block to let courtLoading state settle first.
`runSupremeReview(overrideCaseText?)` accepts optional caseText to avoid stale-closure on courtSession state.

## Registration
`artifacts/api-server/src/routes/index.ts`: courtRouter registered after legalBrainRouter.
Sidebar: no new entry needed — court mode is a toggle on the existing AI Assistant page.
