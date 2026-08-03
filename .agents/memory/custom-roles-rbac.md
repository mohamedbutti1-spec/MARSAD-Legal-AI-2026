---
name: Custom roles vs. two-layer RBAC gating
description: Why owner-created custom roles work on permission-gated routes but not on static-allowlist routes, and the naming pitfall when adding new request-body schemas via orval/openapi codegen.
---

## Two gating layers, only one is dynamic
This RBAC system has two independent authorization layers:
1. **Flag-based** (`requirePermission`, backed by the DB `roles`/`permissions`/`rolePermissions` tables and an in-memory cache) — fully dynamic. Any role, built-in or custom, works automatically with zero code changes once its flags are set in the Role Permissions matrix.
2. **Coarse allowlists** (`requireRole`/`requireAnyRole`/`requireWriteRole`/etc.) — static arrays of role-name strings per route group in `roleAuth.ts`. A custom role is never auto-added to these; it needs an explicit code change to gain access to routes gated this way.

**Why:** Rewriting every allowlist to consult the dynamic role list was judged too large/risky under this project's "Locked Vision Mode" freeze. Supporting arbitrary custom roles fully would require redesigning the allowlist model (e.g. capability tags), which was deliberately descoped.

**How to apply:** When adding a new custom-role capability, check whether the target route is gated by `requirePermission` (works out of the box) or `requireAnyRole`-style (needs the role added to the allowlist by hand). Don't assume "custom roles exist" implies "custom roles can access everything."

Built-in-ness is defined structurally as `key ∈ ALL_ROLES` (the static array in `lib/db/src/permissions.ts`) — there is no separate `is_built_in` DB column; `isBuiltInRole()`/`isKnownRole()` derive from that array plus the live permissions cache.

## orval/openapi naming collision on inline request-body schemas
If a new named OpenAPI component schema (e.g. `CreateRoleBody`) happens to match the name orval auto-derives for an operation's request body (`<operationId>Body`), the "zod" client's `export *` barrel gets two conflicting exports of the same name (one from `generated/api.ts`, one from `generated/types/*.ts`) — `tsc` fails with "already exported a member named X."

**Why:** orval only skips generating a duplicate type file when the request body schema is referenced via `$ref` to an existing named component whose name differs from the auto-derived body name (e.g. `UserInput` used for `createUser`'s body — no collision, because the names differ).

**How to apply:** Name request-body component schemas differently from `<operationId>Body` (e.g. `RoleCreateInput` instead of `CreateRoleBody`) and `$ref` them from the path's `requestBody`, rather than inlining the schema or naming it to match orval's auto-derived name.

## Nested `db.transaction()` calls silently break FK visibility (node-postgres)
Wrapping a user-creation/update route in its own `db.transaction(async (tx) => ...)` and then calling a shared helper (e.g. `assignUserRole`) that *also* opens `db.transaction(...)` internally causes the helper's insert to run on a second, separate pooled connection — which cannot see the outer transaction's uncommitted row yet, so a foreign-key insert (e.g. into `user_roles`) fails even though the referenced row obviously exists in the same request.

**Why:** node-postgres's `pool`-backed drizzle `db.transaction()` checks out a connection per call; nested calls to `db.transaction()` do not compose into one session. This is a second occurrence of the "nested-tx" class of bug already noted for Phase 3 chain-of-custody.

**How to apply:** Any shared DB helper that might be called from inside a caller's own transaction (role assignment, hash-chain writes, etc.) should accept an optional executor/`tx` parameter and use it instead of always opening `db.transaction()` itself. Default to opening its own transaction only when called standalone.
