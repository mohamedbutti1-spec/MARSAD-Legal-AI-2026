import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import router from "./routes";
import { logger } from "./lib/logger";
import { auditMiddleware } from "./middlewares/auditLog";
import { authenticate } from "./middlewares/authenticate";

const app: Express = express();

// ── Environment ──────────────────────────────────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ── Allowed CORS origins ─────────────────────────────────────────────────────
// Production:  set ALLOWED_ORIGIN env var to the deployment URL.
//              Comma-separate multiple values for staging + production.
//              *.replit.app is always allowed in production as a safety net
//              (Replit deployments are same-domain; this never widens exposure
//              beyond what the JWT cookie already enforces).
// Development: localhost, *.replit.dev, *.repl.co are automatically allowed.
const ALLOWED_ORIGINS: (string | RegExp)[] = [];

if (process.env.ALLOWED_ORIGIN) {
  // Support comma-separated list: "https://a.replit.app,https://b.replit.app"
  process.env.ALLOWED_ORIGIN.split(",").forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) ALLOWED_ORIGINS.push(trimmed);
  });
}

if (IS_PRODUCTION) {
  // Always allow *.replit.app — Replit deployment domains are same-origin
  // for the static frontend. Belt-and-suspenders in case ALLOWED_ORIGIN is
  // missing or the deployment domain changes without updating the env var.
  ALLOWED_ORIGINS.push(/^https:\/\/[a-z0-9-]+\.replit\.app$/);
}

if (!IS_PRODUCTION) {
  ALLOWED_ORIGINS.push(
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /\.replit\.dev$/,
    /\.repl\.co$/,
    /\.kirk\.replit\.dev$/,
    /\.pike\.replit\.dev$/,
  );
}

// ── Security headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'none'"],
        scriptSrc:      ["'none'"],
        styleSrc:       ["'none'"],
        imgSrc:         ["'none'"],
        connectSrc:     ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ── HTTP request logging ─────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── C3 Fix: Block unauthenticated direct API access in production ─────────────
// Rejects requests that carry neither Origin nor Referer — the signature of
// raw curl/script access that bypasses the browser security model.
// Exemptions:
//   • /api/healthz and /healthz — load-balancer / uptime probes
//   • Any request with a Referer header — covers PWA standalone on iOS
//     (iOS Safari omits Origin on navigations but always sends Referer)
if (IS_PRODUCTION) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/api/healthz" || req.path === "/healthz") {
      return next();
    }
    if (!req.headers.origin && !req.headers.referer) {
      res.status(403).json({ error: "Direct API access is not permitted in production." });
      return;
    }
    next();
  });
}

// ── CORS ─────────────────────────────────────────────────────────────────────
// Credentials mode: the session cookie is sent on every API request.
// On CORS rejection the origin callback throws; the error handler returns 403.
app.use(
  cors({
    origin: (origin, cb) => {
      // In development: allow no-origin requests (curl, Replit shell scripts)
      if (!origin) {
        return IS_PRODUCTION ? cb(new Error("CORS_NO_ORIGIN")) : cb(null, true);
      }
      const allowed = ALLOWED_ORIGINS.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin),
      );
      if (allowed) return cb(null, true);
      return cb(new Error(`CORS_REJECTED:${origin}`));
    },
    credentials: true,
  }),
);

// ── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// ── Cookie parser (required for JWT session cookie) ──────────────────────────
app.use(cookieParser());

// ── Strip spoofable identity headers ─────────────────────────────────────────
// Attackers can send x-user-role / x-user-id / x-user-org to try to assume
// another identity. We remove them here so no route handler ever sees a
// caller-supplied value. The authenticate middleware below re-injects the
// correct values from the verified JWT payload after token verification.
app.use((req: Request, _res: Response, next: NextFunction) => {
  delete req.headers["x-user-role"];
  delete req.headers["x-user-id"];
  delete req.headers["x-user-org"];
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
// H1 Fix: trust proxy so real client IP is used (not reverse-proxy IP)
app.set("trust proxy", 1);

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use(globalLimiter);

// Stricter limiter for AI endpoints (costly API calls)
const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit exceeded. Maximum 15 AI requests per minute." },
});
app.use("/api/ai", aiLimiter);

// Brute-force protection for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
});
app.use("/api/auth/login", loginLimiter);

// ── Audit middleware ─────────────────────────────────────────────────────────
app.use(auditMiddleware);

// ── JWT Authentication ───────────────────────────────────────────────────────
// Applied to ALL /api/* routes EXCEPT:
//   /api/healthz    — health check (no auth required for load balancers)
//   /api/auth/…     — login / logout / session check (establishes auth)
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/healthz") return next();
  if (req.path === "/auth/login" || req.path === "/auth/logout" || req.path === "/auth/me") {
    return next();
  }
  return authenticate(req, res, next);
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // CORS rejections → 403 (not 500)
  if (err.message?.startsWith("CORS_")) {
    res.status(403).json({ error: "CORS: this origin is not permitted." });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
