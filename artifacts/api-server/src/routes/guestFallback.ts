import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE_MS } from "../lib/jwt";
import { logger } from "../lib/logger";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Railway-safe guest login used by the preview branch.
 *
 * Why this exists:
 * - the regular guest-login path persists a user_sessions row before issuing
 *   the JWT; if an older Railway database is missing that table/shape, the
 *   request can fail with a generic 500 even though the app itself is healthy.
 * - the reviewer identity is strictly read-only, so it is safe to issue a
 *   short-lived JWT with a synthetic sid when session-registry persistence is
 *   unavailable.
 * - if the permanent reviewer account was never provisioned (for example when
 *   REVIEWER_BOOTSTRAP_PASSWORD was not set on an old deployment), provision a
 *   non-demo viewer account automatically with an unusable random password hash.
 */
export async function railwayGuestLogin(req: Request, res: Response): Promise<void> {
  try {
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, "reviewer"));

    if (!user) {
      const unusablePassword = await bcrypt.hash(randomUUID(), 10);
      const inserted = await db.execute(sql`
        INSERT INTO users (
          name, email, role, username, password_hash,
          is_demo, is_active, password_version, must_change_password, plan
        )
        VALUES (
          'حساب المراجعة — قراءة فقط',
          'reviewer@marsad.ae',
          'viewer',
          'reviewer',
          ${unusablePassword},
          FALSE,
          TRUE,
          0,
          FALSE,
          'free'
        )
        ON CONFLICT (email) DO UPDATE SET
          username = EXCLUDED.username,
          role = 'viewer',
          is_demo = FALSE,
          is_active = TRUE,
          must_change_password = FALSE
        RETURNING id
      `);

      const insertedId = Number((inserted[0] as { id?: number } | undefined)?.id ?? 0);
      if (!insertedId) {
        throw new Error("Reviewer account provisioning did not return an id");
      }

      [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, insertedId));
    }

    if (!user || !user.isActive || user.role !== "viewer" || user.isDemo) {
      res.status(503).json({ error: "Evaluation account is unavailable." });
      return;
    }

    const sid = randomUUID();
    const token = signToken({
      userId: user.id,
      role: user.role,
      org: "",
      plan: "free",
      pwv: user.passwordVersion,
      mustChangePassword: false,
      sid,
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE_MS,
      path: "/",
    });

    logger.info({ userId: user.id, sid }, "Railway guest evaluation session started");
    res.json({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      org: "",
      mustChangePassword: false,
    });
  } catch (err) {
    logger.error({ err }, "Railway guest evaluation login failed");
    res.status(503).json({ error: "Evaluation login is temporarily unavailable." });
  }
}
