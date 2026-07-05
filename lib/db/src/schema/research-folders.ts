// Phase 57 — Legal Research Workspace: Folders
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { researchProjectsTable } from "./research-projects.js";

export const researchFoldersTable = pgTable("research_folders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => researchProjectsTable.id, { onDelete: "cascade" }),
  parentFolderId: integer("parent_folder_id"), // null = root level
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResearchFolder = typeof researchFoldersTable.$inferSelect;
export type InsertResearchFolder = typeof researchFoldersTable.$inferInsert;
