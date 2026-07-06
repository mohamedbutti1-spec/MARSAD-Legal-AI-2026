import type { Request, Response, NextFunction } from "express";
import { ALL_ROLES, getPermissions } from "@workspace/db/permissions";

export type UserRole = (typeof ALL_ROLES)[number];

/**
 * Reads the X-User-Role header sent by the frontend (stored in localStorage).
 * For a full production deployment, replace this with a verified JWT/session check.
 * Now supports all 14 roles (3 legacy + 11 governance).
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req.headers["x-user-role"] as string) || "viewer";
    if (!ALL_ROLES.includes(role as UserRole)) {
      res.status(401).json({ error: "Invalid or missing user role" });
      return;
    }
    if (!allowedRoles.includes(role as UserRole)) {
      res.status(403).json({ error: "Insufficient permissions for this action" });
      return;
    }
    next();
  };
}

/**
 * Permission-flag based middleware factory.
 * Usage: requirePermission('canReadAuditLog')
 */
export function requirePermission(flag: keyof ReturnType<typeof getPermissions>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req.headers["x-user-role"] as string) || "viewer";
    const perms = getPermissions(role);
    if (!perms[flag]) {
      res.status(403).json({ error: `Permission denied: ${flag} is not granted for role '${role}'` });
      return;
    }
    next();
  };
}

export const requireOwner             = requireRole("owner");
export const requireSupervisorOrOwner = requireRole("owner", "supervisor");

/**
 * requireAnyRole — any valid platform professional (13 roles, citizen excluded).
 * Use this as the baseline auth check for AI features, research tools,
 * and any route where data is already scoped by ownerId/userId.
 * Citizen users access the legal-os citizen portal; they are not granted
 * access to the internal research and decision-management features.
 */
export const requireAnyRole = requireRole(
  "owner", "supervisor", "viewer",
  "minister", "undersecretary", "assistant_undersecretary",
  "director_general", "department_director", "legal_department",
  "constitutional_reviewer", "internal_auditor", "external_auditor",
  "judge",
);

/**
 * requireGovernanceRead — alias for requireAnyRole.
 * Kept for backwards compatibility on governance routes.
 */
export const requireGovernanceRead = requireAnyRole;
