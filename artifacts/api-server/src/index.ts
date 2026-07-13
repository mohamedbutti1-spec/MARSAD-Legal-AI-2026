import app from "./app";
import { logger } from "./lib/logger";
import { seedDatabase } from "./seed";

// ── Global error guards ────────────────────────────────────────────────────────
// Prevent silent process exit on unhandled async errors (e.g. setImmediate
// AI pipeline failures when the DB status-update itself throws).
process.on("unhandledRejection", (reason, promise) => {
  logger.error({ reason, promise }, "Unhandled promise rejection — investigate background pipeline");
  // Do NOT exit — background AI jobs must not crash the server
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — shutting down safely");
  process.exit(1);
});

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedDatabase().catch((err) => {
  logger.error({ err }, "Failed to seed database");
});

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Long legal opinions (17-section AI responses, up to 8000 output tokens)
// combined with a retry-once-then-fallback path can legitimately take well
// over a minute end to end. Node's default requestTimeout (300s) already
// covers this, but set it explicitly so it can never silently regress to a
// lower value, and so it's obviously >= the 120s floor the product requires.
server.requestTimeout = 180_000;
server.headersTimeout = 185_000;
// keepAliveTimeout must stay below headersTimeout; used for connection reuse
// between requests, unrelated to a single request's duration.
server.keepAliveTimeout = 65_000;
