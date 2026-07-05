// Phase 57 — Legal Research Workspace: Projects
import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";

export const researchProjectsTable = pgTable("research_projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: integer("owner_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | archived
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResearchProject = typeof researchProjectsTable.$inferSelect;
export type InsertResearchProject = typeof researchProjectsTable.$inferInsert;
