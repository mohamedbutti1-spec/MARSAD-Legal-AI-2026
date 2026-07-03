import type { Request, Response, NextFunction } from "express";

export type UserRole = "owner" | "supervisor" | "viewer";

/**
 * Reads the X-User-Role header sent by the frontend (stored in localStorage).
 * For a full production deployment, replace this with a verified JWT/session check.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req.headers["x-user-role"] as string) || "viewer";
    if (!["owner", "supervisor", "viewer"].includes(role)) {
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

export const requireOwner = requireRole("owner");
export const requireSupervisorOrOwner = requireRole("owner", "supervisor");
export const requireAnyRole = requireRole("owner", "supervisor", "viewer");
