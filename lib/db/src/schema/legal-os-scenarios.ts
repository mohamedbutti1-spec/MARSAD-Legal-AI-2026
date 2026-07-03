import { pgTable, text, serial, timestamp, integer, json, varchar, boolean } from "drizzle-orm/pg-core";

/**
 * Admin-created Legal OS roles (extend the hardcoded ROLES catalog).
 * roleKey must be unique and cannot clash with the built-in role IDs.
 */
export const legalOsCustomRolesTable = pgTable("legal_os_custom_roles", {
  id: serial("id").primaryKey(),
  roleKey: varchar("role_key", { length: 80 }).notNull().unique(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull().default(""),
  icon: varchar("icon", { length: 60 }).notNull().default("UserCircle"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LegalOsCustomRole = typeof legalOsCustomRolesTable.$inferSelect;
export type NewLegalOsCustomRole = typeof legalOsCustomRolesTable.$inferInsert;

/**
 * Admin-created scenarios, including their full question tree stored as JSON.
 * roleKey references either a legalOsCustomRolesTable row or a built-in role id.
 */
export const legalOsCustomScenariosTable = pgTable("legal_os_custom_scenarios", {
  id: serial("id").primaryKey(),
  /** Stable slug, unique globally */
  scenarioKey: varchar("scenario_key", { length: 120 }).notNull().unique(),
  /** roleKey from legalOsCustomRolesTable OR a built-in role id */
  roleKey: varchar("role_key", { length: 80 }).notNull(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull().default(""),
  /** JSON string[] */
  jurisdictions: json("jurisdictions").$type<string[]>().notNull().default([]),
  estimatedMinutes: integer("estimated_minutes").notNull().default(5),
  /**
   * Full question tree — array of QuestionNode objects (same shape as the
   * hardcoded catalog: id, questionAr, questionEn, hintAr?, answerType,
   * options?, placeholder?, unit?)
   */
  questions: json("questions").$type<QuestionNodeJson[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LegalOsCustomScenario = typeof legalOsCustomScenariosTable.$inferSelect;
export type NewLegalOsCustomScenario = typeof legalOsCustomScenariosTable.$inferInsert;

// ─── Mirrored types (kept in the schema file so DB + API share them) ─────────

export interface QuestionOptionJson {
  value: string;
  labelAr: string;
  labelEn: string;
}

export type AnswerTypeJson = "chips" | "yes-no" | "text" | "number";

export interface QuestionNodeJson {
  id: string;
  questionAr: string;
  questionEn: string;
  hintAr?: string;
  answerType: AnswerTypeJson;
  options?: QuestionOptionJson[];
  placeholder?: string;
  unit?: string;
}
