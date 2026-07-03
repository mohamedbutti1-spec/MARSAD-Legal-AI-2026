---
name: Phase 5 — PDF, Audit Trail & Compliance
description: Durable decisions and constraints for the Phase 5 audit trail, PDF generation, and compliance dashboard in the Al-Shamsi Admin Decision OS.
---

## Brief hash canonical source

The SHA-256 `briefHash` is computed once in `POST /admin-os/assess` from the **pre-persistence** `brief` object and stored in `audit_logs.details` as `{ briefHash: "..." }` via `logAudit`. This is the canonical value.

The `GET /admin-os/sessions/:id/export.pdf` endpoint **retrieves** this hash from the `admin-os.assess` audit entry rather than recomputing from `session.brief` (persisted shape may differ slightly from the pre-persistence shape).

**Why:** Computing from two different object shapes produces two different hashes, breaking the trust model. Always use the stored value; fall back to recomputing only for sessions created before Phase 5.

**How to apply:** Any endpoint that needs `briefHash` for a session should query `auditLogsTable` where `action='admin-os.assess'` AND `entityId=sessionId`, then parse `details` as JSON. Never recompute from `session.brief` as the primary path.

---

## Stats endpoint user scoping

`GET /admin-os/stats` aggregates session data. All aggregations — including `totalPdfExports` and `recentPdfExports` — must be scoped to the requester's sessions when the requester is not an owner.

**Pattern:** Build `ownedSessionIds = sessions.map(s => s.id)` from the already-filtered sessions array, then apply `inArray(auditLogsTable.entityId, ownedSessionIds)` to all `auditLogsTable` queries in this endpoint.

**Why:** Without scoping, supervisors see global PDF export metadata, violating the access model and leaking cross-user information.

---

## Puppeteer browser installation in Replit

pnpm v10 blocks build scripts by default. Chrome is **not** auto-downloaded on `pnpm add puppeteer`.

**Install command** (run once from `artifacts/api-server`):
```
node node_modules/puppeteer/install.mjs
```
Chrome lands at `~/.cache/puppeteer/` and persists across server restarts in the same container.

**Why:** pnpm 10's security model blocks postinstall scripts; running the install script directly bypasses this.

---

## puppeteer page.setContent waitUntil

In puppeteer 25, `page.setContent()` only accepts `"load" | "domcontentloaded"`. The values `"networkidle0"` and `"networkidle2"` were removed from the TypeScript types.

**Fix:** Use `waitUntil: "domcontentloaded"` then add a `setTimeout(2000)` delay for Google Fonts to render before `page.pdf()` is called.
