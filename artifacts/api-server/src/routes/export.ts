import { Router, type IRouter } from "express";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { db, documentsTable, comparisonsTable } from "@workspace/db";
import { ExportDataBody } from "@workspace/api-zod";
import { requireSupervisorOrOwner } from "../middlewares/roleAuth";

const router: IRouter = Router();
const exportDir = path.join(process.cwd(), "exports");
if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

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
    let docs = await db.select().from(documentsTable);
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
    let comps = await db.select().from(comparisonsTable);
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

  req.log.info({ filename, type }, "Export generated");

  // Return JSON as per OpenAPI spec — client fetches /api/export/download/:filename
  res.json({
    downloadUrl: `/api/export/download/${filename}`,
    filename,
    generatedAt: new Date().toISOString(),
  });
});

// GET /export/download/:filename — serve the actual XLSX file
router.get("/export/download/:filename", (req, res): void => {
  const { filename } = req.params;
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
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

export default router;
