import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, comparisonsTable } from "@workspace/db";
import {
  GetComparisonParams,
  CreateComparisonBody,
  UpdateComparisonParams,
  UpdateComparisonBody,
  DeleteComparisonParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /comparisons
router.get("/comparisons", async (_req, res): Promise<void> => {
  const comparisons = await db
    .select()
    .from(comparisonsTable)
    .orderBy(comparisonsTable.createdAt);
  res.json(comparisons);
});

// POST /comparisons
router.post("/comparisons", async (req, res): Promise<void> => {
  const parsed = CreateComparisonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [comparison] = await db
    .insert(comparisonsTable)
    .values(parsed.data)
    .returning();
  req.log.info({ comparisonId: comparison.id }, "Comparison created");
  res.status(201).json(comparison);
});

// GET /comparisons/:id
router.get("/comparisons/:id", async (req, res): Promise<void> => {
  const params = GetComparisonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [comparison] = await db
    .select()
    .from(comparisonsTable)
    .where(eq(comparisonsTable.id, params.data.id));
  if (!comparison) {
    res.status(404).json({ error: "Comparison not found" });
    return;
  }
  res.json(comparison);
});

// PATCH /comparisons/:id
router.patch("/comparisons/:id", async (req, res): Promise<void> => {
  const params = UpdateComparisonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateComparisonBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [comparison] = await db
    .update(comparisonsTable)
    .set(parsed.data)
    .where(eq(comparisonsTable.id, params.data.id))
    .returning();
  if (!comparison) {
    res.status(404).json({ error: "Comparison not found" });
    return;
  }
  res.json(comparison);
});

// DELETE /comparisons/:id
router.delete("/comparisons/:id", async (req, res): Promise<void> => {
  const params = DeleteComparisonParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [comparison] = await db
    .delete(comparisonsTable)
    .where(eq(comparisonsTable.id, params.data.id))
    .returning();
  if (!comparison) {
    res.status(404).json({ error: "Comparison not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
