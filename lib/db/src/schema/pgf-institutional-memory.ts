import { pgTable, text, serial, timestamp, integer, varchar, index } from "drizzle-orm/pg-core";

/**
 * Professional Guidance Framework — Institutional Memory.
 *
 * Each row is a knowledge entry scoped to a specific (sector, profession, stage)
 * combination, organised by category. Up to 5 entries are shown per stage.
 */
export const pgfInstitutionalMemoryTable = pgTable(
  "pgf_institutional_memory",
  {
    id:           serial("id").primaryKey(),

    sectorId:     varchar("sector_id",     { length: 80 }).notNull(),
    professionId: varchar("profession_id", { length: 80 }).notNull(),
    stageId:      varchar("stage_id",      { length: 80 }).notNull(),

    title:        text("title").notNull(),
    content:      text("content").notNull(),

    /**
     * One of: expert_practice | frequent_mistake | lesson_learned |
     *         recommended_sequence | practical_tip |
     *         success_indicator | failure_indicator
     */
    category:    varchar("category",    { length: 40 }).notNull(),

    /** 0–100 confidence/quality score; entries shown in descending order */
    confidence:  integer("confidence").notNull().default(80),

    /**
     * Where the entry came from:
     *   institutional   — curated by the platform
     *   ai_generated    — drafted by AI and reviewed
     *   user_contributed — submitted by practitioners
     */
    sourceType:  varchar("source_type", { length: 40 }).notNull().default("institutional"),

    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("pgf_im_scope_idx").on(t.sectorId, t.professionId, t.stageId),
    index("pgf_im_confidence_idx").on(t.confidence),
  ],
);

export type PgfInstitutionalMemory       = typeof pgfInstitutionalMemoryTable.$inferSelect;
export type PgfInstitutionalMemoryInsert = typeof pgfInstitutionalMemoryTable.$inferInsert;
