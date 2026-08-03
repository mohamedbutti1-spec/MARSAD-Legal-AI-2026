/**
 * Authentication routes — no JWT required (these establish the session).
 *
 *   POST /api/auth/login   — verify credentials, issue session cookie
 *   GET  /api/auth/me      — return the current session's user payload
 *   POST /api/auth/logout  — clear the session cookie
 */
import { Router, type IRouter } from "express";
import { db, usersTable, getPermissions } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken, verifyToken, COOKIE_NAME, COOKIE_MAX_AGE_MS } from "../lib/jwt";
import { logger } from "../lib/logger";
import { logAudit } from "../middlewares/auditLog";

const router: IRouter = Router();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Precomputed once at startup — keeps bcrypt timing constant regardless of whether
// a username exists in the database, preventing timing-based username enumeration.
const TIMING_SENTINEL = bcrypt.hashSync("marsad-timing-sentinel", 10);

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

  // Always run bcrypt to prevent timing-based username enumeration.
  // TIMING_SENTINEL is a real 10-round hash precomputed at startup, so the
  // work-factor is identical whether or not the username exists.
  const storedHash = user?.passwordHash ?? TIMING_SENTINEL;
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

  // Demo accounts are blocked in production — they exist for development and
  // private-beta review only. Permanent accounts (isDemo = false) are unaffected.
  if (user.isDemo && IS_PRODUCTION) {
    res.status(403).json({ error: "Demo accounts are not available in this environment. Contact your administrator." });
    return;
  }

  const org = orgForRole(user.role);
  const token = signToken({
    userId: user.id,
    role: user.role,
    org,
    pwv: user.passwordVersion,
    mustChangePassword: user.mustChangePassword,
  });

  // SameSite=Lax: cookies are sent on top-level navigations AND same-site fetch
  // calls. "Strict" breaks iOS Safari in standalone PWA mode — the hard-navigation
  // after login is treated as cross-context, causing the cookie to be suppressed
  // on the subsequent /api/auth/me check. "Lax" is the browser default since
  // Chrome 80 and the correct value for same-origin SPAs.
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
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
    mustChangePassword: user.mustChangePassword,
  });
});

// ── POST /api/auth/guest-login ───────────────────────────────────────────────
// One-click, password-less entry point for external reviewers/QA/AI testing
// agents. Always signs into the fixed permanent "reviewer" account (role
// "viewer" — read-only across every module, no create/update/delete). This is
// intentionally not gated by a client-supplied password: the target account
// itself carries zero write permissions, so there is no meaningful escalation
// risk, and it lets reviewers explore the full journey with a single click.
router.post("/auth/guest-login", async (_req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, "reviewer"));

  if (!user || !user.passwordHash) {
    res.status(503).json({ error: "Evaluation account is not provisioned." });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: "Evaluation account is deactivated." });
    return;
  }
  // Hard invariant: only ever sign a token for the fixed, read-only reviewer
  // identity. If this account is ever misconfigured or its role escalated in
  // the database, refuse rather than silently granting elevated guest access.
  if (user.role !== "viewer" || user.isDemo) {
    logger.error(
      { userId: user.id, role: user.role, isDemo: user.isDemo },
      "Guest evaluation account failed invariant check (role/is_demo) — refusing login",
    );
    res.status(503).json({ error: "Evaluation account is misconfigured." });
    return;
  }

  const org = orgForRole(user.role);
  const token = signToken({
    userId: user.id,
    role: user.role,
    org,
    pwv: user.passwordVersion,
    mustChangePassword: user.mustChangePassword,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  logger.info({ userId: user.id, role: user.role }, "Guest evaluation session started");

  res.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    org,
    mustChangePassword: user.mustChangePassword,
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", (req, res): void => {
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[COOKIE_NAME];

  if (!token) {
    // Log enough context to diagnose iOS/PWA cookie transmission issues:
    // - hasCookieHeader: did any Cookie header arrive at all?
    // - ua: which browser / PWA mode
    logger.info(
      {
        hasCookieHeader: !!req.headers.cookie,
        ua: req.headers["user-agent"]?.slice(0, 120),
        origin: req.headers.origin,
        referer: req.headers.referer?.slice(0, 80),
      },
      "auth/me: no session cookie — returning 401",
    );
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  try {
    const payload = verifyToken(token);
    res.json(payload);
  } catch (err) {
    logger.warn(
      { err: String(err), ua: req.headers["user-agent"]?.slice(0, 120) },
      "auth/me: invalid or expired token — clearing cookie",
    );
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired." });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
// Self-service password change. Requires a valid session (this path is not in
// app.ts's no-auth allowlist, so `authenticate` runs first and populates
// req.user). Used both for the mandatory first-login flow after an admin
// issues a temporary password, and as a voluntary password change at any
// other time. Requires the current password to prevent a hijacked/left-open
// session from being used to lock the real owner out of their account.
router.post("/auth/change-password", async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  if (userId === undefined) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };

  if (typeof currentPassword !== "string" || !currentPassword) {
    res.status(400).json({ error: "Current password is required." });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || !user.passwordHash) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }
  if (newPassword === currentPassword) {
    res.status(400).json({ error: "New password must be different from the current password." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [updated] = await db
    .update(usersTable)
    .set({
      passwordHash,
      // Bump password_version so any other active session (other device,
      // or the temporary-password session itself) is invalidated.
      passwordVersion: sql`${usersTable.passwordVersion} + 1`,
      mustChangePassword: false,
    })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const org = orgForRole(updated.role);
  const token = signToken({
    userId: updated.id,
    role: updated.role,
    org,
    pwv: updated.passwordVersion,
    mustChangePassword: false,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  logAudit(req, "user.password_changed", { entityType: "user", entityId: updated.id, details: { selfService: true } });
  logger.info({ userId: updated.id }, "User changed their own password");

  res.json({
    userId: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    org,
    mustChangePassword: false,
  });
});

// ── POST /api/auth/sign-out-other-sessions ───────────────────────────────────
// Voluntary self-service session revocation — e.g. "I think I left myself
// logged in on a shared computer." Bumps password_version (the same counter
// a password reset bumps) WITHOUT touching the password itself, so every
// other token — on any other device/tab — fails the authenticate middleware's
// live pwv check on its next request. The current session is kept alive: we
// immediately re-issue a fresh token/cookie carrying the new pwv, so the
// caller is never logged out of the session that requested this.
router.post("/auth/sign-out-other-sessions", async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  if (userId === undefined) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ passwordVersion: sql`${usersTable.passwordVersion} + 1` })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const org = orgForRole(updated.role);
  const token = signToken({
    userId: updated.id,
    role: updated.role,
    org,
    pwv: updated.passwordVersion,
    mustChangePassword: updated.mustChangePassword,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  logAudit(req, "user.sessions_revoked", { entityType: "user", entityId: updated.id, details: { selfService: true } });
  logger.info({ userId: updated.id }, "User signed out of their other active sessions");

  res.json({ message: "All other active sessions have been signed out." });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", (_req, res): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Logged out successfully." });
});

export default router;
