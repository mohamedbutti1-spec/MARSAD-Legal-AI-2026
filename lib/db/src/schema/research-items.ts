// Phase 57 — Legal Research Workspace: Items
// item_type values: question | answer | authority | document | note | highlight | bookmark | timeline_entry
import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { researchProjectsTable } from "./research-projects.js";

export const RESEARCH_ITEM_TYPES = [
  "question",
  "answer",
  "authority",
  "document",
  "note",
  "highlight",
  "bookmark",
  "timeline_entry",
] as const;

export type ResearchItemType = (typeof RESEARCH_ITEM_TYPES)[number];

export const researchItemsTable = pgTable("research_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => researchProjectsTable.id, { onDelete: "cascade" }),
  folderId: integer("folder_id"), // null = project root (no FK — self-referential via research_folders)
  itemType: varchar("item_type", { length: 30 }).notNull(), // ResearchItemType
  title: text("title").notNull(),
  content: text("content").notNull().default("{}"),    // JSON string — type-specific payload
  metadata: text("metadata").notNull().default("{}"),  // JSON string — tags, colour, priority, etc.
  versionNumber: integer("version_number").notNull().default(1),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResearchItem = typeof researchItemsTable.$inferSelect;
export type InsertResearchItem = typeof researchItemsTable.$inferInsert;
