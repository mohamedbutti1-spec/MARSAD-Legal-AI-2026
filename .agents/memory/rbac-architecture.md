---
name: RBAC architecture
description: DB-backed RBAC design — cache-overlay pattern, role tiers, operational-role middleware, role-assignment authorization
---

## Cache-overlay pattern (not per-request DB reads)
The frontend-safe permissions module must stay importable from the Vite frontend with zero server-only (drizzle/pg) dependency. Server boot overlays DB-loaded role/permission grants onto an in-memory cache; no route reads the DB per-request for a permission check. Falls back to the hardcoded baseline matrix if the DB load fails (non-fatal).

**Why:** keeps the frontend bundle dependency-free while still letting the DB be the live source of truth after boot.

**How to apply:** any new permission flag must be added everywhere the interface/matrix/seed define flags together — never partially — or the cache and DB seed disagree.

## Role tier split: read-only oversight vs. operational-only
When adding an access-tier role that should see governance data read-only (e.g. an "admin" style role), keep it out of every *write* middleware tier even if it's included in the read tiers — read access and write access must be two independently-checked tiers, not one boolean.

When adding a role that should use operational tools (research/AI/document workflows) but must never see governance/decision data at all, exclude it from every governance middleware tier entirely rather than trying to hide governance UI client-side only.

**Why:** governance data is sensitive; a role meant to be "read-only oversight" that accidentally lands in a write-capable middleware tier is a silent privilege escalation.

## Role-assignment authorization must be enforced server-side, not just in the UI
Any role that can manage other users (create/edit/assign role) must have its *assignable role set* enforced in the request handler itself — not only by disabling options in a dropdown. A management-capable but non-top-tier role (e.g. "admin" one step below "owner") must be blocked server-side from ever granting the top-tier role to anyone, including itself, and from modifying/demoting/deleting an existing top-tier account.

**Why:** a client-side-only restriction is trivially bypassed by calling the API directly; without a server-side check, a lesser management role can escalate itself (or an ally) to the top tier — a privilege-escalation vulnerability caught in review on this project.

**How to apply:** in the user-management route handlers, check the *requester's* validated role (never a client-supplied header) against both (a) the role being assigned and (b) the target account's *current* role, before performing create/update/delete.

## Aliasing a requested role name onto an existing role key vs. adding a new one
When a user asks for a named role that already matches an existing role's real-world function, just relabel that role's display name (`ROLE_META` label) — do not create a second role key with duplicate permissions. Only add a genuinely new role key/type when the requested role's permission shape actually differs from every existing role.

**Why:** duplicate role keys with identical permissions fragment the permission matrix and create drift risk; a label-only change keeps one source of truth.

## Narrow-middleware pattern for a role scoped to one synthetic-data surface
A role that must reach exactly one feature surface (e.g. a training/simulator page with no real-record access) needs its own middleware variant (e.g. `requireSimulationRole` = the normal role list + the new role), used ONLY on that surface's routes — never added to the general `requireAnyRole`/`requireOperationalRole` used elsewhere, even though it's tempting to just add the role to those.

**Why:** adding the role to the general-purpose middleware would grant it access to every other route gated by that same middleware, defeating the "one synthetic surface only" design intent.

## Express 5 router-bleed can silently override a downstream router's own middleware
`router.use(requireXRole)` with no path prefix inside a sub-router (e.g. `workspace.ts`) bleeds forward into every sibling router mounted *after* it in `routes/index.ts` — not just its own routes. If a later-mounted router (e.g. `pcs.ts`) intentionally uses a *more permissive* middleware for one role, that role gets silently rejected by the earlier router's stricter unpathed gate before ever reaching its own route handler, even though reading `pcs.ts`'s source shows the correct middleware in place.

**Why:** this bug is invisible from reading the target router's own file — the reject happens upstream, and the response looks identical (same generic 403 message) to a correctly-configured deny. Only diffing the exact `allowedRoles` array (e.g. via a temporary debug log) reveals which middleware actually fired.

**How to apply:** any router that needs broader/different access than an earlier unpathed-`router.use(requireXRole)` router (see `workspace.ts`, `adkg.ts`, `kb.ts`) must be mounted in `routes/index.ts` *before* those routers — same fix already applied for `betaRouter`/citizen. Prefer fixing the root cause (add explicit path prefixes to those `router.use()` calls) as a future hardening pass; the reorder is the safe immediate fix.

## `lib/db/src/permissions.ts` and `artifacts/legal-research/src/lib/permissions.ts` must be kept byte-identical
These are two separate files with no symlink or build-copy step. Any change to roles/permissions must be applied to both and diffed to confirm they match.

**Why:** the frontend copy exists so the Vite bundle has zero server-only (drizzle/pg) dependency; without a sync step, they will silently diverge otherwise.
