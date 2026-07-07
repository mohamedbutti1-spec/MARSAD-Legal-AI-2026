/**
 * JWT authentication middleware.
 *
 * Reads the marsad_session HTTP-only cookie, verifies the JWT signature and
 * expiry, and attaches the verified payload to req.user.
 *
 * Returns 401 for missing or expired tokens. Protected routes that need a
 * specific role should additionally use requireRole() / requireAnyRole().
 */
import type { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME } from "../lib/jwt";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }

  try {
    req.user = verifyToken(token);

    // ── Backfill legacy headers from verified JWT payload ─────────────────────
    // Many routes read x-user-role / x-user-id / x-user-org directly.
    // We stripped any attacker-supplied values earlier; now we reinstate the
    // correct, server-verified values so legacy code works without changes.
    // This is defense-in-depth: even if a route still reads these headers,
    // it gets the JWT value, not a spoofed one.
    req.headers["x-user-role"] = req.user.role;
    req.headers["x-user-id"]   = String(req.user.userId);
    req.headers["x-user-org"]  = req.user.org;

    next();
  } catch {
    // Clear the invalid/expired cookie so the browser doesn't keep sending it
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}
