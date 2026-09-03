/**
 * Authentication routes — no JWT required (these establish the session).
 *
 *   POST /api/auth/login                 — verify credentials, issue session cookie
 *   POST /api/auth/guest-login           — one-click reviewer login
 *   GET  /api/auth/me                    — return the current session's user payload
 *   GET  /api/auth/sessions              — list active sessions for the current user
 *   POST /api/auth/change-password       — self-service password change
 *   POST /api/auth/sign-out-other-sessions — revoke every session except this one
 *   POST /api/auth/logout                — clear this session's cookie
 */
import { Router, type IRouter } from "express";
import { db, usersTable, userSessionsTable, getPermissions } from "@workspace/db";
import { eq, sql, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { signToken, verifyToken, COOKIE_NAME, COOKIE_MAX_AGE_MS, TOKEN_EXPIRY_MS } from "../lib/jwt";
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

/** Resolve the client IP from a request — trusts X-Forwarded-For first hop */
function clientIp(req: import("express").Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

// ── Guaranteed table initialisation ──────────────────────────────────────────
// user_sessions must exist before any createSession() call. This module-level
// promise runs ONCE when auth.ts is first imported (at server startup) and
// creates the table if the startup seed migration silently failed.
//
// Why this is needed:
//   seed.ts creates the table via pool.query() inside migrateAuth(). In
//   production the error is caught and only emitted through pino's async
//   transport — which can lose messages during the first ~2 s of startup before
//   the worker thread is ready. The result is a missing table with no visible
//   log. This promise is a belt-and-suspenders guarantee: db.execute() uses
//   drizzle's own connection (same SSL config), and failures are surfaced via
//   console.error which writes synchronously to stdout and is always captured
//   by the deployment log collector.
const _userSessionsTableReady: Promise<void> = (async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id"           serial PRIMARY KEY,
        "user_id"      integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "sid"          text    NOT NULL UNIQUE,
        "user_agent"   text,
        "ip"           text,
        "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
        "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
        "expires_at"   timestamp with time zone NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
        ON "user_sessions"("user_id")
    `);
    // Use console.log (not logger) so this startup confirmation is always
    // captured synchronously, regardless of pino worker flush timing.
    console.log('[auth] user_sessions table ready');
  } catch (err) {
    // console.error bypasses pino's async transport — always reaches the
    // deployment log collector even when pino workers haven't initialised yet.
    console.error(
      '[auth] CRITICAL: user_sessions table initialisation failed — ' +
      'login will return 500 until this is resolved:',
      err,
    );
  }
})();

/**
 * Create a session row in user_sessions and return the generated sid.
 * Called after every successful login/guest-login.
 *
 * Awaits _userSessionsTableReady so the table is guaranteed to exist before
 * the INSERT — handles the edge case where the startup migration failed
 * silently in production.
 */
async function createSession(
  userId: number,
  req: import("express").Request,
): Promise<string> {
  // Wait for table to be ready (no-op if already initialised)
  await _userSessionsTableReady;

  const sid = randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
  try {
    await db.insert(userSessionsTable).values({
      userId,
      sid,
      userAgent: req.headers["user-agent"]?.slice(0, 300) ?? null,
      ip: clientIp(req),
      expiresAt,
    });
  } catch (err) {
    // Log the raw DB error so it is always visible in deployment logs,
    // independently of pino's async transport flush state.
    console.error('[auth] createSession INSERT failed:', err);
    throw err;
  }
  return sid;
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
  const sid = await createSession(user.id, req);

  // Read the user's subscription plan — graceful fallback to 'free' if the
  // plan column hasn't been migrated yet (safe first-deploy window).
  let userPlan = "free";
  try {
    const planRows = await db.execute<{ plan: string }>(
      sql`SELECT COALESCE(plan, 'free') AS plan FROM users WHERE id = ${user.id}`,
    );
    userPlan = (planRows[0] as { plan?: string })?.plan ?? "free";
  } catch {
    // plan column not yet added — default to 'free'
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    org,
    plan: userPlan,
    pwv: user.passwordVersion,
    mustChangePassword: user.mustChangePassword,
    sid,
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

  logger.info({ userId: user.id, role: user.role, sid }, "User authenticated");

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
router.post("/auth/guest-login", async (req, res): Promise<void> => {
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
  const sid = await createSession(user.id, req);

  const token = signToken({
    userId: user.id,
    role: user.role,
    org,
    plan: "free", // guest/reviewer accounts are always on the free plan
    pwv: user.passwordVersion,
    mustChangePassword: user.mustChangePassword,
    sid,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  logger.info({ userId: user.id, role: user.role, sid }, "Guest evaluation session started");

  res.json({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    org,
    mustChangePassword: user.mustChangePassword,
  });
});

// ── POST /api/auth/demo-login ────────────────────────────────────────────────
// Password-less entry into a named demo account, for the login page's demo
// panel. Replaces the old approach of shipping every demo account's plaintext
// password in the frontend bundle (extractable by anyone who downloads the
// JS). The client sends only a username; the server looks the account up,
// verifies it is a real is_demo=TRUE row, and issues the session cookie
// directly — no password ever needs to exist client-side. Blocked in
// production by the same is_demo + IS_PRODUCTION gate as regular login.
router.post("/auth/demo-login", async (req, res): Promise<void> => {
  if (IS_PRODUCTION) {
    res.status(403).json({ error: "Demo accounts are not available in this environment." });
    return;
  }

  const { username } = req.body as { username?: unknown };
  if (typeof username !== "string" || !username.trim()) {
    res.status(400).json({ error: "Username is required." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim().toLowerCase()));

  // Hard invariant: only ever sign a token for a genuine, currently-active
  // demo account. Refuses rather than silently granting access if the
  // username doesn't exist, isn't marked is_demo, or has been deactivated.
  if (!user || !user.isDemo || !user.isActive) {
    res.status(403).json({ error: "Unknown or unavailable demo account." });
    return;
  }

  const org = orgForRole(user.role);
  const sid = await createSession(user.id, req);

  const token = signToken({
    userId: user.id,
    role: user.role,
    org,
    plan: "free", // demo accounts are always on the free plan
    pwv: user.passwordVersion,
    mustChangePassword: user.mustChangePassword,
    sid,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  logger.info({ userId: user.id, role: user.role, sid }, "Demo account session started");

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
// Unlike other protected routes, this endpoint is NOT behind the `authenticate`
// middleware (it is the route that establishes whether a valid session exists).
// It therefore performs its own password-version check so that a revoked JWT
// (from a remote sign-out or admin password reset) is detected immediately on
// page load, not only when the first downstream protected request fires.
router.get("/auth/me", async (req, res): Promise<void> => {
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

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    logger.warn(
      { err: String(err), ua: req.headers["user-agent"]?.slice(0, 120) },
      "auth/me: invalid or expired token — clearing cookie",
    );
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired." });
    return;
  }

  // ── Password-reset session invalidation (mirrors authenticate.ts) ─────────
  // Check the live password_version so a token issued before a reset/revoke is
  // rejected here, before the UI settles on an "authenticated" state.
  // If the row cannot be found (deleted account, synthetic ID), fall through
  // and trust the JWT — consistent with the authenticate middleware policy.
  try {
    const [current] = await db
      .select({ passwordVersion: usersTable.passwordVersion })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId));

    if (current && current.passwordVersion !== payload.pwv) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.status(401).json({
        error: "Your session was ended. Please log in again.",
        code: "SESSION_REVOKED",
      });
      return;
    }
  } catch {
    // DB lookup failure is non-fatal — fall through and trust the JWT
  }

  res.json(payload);
});

// ── GET /api/auth/sessions ───────────────────────────────────────────────────
// Returns ACTIVE (non-expired) session rows for the authenticated user, ordered
// by most recently seen first. The current session (matched by sid claim) is
// flagged so the UI can highlight it.
// "Active" means expires_at > NOW() — sessions whose JWT lifetime has elapsed
// are silently excluded even if the row was never explicitly deleted.
router.get("/auth/sessions", async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  const currentSid = req.user?.sid ?? "";

  if (userId === undefined) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const rows = await db
    .select()
    .from(userSessionsTable)
    .where(
      sql`${userSessionsTable.userId} = ${userId} AND ${userSessionsTable.expiresAt} > NOW()`,
    )
    .orderBy(sql`${userSessionsTable.lastSeenAt} DESC`);

  const sessions = rows.map((r) => ({
    id:          r.id,
    sid:         r.sid,
    isCurrent:   r.sid === currentSid,
    userAgent:   r.userAgent,
    ip:          r.ip,
    createdAt:   r.createdAt,
    lastSeenAt:  r.lastSeenAt,
    expiresAt:   r.expiresAt,
  }));

  res.json({ sessions });
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

  // Delete all session rows for this user except the current one —
  // those sessions are now dead (pwv mismatch) and their rows are stale.
  const currentSid = req.user?.sid ?? "";
  if (currentSid) {
    await db
      .delete(userSessionsTable)
      .where(
        sql`${userSessionsTable.userId} = ${userId} AND ${userSessionsTable.sid} != ${currentSid}`,
      );
  }

  const org = orgForRole(updated.role);
  const token = signToken({
    userId: updated.id,
    role: updated.role,
    org,
    pwv: updated.passwordVersion,
    mustChangePassword: false,
    sid: currentSid,
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
// Also deletes all user_sessions rows except the caller's so the list
// immediately reflects the result.
router.post("/auth/sign-out-other-sessions", async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  const currentSid = req.user?.sid ?? "";

  if (userId === undefined) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  // Count active (non-expired) sessions that will be ended (for the response message)
  const liveSessions = await db
    .select({ sid: userSessionsTable.sid })
    .from(userSessionsTable)
    .where(
      sql`${userSessionsTable.userId} = ${userId} AND ${userSessionsTable.expiresAt} > NOW()`,
    );
  const revokedCount = liveSessions.filter((s) => s.sid !== currentSid).length;

  const [updated] = await db
    .update(usersTable)
    .set({ passwordVersion: sql`${usersTable.passwordVersion} + 1` })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  // Delete every session row except the current one
  if (currentSid) {
    await db
      .delete(userSessionsTable)
      .where(
        sql`${userSessionsTable.userId} = ${userId} AND ${userSessionsTable.sid} != ${currentSid}`,
      );
  } else {
    // Fallback: no sid in token (legacy token) — delete all rows
    await db.delete(userSessionsTable).where(eq(userSessionsTable.userId, userId));
  }

  const org = orgForRole(updated.role);
  const token = signToken({
    userId: updated.id,
    role: updated.role,
    org,
    pwv: updated.passwordVersion,
    mustChangePassword: updated.mustChangePassword,
    sid: currentSid,
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });

  logAudit(req, "user.sessions_revoked", { entityType: "user", entityId: updated.id, details: { selfService: true, revokedCount } });
  logger.info({ userId: updated.id, revokedCount }, "User signed out of their other active sessions");

  res.json({ message: "All other active sessions have been signed out.", revokedCount });
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
  // Delete the session row for this specific session if we have a sid
  const cookies = req.cookies as Record<string, string> | undefined;
  const token = cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = verifyToken(token);
      if (payload.sid) {
        await db
          .delete(userSessionsTable)
          .where(eq(userSessionsTable.sid, payload.sid));
      }
    } catch {
      // Token invalid/expired — nothing to delete
    }
  }

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Logged out successfully." });
});

export default router;
