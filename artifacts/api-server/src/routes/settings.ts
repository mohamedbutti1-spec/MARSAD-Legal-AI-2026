import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { requireOwner, requireAnyRole } from "../middlewares/roleAuth";

const router: IRouter = Router();

async function ensureSettings() {
  const [existing] = await db.select().from(settingsTable);
  if (!existing) {
    const [settings] = await db.insert(settingsTable).values({}).returning();
    return settings;
  }
  return existing;
}

// GET /settings
router.get("/settings", requireAnyRole, async (_req, res): Promise<void> => {
  const settings = await ensureSettings();
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
  const [settings] = await db
    .update(settingsTable)
    .set(parsed.data)
    .returning();
  if (!settings) {
    res.status(500).json({ error: "Failed to update settings" });
    return;
  }
  res.json(settings);
});

export default router;
