// Phase 58 — Administrative Decision Knowledge Graph: Core Decision Record
import {
  pgTable, text, serial, timestamp, integer, varchar, real,
} from "drizzle-orm/pg-core";

export const ADKG_STATUSES = [
  "draft", "issued", "challenged", "suspended",
  "amended", "revoked", "annulled", "executed",
] as const;

export type AdkgStatus = (typeof ADKG_STATUSES)[number];

export const adkgDecisionsTable = pgTable("adkg_decisions", {
  id: serial("id").primaryKey(),

  // ── Identity ──────────────────────────────────────────────────────────────
  decisionNumber: text("decision_number").notNull(),
  // Unique reference such as "QR-2024-001" or "وزاري-2024-15"

  title:    text("title").notNull(),    // English title
  titleAr:  text("title_ar").notNull(), // Arabic title (authoritative)

  issuerOrg:   text("issuer_org"),    // Issuing organisation (EN)
  issuerOrgAr: text("issuer_org_ar"), // Issuing organisation (AR)

  subject:   text("subject"),    // Subject / scope (EN)
  subjectAr: text("subject_ar"), // Subject / scope (AR)

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  // One of ADKG_STATUSES

  issuedDate:    text("issued_date"),    // ISO date string — date of issuance
  effectiveDate: text("effective_date"), // ISO date string — date of effect
  expiryDate:    text("expiry_date"),    // ISO date string — if applicable

  // ── Content ───────────────────────────────────────────────────────────────
  content:   text("content").notNull().default("{}"),
  // JSON: { body?: string, bodyAr?: string, articles?: [{num, text, textAr}] }

  metadata:  text("metadata").notNull().default("{}"),
  // JSON: free-form key/value pairs (tags, categories, etc.)

  // ── Provenance (Phase 56 verification artefacts) ──────────────────────────
  citedAuthorities:   text("cited_authorities").notNull().default("[]"),
  verificationReport: text("verification_report").notNull().default("{}"),
  confidenceLevel:    real("confidence_level"),

  // ── Ownership ─────────────────────────────────────────────────────────────
  ownerId: integer("owner_id").notNull(),

  // ── Timestamps ────────────────────────────────────────────────────────────
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdkgDecision       = typeof adkgDecisionsTable.$inferSelect;
export type InsertAdkgDecision = typeof adkgDecisionsTable.$inferInsert;
