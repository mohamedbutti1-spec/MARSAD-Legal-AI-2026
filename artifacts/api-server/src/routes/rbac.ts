import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  rolesTable,
  permissionsTable,
  rolePermissionsTable,
  reloadRbacCache,
  isBuiltInRole,
  createCustomRole,
  renameCustomRole,
  deleteCustomRole,
} from "@workspace/db";
import { ALL_ROLES, PERMISSION_KEYS, isKnownRole } from "@workspace/db/permissions";
import { UpdateRolePermissionBody, CreateRoleBody, UpdateRoleBody } from "@workspace/api-zod";
import { requireOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";

const router: IRouter = Router();

/**
 * Production RBAC self-service — owner-only.
 *
 * GET  /rbac/roles-permissions — the full roles × permissions matrix, read
 *      straight from the DB tables (source of truth), not the in-memory
 *      cache — so the UI always reflects exactly what's persisted.
 * PATCH /rbac/role-permissions — toggle a single (role, permission) grant.
 *      Upserts the row, then calls reloadRbacCache() so the change takes
 *      effect immediately for every in-flight request, with zero redeploy.
 */

// GET /rbac/roles-permissions
router.get("/rbac/roles-permissions", requireOwner, async (_req, res): Promise<void> => {
  const [roles, permissions, grants] = await Promise.all([
    db.select().from(rolesTable),
    db.select().from(permissionsTable),
    db.select().from(rolePermissionsTable),
  ]);

  const roleKeyById = new Map(roles.map((r) => [r.id, r.key]));
  const permKeyById = new Map(permissions.map((p) => [p.id, p.key]));

  // Built-in roles keep their canonical ALL_ROLES order; any owner-created
  // custom role (not in ALL_ROLES) sorts after them, alphabetically by key.
  const builtInRank = (key: string) => {
    const i = ALL_ROLES.indexOf(key as never);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  res.json({
    roles: roles
      .slice()
      .sort((a, b) => {
        const ra = builtInRank(a.key);
        const rb = builtInRank(b.key);
        return ra !== rb ? ra - rb : a.key.localeCompare(b.key);
      })
      .map((r) => ({
        key: r.key, labelAr: r.labelAr, labelEn: r.labelEn, tier: r.tier,
        isGovernance: r.isGovernance, isCustom: !isBuiltInRole(r.key),
      })),
    permissions: permissions
      .slice()
      .sort((a, b) => PERMISSION_KEYS.indexOf(a.key as never) - PERMISSION_KEYS.indexOf(b.key as never))
      .map((p) => ({ key: p.key, description: p.description ?? null })),
    grants: grants
      .map((g) => {
        const roleKey = roleKeyById.get(g.roleId);
        const permissionKey = permKeyById.get(g.permissionId);
        if (!roleKey || !permissionKey) return null;
        return { roleKey, permissionKey, allowed: g.allowed };
      })
      .filter((g): g is { roleKey: string; permissionKey: string; allowed: boolean } => g !== null),
  });
});

// PATCH /rbac/role-permissions
router.patch("/rbac/role-permissions", requireOwner, async (req, res): Promise<void> => {
  const parsed = UpdateRolePermissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { roleKey, permissionKey, allowed } = parsed.data;

  // Accept any built-in role OR any owner-created custom role already
  // present in the DB-backed permissions cache (createCustomRole reloads
  // the cache immediately on creation, so a brand-new role is toggleable
  // right away without a restart).
  if (!isKnownRole(roleKey)) {
    res.status(400).json({ error: `Unknown role: ${roleKey}` });
    return;
  }
  if (!PERMISSION_KEYS.includes(permissionKey as never)) {
    res.status(400).json({ error: `Unknown permission: ${permissionKey}` });
    return;
  }

  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.key, roleKey));
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }
  const [permission] = await db.select().from(permissionsTable).where(eq(permissionsTable.key, permissionKey));
  if (!permission) { res.status(404).json({ error: "Permission not found" }); return; }

  const [existing] = await db
    .select()
    .from(rolePermissionsTable)
    .where(and(eq(rolePermissionsTable.roleId, role.id), eq(rolePermissionsTable.permissionId, permission.id)));

  if (existing) {
    await db
      .update(rolePermissionsTable)
      .set({ allowed })
      .where(eq(rolePermissionsTable.id, existing.id));
  } else {
    await db.insert(rolePermissionsTable).values({ roleId: role.id, permissionId: permission.id, allowed });
  }

  await reloadRbacCache();

  logAudit(req, "rbac.role_permission.update", {
    entityType: "role_permissions",
    entityId: role.id,
    details: { roleKey, permissionKey, allowed },
  });

  res.json({ roleKey, permissionKey, allowed });
});

// POST /rbac/roles — create a new custom role, deny-by-default.
router.post("/rbac/roles", requireOwner, async (req, res): Promise<void> => {
  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const role = await createCustomRole(parsed.data);
    logAudit(req, "rbac.role.create", {
      entityType: "roles",
      details: { key: role.key, labelAr: role.labelAr, labelEn: role.labelEn, tier: role.tier },
    });
    res.json({ ...role, isCustom: true });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : "Could not create role." });
  }
});

// PATCH /rbac/roles/:key — rename a custom role's labels/tier.
router.patch("/rbac/roles/:key", requireOwner, async (req, res): Promise<void> => {
  const parsed = UpdateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const key = String(req.params.key);

  try {
    const role = await renameCustomRole(key, parsed.data);
    logAudit(req, "rbac.role.rename", { entityType: "roles", details: { key, updates: parsed.data } });
    res.json({ ...role, isCustom: !isBuiltInRole(role.key) });
  } catch (err) {
    res.status(err instanceof Error && err.message.includes("not found") ? 404 : 409).json({
      error: err instanceof Error ? err.message : "Could not update role.",
    });
  }
});

// DELETE /rbac/roles/:key — delete a custom role (must be unassigned).
router.delete("/rbac/roles/:key", requireOwner, async (req, res): Promise<void> => {
  const key = String(req.params.key);

  try {
    await deleteCustomRole(key);
    logAudit(req, "rbac.role.delete", { entityType: "roles", details: { key } });
    res.json({ success: true });
  } catch (err) {
    res.status(err instanceof Error && err.message.includes("not found") ? 404 : 409).json({
      error: err instanceof Error ? err.message : "Could not delete role.",
    });
  }
});

export default router;
