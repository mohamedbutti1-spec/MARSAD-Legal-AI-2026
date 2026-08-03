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
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifyToken, COOKIE_NAME } from "../lib/jwt";

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }

  try {
    // Captured in a local so TypeScript's narrowing survives the `await`
    // below (property accesses on `req.user`, an optional field, lose their
    // non-undefined narrowing across an awaited call).
    const user = verifyToken(token);
    req.user = user;

    // ── Password-reset session invalidation ────────────────────────────────
    // The JWT is stateless and normally trusted for its full 8-hour life, but
    // that would let a token issued before a password reset keep working on
    // another device. Compare the token's password-version snapshot against
    // the live DB value; a reset bumps password_version (see PATCH /users/:id),
    // which immediately invalidates every token issued before the bump.
    // If the user row can't be found (e.g. account deleted, or synthetic IDs
    // used by non-account-backed flows), fall back to trusting the JWT as
    // before — this check only ever *adds* an extra rejection reason, it
    // never turns a previously-accepted identity into a lookup requirement.
    const [current] = await db
      .select({ passwordVersion: usersTable.passwordVersion, mustChangePassword: usersTable.mustChangePassword })
      .from(usersTable)
      .where(eq(usersTable.id, user.userId));

    if (current && current.passwordVersion !== user.pwv) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.status(401).json({ error: "Session expired or invalid. Please log in again." });
      return;
    }

    // ── Mandatory password change gate ───────────────────────────────────────
    // Use the live DB value (not the token's stale snapshot) so the gate lifts
    // the instant /auth/change-password clears the flag, without waiting for
    // a fresh token. Every route is blocked except the change-password
    // endpoint itself, until the user replaces their admin-issued temporary
    // password.
    const mustChangePassword = current?.mustChangePassword ?? user.mustChangePassword;
    user.mustChangePassword = mustChangePassword;
    if (mustChangePassword && req.path !== "/auth/change-password") {
      res.status(403).json({ error: "You must set a new password before continuing.", code: "MUST_CHANGE_PASSWORD" });
      return;
    }

    // ── Backfill legacy headers from verified JWT payload ─────────────────────
    // Many routes read x-user-role / x-user-id / x-user-org directly.
    // We stripped any attacker-supplied values earlier; now we reinstate the
    // correct, server-verified values so legacy code works without changes.
    // This is defense-in-depth: even if a route still reads these headers,
    // it gets the JWT value, not a spoofed one.
    req.headers["x-user-role"] = user.role;
    req.headers["x-user-id"]   = String(user.userId);
    req.headers["x-user-org"]  = user.org;

    next();
  } catch {
    // Clear the invalid/expired cookie so the browser doesn't keep sending it
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}
