import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, comparisonsTable } from "@workspace/db";
import {
  CreateComparisonBody,
  GetComparisonParams,
  UpdateComparisonParams,
  UpdateComparisonBody,
  DeleteComparisonParams,
} from "@workspace/api-zod";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";

const router: IRouter = Router();

// GET /comparisons
router.get("/comparisons", requireAnyRole, async (_req, res): Promise<void> => {
  const rows = await db.select().from(comparisonsTable).orderBy(comparisonsTable.createdAt);
  res.json(rows);
});

// POST /comparisons
router.post("/comparisons", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = CreateComparisonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(comparisonsTable).values(parsed.data).returning();
  logAudit(req, "comparison.create", { entityType: "comparison", entityId: row.id });
  res.status(201).json(row);
});

// GET /comparisons/:id
router.get("/comparisons/:id", requireAnyRole, async (req, res): Promise<void> => {
  const params = GetComparisonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(comparisonsTable).where(eq(comparisonsTable.id, params.data.id));
  if (!row) { res.status(404).json({ error: "Comparison not found" }); return; }
  res.json(row);
});

// PATCH /comparisons/:id
router.patch("/comparisons/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const params = UpdateComparisonParams.safeParse(req.params);
  const body = UpdateComparisonBody.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [row] = await db
    .update(comparisonsTable)
    .set(body.data)
    .where(eq(comparisonsTable.id, params.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Comparison not found" }); return; }
  res.json(row);
});

// DELETE /comparisons/:id
router.delete("/comparisons/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const params = DeleteComparisonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(comparisonsTable)
    .where(eq(comparisonsTable.id, params.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Comparison not found" }); return; }
  logAudit(req, "comparison.delete", { entityType: "comparison", entityId: params.data.id });
  res.sendStatus(204);
});

export default router;
