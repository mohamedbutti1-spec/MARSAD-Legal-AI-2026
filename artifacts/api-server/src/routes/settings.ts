import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { requireOwner, requireAnyRole } from "../middlewares/roleAuth";
import { logAudit } from "../middlewares/auditLog";
import { cache, TTL } from "../lib/cache";
import { invalidateKeyCache, getKeyStatus } from "../ai";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/**
 * Strip secret key values before sending settings to the browser.
 * Only boolean availability flags are exposed — never the actual keys.
 */
function sanitizeForClient(
  row: typeof settingsTable.$inferSelect,
  keyStatus: Record<string, boolean>,
) {
  const { claudeApiKey: _c, perplexityApiKey: _p, ...safe } = row;
  return { ...safe, ...keyStatus };
}

// ─── GET /settings ────────────────────────────────────────────────────────────

router.get("/settings", requireAnyRole, async (_req, res): Promise<void> => {
  const cached = cache.get<unknown>("settings");
  if (cached) { res.json(cached); return; }

  const [settings, keyStatus] = await Promise.all([ensureSettings(), getKeyStatus()]);
  const payload = sanitizeForClient(settings, keyStatus);
  cache.set("settings", payload, TTL.LONG);
  res.json(payload);
});

// ─── PATCH /settings ─────────────────────────────────────────────────────────

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
    .where(eq(settingsTable.id, current.id))
    .returning();
  cache.del("settings");
  logAudit(req, "settings.update", { entityType: "settings", entityId: current.id, details: parsed.data });

  const keyStatus = await getKeyStatus();
  res.json(sanitizeForClient(updated, keyStatus));
});

// ─── PATCH /settings/api-keys ─────────────────────────────────────────────────
//
// Accepts partial key updates. Each field is optional — omitting a key leaves
// the existing stored value unchanged. Sending an empty string clears the key.
// Keys are stored server-side only; they are NEVER returned in any response.

/** Validate and parse the api-keys PATCH body without a Zod dependency. */
function parseApiKeysBody(
  body: unknown,
): { ok: true; data: { claudeApiKey?: string; perplexityApiKey?: string } } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Body must be an object" };
  const allowed = new Set(["claudeApiKey", "perplexityApiKey"]);
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (!allowed.has(key)) return { ok: false, error: `Unknown field: ${key}` };
  }
  const b = body as Record<string, unknown>;
  const data: { claudeApiKey?: string; perplexityApiKey?: string } = {};
  if ("claudeApiKey" in b) {
    if (typeof b.claudeApiKey !== "string") return { ok: false, error: "claudeApiKey must be a string" };
    data.claudeApiKey = b.claudeApiKey;
  }
  if ("perplexityApiKey" in b) {
    if (typeof b.perplexityApiKey !== "string") return { ok: false, error: "perplexityApiKey must be a string" };
    data.perplexityApiKey = b.perplexityApiKey;
  }
  return { ok: true, data };
}

router.patch("/settings/api-keys", requireOwner, async (req, res): Promise<void> => {
  const parsed = parseApiKeysBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const current = await ensureSettings();
  const updates: Partial<typeof settingsTable.$inferSelect> = {};

  if (parsed.data.claudeApiKey !== undefined) {
    updates.claudeApiKey = parsed.data.claudeApiKey || null;
    invalidateKeyCache("claude");
  }
  if (parsed.data.perplexityApiKey !== undefined) {
    updates.perplexityApiKey = parsed.data.perplexityApiKey || null;
    invalidateKeyCache("perplexity");
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No keys provided to update." });
    return;
  }

  await db.update(settingsTable).set(updates).where(eq(settingsTable.id, current.id));
  cache.del("settings");
  logAudit(req, "settings.api-keys.update", {
    entityType: "settings",
    entityId: current.id,
    details: {
      updatedProviders: Object.keys(updates).map((k) =>
        k === "claudeApiKey" ? "claude" : k === "perplexityApiKey" ? "perplexity" : k,
      ),
    },
  });

  // Respond with the updated availability flags — never the actual key values.
  const keyStatus = await getKeyStatus();
  res.json({ message: "API keys updated successfully.", keyStatus });
});

export default router;
