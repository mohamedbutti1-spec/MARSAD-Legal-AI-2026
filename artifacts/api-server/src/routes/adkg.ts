/**
 * Phase 58 — Administrative Decision Knowledge Graph API Router
 * All endpoints under /adkg/* — fully additive; no existing routes modified.
 *
 * Auth:      X-User-Id header (platform convention).
 * Ownership: every decision is scoped to its owner_id.
 * Security:  link/timeline/edge endpoints verify both decision ownership
 *            AND that the child row belongs to the owned decision.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { sql, eq, and, inArray, or } from "drizzle-orm";
import {
  db,
  adkgDecisionsTable,
  adkgDecisionLinksTable,
  adkgTimelineEventsTable,
  adkgGraphEdgesTable,
  kbDocumentsTable,
  researchProjectsTable,
} from "@workspace/db";
import { logAudit } from "../middlewares/auditLog.js";
import { exportAdkgAsPdf, exportAdkgAsDocx, exportAdkgAsMarkdown } from "../utils/adkg-export.js";
import { aiRouter, TaskType } from "../ai";
import { parseModelJson } from "../ai/providers/interface";
import { buildContext } from "../utils/rag";
import {
  buildAdkgEvaluatorPrompt,
  validateAdminBrief,
  computeLegalityScore,
  computeRiskScore,
  type AdminDecisionBriefData,
  type DimensionResult,
} from "../utils/admin-os-evaluator";
import { getUserId } from "../lib/route-helpers.js";
import { requireSupervisorOrOwner } from "../middlewares/roleAuth.js";

const router: IRouter = Router();

// All ADKG routes require at minimum supervisor-level access (mirrors canUseAi frontend gate).
router.use(requireSupervisorOrOwner);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJson<T = unknown>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

async function assertDecisionOwner(
  decisionId: number,
  userId: number,
  res: Response,
): Promise<boolean> {
  const [row] = await db
    .select({ id: adkgDecisionsTable.id })
    .from(adkgDecisionsTable)
    .where(and(
      eq(adkgDecisionsTable.id, decisionId),
      eq(adkgDecisionsTable.ownerId, userId),
    ))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Decision not found or access denied" }); return false; }
  return true;
}

/** Update stored FTS search_vector for a decision (non-fatal background op). */
async function updateDecisionSearchVector(
  req: Request,
  id: number,
  decisionNumber: string,
  title: string,
  titleAr: string,
  subject: string | null | undefined,
  subjectAr: string | null | undefined,
): Promise<void> {
  const blob = [decisionNumber, title, titleAr, subject ?? "", subjectAr ?? ""].join(" ").slice(0, 4000);
  await db.execute(sql`
    UPDATE adkg_decisions
    SET search_vector = to_tsvector('simple', ${blob})
    WHERE id = ${id}
  `).catch((err) => req.log.warn({ err, id }, "adkg search vector update failed"));
}

// ─── Decisions CRUD ───────────────────────────────────────────────────────────

/** GET /adkg/decisions — list decisions owned by the current user */
router.get("/adkg/decisions", async (req: Request, res: Response): Promise<void> => {
  const userId  = getUserId(req);
  const status  = req.query.status as string | undefined;
  const limit   = Math.min(parseInt(req.query.limit as string || "50", 10), 100);

  let rows = await db
    .select()
    .from(adkgDecisionsTable)
    .where(eq(adkgDecisionsTable.ownerId, userId));

  if (status) rows = rows.filter((r) => r.status === status);
  rows = rows.slice(0, limit);

  res.json({
    decisions: rows.map((r) => ({
      ...r,
      content:  parseJson(r.content, {}),
      metadata: parseJson(r.metadata, {}),
    })),
  });
});

/** POST /adkg/decisions — create a new decision */
router.post("/adkg/decisions", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const {
    decisionNumber, title, titleAr, issuerOrg, issuerOrgAr,
    subject, subjectAr, status, issuedDate, effectiveDate, expiryDate,
    content = {}, metadata = {},
  } = req.body as {
    decisionNumber: string; title: string; titleAr: string;
    issuerOrg?: string; issuerOrgAr?: string;
    subject?: string; subjectAr?: string;
    status?: string; issuedDate?: string; effectiveDate?: string; expiryDate?: string;
    content?: Record<string, unknown>; metadata?: Record<string, unknown>;
  };

  if (!decisionNumber?.trim()) { res.status(400).json({ error: "decisionNumber is required" }); return; }
  if (!title?.trim())          { res.status(400).json({ error: "title is required" }); return; }
  if (!titleAr?.trim())        { res.status(400).json({ error: "titleAr is required" }); return; }

  const [decision] = await db
    .insert(adkgDecisionsTable)
    .values({
      decisionNumber: decisionNumber.trim(),
      title: title.trim(), titleAr: titleAr.trim(),
      issuerOrg: issuerOrg ?? null, issuerOrgAr: issuerOrgAr ?? null,
      subject: subject ?? null, subjectAr: subjectAr ?? null,
      status: status ?? "draft",
      issuedDate: issuedDate ?? null, effectiveDate: effectiveDate ?? null, expiryDate: expiryDate ?? null,
      content: JSON.stringify(content), metadata: JSON.stringify(metadata),
      ownerId: userId,
    })
    .returning();

  await updateDecisionSearchVector(req, decision.id, decision.decisionNumber, decision.title, decision.titleAr, decision.subject, decision.subjectAr);

  // Auto-create first timeline event if status != draft
  if (status && status !== "draft" && issuedDate) {
    await db.insert(adkgTimelineEventsTable).values({
      decisionId: decision.id, eventType: status, eventDate: issuedDate,
      descriptionAr: `تم إنشاء القرار بحالة: ${status}`,
      description: `Decision created with status: ${status}`,
      createdBy: userId,
    });
  }

  await logAudit(req, "adkg.decision.create", { details: { decisionId: decision.id, decisionNumber: decision.decisionNumber } });
  res.status(201).json({ decision: { ...decision, content, metadata } });
});

/** GET /adkg/decisions/:id — full decision detail */
router.get("/adkg/decisions/:id", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);

  const [decision] = await db
    .select()
    .from(adkgDecisionsTable)
    .where(and(eq(adkgDecisionsTable.id, decisionId), eq(adkgDecisionsTable.ownerId, userId)))
    .limit(1);

  if (!decision) { res.status(404).json({ error: "Decision not found" }); return; }

  const [links, timeline] = await Promise.all([
    db.select().from(adkgDecisionLinksTable).where(eq(adkgDecisionLinksTable.decisionId, decisionId)),
    db.select().from(adkgTimelineEventsTable).where(eq(adkgTimelineEventsTable.decisionId, decisionId)),
  ]);

  res.json({
    decision: { ...decision, content: parseJson(decision.content, {}), metadata: parseJson(decision.metadata, {}), citedAuthorities: parseJson<unknown[]>(decision.citedAuthorities, []), verificationReport: parseJson(decision.verificationReport, {}) },
    links,
    timeline: timeline.sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
  });
});

/** PUT /adkg/decisions/:id — update decision */
router.put("/adkg/decisions/:id", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);
  if (!await assertDecisionOwner(decisionId, userId, res)) return;

  const {
    decisionNumber, title, titleAr, issuerOrg, issuerOrgAr,
    subject, subjectAr, status, issuedDate, effectiveDate, expiryDate,
    content, metadata,
  } = req.body as Record<string, unknown>;

  const updates: Partial<typeof adkgDecisionsTable.$inferInsert> = { updatedAt: new Date() };
  if (decisionNumber) updates.decisionNumber = String(decisionNumber).trim();
  if (title)          updates.title          = String(title).trim();
  if (titleAr)        updates.titleAr        = String(titleAr).trim();
  if (issuerOrg !== undefined) updates.issuerOrg   = issuerOrg ? String(issuerOrg) : null;
  if (issuerOrgAr !== undefined) updates.issuerOrgAr = issuerOrgAr ? String(issuerOrgAr) : null;
  if (subject !== undefined)   updates.subject     = subject ? String(subject) : null;
  if (subjectAr !== undefined) updates.subjectAr   = subjectAr ? String(subjectAr) : null;
  if (status)         updates.status         = String(status);
  if (issuedDate !== undefined)    updates.issuedDate    = issuedDate ? String(issuedDate) : null;
  if (effectiveDate !== undefined) updates.effectiveDate = effectiveDate ? String(effectiveDate) : null;
  if (expiryDate !== undefined)    updates.expiryDate    = expiryDate ? String(expiryDate) : null;
  if (content)        updates.content        = JSON.stringify(content);
  if (metadata)       updates.metadata       = JSON.stringify(metadata);

  const [updated] = await db
    .update(adkgDecisionsTable)
    .set(updates)
    .where(eq(adkgDecisionsTable.id, decisionId))
    .returning();

  await updateDecisionSearchVector(req, updated.id, updated.decisionNumber, updated.title, updated.titleAr, updated.subject, updated.subjectAr);
  res.json({ decision: { ...updated, content: parseJson(updated.content, {}), metadata: parseJson(updated.metadata, {}) } });
});

/** DELETE /adkg/decisions/:id */
router.delete("/adkg/decisions/:id", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);
  if (!await assertDecisionOwner(decisionId, userId, res)) return;

  await db.delete(adkgDecisionsTable).where(eq(adkgDecisionsTable.id, decisionId));
  await logAudit(req, "adkg.decision.delete", { details: { decisionId } });
  res.json({ ok: true });
});

// ─── Links ────────────────────────────────────────────────────────────────────

/** POST /adkg/decisions/:id/links */
router.post("/adkg/decisions/:id/links", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);
  if (!await assertDecisionOwner(decisionId, userId, res)) return;

  const {
    linkType, linkedEntityType, linkedEntityId, linkedEntityRef,
    titleAr, titleEn, authorityClass, notes,
  } = req.body as {
    linkType: string; linkedEntityType: string;
    linkedEntityId?: number; linkedEntityRef?: string;
    titleAr?: string; titleEn?: string;
    authorityClass?: string; notes?: string;
  };

  if (!linkType)           { res.status(400).json({ error: "linkType is required" }); return; }
  if (!linkedEntityType)   { res.status(400).json({ error: "linkedEntityType is required" }); return; }
  if (!titleAr && !titleEn && !linkedEntityRef) {
    res.status(400).json({ error: "One of titleAr, titleEn, or linkedEntityRef is required" }); return;
  }

  const [link] = await db
    .insert(adkgDecisionLinksTable)
    .values({
      decisionId, linkType, linkedEntityType,
      linkedEntityId: linkedEntityId ?? null,
      linkedEntityRef: linkedEntityRef ?? null,
      titleAr: titleAr ?? null, titleEn: titleEn ?? null,
      authorityClass: authorityClass ?? "persuasive",
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json({ link });
});

/** DELETE /adkg/decisions/:id/links/:linkId */
router.delete("/adkg/decisions/:id/links/:linkId", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);
  const linkId     = parseInt(String(req.params.linkId), 10);
  if (!await assertDecisionOwner(decisionId, userId, res)) return;

  // SECURITY: verify link belongs to this decision
  const [linkCheck] = await db
    .select({ id: adkgDecisionLinksTable.id })
    .from(adkgDecisionLinksTable)
    .where(and(eq(adkgDecisionLinksTable.id, linkId), eq(adkgDecisionLinksTable.decisionId, decisionId)))
    .limit(1);
  if (!linkCheck) { res.status(404).json({ error: "Link not found in this decision" }); return; }

  await db.delete(adkgDecisionLinksTable).where(eq(adkgDecisionLinksTable.id, linkId));
  res.json({ ok: true });
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

/** POST /adkg/decisions/:id/timeline */
router.post("/adkg/decisions/:id/timeline", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);
  if (!await assertDecisionOwner(decisionId, userId, res)) return;

  const { eventType, eventDate, description, descriptionAr, metadata = {} } = req.body as {
    eventType: string; eventDate: string;
    description?: string; descriptionAr?: string;
    metadata?: Record<string, unknown>;
  };

  if (!eventType)  { res.status(400).json({ error: "eventType is required" }); return; }
  if (!eventDate)  { res.status(400).json({ error: "eventDate is required" }); return; }

  const [event] = await db
    .insert(adkgTimelineEventsTable)
    .values({
      decisionId, eventType, eventDate,
      description: description ?? null, descriptionAr: descriptionAr ?? null,
      metadata: JSON.stringify(metadata),
      createdBy: userId,
    })
    .returning();

  // If this event sets a lifecycle status, update the decision status automatically
  const STATUS_EVENTS = new Set(["issued", "challenged", "suspended", "amended", "revoked", "annulled", "executed"]);
  if (STATUS_EVENTS.has(eventType)) {
    await db.execute(sql`
      UPDATE adkg_decisions SET status = ${eventType}, updated_at = NOW() WHERE id = ${decisionId}
    `);
  }

  res.status(201).json({ event: { ...event, metadata } });
});

/** DELETE /adkg/decisions/:id/timeline/:eventId */
router.delete("/adkg/decisions/:id/timeline/:eventId", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);
  const eventId    = parseInt(String(req.params.eventId), 10);
  if (!await assertDecisionOwner(decisionId, userId, res)) return;

  // SECURITY: verify event belongs to this decision
  const [check] = await db
    .select({ id: adkgTimelineEventsTable.id })
    .from(adkgTimelineEventsTable)
    .where(and(eq(adkgTimelineEventsTable.id, eventId), eq(adkgTimelineEventsTable.decisionId, decisionId)))
    .limit(1);
  if (!check) { res.status(404).json({ error: "Event not found in this decision" }); return; }

  await db.delete(adkgTimelineEventsTable).where(eq(adkgTimelineEventsTable.id, eventId));
  res.json({ ok: true });
});

// ─── Graph Edges ──────────────────────────────────────────────────────────────

/** POST /adkg/graph-edges — create a directed edge between two decisions */
router.post("/adkg/graph-edges", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const { fromDecisionId, toDecisionId, relationshipType, notes, confidence } = req.body as {
    fromDecisionId: number; toDecisionId: number;
    relationshipType: string; notes?: string; confidence?: number;
  };

  if (!fromDecisionId) { res.status(400).json({ error: "fromDecisionId is required" }); return; }
  if (!toDecisionId)   { res.status(400).json({ error: "toDecisionId is required" }); return; }
  if (!relationshipType) { res.status(400).json({ error: "relationshipType is required" }); return; }

  // User must own the source decision
  if (!await assertDecisionOwner(fromDecisionId, userId, res)) return;

  const [edge] = await db
    .insert(adkgGraphEdgesTable)
    .values({
      fromDecisionId, toDecisionId, relationshipType,
      notes: notes ?? null, confidence: confidence ?? null,
      createdBy: userId,
    })
    .returning();

  res.status(201).json({ edge });
});

/** DELETE /adkg/graph-edges/:edgeId */
router.delete("/adkg/graph-edges/:edgeId", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const edgeId = parseInt(String(req.params.edgeId), 10);

  const [edge] = await db
    .select()
    .from(adkgGraphEdgesTable)
    .where(eq(adkgGraphEdgesTable.id, edgeId))
    .limit(1);
  if (!edge) { res.status(404).json({ error: "Edge not found" }); return; }

  // Must own the source decision to delete its outgoing edges
  if (!await assertDecisionOwner(edge.fromDecisionId, userId, res)) return;

  await db.delete(adkgGraphEdgesTable).where(eq(adkgGraphEdgesTable.id, edgeId));
  res.json({ ok: true });
});

// ─── Graph Subgraph ───────────────────────────────────────────────────────────

/** GET /adkg/decisions/:id/graph — return the subgraph around this decision */
router.get("/adkg/decisions/:id/graph", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);

  const [central] = await db
    .select()
    .from(adkgDecisionsTable)
    .where(and(eq(adkgDecisionsTable.id, decisionId), eq(adkgDecisionsTable.ownerId, userId)))
    .limit(1);
  if (!central) { res.status(404).json({ error: "Decision not found" }); return; }

  // Fetch all graph edges (out + in)
  const [outEdges, inEdges, links] = await Promise.all([
    db.select().from(adkgGraphEdgesTable).where(eq(adkgGraphEdgesTable.fromDecisionId, decisionId)),
    db.select().from(adkgGraphEdgesTable).where(eq(adkgGraphEdgesTable.toDecisionId, decisionId)),
    db.select().from(adkgDecisionLinksTable).where(eq(adkgDecisionLinksTable.decisionId, decisionId)),
  ]);

  // Fetch connected decision nodes — SECURITY: scoped to ownerId to prevent
  // cross-user metadata leakage. Decisions owned by another user will simply not
  // appear as enriched nodes (they are excluded rather than exposed).
  const connectedIds = [
    ...outEdges.map((e) => e.toDecisionId),
    ...inEdges.map((e) => e.fromDecisionId),
  ].filter((id) => id !== decisionId);

  const connectedDecisions = connectedIds.length > 0
    ? await db.select({ id: adkgDecisionsTable.id, titleAr: adkgDecisionsTable.titleAr, title: adkgDecisionsTable.title, status: adkgDecisionsTable.status, decisionNumber: adkgDecisionsTable.decisionNumber })
        .from(adkgDecisionsTable)
        .where(and(
          inArray(adkgDecisionsTable.id, connectedIds),
          eq(adkgDecisionsTable.ownerId, userId),   // ← owner-scoped; cross-user nodes are excluded
        ))
    : [];

  // Build graph response
  type GraphNode = {
    id: string; type: string; label: string; labelAr: string;
    status?: string; authorityClass?: string; linkType?: string;
  };
  type GraphEdge = { source: string; target: string; type: string; label: string };

  const nodes: GraphNode[] = [
    { id: `d:${central.id}`, type: "decision", label: central.title, labelAr: central.titleAr, status: central.status },
    ...connectedDecisions.map((d) => ({
      id: `d:${d.id}`, type: "decision", label: d.title, labelAr: d.titleAr, status: d.status ?? "draft",
    })),
    ...links.map((l): GraphNode => ({
      id: `lnk:${l.id}`,
      type: l.linkedEntityType,
      label: l.titleEn ?? l.linkedEntityRef ?? `[${l.linkedEntityType}:${l.linkedEntityId ?? "ext"}]`,
      labelAr: l.titleAr ?? l.titleEn ?? l.linkedEntityRef ?? "",
      authorityClass: l.authorityClass,
      linkType: l.linkType,
    })),
  ];

  const edges: GraphEdge[] = [
    ...outEdges.map((e): GraphEdge => ({
      source: `d:${e.fromDecisionId}`, target: `d:${e.toDecisionId}`,
      type: e.relationshipType, label: e.relationshipType.replace(/_/g, " "),
    })),
    ...inEdges.map((e): GraphEdge => ({
      source: `d:${e.fromDecisionId}`, target: `d:${e.toDecisionId}`,
      type: e.relationshipType, label: e.relationshipType.replace(/_/g, " "),
    })),
    ...links.map((l): GraphEdge => ({
      source: `d:${central.id}`, target: `lnk:${l.id}`,
      type: l.linkType, label: l.linkType.replace(/_/g, " "),
    })),
  ];

  res.json({ centralId: decisionId, nodes, edges });
});

// ─── Full-Text Search ─────────────────────────────────────────────────────────

/** GET /adkg/search?q= */
router.get("/adkg/search", async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const q      = (req.query.q as string ?? "").trim();
  const status = req.query.status as string | undefined;
  const limit  = Math.min(parseInt(req.query.limit as string || "20", 10), 50);

  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const results = await db.execute<{
    id: number; decision_number: string; title: string; title_ar: string;
    status: string; issued_date: string | null; rank: number;
  }>(sql`
    SELECT
      id, decision_number, title, title_ar, status, issued_date,
      COALESCE(ts_rank(search_vector, plainto_tsquery('simple', ${q})), 0) AS rank
    FROM adkg_decisions
    WHERE owner_id = ${userId}
      AND (
        search_vector @@ plainto_tsquery('simple', ${q})
        OR title    ILIKE ${'%' + q + '%'}
        OR title_ar ILIKE ${'%' + q + '%'}
        OR decision_number ILIKE ${'%' + q + '%'}
      )
      ${status ? sql`AND status = ${status}` : sql``}
    ORDER BY rank DESC, updated_at DESC
    LIMIT ${limit}
  `);

  res.json({ results: results.rows ?? [], query: q, total: (results.rows ?? []).length });
});

// ─── Export ───────────────────────────────────────────────────────────────────

/** GET /adkg/decisions/:id/export?format=pdf|docx|md */
router.get("/adkg/decisions/:id/export", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);
  const format     = (req.query.format as string ?? "md").toLowerCase();

  const [decision] = await db
    .select()
    .from(adkgDecisionsTable)
    .where(and(eq(adkgDecisionsTable.id, decisionId), eq(adkgDecisionsTable.ownerId, userId)))
    .limit(1);
  if (!decision) { res.status(404).json({ error: "Decision not found" }); return; }

  const [links, timeline] = await Promise.all([
    db.select().from(adkgDecisionLinksTable).where(eq(adkgDecisionLinksTable.decisionId, decisionId)),
    db.select().from(adkgTimelineEventsTable).where(eq(adkgTimelineEventsTable.decisionId, decisionId)),
  ]);

  const exportData = {
    decision: { ...decision, content: parseJson(decision.content, {}), citedAuthorities: parseJson<unknown[]>(decision.citedAuthorities, []) },
    links,
    timeline: timeline.sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    exportDate: new Date(),
  };

  try {
    const slug = decision.decisionNumber.replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, "-").slice(0, 50);
    if (format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${slug}.md"`);
      res.send(exportAdkgAsMarkdown(exportData));
    } else if (format === "docx") {
      const buf = await exportAdkgAsDocx(exportData);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${slug}.docx"`);
      res.send(buf);
    } else {
      const buf = await exportAdkgAsPdf(exportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${slug}.pdf"`);
      res.send(buf);
    }
    await logAudit(req, "adkg.decision.export", { details: { decisionId, format } });
  } catch (err) {
    req.log.error({ err }, "ADKG export failed");
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── Pillar Analysis ──────────────────────────────────────────────────────────

/**
 * POST /adkg/decisions/:id/analyze
 * Runs the 16-pillar Al-Shamsi evaluator against the stored ADKG decision content
 * and its linked authorities. Stores the result in citedAuthorities.pillarAnalysis.
 */
router.post("/adkg/decisions/:id/analyze", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);

  const [decision] = await db
    .select()
    .from(adkgDecisionsTable)
    .where(and(eq(adkgDecisionsTable.id, decisionId), eq(adkgDecisionsTable.ownerId, userId)))
    .limit(1);
  if (!decision) { res.status(404).json({ error: "Decision not found" }); return; }

  const links = await db
    .select()
    .from(adkgDecisionLinksTable)
    .where(eq(adkgDecisionLinksTable.decisionId, decisionId));

  const content = parseJson<Record<string, unknown>>(decision.content, {});
  const bodyAr  = String(content.bodyAr ?? content.body ?? "");
  const bodyEn  = String(content.body ?? "");

  // Build RAG context from decision text
  const semanticQuery = [decision.titleAr, decision.title, decision.subjectAr ?? "", bodyAr].join(" ").slice(0, 1000);
  let provider;
  try {
    provider = await aiRouter.routeFor(TaskType.RAG);
  } catch (err: unknown) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }

  const { context: ragContext } = await buildContext(semanticQuery, userId, [], []);

  const { systemPrompt, userPrompt } = buildAdkgEvaluatorPrompt({
    decisionNumber: decision.decisionNumber,
    titleAr: decision.titleAr,
    titleEn: decision.title,
    issuerOrg: decision.issuerOrg,
    issuerOrgAr: decision.issuerOrgAr,
    bodyAr,
    bodyEn,
    linkedAuthorities: links.map((l) => ({
      titleAr: l.titleAr,
      titleEn: l.titleEn,
      linkType: l.linkType,
      authorityClass: l.authorityClass,
      linkedEntityRef: l.linkedEntityRef,
    })),
    ragContext,
  });

  // ── Repair helper: close open brackets left by a truncated response ─────────
  function repairTruncatedJson(text: string): string | null {
    try {
      const stack: string[] = [];
      let inString = false;
      let escaped   = false;
      for (const ch of text) {
        if (escaped)            { escaped = false; continue; }
        if (ch === "\\" && inString) { escaped = true; continue; }
        if (ch === '"')         { inString = !inString; continue; }
        if (inString)           continue;
        if (ch === "{" || ch === "[") { stack.push(ch === "{" ? "}" : "]"); }
        else if (ch === "}" || ch === "]") { if (stack.length) stack.pop(); }
      }
      if (stack.length === 0) return null; // nothing to repair
      // Close all open containers in reverse, then parse test
      const repaired = text + stack.reverse().join("");
      JSON.parse(repaired); // validate
      return repaired;
    } catch { return null; }
  }

  let brief: AdminDecisionBriefData;
  try {
    const aiResult = await provider.complete({
      taskType: TaskType.RAG,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 16000,
    });

    const stripped = aiResult.text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    // Try direct parse first, then attempt truncation repair before giving up
    let parseResult = parseModelJson<Record<string, unknown>>(stripped);
    if (!parseResult.ok) {
      const repaired = repairTruncatedJson(stripped.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim());
      if (repaired) {
        req.log.warn("ADKG: repaired truncated JSON response");
        parseResult = parseModelJson<Record<string, unknown>>(repaired);
      }
    }
    const cleaned = stripped; // kept for compat
    if (!parseResult.ok) {
      req.log.error({ rawLen: stripped.length }, "Failed to parse ADKG pillar analysis JSON after repair attempt");
      res.status(500).json({ error: "Failed to parse AI response. Please try again." });
      return;
    }

    const validationError = validateAdminBrief(parseResult.data);
    if (validationError) {
      req.log.warn({ validationError }, "ADKG pillar analysis failed validation");
      res.status(422).json({ error: "AI response incomplete. Please try again.", detail: validationError });
      return;
    }

    brief = parseResult.data as unknown as AdminDecisionBriefData;
  } catch (err) {
    req.log.error({ err }, "ADKG pillar analysis AI call failed");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
    return;
  }

  // Compute scores from the 16 pillars
  const dims: Record<string, DimensionResult> = {
    jurisdiction: brief.jurisdiction,
    competence: brief.competence,
    form: brief.form,
    cause: brief.cause,
    subjectMatter: brief.subjectMatter,
    purpose: brief.purpose,
    humanWill: brief.humanWill,
    digitalWillFormation: brief.digitalWillFormation,
    algorithmicWeight: brief.algorithmicWeight,
    algorithmicBias: brief.algorithmicBias,
    explainability: brief.explainability,
    humanOversight: brief.humanOversight,
    judicialReviewReadiness: brief.judicialReviewReadiness,
    proportionality: brief.proportionality,
    transparency: brief.transparency,
    accountability: brief.accountability,
  };

  const legalityScore = computeLegalityScore(dims);
  const riskScore = computeRiskScore(dims, "medium", legalityScore);

  // Upsert pillarAnalysis into metadata (citedAuthorities remains an array for export compatibility)
  const existingMetadata = parseJson<Record<string, unknown>>(decision.metadata, {});
  const updatedMetadata = {
    ...existingMetadata,
    pillarAnalysis: {
      ...brief,
      legalityScore,
      riskScore,
      analyzedAt: new Date().toISOString(),
      decisionId,
    },
  };

  await db
    .update(adkgDecisionsTable)
    .set({ metadata: JSON.stringify(updatedMetadata), updatedAt: new Date() })
    .where(eq(adkgDecisionsTable.id, decisionId));

  await logAudit(req, "adkg.decision.analyze", { details: { decisionId, legalityScore, riskScore } });
  res.json({ ok: true, legalityScore, riskScore, analysis: updatedMetadata.pillarAnalysis });
});

/**
 * GET /adkg/decisions/:id/analyze
 * Returns the stored pillar analysis result from citedAuthorities.pillarAnalysis.
 */
router.get("/adkg/decisions/:id/analyze", async (req: Request, res: Response): Promise<void> => {
  const userId     = getUserId(req);
  const decisionId = parseInt(String(req.params.id), 10);

  const [decision] = await db
    .select({ metadata: adkgDecisionsTable.metadata })
    .from(adkgDecisionsTable)
    .where(and(eq(adkgDecisionsTable.id, decisionId), eq(adkgDecisionsTable.ownerId, userId)))
    .limit(1);

  if (!decision) { res.status(404).json({ error: "Decision not found" }); return; }

  const meta = parseJson<Record<string, unknown>>(decision.metadata, {});
  const analysis = meta.pillarAnalysis ?? null;

  res.json({ analysis });
});

export default router;
