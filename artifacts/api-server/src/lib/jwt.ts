/**
 * JWT utilities for MARSAD session authentication.
 *
 * Tokens are signed with HS256 using SESSION_SECRET and stored as
 * HTTP-only, SameSite=Strict cookies. They expire after 8 hours (one working day).
 */
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET;

if (!SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable is required but not set. " +
      "Set it in your environment before starting the server.",
  );
}

export interface JwtPayload {
  userId: number;
  role: string;
  /** Organisation string for org-scoped roles; empty string otherwise */
  org: string;
  /**
   * Snapshot of users.password_version at the moment this token was issued.
   * Checked against the live DB value on every request (see authenticate
   * middleware) so that resetting a user's password immediately invalidates
   * any session token issued before the reset — even though the token
   * itself hasn't expired yet.
   */
  pwv: number;
  /**
   * TRUE when the user must set a new password before doing anything else
   * (admin-issued temporary password: new account or password reset).
   * Snapshot at issuance; a fresh login/change-password re-issues the token
   * with the current value, so this never goes stale for longer than one
   * password-reset cycle (which already forces re-login via the pwv check).
   */
  mustChangePassword: boolean;
}

/** Name of the HTTP-only session cookie */
export const COOKIE_NAME = "marsad_session";

/** Token validity window */
export const TOKEN_EXPIRY = "8h";

/** Cookie maxAge in milliseconds (must match TOKEN_EXPIRY) */
export const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function signToken(payload: JwtPayload): string {
  const opts: SignOptions = { expiresIn: TOKEN_EXPIRY, algorithm: "HS256" };
  return jwt.sign(payload, SECRET!, opts);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, SECRET!, { algorithms: ["HS256"] }) as JwtPayload & {
    iat: number;
    exp: number;
  };
  return {
    userId: decoded.userId,
    role: decoded.role,
    org: decoded.org ?? "",
    pwv: decoded.pwv ?? 0,
    mustChangePassword: decoded.mustChangePassword ?? false,
  };
}
