/**
 * Standardised error response helper — P1-11 Architecture Freeze
 *
 * Every API route must use this helper instead of ad-hoc `res.json({ error: ... })` calls.
 * Ensures a uniform shape across all 123 endpoints:
 *   { error: string, code?: string, details?: unknown }
 */
import type { Response } from "express";

export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "CONFLICT"
  | "FAILED_DEPENDENCY"
  | "INTERNAL_ERROR"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "AI_ERROR";

export interface ApiError {
  error: string;
  code?: ApiErrorCode;
  details?: unknown;
}

/**
 * Send a standardised JSON error response and end the response.
 *
 * @param res     - Express Response
 * @param status  - HTTP status code
 * @param message - Human-readable Arabic or English error message
 * @param code    - Optional machine-readable error code
 * @param details - Optional structured detail object (never include secrets)
 */
export function sendError(
  res: Response,
  status: number,
  message: string,
  code?: ApiErrorCode,
  details?: unknown,
): void {
  const body: ApiError = { error: message };
  if (code)    body.code    = code;
  if (details) body.details = details;
  res.status(status).json(body);
}

/** Shorthand helpers */
export const e400 = (res: Response, msg: string, details?: unknown) => sendError(res, 400, msg, "BAD_REQUEST", details);
export const e403 = (res: Response, msg: string) => sendError(res, 403, msg, "FORBIDDEN");
export const e404 = (res: Response, msg: string) => sendError(res, 404, msg, "NOT_FOUND");
export const e409 = (res: Response, msg: string) => sendError(res, 409, msg, "CONFLICT");
export const e424 = (res: Response, msg: string) => sendError(res, 424, msg, "FAILED_DEPENDENCY");
export const e500 = (res: Response, msg: string) => sendError(res, 500, msg, "INTERNAL_ERROR");
