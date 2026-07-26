import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, like, and, type SQL, desc } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import {
  ListDocumentsQueryParams,
  GetDocumentParams,
  DeleteDocumentParams,
} from "@workspace/api-zod";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { cache, TTL } from "../lib/cache";

const router: IRouter = Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const MAX_UPLOAD_MB = 100;

/** Raised by the multer fileFilter for disallowed extensions; mapped to 400. */
class UnsupportedFileTypeError extends Error {
  constructor(ext: string) {
    super(`Unsupported file type: ${ext || "(none)"}`);
    this.name = "UnsupportedFileTypeError";
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".docx", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new UnsupportedFileTypeError(ext));
  },
});

/**
 * Runs multer's single-file handler and converts its failures into clear,
 * bilingual client errors. Previously these errors fell through to the global
 * error handler and surfaced as "Internal server error" (500) with no hint of
 * what went wrong — for user mistakes as ordinary as picking a .jpg or a file
 * over the size limit.
 */
function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof UnsupportedFileTypeError) {
      res.status(400).json({
        error: "نوع الملف غير مدعوم — الأنواع المسموح بها: PDF أو DOCX أو TXT. / Unsupported file type — allowed types: PDF, DOCX, or TXT.",
      });
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: `حجم الملف يتجاوز الحد الأقصى ${MAX_UPLOAD_MB} ميغابايت. / File exceeds the ${MAX_UPLOAD_MB} MB size limit.`,
      });
      return;
    }
    if (err instanceof multer.MulterError) {
      // Remaining multer codes (wrong field name, too many files, …) are
      // malformed requests, not server faults.
      res.status(400).json({
        error: `تعذّر استلام الملف: ${err.code}. / Could not accept the file: ${err.code}.`,
      });
      return;
    }
    next(err);
  });
}

function extractKeywords(text: string): string {
  // Stop words (Arabic + English)
  const stopWords = new Set([
    "the","and","or","is","in","of","to","a","an","that","it","for","on","are","was","with",
    "he","she","they","we","you","this","at","by","from","as","be","have","has","had",
    "not","but","if","do","so","can","up","out","what","which","who","all","were","been",
    "their","my","your","our","its","will","would","could","should","more","also","than",
    "ان","في","من","على","الى","مع","هذا","هذه","تلك","ذلك","قد","لا","كل","أن","هو","هي",
    "كان","كانت","التي","الذي","عن","ما","ولا","بين","حتى","إلى","لم","له","لها",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w]) => w)
    .join(", ");
}

async function extractContent(filePath: string, ext: string): Promise<string | null> {
  try {
    if (ext === "txt") {
      return fs.readFileSync(filePath, "utf-8");
    }
    if (ext === "pdf") {
      // Dynamically import to avoid startup overhead
      const pdfMod = await import("pdf-parse");
      const pdfParse = (pdfMod as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfMod;
      const buffer = fs.readFileSync(filePath);
      const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
      return data.text || null;
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || null;
    }
  } catch {
    /* Content extraction is best-effort */
  }
  return null;
}

// GET /documents
router.get("/documents", requireAnyRole, async (req, res): Promise<void> => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, type } = parsed.data;

  // Only cache when no filters applied
  if (!search && !type) {
    const cached = cache.get<unknown[]>("documents:all");
    if (cached) {
      res.json(cached);
      return;
    }
  }

  const conditions: SQL[] = [];
  if (search) conditions.push(like(documentsTable.originalName, `%${search}%`));
  if (type) conditions.push(eq(documentsTable.fileType, type));

  const docs = await db
    .select()
    .from(documentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(documentsTable.uploadedAt));

  if (!search && !type) cache.set("documents:all", docs, TTL.MED);
  res.json(docs);
});

// GET /documents/stats
router.get("/documents/stats", requireAnyRole, async (_req, res): Promise<void> => {
  const cached = cache.get<unknown>("documents:stats");
  if (cached) {
    res.json(cached);
    return;
  }

  const docs = await db.select().from(documentsTable);
  const total = docs.length;
  const totalSize = docs.reduce((acc, d) => acc + d.fileSize, 0);
  const byTypeMap: Record<string, number> = {};
  for (const d of docs) byTypeMap[d.fileType] = (byTypeMap[d.fileType] || 0) + 1;
  const byType = Object.entries(byTypeMap).map(([type, count]) => ({ type, count }));

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentUploads = docs.filter((d) => new Date(d.uploadedAt) > sevenDaysAgo).length;

  // Build upload activity for the last 30 days (for charts)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const uploadsByDay: Record<string, number> = {};
  for (const d of docs) {
    const day = new Date(d.uploadedAt).toISOString().split("T")[0];
    if (new Date(d.uploadedAt) >= thirtyDaysAgo) {
      uploadsByDay[day] = (uploadsByDay[day] || 0) + 1;
    }
  }

  const stats = { total, byType, totalSize, recentUploads, uploadsByDay };
  cache.set("documents:stats", stats, TTL.SHORT);
  res.json(stats);
});

// GET /documents/:id
router.get("/documents/:id", requireAnyRole, async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(doc);
});

// DELETE /documents/:id
router.delete("/documents/:id", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [doc] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, params.data.id))
    .returning();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  try {
    const filePath = path.join(uploadDir, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore file deletion errors */ }

  cache.delPattern("documents:");
  logAudit(req, "document.delete", { entityType: "document", entityId: doc.id, details: { filename: doc.originalName } });
  res.sendStatus(204);
});

// POST /documents/upload
router.post("/documents/upload", requireSupervisorOrOwner, uploadSingleFile, async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "لم يتم إرفاق أي ملف. / No file provided." });
    return;
  }

  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const uploadedById = req.body.uploadedById ? parseInt(req.body.uploadedById, 10) : null;

  // Real content extraction for all supported types
  const content = await extractContent(file.path, ext);
  const keywords = content ? extractKeywords(content) : null;

  const [doc] = await db
    .insert(documentsTable)
    .values({
      filename: file.filename,
      originalName: file.originalname,
      fileType: ext,
      fileSize: file.size,
      content,
      keywords,
      uploadedById,
    })
    .returning();

  cache.delPattern("documents:");
  logAudit(req, "document.upload", {
    entityType: "document",
    entityId: doc.id,
    details: { filename: file.originalname, fileType: ext, sizeBytes: file.size },
  });
  req.log.info({ docId: doc.id, filename: file.originalname, ext, contentLength: content?.length }, "Document uploaded");
  res.status(201).json(doc);
});

export default router;
