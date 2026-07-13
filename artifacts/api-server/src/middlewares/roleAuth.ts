/**
 * Role-based access control middleware.
 *
 * All helpers here read the verified role from req.user (set by the authenticate
 * middleware from the JWT cookie). They NEVER read X-User-Role or X-User-Id
 * headers — those are ignored entirely on the backend.
 */
import type { Request, Response, NextFunction } from "express";
import { ALL_ROLES, getPermissions } from "@workspace/db/permissions";
import { logAudit } from "./auditLog.js";

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

/**
 * requireWriteRoleOrGuestDemo — requireWriteRole, plus a narrow exception
 * letting "viewer" through.
 *
 * This exists ONLY to support the public "تجربة المنصة / Demo Access" guest
 * flow: invited evaluators sign into the shared read-only reviewer account
 * and should be able to ask the AI assistant a legal question and get an
 * answer, without creating a real account. It must be used ONLY on the two
 * assistant routes that implement that flow (create session, send message),
 * and the message-send route MUST also carry `guestDailyQuestionLimit`
 * (rateLimits.ts) so guest usage stays capped at 5 questions/day. Every other
 * write route on the platform — including renaming/deleting assistant
 * sessions — stays on requireWriteRole / requireSupervisorOrOwner with
 * viewer excluded, per the read-only invariant enforced at guest-login time.
 */
export function requireWriteRoleOrGuestDemo(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.user?.role === "viewer") {
    next();
    return;
  }
  requireWriteRole(req, res, next);
}

/**
 * isShamsiFrameworkEnabled — reads the SHAMSI_FRAMEWORK_ENABLED env flag.
 * Defaults to enabled (true) unless explicitly set to "false".
 */
export function isShamsiFrameworkEnabled(): boolean {
  return process.env.SHAMSI_FRAMEWORK_ENABLED !== "false";
}

/**
 * requireShamsiOwner — gate for every Al-Shamsi Theory / Framework surface
 * (admin-os, legal-brain/shamsi-analysis, court simulation, and any future
 * Shamsi-branded route).
 *
 * Restricted to the "owner" role only, and only while SHAMSI_FRAMEWORK_ENABLED
 * is not explicitly disabled. Every denial — whether from wrong role, missing
 * auth, or the framework being disabled — is logged to the audit trail and
 * returns a generic 403 so the response never reveals that a Shamsi-specific
 * feature exists behind the gate.
 */
export function requireShamsiOwner(req: Request, res: Response, next: NextFunction): void {
  const deny = (reason: string) => {
    logAudit(req, "shamsi.access_denied", {
      details: { path: req.path, method: req.method, reason },
    });
    res.status(403).json({ error: "Unauthorized" });
  };

  if (!isShamsiFrameworkEnabled()) {
    deny("framework_disabled");
    return;
  }
  if (!req.user) {
    deny("unauthenticated");
    return;
  }
  if (req.user.role !== "owner") {
    deny("not_owner");
    return;
  }
  next();
}

/**
 * canIncludeShamsi — true only when the trusted session role is "owner" and
 * the framework is not disabled. Use this (never the raw x-user-role header)
 * to decide whether an otherwise-broadly-accessible response may include
 * Al-Shamsi Theory data (alShamsiDimensions / alShamsiMapping / alShamsiDrivers
 * / alShamsiFrameworkCompliance).
 */
export function canIncludeShamsi(role: string): boolean {
  return role === "owner" && isShamsiFrameworkEnabled();
}

/**
 * stripShamsiFromRiskAssessment — redacts Al-Shamsi Theory outputs from a
 * risk assessment row for non-owner roles: the 16-dimension mapping
 * (alShamsiMapping) and, per individual risk index, which Shamsi dimensions
 * drove that index's score (alShamsiDrivers). All other risk data (scores,
 * reasons, legal citations) remains visible — this is redaction, not a
 * route-level lock, since risk assessment is a legitimate broader-access
 * feature that merely happens to carry Shamsi-derived fields.
 */
export function stripShamsiFromRiskAssessment<T extends Record<string, unknown>>(
  assessment: T | null | undefined,
  role: string,
): T | null | undefined {
  if (!assessment || canIncludeShamsi(role)) return assessment;
  const clone: Record<string, unknown> = { ...assessment };
  clone.alShamsiMapping = null;
  // Present-tense assessments use `indices`; risk_history rows snapshot the
  // same shape under `indicesSnapshot` — strip Shamsi drivers from whichever
  // is present.
  for (const field of ["indices", "indicesSnapshot"] as const) {
    const value = clone[field];
    if (value && typeof value === "object") {
      const indices = value as Record<string, Record<string, unknown>>;
      const strippedIndices: Record<string, unknown> = {};
      for (const key of Object.keys(indices)) {
        const idx = indices[key];
        strippedIndices[key] = idx && typeof idx === "object" ? { ...idx, alShamsiDrivers: [] } : idx;
      }
      clone[field] = strippedIndices;
    }
  }
  return clone as T;
}
