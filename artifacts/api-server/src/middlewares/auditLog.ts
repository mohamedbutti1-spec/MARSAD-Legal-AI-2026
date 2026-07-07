import type { Request, Response, NextFunction } from "express";
import { db, auditLogsTable } from "@workspace/db";

/**
 * Call this helper inside any route handler to record an audit event.
 * Fire-and-forget — does not block the response.
 */
export function logAudit(
  req: Request,
  action: string,
  opts: {
    entityType?: string;
    entityId?: number;
    details?: Record<string, unknown>;
  } = {},
): void {
  // Read from verified JWT payload (req.user) — never from spoofable headers
  const userId   = req.user?.userId ?? undefined;
  const userRole = req.user?.role   ?? "anonymous";
  const ip =
    String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim() ||
    null;

  db.insert(auditLogsTable)
    .values({
      action,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      userId: Number.isNaN(userId) ? null : (userId ?? null),
      userRole,
      details: opts.details ? JSON.stringify(opts.details) : null,
      ipAddress: ip,
    })
    .catch(() => {
      /* swallow DB errors — audit must never crash the response path */
    });
}

/**
 * Middleware that auto-logs every mutating request (POST/PUT/PATCH/DELETE)
 * after the response is sent.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  res.on("finish", () => {
    if (res.statusCode >= 400) return; // only log successful mutations

    const path = req.path.replace(/\/\d+$/, "/:id");
    const action = `${req.method.toLowerCase()}:${path}`;

    logAudit(req, action, {
      details: { statusCode: res.statusCode },
    });
  });

  next();
}
