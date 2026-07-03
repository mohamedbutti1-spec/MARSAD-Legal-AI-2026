import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { requireOwner, requireAnyRole } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { cache, TTL } from "../lib/cache";

const router: IRouter = Router();

async function ensureSettings() {
  const rows = await db.select().from(settingsTable);
  if (rows.length === 0) {
    const [row] = await db
      .insert(settingsTable)
      .values({ aiEnabled: true, maxUploadSizeMb: 50, allowedFileTypes: "pdf,docx,txt", maintenanceMode: false })
      .returning();
    return row;
  }
  return rows[0];
}

// GET /settings
router.get("/settings", requireAnyRole, async (_req, res): Promise<void> => {
  const cached = cache.get<unknown>("settings");
  if (cached) { res.json(cached); return; }
  const settings = await ensureSettings();
  cache.set("settings", settings, TTL.LONG);
  res.json(settings);
});

// PATCH /settings
router.patch("/settings", requireOwner, async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await ensureSettings();
  const [updated] = await db
    .update(settingsTable)
    .set(parsed.data)
    .returning();
  cache.del("settings");
  logAudit(req, "settings.update", { entityType: "settings", entityId: current.id, details: parsed.data });
  res.json(updated);
});

export default router;
