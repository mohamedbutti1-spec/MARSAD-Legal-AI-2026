/**
 * Jurisdiction Plugin System — Al-Shamsi Administrative Decision OS
 *
 * GCC EXPANSION FRAMEWORK
 * ─────────────────────────────────────────────────────────────────────────────
 * Adding a new GCC jurisdiction requires exactly three steps:
 *   1. Create a seed row in admin_jurisdictions table (see seed-admin-os-jurisdictions.ts)
 *   2. Create a prompt module file in this directory (e.g. sa.prompt.ts)
 *      that implements JurisdictionPlugin and exports it as default
 *   3. Add decision type seed data in admin-os-{key}-seed.ts
 *
 * No changes to routes, evaluator, or frontend are needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Plugin interface ──────────────────────────────────────────────────────────

export interface JurisdictionPluginParams {
  decisionTypeAr: string;
  decisionTypeEn: string;
  domain: string;
  role: string;
  answers: Record<string, string>;
  applicableLaws: Array<{ lawAr: string; referenceNumber: string; articles?: string[] }>;
}

/**
 * Each jurisdiction plugin must implement this interface.
 * The `buildJurisdictionContext` method returns a string injected
 * directly into the AI evaluator system prompt, providing jurisdiction-specific
 * legal framework context for all 12 Al-Shamsi dimensions.
 */
export interface JurisdictionPlugin {
  /** Must match the jurisdictionKey in admin_jurisdictions */
  jurisdictionKey: string;
  nameAr: string;
  nameEn: string;
  /** civil | common | mixed | islamic */
  legalSystem: string;
  /** Whether this plugin is production-ready (false for stubs) */
  active: boolean;

  /**
   * Build jurisdiction-specific context string for the AI evaluator prompt.
   * This replaces/supplements the UAE-default legal framework section.
   */
  buildJurisdictionContext(params: JurisdictionPluginParams): string;
}

// ─── Plugin registry ───────────────────────────────────────────────────────────

import uaePlugin from "./uae.prompt";
import francePlugin from "./france.prompt";
import saPlugin from "./sa.prompt";
import qaPlugin from "./qa.prompt";
import bhPlugin from "./bh.prompt";
import kwPlugin from "./kw.prompt";
import omPlugin from "./om.prompt";

const REGISTRY: Map<string, JurisdictionPlugin> = new Map([
  ["uae",     uaePlugin],
  ["france",  francePlugin],
  ["gcc_sa",  saPlugin],
  ["gcc_qa",  qaPlugin],
  ["gcc_bh",  bhPlugin],
  ["gcc_kw",  kwPlugin],
  ["gcc_om",  omPlugin],
]);

/**
 * Retrieve a jurisdiction plugin by key.
 * Returns undefined if the jurisdiction is not registered.
 */
export function getJurisdictionPlugin(key: string): JurisdictionPlugin | undefined {
  return REGISTRY.get(key);
}

/**
 * List all active (production-ready) jurisdiction plugins.
 */
export function listActiveJurisdictions(): JurisdictionPlugin[] {
  return Array.from(REGISTRY.values()).filter((p) => p.active);
}

/**
 * List all registered jurisdiction plugins (active + inactive stubs).
 */
export function listAllJurisdictions(): JurisdictionPlugin[] {
  return Array.from(REGISTRY.values());
}
