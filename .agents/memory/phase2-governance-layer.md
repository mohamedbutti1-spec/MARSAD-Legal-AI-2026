---
name: Phase 2 — Executive Governance Layer
description: Durable security and type decisions for the RBAC governance layer built on Module 1.
---

## Security rules (apply to any future governance endpoint)

- **DCI payload must use explicit field allowlist** — never `...dciRow`. Gate each field with its permission flag (`canReadHii`, `canReadAuditHashes`, `canReadQvaRaw`). Spreading silently exposes new columns added to the schema later.
- **Org-scope is deny-by-default** — when `seeOwnOrgOnly=true` and no org header is present, return empty set (list/dashboard) or 403 (detail). Never fall through to "show all".
- **Delegation state lives in `metadata` JSONB** — not a top-level column. Always read `(d.metadata as Record<string, unknown>).delegatedForReview` etc.
- **`minister.canReadHii = false`** — Minister sees executive KPIs only; HII is Undersecretary-tier and above.
- **Arabic org names in HTTP headers are unsafe** — HTTP/1.1 is ASCII-only; long Arabic strings in `X-User-Org` get corrupted by curl/proxies. In production, use short opaque org IDs (UUID or code), not display names.

## TypeScript patterns that caused build failures

- **Express middleware `next` must be `NextFunction`**, not `() => void`. Wrong type causes phantom `string | string[]` errors at the router call site (not at the function definition).
- **`req.params["id"] as string` cast required** — multi-handler route stacks widen `req.params.id` to `string | string[]`; cast explicitly.
- **`{unknown && <el>}` fails in JSX** — use `{unknown ? <el> : null}`; the `&&` short-circuit returns `unknown` which is not assignable to `ReactNode`.
- **`auditLogsTable` has no `metadata` column** — filter by `entityType = 'decision'` + `entityId = id`.
- **Do not alias lsiStatus as legalityStatus** — the DB column is `lsi_status` → Drizzle field `lsiStatus`. Use it consistently in both API responses and frontend types.

**Why:** These were real type errors that blocked the TypeScript build and had to be tracked down one by one. Documenting here prevents re-discovery.
