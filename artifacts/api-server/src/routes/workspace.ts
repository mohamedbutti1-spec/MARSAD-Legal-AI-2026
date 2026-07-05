/**
 * Phase 57 — Research Workspace API Router
 * Mounted at /api prefix (via routes/index.ts).
 * All workspace endpoints live under /research/workspace/* to avoid
 * any collision with the existing POST /research/search endpoint.
 *
 * Auth: X-User-Id header (same convention as all other routes).
 * Ownership: every project is scoped to its owner_id; cross-user access is rejected.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { sql, eq, and, inArray } from "drizzle-orm";
import {
  db,
  researchProjectsTable,
  researchFoldersTable,
  researchItemsTable,
  researchItemVersionsTable,
  researchAnswerMetadataTable,
  citationRefreshStatusTable,
  usersTable,
  kbDocumentsTable,
} from "@workspace/db";
import { checkCitationStaleness, registerCitedKbDocs } from "../utils/citation-refresh.js";
import {
  exportProjectAsPdf,
  exportProjectAsDocx,
  exportProjectAsMarkdown,
  type ExportProject,
  type ExportFolder,
  type ExportItem,
} from "../utils/research-export.js";
import { logAudit } from "../middlewares/auditLog.js";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(req: Request): number {
  const id = parseInt(req.headers["x-user-id"] as string, 10);
  return Number.isFinite(id) ? id : 1;
}

function parseJson<T = unknown>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

async function assertProjectOwner(
  projectId: number,
  userId: number,
  res: Response,
): Promise<boolean> {
  const [project] = await db
    .select()
    .from(researchProjectsTable)
    .where(
      and(
        eq(researchProjectsTable.id, projectId),
        eq(researchProjectsTable.ownerId, userId),
      ),
    )
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Project not found or access denied" });
    return false;
  }
  return true;
}

// ─── Update search vector for an item ─────────────────────────────────────────
async function updateSearchVector(itemId: number, title: string, content: string): Promise<void> {
  // Simple FTS with Arabic + English using 'simple' config (no stemming — works for any language)
  const textBlob = `${title} ${content}`.slice(0, 4000);
  await db.execute(sql`
    UPDATE research_items
    SET search_vector = to_tsvector('simple', ${textBlob})
    WHERE id = ${itemId}
  `);
}

// ─── Extract KB document IDs from cited authorities ────────────────────────────
function extractKbDocIds(citedAuthorities: unknown[]): number[] {
  const ids: number[] = [];
  for (const a of citedAuthorities) {
    if (typeof a === "object" && a !== null) {
      const doc = a as Record<string, unknown>;
      // KB doc IDs are stored pre-offset in citedAuthorities (raw IDs)
      if (typeof doc.documentId === "number") ids.push(doc.documentId);
    }
  }
  return ids;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

/** GET /research/workspace/projects */
router.get("/research/workspace/projects", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const projects = await db
    .select()
    .from(researchProjectsTable)
    .where(eq(researchProjectsTable.ownerId, userId));
  res.json({ projects });
});

/** POST /research/workspace/projects */
router.post("/research/workspace/projects", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { title, description } = req.body as { title?: string; description?: string };

  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const [project] = await db
    .insert(researchProjectsTable)
    .values({ title: title.trim(), description: description ?? null, ownerId: userId, status: "active" })
    .returning();

  await logAudit(req, "workspace.project.create", { details: { projectId: project.id, title: project.title } });
  res.status(201).json({ project });
});

/** GET /research/workspace/projects/:projectId */
router.get("/research/workspace/projects/:projectId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);

  const [project] = await db
    .select()
    .from(researchProjectsTable)
    .where(and(eq(researchProjectsTable.id, projectId), eq(researchProjectsTable.ownerId, userId)))
    .limit(1);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const [folders, items] = await Promise.all([
    db.select().from(researchFoldersTable).where(eq(researchFoldersTable.projectId, projectId)),
    db.select({
      id: researchItemsTable.id,
      itemType: researchItemsTable.itemType,
      title: researchItemsTable.title,
      folderId: researchItemsTable.folderId,
      versionNumber: researchItemsTable.versionNumber,
      createdAt: researchItemsTable.createdAt,
      updatedAt: researchItemsTable.updatedAt,
    }).from(researchItemsTable).where(eq(researchItemsTable.projectId, projectId)),
  ]);

  res.json({ project, folders, items });
});

/** PUT /research/workspace/projects/:projectId */
router.put("/research/workspace/projects/:projectId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  const { title, description, status } = req.body as { title?: string; description?: string; status?: string };
  const updates: Partial<typeof researchProjectsTable.$inferInsert> = { updatedAt: new Date() };
  if (title?.trim())          updates.title       = title.trim();
  if (description !== undefined) updates.description = description ?? null;
  if (status)                 updates.status      = status;

  const [project] = await db
    .update(researchProjectsTable)
    .set(updates)
    .where(eq(researchProjectsTable.id, projectId))
    .returning();

  res.json({ project });
});

/** DELETE /research/workspace/projects/:projectId */
router.delete("/research/workspace/projects/:projectId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  await db.delete(researchProjectsTable).where(eq(researchProjectsTable.id, projectId));
  await logAudit(req, "workspace.project.delete", { details: { projectId } });
  res.json({ ok: true });
});

// ─── Folders ──────────────────────────────────────────────────────────────────

/** POST /research/workspace/projects/:projectId/folders */
router.post("/research/workspace/projects/:projectId/folders", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  const { name, parentFolderId, position } = req.body as { name?: string; parentFolderId?: number; position?: number };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const [folder] = await db
    .insert(researchFoldersTable)
    .values({ projectId, name: name.trim(), parentFolderId: parentFolderId ?? null, position: position ?? 0 })
    .returning();

  res.status(201).json({ folder });
});

/** PUT /research/workspace/projects/:projectId/folders/:folderId */
router.put("/research/workspace/projects/:projectId/folders/:folderId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const folderId  = parseInt(String(req.params.folderId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  const { name, parentFolderId, position } = req.body as { name?: string; parentFolderId?: number | null; position?: number };
  const updates: Partial<typeof researchFoldersTable.$inferInsert> = { updatedAt: new Date() };
  if (name?.trim())                updates.name           = name.trim();
  if (parentFolderId !== undefined) updates.parentFolderId = parentFolderId ?? null;
  if (position !== undefined)       updates.position       = position;

  const [folder] = await db
    .update(researchFoldersTable)
    .set(updates)
    .where(and(eq(researchFoldersTable.id, folderId), eq(researchFoldersTable.projectId, projectId)))
    .returning();

  res.json({ folder });
});

/** DELETE /research/workspace/projects/:projectId/folders/:folderId */
router.delete("/research/workspace/projects/:projectId/folders/:folderId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const folderId  = parseInt(String(req.params.folderId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  await db
    .delete(researchFoldersTable)
    .where(and(eq(researchFoldersTable.id, folderId), eq(researchFoldersTable.projectId, projectId)));

  res.json({ ok: true });
});

// ─── Items ────────────────────────────────────────────────────────────────────

/** GET /research/workspace/projects/:projectId/items */
router.get("/research/workspace/projects/:projectId/items", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  const folderId  = req.query.folderId !== undefined ? parseInt(req.query.folderId as string, 10) : undefined;
  const itemType  = req.query.itemType as string | undefined;

  let q = db
    .select()
    .from(researchItemsTable)
    .where(eq(researchItemsTable.projectId, projectId));

  const items = await q;
  const filtered = items.filter((item) => {
    if (folderId !== undefined && item.folderId !== folderId) return false;
    if (itemType && item.itemType !== itemType) return false;
    return true;
  });

  res.json({ items: filtered.map((item) => ({ ...item, content: parseJson(item.content, {}), metadata: parseJson(item.metadata, {}) })) });
});

/** POST /research/workspace/projects/:projectId/items */
router.post("/research/workspace/projects/:projectId/items", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  const {
    itemType, title, content = {}, metadata = {}, folderId,
    answerMeta,
  } = req.body as {
    itemType: string;
    title: string;
    content?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    folderId?: number;
    answerMeta?: {
      citedAuthorities?: unknown[];
      verificationReport?: Record<string, unknown>;
      confidenceLevel?: number;
      retrievalInventory?: Record<string, unknown>;
      generationTimestamp?: string;
      modelVersion?: string;
    };
  };

  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  if (!itemType)       { res.status(400).json({ error: "itemType is required" }); return; }

  const contentStr  = JSON.stringify(content);
  const metaStr     = JSON.stringify(metadata);

  const [item] = await db
    .insert(researchItemsTable)
    .values({
      projectId,
      folderId:      folderId ?? null,
      itemType,
      title:         title.trim(),
      content:       contentStr,
      metadata:      metaStr,
      versionNumber: 1,
      createdBy:     userId,
    })
    .returning();

  // Update search vector (background, non-fatal — log warns on failure)
  await updateSearchVector(item.id, item.title, contentStr).catch((err) => req.log.warn({ err, itemId: item.id }, "search vector update failed"));

  // Store initial version
  await db.insert(researchItemVersionsTable).values({
    itemId: item.id, versionNumber: 1, content: contentStr, metadata: metaStr, changedBy: userId,
  });

  // Answer-specific metadata
  if (itemType === "answer" && answerMeta) {
    const citedAuthorities  = answerMeta.citedAuthorities  ?? [];
    const verificationReport = answerMeta.verificationReport ?? {};
    const retrievalInventory = answerMeta.retrievalInventory ?? {};

    await db.insert(researchAnswerMetadataTable).values({
      itemId:              item.id,
      citedAuthorities:    JSON.stringify(citedAuthorities),
      verificationReport:  JSON.stringify(verificationReport),
      confidenceLevel:     answerMeta.confidenceLevel ?? null,
      retrievalInventory:  JSON.stringify(retrievalInventory),
      generationTimestamp: answerMeta.generationTimestamp ? new Date(answerMeta.generationTimestamp) : null,
      modelVersion:        answerMeta.modelVersion ?? null,
    });

    // Register KB doc IDs for staleness monitoring (background, non-fatal)
    const kbDocIds = extractKbDocIds(citedAuthorities);
    if (kbDocIds.length > 0) {
      await registerCitedKbDocs(item.id, kbDocIds).catch((err) => req.log.warn({ err, itemId: item.id }, "citation staleness registration failed"));
    }
  }

  await logAudit(req, "workspace.item.create", { details: { itemId: item.id, projectId, itemType } });
  res.status(201).json({ item: { ...item, content, metadata } });
});

/** GET /research/workspace/projects/:projectId/items/:itemId */
router.get("/research/workspace/projects/:projectId/items/:itemId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const itemId    = parseInt(String(req.params.itemId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  const [item] = await db
    .select()
    .from(researchItemsTable)
    .where(and(eq(researchItemsTable.id, itemId), eq(researchItemsTable.projectId, projectId)))
    .limit(1);

  if (!item) { res.status(404).json({ error: "Item not found" }); return; }

  // Fetch optional answer metadata
  const [answerMeta] = await db
    .select()
    .from(researchAnswerMetadataTable)
    .where(eq(researchAnswerMetadataTable.itemId, itemId))
    .limit(1);

  // Citation staleness check (poll-on-open, non-fatal)
  const staleness = await checkCitationStaleness(itemId).catch(() => null);

  res.json({
    item: {
      ...item,
      content:  parseJson(item.content, {}),
      metadata: parseJson(item.metadata, {}),
    },
    answerMeta: answerMeta
      ? {
          ...answerMeta,
          citedAuthorities:   parseJson<unknown[]>(answerMeta.citedAuthorities, []),
          verificationReport: parseJson(answerMeta.verificationReport, {}),
          retrievalInventory: parseJson(answerMeta.retrievalInventory, {}),
        }
      : null,
    staleness,
  });
});

/** PUT /research/workspace/projects/:projectId/items/:itemId */
router.put("/research/workspace/projects/:projectId/items/:itemId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const itemId    = parseInt(String(req.params.itemId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  const [existing] = await db
    .select()
    .from(researchItemsTable)
    .where(and(eq(researchItemsTable.id, itemId), eq(researchItemsTable.projectId, projectId)))
    .limit(1);

  if (!existing) { res.status(404).json({ error: "Item not found" }); return; }

  const { title, content, metadata, folderId } = req.body as {
    title?: string;
    content?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    folderId?: number | null;
  };

  const newVersion = (existing.versionNumber ?? 1) + 1;
  const contentStr = content !== undefined ? JSON.stringify(content) : existing.content;
  const metaStr    = metadata !== undefined ? JSON.stringify(metadata) : existing.metadata;

  // Save previous version before overwriting
  await db.insert(researchItemVersionsTable).values({
    itemId, versionNumber: existing.versionNumber, content: existing.content, metadata: existing.metadata, changedBy: userId,
  });

  const [updated] = await db
    .update(researchItemsTable)
    .set({
      title:         title?.trim() ?? existing.title,
      content:       contentStr,
      metadata:      metaStr,
      folderId:      folderId !== undefined ? folderId : existing.folderId,
      versionNumber: newVersion,
      updatedAt:     new Date(),
    })
    .where(eq(researchItemsTable.id, itemId))
    .returning();

  await updateSearchVector(itemId, updated.title, contentStr).catch((err) => req.log.warn({ err, itemId }, "search vector update failed"));
  res.json({ item: { ...updated, content: parseJson(updated.content, {}), metadata: parseJson(updated.metadata, {}) } });
});

/** DELETE /research/workspace/projects/:projectId/items/:itemId */
router.delete("/research/workspace/projects/:projectId/items/:itemId", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const itemId    = parseInt(String(req.params.itemId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  await db
    .delete(researchItemsTable)
    .where(and(eq(researchItemsTable.id, itemId), eq(researchItemsTable.projectId, projectId)));

  await logAudit(req, "workspace.item.delete", { details: { itemId, projectId } });
  res.json({ ok: true });
});

/** GET /research/workspace/projects/:projectId/items/:itemId/versions */
router.get("/research/workspace/projects/:projectId/items/:itemId/versions", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const itemId    = parseInt(String(req.params.itemId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  // SECURITY: Verify the item belongs to this project (prevents cross-user IDOR via itemId)
  const [itemCheck] = await db
    .select({ id: researchItemsTable.id })
    .from(researchItemsTable)
    .where(and(eq(researchItemsTable.id, itemId), eq(researchItemsTable.projectId, projectId)))
    .limit(1);
  if (!itemCheck) { res.status(404).json({ error: "Item not found in this project" }); return; }

  const versions = await db
    .select()
    .from(researchItemVersionsTable)
    .where(eq(researchItemVersionsTable.itemId, itemId));

  res.json({ versions: versions.map((v) => ({ ...v, content: parseJson(v.content, {}), metadata: parseJson(v.metadata, {}) })) });
});

/** POST /research/workspace/projects/:projectId/items/:itemId/review — mark stale citation as reviewed */
router.post("/research/workspace/projects/:projectId/items/:itemId/review", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const itemId    = parseInt(String(req.params.itemId), 10);
  if (!await assertProjectOwner(projectId, userId, res)) return;

  // SECURITY: Verify the item belongs to this project before mutating its citation status
  const [itemCheck] = await db
    .select({ id: researchItemsTable.id })
    .from(researchItemsTable)
    .where(and(eq(researchItemsTable.id, itemId), eq(researchItemsTable.projectId, projectId)))
    .limit(1);
  if (!itemCheck) { res.status(404).json({ error: "Item not found in this project" }); return; }

  await db.execute(sql`
    UPDATE citation_refresh_status
    SET is_stale         = FALSE,
        staleness_reason = NULL,
        last_checked_at  = NOW(),
        updated_at       = NOW()
    WHERE item_id = ${itemId}
  `);

  res.json({ ok: true });
});

// ─── Full-Text Search ─────────────────────────────────────────────────────────

/** GET /research/workspace/search?q=&projectId= */
router.get("/research/workspace/search", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const q         = (req.query.q as string ?? "").trim();
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
  const limit     = Math.min(parseInt(req.query.limit as string || "20", 10), 50);

  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  // First get the user's project IDs (access control)
  const userProjects = await db
    .select({ id: researchProjectsTable.id })
    .from(researchProjectsTable)
    .where(eq(researchProjectsTable.ownerId, userId));

  const userProjectIds = userProjects.map((p) => p.id);
  if (userProjectIds.length === 0) { res.json({ results: [], total: 0 }); return; }

  const scopedIds = projectId && userProjectIds.includes(projectId)
    ? [projectId]
    : userProjectIds;

  // FTS using stored search_vector, fallback to ILIKE for items without vector
  const results = await db.execute<{
    id: number; project_id: number; folder_id: number | null;
    item_type: string; title: string; content: string;
    created_at: Date; rank: number;
  }>(sql`
    SELECT
      id, project_id, folder_id, item_type, title,
      left(content, 500) AS content,
      created_at,
      COALESCE(ts_rank(search_vector, plainto_tsquery('simple', ${q})), 0) AS rank
    FROM research_items
    WHERE project_id = ANY(${scopedIds}::int[])
      AND (
        search_vector @@ plainto_tsquery('simple', ${q})
        OR title ILIKE ${'%' + q + '%'}
      )
    ORDER BY rank DESC, updated_at DESC
    LIMIT ${limit}
  `);

  res.json({
    results: (results.rows ?? []).map((r) => ({
      ...r,
      content: parseJson<Record<string, unknown>>(r.content, {}),
    })),
    total: (results.rows ?? []).length,
    query: q,
  });
});

// ─── Cross-Reference Lookup ───────────────────────────────────────────────────

/** GET /research/workspace/xref?kbDocId=&legalSourceId= — items that cite a given KB doc or legal source */
router.get("/research/workspace/xref", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const kbDocId    = req.query.kbDocId    ? parseInt(req.query.kbDocId    as string, 10) : null;
  const _legalSrcId = req.query.legalSourceId ? parseInt(req.query.legalSourceId as string, 10) : null;

  if (!kbDocId) {
    res.status(400).json({ error: "kbDocId is required" });
    return;
  }

  // Get the user's answer items that have cited_authorities containing this KB doc ID
  const userProjects = await db
    .select({ id: researchProjectsTable.id })
    .from(researchProjectsTable)
    .where(eq(researchProjectsTable.ownerId, userId));

  const userProjectIds = userProjects.map((p) => p.id);
  if (userProjectIds.length === 0) { res.json({ matches: [], kbDocId }); return; }

  const userItems = await db
    .select({ id: researchItemsTable.id, title: researchItemsTable.title, projectId: researchItemsTable.projectId, itemType: researchItemsTable.itemType })
    .from(researchItemsTable)
    .where(
      and(
        inArray(researchItemsTable.projectId, userProjectIds),
        eq(researchItemsTable.itemType, "answer"),
      ),
    );

  const itemIds = userItems.map((i) => i.id);
  if (itemIds.length === 0) { res.json({ matches: [], kbDocId }); return; }

  // Load answer metadata and filter by kbDocId in cited_authorities
  const metaRows = await db
    .select({ itemId: researchAnswerMetadataTable.itemId, citedAuthorities: researchAnswerMetadataTable.citedAuthorities })
    .from(researchAnswerMetadataTable)
    .where(inArray(researchAnswerMetadataTable.itemId, itemIds));

  const matches = metaRows
    .filter((row) => {
      const auths = parseJson<Array<Record<string, unknown>>>(row.citedAuthorities, []);
      return auths.some((a) => a.documentId === kbDocId);
    })
    .map((row) => {
      const item = userItems.find((i) => i.id === row.itemId);
      return { itemId: row.itemId, title: item?.title, projectId: item?.projectId };
    });

  // Also fetch KB doc info
  const [kbDoc] = await db
    .select({ titleAr: kbDocumentsTable.titleAr, title: kbDocumentsTable.title })
    .from(kbDocumentsTable)
    .where(eq(kbDocumentsTable.id, kbDocId))
    .limit(1);

  res.json({ matches, kbDocId, kbDoc: kbDoc ?? null });
});

// ─── Export ───────────────────────────────────────────────────────────────────

/** GET /research/workspace/projects/:projectId/export?format=pdf|docx|md */
router.get("/research/workspace/projects/:projectId/export", async (req: Request, res: Response): Promise<void> => {
  const userId    = getUserId(req);
  const projectId = parseInt(String(req.params.projectId), 10);
  const format    = (req.query.format as string ?? "md").toLowerCase();

  const [project] = await db
    .select()
    .from(researchProjectsTable)
    .where(and(eq(researchProjectsTable.id, projectId), eq(researchProjectsTable.ownerId, userId)))
    .limit(1);

  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  // Fetch owner name
  const [ownerRow] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const ownerName = ownerRow?.name ?? `User ${userId}`;

  // Fetch folders
  const folders = await db
    .select()
    .from(researchFoldersTable)
    .where(eq(researchFoldersTable.projectId, projectId));

  // Fetch all items
  const items = await db
    .select()
    .from(researchItemsTable)
    .where(eq(researchItemsTable.projectId, projectId));

  // Fetch all answer metadata for this project's items
  const itemIds = items.map((i) => i.id);
  const answerMetaRows = itemIds.length > 0
    ? await db
        .select()
        .from(researchAnswerMetadataTable)
        .where(inArray(researchAnswerMetadataTable.itemId, itemIds))
    : [];
  const answerMetaMap = new Map(answerMetaRows.map((r) => [r.itemId, r]));

  // Build ExportProject
  const rootItems: ExportItem[] = [];
  const folderItemMap = new Map<number, ExportItem[]>();

  for (const item of items) {
    const am = answerMetaMap.get(item.id);
    const exportItem: ExportItem = {
      id:        item.id,
      itemType:  item.itemType,
      title:     item.title,
      content:   parseJson<Record<string, unknown>>(item.content, {}),
      metadata:  parseJson<Record<string, unknown>>(item.metadata, {}),
      createdAt: item.createdAt,
      answerMeta: am ? {
        citedAuthorities:   parseJson<unknown[]>(am.citedAuthorities, []),
        verificationReport: parseJson(am.verificationReport, {}),
        confidenceLevel:    am.confidenceLevel ?? null,
        retrievalInventory: parseJson(am.retrievalInventory, {}),
        generationTimestamp: am.generationTimestamp ?? null,
        modelVersion:        am.modelVersion ?? null,
      } : undefined,
    };

    if (item.folderId === null) {
      rootItems.push(exportItem);
    } else {
      if (!folderItemMap.has(item.folderId)) folderItemMap.set(item.folderId, []);
      folderItemMap.get(item.folderId)!.push(exportItem);
    }
  }

  const exportFolders: ExportFolder[] = [
    { id: null, name: "الجذر", items: rootItems },
    ...folders.map((f): ExportFolder => ({
      id: f.id, name: f.name, items: folderItemMap.get(f.id) ?? [],
    })),
  ].filter((f) => f.items.length > 0);

  const exportProject: ExportProject = {
    id:          project.id,
    title:       project.title,
    description: project.description,
    ownerName,
    exportDate:  new Date(),
    folders:     exportFolders,
  };

  const slug = project.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, "-").slice(0, 50);

  try {
    if (format === "md") {
      const md = exportProjectAsMarkdown(exportProject);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${slug}.md"`);
      res.send(md);
    } else if (format === "docx") {
      const buf = await exportProjectAsDocx(exportProject);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${slug}.docx"`);
      res.send(buf);
    } else {
      // Default: PDF
      const buf = await exportProjectAsPdf(exportProject);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${slug}.pdf"`);
      res.send(buf);
    }
    await logAudit(req, "workspace.project.export", { details: { projectId, format } });
  } catch (err) {
    req.log.error({ err }, "Project export failed");
    res.status(500).json({ error: "Export failed. Please try again." });
  }
});

export default router;
