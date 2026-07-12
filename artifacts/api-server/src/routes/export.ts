import { Router, type IRouter } from "express";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { db, documentsTable, comparisonsTable } from "@workspace/db";
import { ExportDataBody } from "@workspace/api-zod";
import { requireAnyRole, requireSupervisorOrOwner } from "../middlewares/roleAuth";
import { getUserId, getValidatedRole } from "../lib/route-helpers";

const router: IRouter = Router();
const exportDir = path.join(process.cwd(), "exports");
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

/** Max rows per sheet — bounds memory/CPU on a single export request. */
const MAX_EXPORT_ROWS = 5000;

interface ExportOwnership {
  ownerId: number;
  ownerRole: string;
  createdAt: string;
}

function metaPath(filePath: string): string {
  return `${filePath}.meta.json`;
}

function writeExportOwnership(filePath: string, ownership: ExportOwnership): void {
  fs.writeFileSync(metaPath(filePath), JSON.stringify(ownership), "utf-8");
}

function readExportOwnership(filePath: string): ExportOwnership | null {
  try {
    const raw = fs.readFileSync(metaPath(filePath), "utf-8");
    return JSON.parse(raw) as ExportOwnership;
  } catch {
    return null;
  }
}

// POST /export — returns JSON with a download URL pointing to /api/export/download/:filename
router.post("/export", requireSupervisorOrOwner, async (req, res): Promise<void> => {
  const parsed = ExportDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, documentIds, comparisonIds } = parsed.data;
  const wb = XLSX.utils.book_new();

  if (type === "documents" || type === "all") {
    let docs = await db.select().from(documentsTable).limit(MAX_EXPORT_ROWS);
    if (documentIds && documentIds.length > 0) {
      docs = docs.filter((d) => documentIds.includes(d.id));
    }
    const rows = docs.map((d) => ({
      ID: d.id,
      "File Name": d.originalName,
      "File Type": d.fileType.toUpperCase(),
      "Size (KB)": Math.round(d.fileSize / 1024),
      Keywords: d.keywords || "",
      "Uploaded At": new Date(d.uploadedAt).toLocaleDateString("ar-AE"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Documents");
  }

  if (type === "comparisons" || type === "all") {
    let comps = await db.select().from(comparisonsTable).limit(MAX_EXPORT_ROWS);
    if (comparisonIds && comparisonIds.length > 0) {
      comps = comps.filter((c) => comparisonIds.includes(c.id));
    }
    const rows = comps.map((c) => ({
      ID: c.id,
      Title: c.title,
      Description: c.description || "",
      "Created At": new Date(c.createdAt).toLocaleDateString("ar-AE"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Comparisons");
  }

  const filename = `export-${Date.now()}.xlsx`;
  const filePath = path.join(exportDir, filename);
  XLSX.writeFile(wb, filePath);
  writeExportOwnership(filePath, {
    ownerId: getUserId(req),
    ownerRole: getValidatedRole(req),
    createdAt: new Date().toISOString(),
  });

  req.log.info({ filename, type }, "Export generated");

  // Return JSON as per OpenAPI spec — client fetches /api/export/download/:filename
  res.json({
    downloadUrl: `/api/export/download/${filename}`,
    filename,
    generatedAt: new Date().toISOString(),
  });
});

// GET /export/download/:filename — serve the actual XLSX file
// Ownership-gated: only the user who generated the export, or an owner-role
// account, may download it. No reliance on filename secrecy.
router.get("/export/download/:filename", requireAnyRole, (req, res): void => {
  const filename = String(req.params.filename);
  // Sanitize: only allow alphanumeric, dash, dot
  if (!/^[a-zA-Z0-9\-_.]+\.xlsx$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(exportDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Export file not found" });
    return;
  }

  // Fail closed: an export with no ownership sidecar (e.g. generated before
  // this check existed) cannot be attributed to a user, so it is not served.
  const ownership = readExportOwnership(filePath);
  if (!ownership) {
    res.status(404).json({ error: "Export file not found" });
    return;
  }

  const uid = getUserId(req);
  const role = getValidatedRole(req);
  const isOwnerOfFile = uid !== -1 && uid === ownership.ownerId;
  const isPlatformOwner = role === "owner";
  if (!isOwnerOfFile && !isPlatformOwner) {
    res.status(403).json({ error: "You do not have access to this export" });
    return;
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

export default router;
