import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { auditMiddleware } from "./middlewares/auditLog";

const app: Express = express();

// ── Allowed origins ───────────────────────────────────────────────────────────
// PRODUCTION: set ALLOWED_ORIGIN env var to the exact deployment domain.
//             Only that origin (plus no-origin server-to-server) is allowed.
// DEVELOPMENT / Replit: also permit localhost and Replit preview domains.
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const ALLOWED_ORIGINS: (string | RegExp)[] = [];

if (process.env.ALLOWED_ORIGIN) {
  // Explicit override always wins (supports both dev and prod)
  ALLOWED_ORIGINS.push(process.env.ALLOWED_ORIGIN);
}

if (!IS_PRODUCTION) {
  // Dev / Replit only — never active in production
  ALLOWED_ORIGINS.push(
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /\.replit\.dev$/,
    /\.repl\.co$/,
    /\.kirk\.replit\.dev$/,
  );
}

// Security headers
app.use(
  helmet({
    // CSP for the API's own responses (JSON — no inline scripts/styles needed)
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'none'"],
        scriptSrc:   ["'none'"],
        styleSrc:    ["'none'"],
        imgSrc:      ["'none'"],
        connectSrc:  ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Compress all responses
app.use(compression());

// HTTP request logging
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

// CORS — restricted to known origins; credentials allowed for cookie-based auth
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, server-to-server, mobile apps)
    if (!origin) return cb(null, true);
    const allowed = ALLOWED_ORIGINS.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    if (allowed) return cb(null, true);
    return cb(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
}));
// Reduced body limits — 256 KB general, upload routes use their own multer limits
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Global rate limiter: 200 requests per minute per IP
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

// Audit log all mutating requests
app.use(auditMiddleware);

// API routes
app.use("/api", router);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
