import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { eq, like, and, type SQL } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import {
  ListDocumentsQueryParams,
  GetDocumentParams,
  DeleteDocumentParams,
} from "@workspace/api-zod";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";

const router: IRouter = Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".docx", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, and TXT files are allowed"));
    }
  },
});

function extractKeywords(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w)
    .join(", ");
}

// GET /documents
router.get("/documents", requireAnyRole, async (req, res): Promise<void> => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, type } = parsed.data;
  const conditions: SQL[] = [];
  if (search) {
    conditions.push(like(documentsTable.originalName, `%${search}%`));
  }
  if (type) {
    conditions.push(eq(documentsTable.fileType, type));
  }
  const docs = await db
    .select()
    .from(documentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(documentsTable.uploadedAt);
  res.json(docs);
});

// GET /documents/stats
router.get("/documents/stats", requireAnyRole, async (req, res): Promise<void> => {
  const docs = await db.select().from(documentsTable);
  const total = docs.length;
  const totalSize = docs.reduce((acc, d) => acc + d.fileSize, 0);
  const byTypeMap: Record<string, number> = {};
  for (const d of docs) {
    byTypeMap[d.fileType] = (byTypeMap[d.fileType] || 0) + 1;
  }
  const byType = Object.entries(byTypeMap).map(([type, count]) => ({ type, count }));
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentUploads = docs.filter((d) => new Date(d.uploadedAt) > oneDayAgo).length;
  res.json({ total, byType, totalSize, recentUploads });
});

// GET /documents/:id
router.get("/documents/:id", async (req, res): Promise<void> => {
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
  // Remove file from disk
  try {
    const filePath = path.join(uploadDir, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore file deletion errors
  }
  res.sendStatus(204);
});

// POST /documents/upload (multipart/form-data, not in spec — handled manually)
router.post("/documents/upload", requireSupervisorOrOwner, upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }

  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const uploadedById = req.body.uploadedById ? parseInt(req.body.uploadedById, 10) : null;

  let content: string | null = null;
  try {
    if (ext === "txt") {
      content = fs.readFileSync(file.path, "utf-8");
    }
    // For PDF and DOCX, content extraction would require additional libraries
    // We store null for now and extract on-demand
  } catch {
    // ignore
  }

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

  req.log.info({ docId: doc.id, filename: file.originalname }, "Document uploaded");
  res.status(201).json(doc);
});

export default router;
