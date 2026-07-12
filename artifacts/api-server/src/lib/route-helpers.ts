/**
 * Shared route helpers — imported by every domain route file.
 *
 * getUserId        — reads from req.user (set by JWT authenticate middleware).
 *                    Returns -1 when absent so ownership queries return 0 rows
 *                    instead of accidentally matching another user's data.
 * getValidatedRole — reads from req.user.role, defaults to "citizen" when absent.
 *
 * SECURITY: These helpers NEVER read X-User-Role or X-User-Id headers.
 * The only authoritative source of identity is the verified JWT payload.
 */
import type { Request } from "express";
import { ALL_ROLES } from "@workspace/db/permissions";

/**
 * Extract the numeric user id from the verified JWT payload.
 * Returns -1 (an impossible DB primary-key value) when unauthenticated,
 * so ownership WHERE clauses silently return no rows.
 */
export function getUserId(req: Request): number {
  return req.user?.userId ?? -1;
}

/**
 * Extract and validate the user role from the verified JWT payload.
 * Returns "citizen" when absent or unrecognised.
 */
export function getValidatedRole(req: Request): string {
  const role = req.user?.role;
  if (!role || !ALL_ROLES.includes(role as never)) return "citizen";
  return role;
}

/**
 * Shared { role, userId, org } shape used by several route modules
 * (risk, cil, jdt, audit, admin-os) for scoping and audit-trail metadata.
 *
 * Reads exclusively from the verified JWT payload (req.user) — never from
 * X-User-Role / X-User-Id / X-User-Org headers, which are attacker-spoofable
 * and are stripped before this code runs (see middlewares/authenticate.ts).
 *
 * Returned as strings for backward compatibility with call sites that were
 * previously built around header values.
 */
export function getUserInfo(req: Request): { role: string; userId: string; org: string } {
  return {
    role: getValidatedRole(req),
    userId: String(req.user?.userId ?? "system"),
    org: req.user?.org ?? "",
  };
}
