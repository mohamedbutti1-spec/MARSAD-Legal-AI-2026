/**
 * Production RBAC migration — creates roles/permissions/role_permissions/
 * user_roles tables (additive, all IF NOT EXISTS) and the users.auth_provider
 * column. Called at server startup from seed.ts, after migrateAuth().
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger.js";

export async function migrateRbac(): Promise<void> {
  logger.info("Running Production RBAC migration…");

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password'`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS roles (
      id            SERIAL PRIMARY KEY,
      key           TEXT NOT NULL UNIQUE,
      label_ar      TEXT NOT NULL,
      label_en      TEXT NOT NULL,
      tier          TEXT NOT NULL,
      is_governance BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS permissions (
      id          SERIAL PRIMARY KEY,
      key         TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id            SERIAL PRIMARY KEY,
      role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      allowed       BOOLEAN NOT NULL DEFAULT FALSE,
      CONSTRAINT role_permissions_role_perm_uix UNIQUE (role_id, permission_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id    INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_roles_user_role_uix UNIQUE (user_id, role_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS user_roles_user_idx ON user_roles (user_id)`);

  logger.info("Production RBAC migration complete");
}
