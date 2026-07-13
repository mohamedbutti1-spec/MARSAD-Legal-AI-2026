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

/**
 * Guest/demo daily question cap: 5 AI questions per 24h, IP-keyed.
 *
 * Only applies to the "viewer" role — the shared read-only guest/reviewer
 * account used by the public "تجربة المنصة / Demo Access" flow (see
 * requireWriteRoleOrGuestDemo in roleAuth.ts). Every other role skips this
 * limiter entirely (`skip` returns true), so owners/supervisors/governance
 * roles keep their existing per-minute limits only. Keyed by IP (the
 * default keyGenerator) rather than user id, since every guest shares the
 * same underlying account — this gives each invited evaluator their own
 * daily allowance instead of one shared pool for all guests.
 */
export const guestDailyQuestionLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.user?.role !== "viewer",
  message: {
    error: "Daily demo question limit reached (5/day).",
    arabicMessage:
      "لقد استخدمت الحد الأقصى للأسئلة في وضع العرض التجريبي (5 أسئلة يوميًا). يرجى المحاولة مرة أخرى غدًا، أو تسجيل حساب كامل.",
    code: "GUEST_DAILY_LIMIT",
  },
  skipSuccessfulRequests: false,
});
