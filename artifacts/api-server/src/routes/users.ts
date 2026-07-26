import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetUserParams,
  CreateUserBody,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";
import { requireOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";

const router: IRouter = Router();

// GET /users (paginated)
router.get("/users", requireOwner, async (req, res): Promise<void> => {
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

  const [users, [countRow]] = await Promise.all([
    db.select().from(usersTable).orderBy(usersTable.createdAt).limit(limit).offset(offset),
    db.select({ cnt: sql<number>`count(*)::int` }).from(usersTable),
  ]);
  res.json({ users, total: countRow?.cnt ?? 0, limit, offset });
});

// POST /users
router.post("/users", requireOwner, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing.length > 0) {
    res.status(409).json({ error: "A user with this email already exists." });
    return;
  }
  const [user] = await db.insert(usersTable).values(parsed.data).returning();
  logAudit(req, "user.create", { entityType: "user", entityId: user.id, details: { email: user.email, role: user.role } });
  res.status(201).json(user);
});

// GET /users/:id
router.get("/users/:id", requireOwner, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// PATCH /users/:id
router.patch("/users/:id", requireOwner, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  const body = UpdateUserBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  // Zod strips unrecognized keys, so a body with only unknown fields parses
  // successfully as {} — and drizzle throws on an empty .set(). Reject it as
  // the client error it is instead of surfacing a 500.
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "No updatable fields provided." });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set(body.data)
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  logAudit(req, "user.update", { entityType: "user", entityId: user.id });
  res.json(user);
});

// DELETE /users/:id
router.delete("/users/:id", requireOwner, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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
