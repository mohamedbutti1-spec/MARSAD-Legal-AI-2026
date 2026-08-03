/**
 * Express Request type augmentation — adds the verified JWT payload as req.user.
 * Set by the authenticate middleware after successful token verification.
 * All protected route handlers can read userId, role, and org from req.user.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        /** Numeric primary key from the users table */
        userId: number;
        /** One of the 14 platform roles */
        role: string;
        /** Organisation string for org-scoped roles; empty string otherwise */
        org: string;
        /** password_version snapshot at token issuance; see authenticate middleware */
        pwv: number;
        /** TRUE when an admin-issued temporary password has not been replaced yet */
        mustChangePassword: boolean;
        /** Stable session identifier — matches a row in user_sessions */
        sid: string;
      };
    }
  }
}

export {};
