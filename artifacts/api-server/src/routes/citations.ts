/**
 * Citations routes
 * POST /citations/generate — generate citation in multiple formats + log to history
 * GET  /citations/history  — list user's citation history
 * POST /citations          — (legacy) Harvard-only citation from documentId
 */
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, documentsTable, legalSourcesTable, citationsLogTable } from "@workspace/db";
import { requireAnyRole, requireWriteRole } from "../middlewares/roleAuth";
import { getUserId } from "../lib/route-helpers";

const router: IRouter = Router();

function formatHarvard(title: string, author: string, year: number, publisher: string, url?: string): string {
  let c = `${author} (${year}) '${title}'`;
  if (publisher && publisher !== "Unknown Publisher") c += `, ${publisher}`;
  c += ".";
  if (url) c += ` Available at: ${url} (Accessed: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}).`;
  return c;
}

function formatApa(title: string, author: string, year: number, publisher: string, url?: string): string {
  let c = `${author}. (${year}). ${title}.`;
  if (publisher && publisher !== "Unknown Publisher") c += ` ${publisher}.`;
  if (url) c += ` ${url}`;
  return c;
}

function formatUaeGov(title: string, referenceNumber: string, year: number, jurisdiction: string): string {
  return `${title}${referenceNumber ? `، رقم ${referenceNumber}،` : ""} سنة ${year}، ${jurisdiction}`;
}

// POST /citations/generate
router.post("/citations/generate", requireWriteRole, async (req, res): Promise<void> => {
  const { sourceType = "document", sourceId, authorName, publicationYear, publisher, url } = req.body;
  const uid = getUserId(req);

  let title = "";
  let referenceNumber = "";
  let jurisdiction = "";
  let defaultYear = new Date().getFullYear();

  if (sourceType === "document" && sourceId) {
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, parseInt(sourceId)));
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    title = doc.originalName.replace(/\.[^.]+$/, "");
    defaultYear = doc.uploadedAt ? new Date(doc.uploadedAt).getFullYear() : defaultYear;
  } else if (sourceType === "legal_source" && sourceId) {
    const [src] = await db.select().from(legalSourcesTable).where(eq(legalSourcesTable.id, parseInt(sourceId)));
    if (!src) { res.status(404).json({ error: "Legal source not found" }); return; }
    title = src.title;
    referenceNumber = src.referenceNumber ?? "";
    jurisdiction = src.jurisdiction;
    if (src.year) defaultYear = src.year;
  } else if (sourceType === "manual") {
    title = req.body.title ?? "Untitled";
  } else {
    res.status(400).json({ error: "sourceType must be document | legal_source | manual" });
    return;
  }

  const year = publicationYear ? parseInt(publicationYear) : defaultYear;
  const author = authorName ?? "Unknown Author";
  const pub = publisher ?? "Unknown Publisher";

  const harvard = formatHarvard(title, author, year, pub, url);
  const apa = formatApa(title, author, year, pub, url);
  const uaeGov = formatUaeGov(title, referenceNumber, year, jurisdiction || "الإمارات العربية المتحدة");

  // Log to history (fire-and-forget)
  db.insert(citationsLogTable).values({
    userId: uid,
    sourceType,
    sourceId: sourceId ? parseInt(sourceId) : undefined,
    rawText: title,
    harvard,
    apa,
    uaeGov,
  }).catch(() => {});

  res.json({ harvard, apa, uaeGov, title, year, author });
});

// Legacy: POST /citations
router.post("/citations", requireWriteRole, async (req, res): Promise<void> => {
  const { documentId, authorName, publicationYear, publisher, url } = req.body;
  if (!documentId) { res.status(400).json({ error: "documentId required" }); return; }

  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, documentId));
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  const year = publicationYear || new Date().getFullYear();
  const author = authorName || "Unknown Author";
  const pub = publisher || "Unknown Publisher";
  const title = doc.originalName.replace(/\.[^.]+$/, "");

  let citation = `${author} (${year}) '${title}'`;
  if (pub !== "Unknown Publisher") citation += `, ${pub}`;
  citation += ".";
  if (url) citation += ` Available at: ${url} (Accessed: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}).`;

  res.json({ citation, format: "Harvard" });
});

// GET /citations/history
router.get("/citations/history", requireAnyRole, async (req, res): Promise<void> => {
  const uid = getUserId(req);
  const items = await db.select().from(citationsLogTable).where(eq(citationsLogTable.userId, uid)).orderBy(desc(citationsLogTable.createdAt)).limit(50);
  res.json({ items });
});

export default router;
