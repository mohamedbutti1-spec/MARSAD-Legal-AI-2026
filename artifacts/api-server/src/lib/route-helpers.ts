/**
 * Shared route helpers — imported by every domain route file.
 *
 * getUserId        — reads x-user-id header; returns -1 when absent/invalid so
 *                    ownership queries return 0 rows instead of accidentally
 *                    matching another user's data.
 * getValidatedRole — reads x-user-role header, validates against ALL_ROLES,
 *                    and defaults to "citizen" when absent or unrecognised.
 */

import type { Request } from "express";
import { ALL_ROLES } from "@workspace/db/permissions";

/**
 * Extract the numeric user id from the x-user-id request header.
 * Returns -1 (an impossible DB primary-key value) on missing/non-numeric
 * input so that ownership WHERE clauses silently return no rows.
 */
export function getUserId(req: Request): number {
  const h = req.headers["x-user-id"];
  const v = Array.isArray(h) ? h[0] : h;
  if (!v) return -1;
  const id = parseInt(v, 10);
  return Number.isFinite(id) ? id : -1;
}

/**
 * Extract and validate the user role from the x-user-role request header.
 * Returns "citizen" when the header is absent or contains an unrecognised role.
 * Used by routes that pass the role to getPermissions().
 */
export function getValidatedRole(req: Request): string {
  const h = req.headers["x-user-role"];
  const r = (Array.isArray(h) ? h[0] : h) ?? "citizen";
  return ALL_ROLES.includes(r as never) ? r : "citizen";
}
