import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  email:        text("email").notNull().unique(),
  role:         text("role").notNull().default("viewer"),
  isActive:     boolean("is_active").notNull().default(true),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // ── Auth fields (v1.1 JWT hardening) ─────────────────────────────────────
  // Stored lowercase. Unique index enforced in DB (partial: WHERE username IS NOT NULL).
  username:        text("username").unique(),
  // bcrypt hash (10 rounds). NULL until the account has been provisioned.
  passwordHash:    text("password_hash"),
  // TRUE for seeded demo/test accounts. Logins are blocked in production.
  isDemo:          boolean("is_demo").notNull().default(false),
  // Bumped whenever demo passwords are rotated in seed.ts — triggers re-hash on next start.
  passwordVersion: integer("password_version").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id:           true,
  createdAt:    true,
  lastActiveAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
