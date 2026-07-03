/**
 * Personal Library routes
 * GET    /library          — list saved items for current user
 * POST   /library          — save a document or legal source
 * PATCH  /library/:id      — update tags/notes
 * DELETE /library/:id      — remove from library
 */
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, libraryItemsTable, documentsTable, legalSourcesTable } from "@workspace/db";
import { requireAnyRole } from "../middlewares/roleAuth";

const router: IRouter = Router();

function getUserId(req: import("express").Request): number {
  const h = req.headers["x-user-id"];
  if (!h) return 1;
  return parseInt(Array.isArray(h) ? h[0] : h);
}

router.get("/library", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);

  const items = await db.select().from(libraryItemsTable)
    .where(eq(libraryItemsTable.userId, uid))
    .orderBy(libraryItemsTable.savedAt);

  const enriched = await Promise.all(items.map(async (item) => {
    let sourceMeta: Record<string, unknown> | null = null;
    if (item.sourceType === "document" && item.documentId) {
      const [doc] = await db.select({ id: documentsTable.id, originalName: documentsTable.originalName, fileType: documentsTable.fileType, fileSize: documentsTable.fileSize })
        .from(documentsTable).where(eq(documentsTable.id, item.documentId));
      sourceMeta = doc ?? null;
    } else if (item.sourceType === "legal_source" && item.legalSourceId) {
      const [src] = await db.select({ id: legalSourcesTable.id, title: legalSourcesTable.title, jurisdiction: legalSourcesTable.jurisdiction, docType: legalSourcesTable.docType, year: legalSourcesTable.year })
        .from(legalSourcesTable).where(eq(legalSourcesTable.id, item.legalSourceId));
      sourceMeta = src ?? null;
    }
    return { ...item, sourceMeta };
  }));

  res.json({ items: enriched });
});

router.post("/library", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const { sourceType, documentId, legalSourceId, tags, notes } = req.body;

  if (!sourceType) { res.status(400).json({ error: "sourceType required" }); return; }

  const [created] = await db.insert(libraryItemsTable).values({
    userId: uid,
    sourceType,
    documentId: documentId ? parseInt(documentId) : undefined,
    legalSourceId: legalSourceId ? parseInt(legalSourceId) : undefined,
    tags: tags ? JSON.stringify(tags) : "[]",
    notes,
  }).returning();

  res.status(201).json(created);
});

router.patch("/library/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { tags, notes } = req.body;
  const updateData: Record<string, unknown> = {};
  if (tags !== undefined) updateData.tags = JSON.stringify(tags);
  if (notes !== undefined) updateData.notes = notes;

  const [updated] = await db.update(libraryItemsTable)
    .set(updateData)
    .where(and(eq(libraryItemsTable.id, id), eq(libraryItemsTable.userId, uid)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/library/:id", requireAnyRole, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string);
  const uid = getUserId(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(libraryItemsTable).where(and(eq(libraryItemsTable.id, id), eq(libraryItemsTable.userId, uid)));
  res.json({ ok: true });
});

// ─── GET /library/export ─────────────────────────────────────────────────────
// Returns all user library items as a structured JSON payload.
// The frontend downloads this as a .json file.
// NOTE: userId is resolved from the x-user-id header — a pre-existing platform
// decision for the demo environment (documented in memory: no JWT/session auth).
// In production, this MUST be replaced with a verified session token.
// TODO(security): replace header-based userId with session/JWT before production deploy.
router.get("/library/export", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);

  const items = await db.select().from(libraryItemsTable)
    .where(eq(libraryItemsTable.userId, uid))
    .orderBy(libraryItemsTable.savedAt);

  const enriched = await Promise.all(items.map(async (item) => {
    let sourceMeta: Record<string, unknown> | null = null;
    if (item.sourceType === "document" && item.documentId) {
      const [doc] = await db.select({ id: documentsTable.id, originalName: documentsTable.originalName, fileType: documentsTable.fileType })
        .from(documentsTable).where(eq(documentsTable.id, item.documentId));
      sourceMeta = doc ?? null;
    } else if (item.sourceType === "legal_source" && item.legalSourceId) {
      const [src] = await db.select({ id: legalSourcesTable.id, title: legalSourcesTable.title, jurisdiction: legalSourcesTable.jurisdiction, docType: legalSourcesTable.docType, year: legalSourcesTable.year })
        .from(legalSourcesTable).where(eq(legalSourcesTable.id, item.legalSourceId));
      sourceMeta = src ?? null;
    }
    return { ...item, sourceMeta };
  }));

  const filename = `marsad-library-${new Date().toISOString().split("T")[0]}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/json");
  res.json({ exportedAt: new Date().toISOString(), itemCount: enriched.length, items: enriched });
});

export default router;
