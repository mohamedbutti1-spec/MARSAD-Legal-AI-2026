/**
 * Per-user session registry.
 *
 * A row is created on every login (password or guest). The authenticate
 * middleware touches last_seen_at on each request. When a user signs out of
 * other sessions, every row except the current sid is deleted, giving the UI
 * a live before/after view of what was ended.
 */
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userSessionsTable = pgTable("user_sessions", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  /** Stable identifier placed in the JWT `sid` claim — used to find this row */
  sid:         text("sid").notNull().unique(),
  /** User-Agent header trimmed to 300 chars */
  userAgent:   text("user_agent"),
  /** Client IP (X-Forwarded-For first hop or socket remoteAddress) */
  ip:          text("ip"),
  createdAt:   timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt:  timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  /**
   * Hard expiry matching the JWT lifetime (8 h from login). Rows past this
   * timestamp belong to dead tokens; the sessions list filters them out.
   */
  expiresAt:   timestamp("expires_at",   { withTimezone: true }).notNull(),
});

export type UserSession = typeof userSessionsTable.$inferSelect;
