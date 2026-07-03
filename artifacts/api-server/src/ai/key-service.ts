/**
 * Key resolution service.
 *
 * Priority order for each provider:
 *   1. Environment variable (Replit Secret — highest trust, never persisted to DB)
 *   2. DB-stored key (set via Platform Settings → API Providers)
 *
 * Keys are NEVER returned to the browser. The GET /settings endpoint only
 * exposes boolean flags (claudeKeySet, perplexityKeySet).
 */

import { db, settingsTable } from "@workspace/db";
import type { ProviderName } from "./tasks";

const ENV_KEYS: Record<ProviderName, string> = {
  claude:     "ANTHROPIC_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  openai:     "OPENAI_API_KEY",
};

/** Short-lived in-process cache (60 s) to avoid hammering the DB. */
const keyCache = new Map<ProviderName, { value: string | null; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 60_000;

/**
 * Resolve the API key for a given provider.
 * Returns null when no key is configured anywhere.
 */
export async function getProviderKey(provider: ProviderName): Promise<string | null> {
  // 1. Check environment variable (Replit Secret).
  const envKey = process.env[ENV_KEYS[provider]];
  if (envKey) return envKey;

  // 2. Check the in-process cache before hitting the DB.
  const cached = keyCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  // 3. Query the DB.
  const rows = await db.select().from(settingsTable);
  const row = rows[0];

  let dbKey: string | null = null;
  if (row) {
    if (provider === "claude") dbKey = row.claudeApiKey ?? null;
    if (provider === "perplexity") dbKey = row.perplexityApiKey ?? null;
  }

  keyCache.set(provider, { value: dbKey, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
  return dbKey;
}

/** Invalidate the in-process key cache (call after a key is saved to DB). */
export function invalidateKeyCache(provider?: ProviderName): void {
  if (provider) {
    keyCache.delete(provider);
  } else {
    keyCache.clear();
  }
}

/** Return boolean availability flags — safe to send to the browser. */
export async function getKeyStatus(): Promise<Record<ProviderName, boolean>> {
  const [claude, perplexity, openai] = await Promise.all([
    getProviderKey("claude"),
    getProviderKey("perplexity"),
    getProviderKey("openai"),
  ]);
  return {
    claude:     Boolean(claude),
    perplexity: Boolean(perplexity),
    openai:     Boolean(openai),
  };
}
