import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, commentsTable } from "@workspace/db";
import { ListCommentsQueryParams, CreateCommentBody, DeleteCommentParams } from "@workspace/api-zod";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { cache } from "../lib/cache";

const router: IRouter = Router();

// GET /comments?documentId=
router.get("/comments", requireAnyRole, async (req, res): Promise<void> => {
  const parsed = ListCommentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.documentId, parsed.data.documentId));
  res.json(comments);
});

// POST /comments
router.post("/comments", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [comment] = await db.insert(commentsTable).values(parsed.data).returning();
  logAudit(req, "comment.create", { entityType: "comment", entityId: comment.id, details: { documentId: comment.documentId } });
  cache.delPattern("documents:");
  res.status(201).json(comment);
});

// DELETE /comments/:id
router.delete("/comments/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = DeleteCommentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [comment] = await db
    .delete(commentsTable)
    .where(eq(commentsTable.id, parsed.data.id))
    .returning();
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
