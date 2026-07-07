---
name: MLOS Stage 4 — Legal Intelligence Brain
description: 6-engine Legal Brain hub page + 6 backend routes; hardening patterns applied
---

## What was built
- Backend: `artifacts/api-server/src/routes/legal-brain.ts` — 6 POST endpoints
  - `/legal-brain/judicial-reasoning` (7-stage analysis)
  - `/legal-brain/admin-legality` (9-criteria legality)
  - `/legal-brain/shamsi-analysis` (11-principle Shamsi Theory)
  - `/legal-brain/comparative-analysis` (UAE/France/EU tables)
  - `/legal-brain/memorandum` (6-type document generator)
  - `/legal-brain/risk-assessment` (4-dimension risk classifier)
- Frontend: `artifacts/legal-research/src/pages/legal-brain.tsx` — 6-tab hub

## Registration
- `artifacts/api-server/src/routes/index.ts` — `router.use(legalBrainRouter)` before betaRouter
- `artifacts/legal-research/src/App.tsx` — `<Route path="/legal-brain"><RouteGuard allow={canUseAi}>`
- Sidebar: new `id: 'legal-brain'` section above `id: 'jdt'`, Brain icon, "Stage 4" badge

## Hardening patterns (apply to all future AI routes)
1. `safeStr(value, maxLen)` helper — always use instead of direct `req.body.x?.trim()`; safely coerces unknown to bounded string
2. Short interpolated fields capped at 200 chars; narrative blobs at 4000 chars
3. `validateShape(parsed.data, requiredKeys)` called after `parseModelJson` — returns 422 with error if missing keys

**Why:** Code review flagged: (a) non-string payloads throw before badInput → 500 instead of 400; (b) unbounded short fields are prompt-injection surface; (c) malformed-but-valid JSON passes through without shape check.

## TS fix
Helper function `badInput(res, msg)` and `getProvider(res)` must use `type Response` from express — not `Parameters<Parameters<typeof router.post>[2]>[1]` (which resolves to `never` under Express 5).
