/**
 * Rate limiting middleware for AI-intensive endpoints.
 *
 * All AI routes are expensive (token cost + latency). These limits protect
 * against runaway loops, scrapers, and accidental flooding in demo mode.
 *
 * In production, tighten maxRequests and add Redis as the store.
 * Per-user limiting (X-User-Id header) is a v2.0 enhancement.
 */

import rateLimit from "express-rate-limit";

/** Standard AI analysis limit: 30 requests / minute per IP. */
export const aiAnalysisLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests — please wait a moment before trying again." },
  skipSuccessfulRequests: false,
});

/** Stricter limit for long-running AI sessions (JDC deliberation, full JRE): 10 / minute. */
export const aiSessionLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many session requests — please wait before starting a new one." },
  skipSuccessfulRequests: false,
});

/** KB search and retrieval: 60 / minute (faster, cheaper than AI). */
export const kbSearchLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests — please slow down." },
  skipSuccessfulRequests: false,
});
