// Phase 57 — Legal Research Workspace: Version History
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { researchItemsTable } from "./research-items.js";

export const researchItemVersionsTable = pgTable("research_item_versions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => researchItemsTable.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull().default("{}"),
  metadata: text("metadata").notNull().default("{}"),
  changedBy: integer("changed_by").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResearchItemVersion = typeof researchItemVersionsTable.$inferSelect;
export type InsertResearchItemVersion = typeof researchItemVersionsTable.$inferInsert;
