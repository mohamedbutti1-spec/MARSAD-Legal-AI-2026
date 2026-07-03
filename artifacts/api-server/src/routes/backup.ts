import { Router, type IRouter } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { requireOwner } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";

const execAsync = promisify(exec);
const router: IRouter = Router();

const backupDir = path.join(process.cwd(), "backups");
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

// POST /backup — create a new DB backup (pg_dump)
router.post("/backup", requireOwner, async (req, res): Promise<void> => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    res.status(503).json({ error: "DATABASE_URL not configured." });
    return;
  }

  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
  const filePath = path.join(backupDir, filename);

  try {
    await execAsync(`pg_dump "${dbUrl}" -f "${filePath}" --no-owner --no-privileges`);

    const stat = fs.statSync(filePath);
    logAudit(req, "backup.create", { details: { filename, sizeBytes: stat.size } });
    req.log.info({ filename, sizeBytes: stat.size }, "Backup created");

    res.json({
      filename,
      sizeBytes: stat.size,
      downloadUrl: `/api/backup/download/${filename}`,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Backup failed");
    res.status(500).json({ error: "Backup failed. Ensure pg_dump is available." });
  }
});

// GET /backup — list available backups
router.get("/backup", requireOwner, async (_req, res): Promise<void> => {
  const files = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir).filter((f) => f.endsWith(".sql"))
    : [];

  const backups = files
    .map((f) => {
      const stat = fs.statSync(path.join(backupDir, f));
      return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ backups });
});

// GET /backup/download/:filename — download a backup file
router.get("/backup/download/:filename", requireOwner, (req, res): void => {
  const filename = String(req.params.filename || "");
  if (!/^backup-[\w\-.]+\.sql$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Backup file not found" });
    return;
  }
  res.setHeader("Content-Type", "application/sql");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

// DELETE /backup/:filename — delete a backup
router.delete("/backup/:filename", requireOwner, (req, res): void => {
  const filename = String(req.params.filename || "");
  if (!/^backup-[\w\-.]+\.sql$/.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(backupDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Backup file not found" });
    return;
  }
  fs.unlinkSync(filePath);
  res.sendStatus(204);
});

export default router;
