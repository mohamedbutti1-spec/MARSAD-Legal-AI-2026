import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db, usersTable, assignUserRole } from "@workspace/db";
import { isKnownRole } from "@workspace/db/permissions";
import {
  GetUserParams,
  CreateUserBody,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";
import { requireUserManagementRole } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { getValidatedRole } from "../lib/route-helpers";

const router: IRouter = Router();

/** Derive a username from an email's local part if one wasn't supplied. */
function deriveUsername(email: string): string {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
}

/**
 * Role-assignment policy (defense against privilege escalation):
 * only an existing owner may grant the `owner` role to anyone (including
 * themselves creating another owner). `requireUserManagementRole` alone
 * (owner OR admin) is not sufficient here — an admin must never be able to
 * mint an owner account, since owner unlocks settings/API keys/owner panel/
 * secret sections that admin explicitly does not have.
 */
function canAssignRole(requesterRole: string, targetRole: string): boolean {
  if (targetRole === "owner") return requesterRole === "owner";
  return true;
}

/**
 * Owner accounts are protected from tampering by non-owners: an admin may
 * manage every other role via /users, but must not be able to demote,
 * disable, or delete an owner account. Prevents an admin chain (e.g. admin
 * creates another admin) from ever being used to neutralize real owners.
 */
function canModifyTarget(requesterRole: string, targetCurrentRole: string): boolean {
  if (targetCurrentRole === "owner") return requesterRole === "owner";
  return true;
}

/** Strip passwordHash from a user row before sending it to the client. */
function sanitizeUser<T extends { passwordHash?: string | null }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash, ...rest } = user;
  return rest;
}

// GET /users (paginated)
router.get("/users", requireUserManagementRole, async (req, res): Promise<void> => {
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

  const [users, [countRow]] = await Promise.all([
    db.select().from(usersTable).orderBy(usersTable.createdAt).limit(limit).offset(offset),
    db.select({ cnt: sql<number>`count(*)::int` }).from(usersTable),
  ]);
  res.json({ users: users.map(sanitizeUser), total: countRow?.cnt ?? 0, limit, offset });
});

// POST /users — creates an account with a temporary password (returned once,
// never stored in plaintext or logged). The admin/owner is expected to relay
// it to the user, who should change it after first login.
router.post("/users", requireUserManagementRole, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { password: providedPassword, username: providedUsername, ...userFields } = parsed.data;

  // The API schema accepts any string for `role` (to admit owner-created
  // custom roles), so the server must independently confirm it names a real
  // role — built-in or custom — that actually exists in the DB-backed
  // permissions cache before it's ever written to users.role. Without this,
  // a typo or stale role name would silently create a user with zero
  // effective permissions and no way to reach any permission-gated route.
  if (!isKnownRole(userFields.role)) {
    res.status(400).json({ error: `Unknown role: ${userFields.role}` });
    return;
  }

  if (!canAssignRole(getValidatedRole(req), userFields.role)) {
    res.status(403).json({ error: "Only an owner can create another owner account." });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, userFields.email));
  if (existing.length > 0) {
    res.status(409).json({ error: "A user with this email already exists." });
    return;
  }

  const username = providedUsername?.trim().toLowerCase() || deriveUsername(userFields.email);
  const tempPassword = providedPassword ?? randomUUID().replace(/-/g, "").slice(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  let user;
  try {
    user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(usersTable)
        .values({
          ...userFields,
          username,
          passwordHash,
          authProvider: "password",
          isDemo: false,
          // Every admin-created account starts on an admin-issued password
          // (explicit or auto-generated) — force the user to set their own on
          // first login rather than leaving the admin's password in use forever.
          mustChangePassword: true,
        })
        .returning();

      // assignUserRole re-validates the role against the roles table and
      // backfills user_roles (the durable RBAC source of truth). If it
      // fails, the whole transaction — including the user row — rolls
      // back: we never want an account to exist with an unsynced/broken
      // role, since that leaves it with unpredictable effective permissions.
      await assignUserRole(created.id, created.role, tx);
      return created;
    });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : "Could not create user with the given role." });
    return;
  }

  logAudit(req, "user.create", { entityType: "user", entityId: user.id, details: { email: user.email, role: user.role } });
  res.status(201).json({ ...sanitizeUser(user), temporaryPassword: providedPassword ? undefined : tempPassword });
});

// GET /users/:id
router.get("/users/:id", requireUserManagementRole, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(sanitizeUser(user));
});

// PATCH /users/:id — edit name/email/role, enable/disable (isActive), or
// reset password. Role changes are propagated to user_roles via assignUserRole.
router.patch("/users/:id", requireUserManagementRole, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const requesterRole = getValidatedRole(req);
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  if (!canModifyTarget(requesterRole, target.role)) {
    res.status(403).json({ error: "Only an owner can modify another owner account." });
    return;
  }
  if (body.data.role && !canAssignRole(requesterRole, body.data.role)) {
    res.status(403).json({ error: "Only an owner can grant the owner role." });
    return;
  }
  // See the matching comment in POST /users — the schema now accepts any
  // string for role (to admit custom roles), so it must be checked against
  // the DB-backed permissions cache here, before it's ever persisted.
  if (body.data.role && !isKnownRole(body.data.role)) {
    res.status(400).json({ error: `Unknown role: ${body.data.role}` });
    return;
  }

  const { password: newPassword, ...fields } = body.data;
  const updates: Record<string, unknown> = { ...fields };
  if (newPassword) {
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
    // Bump password_version so every session token issued before this reset
    // (on any device) fails the authenticate middleware's live check and is
    // forced to log in again with the new password.
    updates.passwordVersion = sql`${usersTable.passwordVersion} + 1`;
    // This is an admin-issued password (the "Reset password" action) — force
    // the user to set their own before they can use the app again.
    updates.mustChangePassword = true;
  }

  let user;
  try {
    user = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, params.data.id))
        .returning();
      if (!updated) throw new Error("User not found");

      // If the role changed, re-validate + sync user_roles atomically with
      // the update — a failure here rolls back the whole edit rather than
      // leaving the account on an inconsistent/broken role.
      if (fields.role) {
        await assignUserRole(updated.id, fields.role, tx);
      }
      return updated;
    });
  } catch (err) {
    const notFound = err instanceof Error && err.message === "User not found";
    res.status(notFound ? 404 : 409).json({ error: err instanceof Error ? err.message : "Could not update user." });
    return;
  }

  logAudit(req, "user.update", { entityType: "user", entityId: user.id, details: { fields: Object.keys(fields), passwordChanged: Boolean(newPassword) } });
  res.json(sanitizeUser(user));
});

// DELETE /users/:id
router.delete("/users/:id", requireUserManagementRole, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (!canModifyTarget(getValidatedRole(req), target.role)) {
    res.status(403).json({ error: "Only an owner can delete another owner account." });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  logAudit(req, "user.delete", { entityType: "user", entityId: params.data.id, details: { email: user.email } });
  res.sendStatus(204);
});

export default router;
