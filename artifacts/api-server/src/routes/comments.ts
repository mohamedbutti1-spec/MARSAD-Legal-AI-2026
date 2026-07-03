import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, commentsTable } from "@workspace/db";
import {
  ListCommentsQueryParams,
  CreateCommentBody,
  DeleteCommentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /comments?documentId=...
router.get("/comments", async (req, res): Promise<void> => {
  const parsed = ListCommentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.documentId, parsed.data.documentId))
    .orderBy(commentsTable.createdAt);
  res.json(comments);
});

// POST /comments
router.post("/comments", async (req, res): Promise<void> => {
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [comment] = await db
    .insert(commentsTable)
    .values(parsed.data)
    .returning();
  req.log.info({ commentId: comment.id, documentId: parsed.data.documentId }, "Comment created");
  res.status(201).json(comment);
});

// DELETE /comments/:id
router.delete("/comments/:id", async (req, res): Promise<void> => {
  const params = DeleteCommentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [comment] = await db
    .delete(commentsTable)
    .where(eq(commentsTable.id, params.data.id))
    .returning();
  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
