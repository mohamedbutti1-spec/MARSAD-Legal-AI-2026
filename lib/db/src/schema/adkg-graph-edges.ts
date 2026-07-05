// Phase 58 — Administrative Decision Knowledge Graph: Decision-to-Decision Graph Edges
// Explicit directional relationships between two ADKG decisions.
import { pgTable, text, serial, timestamp, integer, varchar, real } from "drizzle-orm/pg-core";
import { adkgDecisionsTable } from "./adkg-decisions.js";

export const ADKG_RELATIONSHIP_TYPES = [
  "amends",          // from amends to
  "challenged_by",   // from is challenged by to
  "suspended_by",    // from is suspended by to
  "revoked_by",      // from is revoked by to
  "annulled_by",     // from is annulled by to
  "executes",        // from executes/implements to (higher-level decision)
  "references",      // from references to (weaker cite)
  "replaces",        // from replaces to (supersedes)
  "implements",      // from implements to (regulation implementing legislation)
  "appeals",         // from appeals against to
] as const;

export type AdkgRelationshipType = (typeof ADKG_RELATIONSHIP_TYPES)[number];

export const adkgGraphEdgesTable = pgTable("adkg_graph_edges", {
  id: serial("id").primaryKey(),

  fromDecisionId: integer("from_decision_id")
    .notNull()
    .references(() => adkgDecisionsTable.id, { onDelete: "cascade" }),

  toDecisionId: integer("to_decision_id")
    .notNull()
    .references(() => adkgDecisionsTable.id, { onDelete: "cascade" }),

  relationshipType: varchar("relationship_type", { length: 30 }).notNull(),
  // One of ADKG_RELATIONSHIP_TYPES

  notes:      text("notes"),
  confidence: real("confidence"), // 0.0–1.0 if uncertain

  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdkgGraphEdge       = typeof adkgGraphEdgesTable.$inferSelect;
export type InsertAdkgGraphEdge = typeof adkgGraphEdgesTable.$inferInsert;
