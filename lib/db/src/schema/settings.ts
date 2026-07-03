import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  maxUploadSizeMb: integer("max_upload_size_mb").notNull().default(50),
  allowedFileTypes: text("allowed_file_types").notNull().default("pdf,docx,txt"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  // Provider API keys — stored server-side only; never returned via the public API.
  claudeApiKey: text("claude_api_key"),
  perplexityApiKey: text("perplexity_api_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
