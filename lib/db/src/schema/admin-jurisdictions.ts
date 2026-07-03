import { pgTable, serial, varchar, text, json, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Jurisdiction registry for Al-Shamsi Administrative Decision OS.
 *
 * Each row represents a supported legal jurisdiction. Adding a new GCC
 * jurisdiction requires only: (a) a seed row here, (b) a prompt module
 * file in ai/jurisdictions/, (c) decision type seed data.
 * No core code changes needed.
 *
 * Active jurisdictions: uae, france
 * Inactive stubs: gcc_sa, gcc_qa, gcc_bh, gcc_kw, gcc_om
 */
export const adminJurisdictionsTable = pgTable("admin_jurisdictions", {
  id: serial("id").primaryKey(),
  /** Primary key used throughout the system: uae | france | gcc_sa | gcc_qa | gcc_bh | gcc_kw | gcc_om */
  jurisdictionKey: varchar("jurisdiction_key", { length: 30 }).notNull().unique(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  /** civil | common | mixed | islamic */
  legalSystem: varchar("legal_system", { length: 20 }).notNull().default("civil"),
  /** Primary legislation governing administrative decisions in this jurisdiction */
  primaryLaws: json("primary_laws").$type<JurisdictionLaw[]>().notNull().default([]),
  /**
   * Prompt module key — the file in ai/jurisdictions/ that provides
   * buildJurisdictionContext() for this jurisdiction.
   * Set to "" for inactive stubs.
   */
  promptModule: text("prompt_module").notNull().default(""),
  /** Only active jurisdictions appear in the frontend selector */
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface JurisdictionLaw {
  nameAr: string;
  nameEn: string;
  referenceNumber: string;
  effectiveYear?: number;
  url?: string;
}

export type AdminJurisdiction = typeof adminJurisdictionsTable.$inferSelect;
