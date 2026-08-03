/**
 * Production RBAC — service layer.
 *
 * seedRbacTables()      — idempotent: populates roles/permissions/role_permissions
 *                          from the hardcoded PERMISSIONS matrix (permissions.ts),
 *                          and backfills user_roles from the existing users.role
 *                          column. Never removes or renames an existing role, and
 *                          never reduces permissions for a role that already has
 *                          rows (only fills gaps / adds new permission keys).
 * loadPermissionsFromDb() — reads role_permissions into an in-memory shape and
 *                          calls setPermissionsCache() so getPermissions() reads
 *                          from the DB-backed values with zero per-request latency.
 * syncUserPrimaryRole() — keeps users.role (fast-path column) in sync with
 *                          user_roles whenever a user's role changes.
 */
import { eq, and, sql } from "drizzle-orm";
import { db } from "./index";
import { rolesTable, permissionsTable, rolePermissionsTable, userRolesTable, usersTable } from "./schema";
import {
  ALL_ROLES,
  PERMISSIONS,
  PERMISSION_KEYS,
  ROLE_META,
  GOVERNANCE_ROLES,
  setPermissionsCache,
  type RolePermissions,
  type UserRole,
} from "./permissions";

/** Idempotent: create/refresh roles, permissions, and role_permissions rows
 *  from the hardcoded matrix, then backfill user_roles from users.role. */
export async function seedRbacTables(): Promise<void> {
  // ── 1. Roles ────────────────────────────────────────────────────────────
  const existingRoles = await db.select().from(rolesTable);
  const roleIdByKey = new Map(existingRoles.map((r) => [r.key, r.id]));

  for (const key of ALL_ROLES) {
    const meta = ROLE_META[key];
    const isGovernance = (GOVERNANCE_ROLES as readonly string[]).includes(key) || key === "owner" || key === "supervisor" || key === "viewer";
    if (!roleIdByKey.has(key)) {
      const [inserted] = await db
        .insert(rolesTable)
        .values({ key, labelAr: meta.ar, labelEn: meta.en, tier: meta.tier, isGovernance })
        .onConflictDoNothing({ target: rolesTable.key })
        .returning();
      if (inserted) roleIdByKey.set(key, inserted.id);
    } else {
      // Keep display metadata current without touching isGovernance (never
      // silently reclassify an existing role).
      await db
        .update(rolesTable)
        .set({ labelAr: meta.ar, labelEn: meta.en, tier: meta.tier })
        .where(eq(rolesTable.key, key));
    }
  }

  // ── 2. Permissions ──────────────────────────────────────────────────────
  const existingPerms = await db.select().from(permissionsTable);
  const permIdByKey = new Map(existingPerms.map((p) => [p.key, p.id]));

  for (const key of PERMISSION_KEYS) {
    if (!permIdByKey.has(key)) {
      const [inserted] = await db
        .insert(permissionsTable)
        .values({ key })
        .onConflictDoNothing({ target: permissionsTable.key })
        .returning();
      if (inserted) permIdByKey.set(key, inserted.id);
    }
  }

  // ── 3. Role ⇄ Permission grants ─────────────────────────────────────────
  const existingGrants = await db.select().from(rolePermissionsTable);
  const grantKey = (roleId: number, permissionId: number) => `${roleId}:${permissionId}`;
  const existingGrantSet = new Set(existingGrants.map((g) => grantKey(g.roleId, g.permissionId)));

  for (const roleKey of ALL_ROLES) {
    const roleId = roleIdByKey.get(roleKey);
    if (!roleId) continue;
    const rolePerms = PERMISSIONS[roleKey];
    for (const permKey of PERMISSION_KEYS) {
      const permissionId = permIdByKey.get(permKey);
      if (!permissionId) continue;
      if (existingGrantSet.has(grantKey(roleId, permissionId))) continue; // never overwrite an existing row
      await db.insert(rolePermissionsTable).values({
        roleId,
        permissionId,
        allowed: Boolean(rolePerms[permKey as keyof RolePermissions]),
      }).onConflictDoNothing();
    }
  }

  // ── 4. Backfill user_roles from users.role (fast-path column) ───────────
  const allUsers = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable);
  const existingUserRoles = await db.select().from(userRolesTable);
  const hasUserRole = new Set(existingUserRoles.map((ur) => `${ur.userId}:${ur.roleId}`));

  for (const u of allUsers) {
    const roleId = roleIdByKey.get(u.role);
    if (!roleId) continue; // unknown role string — leave untouched, don't guess
    if (hasUserRole.has(`${u.id}:${roleId}`)) continue;
    await db.insert(userRolesTable).values({ userId: u.id, roleId, isPrimary: true }).onConflictDoNothing();
  }
}

/** Load role_permissions from the DB into the in-memory permissions cache. */
export async function loadPermissionsFromDb(): Promise<void> {
  const roles = await db.select().from(rolesTable);
  const perms = await db.select().from(permissionsTable);
  const grants = await db.select().from(rolePermissionsTable);

  const permKeyById = new Map(perms.map((p) => [p.id, p.key]));
  const next: Record<string, RolePermissions> = { ...PERMISSIONS };

  for (const role of roles) {
    const base: Record<string, boolean> = { ...(PERMISSIONS[role.key as UserRole] ?? PERMISSIONS.citizen) };
    for (const grant of grants) {
      if (grant.roleId !== role.id) continue;
      const permKey = permKeyById.get(grant.permissionId);
      if (!permKey) continue;
      base[permKey] = grant.allowed;
    }
    next[role.key] = base as unknown as RolePermissions;
  }

  setPermissionsCache(next);
}

/** Re-read role_permissions and refresh the cache — call after an admin edits a role's grants. */
export async function reloadRbacCache(): Promise<void> {
  await loadPermissionsFromDb();
}

/** True for any of the 21 hardcoded roles seeded from ALL_ROLES — these can
 *  never be renamed or deleted through the Role Permissions self-service UI. */
export function isBuiltInRole(key: string): boolean {
  return (ALL_ROLES as readonly string[]).includes(key);
}

const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

/**
 * Create a brand-new, owner-defined role: key + bilingual labels + tier.
 * Deny-by-default — every permission flag starts as `false` (unchecked in
 * the matrix), so the owner opts a new role into capabilities explicitly via
 * PATCH /rbac/role-permissions rather than inheriting anything implicitly.
 * Never a governance seat (isGovernance: false) — custom roles are always
 * access-tier, matching admin/professional_user.
 */
export async function createCustomRole(input: {
  key: string;
  labelAr: string;
  labelEn: string;
  tier: string;
}): Promise<{ key: string; labelAr: string; labelEn: string; tier: string; isGovernance: boolean }> {
  const key = input.key.trim();
  if (!ROLE_KEY_PATTERN.test(key)) {
    throw new Error("Role key must be 2-40 lowercase letters, digits, or underscores, starting with a letter.");
  }
  if (isBuiltInRole(key)) {
    throw new Error(`"${key}" is a built-in role key and cannot be reused.`);
  }
  const labelAr = input.labelAr.trim();
  const labelEn = input.labelEn.trim();
  const tier = input.tier.trim();
  if (!labelAr || !labelEn || !tier) {
    throw new Error("labelAr, labelEn, and tier are all required.");
  }

  const created = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(rolesTable).where(eq(rolesTable.key, key));
    if (existing) throw new Error(`Role "${key}" already exists.`);

    const [role] = await tx
      .insert(rolesTable)
      .values({ key, labelAr, labelEn, tier, isGovernance: false })
      .returning();

    const perms = await tx.select().from(permissionsTable);
    if (perms.length > 0) {
      await tx.insert(rolePermissionsTable).values(
        perms.map((p) => ({ roleId: role.id, permissionId: p.id, allowed: false })),
      );
    }
    return role;
  });

  await loadPermissionsFromDb();
  return { key: created.key, labelAr: created.labelAr, labelEn: created.labelEn, tier: created.tier, isGovernance: created.isGovernance };
}

/** Update display metadata (labels/tier) for a custom role. Built-in roles
 *  can never be renamed through this path. */
export async function renameCustomRole(
  key: string,
  updates: { labelAr?: string; labelEn?: string; tier?: string },
): Promise<{ key: string; labelAr: string; labelEn: string; tier: string; isGovernance: boolean }> {
  if (isBuiltInRole(key)) throw new Error("Built-in roles cannot be renamed.");

  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.key, key));
  if (!role) throw new Error(`Role "${key}" not found.`);

  const set: Partial<typeof role> = {};
  if (updates.labelAr !== undefined && updates.labelAr.trim()) set.labelAr = updates.labelAr.trim();
  if (updates.labelEn !== undefined && updates.labelEn.trim()) set.labelEn = updates.labelEn.trim();
  if (updates.tier !== undefined && updates.tier.trim()) set.tier = updates.tier.trim();

  const [updated] = Object.keys(set).length > 0
    ? await db.update(rolesTable).set(set).where(eq(rolesTable.id, role.id)).returning()
    : [role];

  return { key: updated.key, labelAr: updated.labelAr, labelEn: updated.labelEn, tier: updated.tier, isGovernance: updated.isGovernance };
}

/** Delete a custom role. Built-in roles can never be deleted. Refuses to
 *  delete a role that's still assigned to any user — the caller must
 *  reassign them first, so no account is silently left in an unknown state. */
export async function deleteCustomRole(key: string): Promise<void> {
  if (isBuiltInRole(key)) throw new Error("Built-in roles cannot be deleted.");

  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.key, key));
  if (!role) throw new Error(`Role "${key}" not found.`);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userRolesTable)
    .where(eq(userRolesTable.roleId, role.id));
  if (Number(count) > 0) {
    throw new Error(`Cannot delete "${key}": ${count} user(s) are still assigned this role. Reassign them first.`);
  }

  await db.delete(rolesTable).where(eq(rolesTable.id, role.id));
  await loadPermissionsFromDb();
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Assign (or reassign) a user's single primary role: updates users.role
 * (fast path) and the user_roles table together.
 *
 * Accepts an optional `executor` (a transaction handle) so callers that are
 * already inside a `db.transaction(...)` — e.g. creating a user and setting
 * its role in one atomic step — can pass their own `tx` instead of letting
 * this function open a second, separate transaction. node-postgres runs
 * each `db.transaction()` on its own pooled connection/session, so a nested
 * transaction here would not see the caller's uncommitted row (e.g. a
 * just-inserted user), causing a foreign-key failure. When no executor is
 * given, this opens its own transaction as before.
 */
export async function assignUserRole(userId: number, roleKey: string, executor: DbOrTx = db): Promise<void> {
  const run = async (tx: DbOrTx) => {
    const [role] = await tx.select().from(rolesTable).where(eq(rolesTable.key, roleKey));
    if (!role) throw new Error(`Unknown role: ${roleKey}`);

    await tx.update(usersTable).set({ role: roleKey }).where(eq(usersTable.id, userId));
    await tx.delete(userRolesTable).where(and(eq(userRolesTable.userId, userId), eq(userRolesTable.isPrimary, true)));
    await tx.insert(userRolesTable).values({ userId, roleId: role.id, isPrimary: true });
  };

  if (executor === db) {
    await db.transaction((tx) => run(tx));
  } else {
    await run(executor);
  }
}
