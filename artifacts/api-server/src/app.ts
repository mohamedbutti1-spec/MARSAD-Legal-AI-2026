import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";
import { auditMiddleware } from "./middlewares/auditLog";
import { authenticate } from "./middlewares/authenticate";

const app: Express = express();

// ── Environment ──────────────────────────────────────────────────────────────
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const FRONTEND_DIR = path.resolve(process.cwd(), "artifacts/legal-research/dist/public");

// ── Allowed CORS origins ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS: (string | RegExp)[] = [];

if (process.env.ALLOWED_ORIGIN) {
  process.env.ALLOWED_ORIGIN.split(",").forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) ALLOWED_ORIGINS.push(trimmed);
  });
}

if (IS_PRODUCTION && ALLOWED_ORIGINS.length === 0) {
  logger.warn(
    "ALLOWED_ORIGIN is not set in production. All cross-origin requests will be rejected.",
  );
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
// Production now serves the Vite SPA from this same process, so CSP allows
// same-origin scripts/styles/assets while keeping external execution blocked.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "'unsafe-inline'"],
        imgSrc:         ["'self'", "data:", "blob:"],
        fontSrc:        ["'self'", "data:"],
        connectSrc:     ["'self'"],
        objectSrc:      ["'none'"],
        baseUri:        ["'self'"],
        formAction:     ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ── Compression ──────────────────────────────────────────────────────────────
app.use(
  compression({
    filter: (req, res) => {
      const contentType = String(res.getHeader("Content-Type") ?? "");
      if (contentType.includes("ndjson")) return false;
      return compression.filter(req, res);
    },
  }),
);

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

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

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
app.use(cookieParser());

// ── Strip spoofable identity headers ─────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  delete req.headers["x-user-role"];
  delete req.headers["x-user-id"];
  delete req.headers["x-user-org"];
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.set("trust proxy", 1);

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});
app.use(globalLimiter);

const aiLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit exceeded. Maximum 15 AI requests per minute." },
});
app.use("/api/ai", aiLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
});
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/guest-login", loginLimiter);

// ── Audit middleware ─────────────────────────────────────────────────────────
app.use(auditMiddleware);

// ── JWT Authentication ───────────────────────────────────────────────────────
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/healthz") return next();
  if (
    req.path === "/auth/login" ||
    req.path === "/auth/guest-login" ||
    req.path === "/auth/logout" ||
    req.path === "/auth/me"
  ) {
    return next();
  }
  return authenticate(req, res, next);
});

// ── API routes ───────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Production SPA ───────────────────────────────────────────────────────────
// Outside Replit the same container serves both the frontend and /api routes.
if (IS_PRODUCTION) {
  app.use(express.static(FRONTEND_DIR, { index: false, maxAge: "1h" }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/") || req.path === "/api") return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(path.join(FRONTEND_DIR, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message?.startsWith("CORS_")) {
    res.status(403).json({ error: "CORS: this origin is not permitted." });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
