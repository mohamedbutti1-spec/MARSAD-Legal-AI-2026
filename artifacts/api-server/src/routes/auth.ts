/**
 * Authentication routes — no JWT required (these establish the session).
 *
 *   POST /api/auth/login   — verify credentials, issue session cookie
 *   GET  /api/auth/me      — return the current session's user payload
 *   POST /api/auth/logout  — clear the session cookie
 */
import { Router, type IRouter } from "express";
import { db, usersTable, getPermissions } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken, verifyToken, COOKIE_NAME, COOKIE_MAX_AGE_MS } from "../lib/jwt";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Organisation string for org-scoped roles (real deployments pull from HR system)
const DEMO_ORG =
  "وزارة الصحة ووقاية المجتمع — الإدارة العامة للرقابة والتفتيش الصحي — إمارة أبوظبي";

function orgForRole(role: string): string {
  try {
    const perms = getPermissions(role) as unknown as Record<string, unknown>;
    return perms.seeOwnOrgOnly === true ? DEMO_ORG : "";
  } catch {
    return "";
  }
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: unknown; password?: unknown };

  if (typeof username !== "string" || !username.trim()) {
    res.status(400).json({ error: "Username is required." });
    return;
  }
  if (typeof password !== "string" || !password) {
    res.status(400).json({ error: "Password is required." });
    return;
  }

  // Lookup by username (stored lowercase)
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim().toLowerCase()));

  // Always run bcrypt to prevent timing-based username enumeration
  const dummyHash = "$2b$10$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const storedHash = user?.passwordHash ?? dummyHash;
  const valid = await bcrypt.compare(password, storedHash);

  if (!user || !valid || !user.passwordHash) {
    // Generic message — do not reveal whether the username exists
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
    return;
  }

  const org = orgForRole(user.role);
  const token = signToken({ userId: user.id, role: user.role, org });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  logger.info({ userId: user.id, role: user.role }, "User authenticated");

  res.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    org,
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", (req, res): void => {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  try {
    const payload = verifyToken(token);
    res.json(payload);
  } catch {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired." });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
  });
  res.json({ message: "Logged out successfully." });
});

export default router;
