import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

// GET /users
router.get("/users", requireOwner, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
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
