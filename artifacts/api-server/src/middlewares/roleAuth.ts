/**
 * Role-based access control middleware.
 *
 * All helpers here read the verified role from req.user (set by the authenticate
 * middleware from the JWT cookie). They NEVER read X-User-Role or X-User-Id
 * headers — those are ignored entirely on the backend.
 */
import type { Request, Response, NextFunction } from "express";
import { ALL_ROLES, getPermissions } from "@workspace/db/permissions";

export type UserRole = (typeof ALL_ROLES)[number];

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const role = req.user.role as UserRole;
    if (!ALL_ROLES.includes(role)) {
      res.status(401).json({ error: "Invalid role in session token." });
      return;
    }
    if (!allowedRoles.includes(role)) {
      res.status(403).json({ error: "Insufficient permissions for this action." });
      return;
    }
    next();
  };
}

/**
 * Permission-flag based middleware.
 * Usage: requirePermission('canReadAuditLog')
 */
export function requirePermission(flag: keyof ReturnType<typeof getPermissions>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const perms = getPermissions(req.user.role);
    if (!perms[flag]) {
      res.status(403).json({
        error: `Permission denied: ${flag} is not granted for role '${req.user.role}'`,
      });
      return;
    }
    next();
  };
}

export const requireOwner             = requireRole("owner");
export const requireSupervisorOrOwner = requireRole("owner", "supervisor");

/**
 * requireAnyRole — any valid platform professional (13 roles, citizen excluded).
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
 */
export const requireGovernanceRead = requireAnyRole;

/**
 * requireWriteRole — any professional role EXCEPT "viewer" and "citizen".
 *
 * "viewer" is the platform's dedicated read-only role (used by the permanent
 * evaluation/"reviewer" account so external reviewers, supervisors, and AI
 * testing agents can exercise the full journey without touching production
 * data). Use this instead of requireAnyRole on any endpoint that creates,
 * updates, or deletes data — requireAnyRole alone would let viewer mutate.
 */
export const requireWriteRole = requireRole(
  "owner", "supervisor",
  "minister", "undersecretary", "assistant_undersecretary",
  "director_general", "department_director", "legal_department",
  "constitutional_reviewer", "internal_auditor", "external_auditor",
  "judge",
);
