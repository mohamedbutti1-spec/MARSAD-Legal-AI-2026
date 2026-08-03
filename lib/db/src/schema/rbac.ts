import { pgTable, serial, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Production RBAC — DB-backed roles/permissions.
 *
 * Replaces the hardcoded PERMISSIONS matrix (lib/db/src/permissions.ts) as
 * the source of truth. The matrix constants remain in permissions.ts as the
 * seed data (and as a pure, frontend-safe fallback) — rbac-service.ts seeds
 * these tables from that matrix on first boot, then loads role_permissions
 * into permissions.ts's in-memory cache on every boot.
 *
 * users.role stays as a fast-path denormalized column, kept in sync with
 * user_roles whenever a user's primary role changes (see rbac-service.ts).
 */

export const rolesTable = pgTable("roles", {
  id:          serial("id").primaryKey(),
  /** Stable machine key — matches UserRole in permissions.ts (e.g. "owner") */
  key:         text("key").notNull().unique(),
  labelAr:     text("label_ar").notNull(),
  labelEn:     text("label_en").notNull(),
  tier:        text("tier").notNull(),
  /** False for admin/professional_user — excluded from the governance lifecycle */
  isGovernance: boolean("is_governance").notNull().default(true),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissionsTable = pgTable("permissions", {
  id:          serial("id").primaryKey(),
  /** Matches a RolePermissions key (e.g. "canReadDecisionList") */
  key:         text("key").notNull().unique(),
  description: text("description"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    id:           serial("id").primaryKey(),
    roleId:       integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
    permissionId: integer("permission_id").notNull().references(() => permissionsTable.id, { onDelete: "cascade" }),
    allowed:      boolean("allowed").notNull().default(false),
  },
  (t) => [unique("role_permissions_role_perm_uix").on(t.roleId, t.permissionId)],
);

export const userRolesTable = pgTable(
  "user_roles",
  {
    id:        serial("id").primaryKey(),
    userId:    integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    roleId:    integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
    /** Every user has exactly one primary role today (single-role model); the
     *  table is many-to-many-shaped for future multi-role support. */
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_roles_user_role_uix").on(t.userId, t.roleId)],
);

export type Role                = typeof rolesTable.$inferSelect;
export type Permission          = typeof permissionsTable.$inferSelect;
export type RolePermissionRow   = typeof rolePermissionsTable.$inferSelect;
export type UserRoleRow         = typeof userRolesTable.$inferSelect;
