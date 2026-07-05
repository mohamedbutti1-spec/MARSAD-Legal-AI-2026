// Phase 58 — Administrative Decision Knowledge Graph: Lifecycle Timeline Events
import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { adkgDecisionsTable } from "./adkg-decisions.js";

export const ADKG_EVENT_TYPES = [
  "draft",
  "issued",
  "challenged",
  "suspended",
  "amended",
  "revoked",
  "annulled",
  "executed",
  "appeal_filed",
  "appeal_dismissed",
  "appeal_upheld",
  "court_referral",
  "publication",
  "custom",
] as const;

export type AdkgEventType = (typeof ADKG_EVENT_TYPES)[number];

export const adkgTimelineEventsTable = pgTable("adkg_timeline_events", {
  id: serial("id").primaryKey(),

  decisionId: integer("decision_id")
    .notNull()
    .references(() => adkgDecisionsTable.id, { onDelete: "cascade" }),

  eventType: varchar("event_type", { length: 40 }).notNull(),
  // One of ADKG_EVENT_TYPES

  eventDate: text("event_date").notNull(),
  // ISO date string "YYYY-MM-DD"

  description:   text("description"),   // EN description
  descriptionAr: text("description_ar"), // AR description

  metadata: text("metadata").notNull().default("{}"),
  // JSON: e.g. { courtName, caseNumber, gazette, reference }

  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdkgTimelineEvent       = typeof adkgTimelineEventsTable.$inferSelect;
export type InsertAdkgTimelineEvent = typeof adkgTimelineEventsTable.$inferInsert;
