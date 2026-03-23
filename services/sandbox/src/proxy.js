/**
 * T402 Sandbox — Testnet Facilitator Proxy
 *
 * Lightweight proxy with rate limiting, usage tracking, and mock fallback.
 * In production, proxies to a real testnet facilitator.
 * In standalone mode, returns mock responses for development.
 */

import express from "express";
import compression from "compression";

// --- Lib modules ---
import { PORT, FACILITATOR_API_KEY } from "./lib/config.js";
import { log } from "./lib/logger.js";
import { MAGIC_ADDRESSES, SUPPORTED_NETWORKS, SUPPORTED_KINDS } from "./lib/magic.js";
import { checkUpstream } from "./lib/upstream.js";
import { requestHistory, MAX_HISTORY_PER_SESSION, MAX_SESSIONS, SESSION_TTL_MS, historyEvictionTimer } from "./lib/history.js";
import { clearPruneTimer } from "./lib/metrics.js";

// --- Middleware ---
import { securityHeaders } from "./middleware/security.js";
import { rateLimitMiddleware, evictionTimer } from "./middleware/rateLimit.js";
import { corsMiddleware } from "./middleware/cors.js";
import { contentTypeMiddleware } from "./middleware/contentType.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { historyMiddleware } from "./middleware/historyMiddleware.js";

// --- Routes ---
import { registerHealthRoutes } from "./routes/health.js";
import { registerSupportedRoutes } from "./routes/supported.js";
import { registerProxyRoutes } from "./routes/proxy.js";
import { registerWebhookRoutes } from "./routes/webhook.js";
import { registerDeveloperRoutes } from "./routes/developer.js";
import { registerPageRoutes } from "./routes/pages.js";

// --- App setup ---
const app = express();

// Compress responses
app.use(compression());

// Body parser with explicit size limit
app.use(express.json({ limit: "50kb" }));

// Middleware stack (order matters)
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(rateLimitMiddleware);
app.use(corsMiddleware);
app.use(contentTypeMiddleware);
app.use(loggingMiddleware);
app.use(historyMiddleware);

// Register routes
registerHealthRoutes(app);
registerSupportedRoutes(app);
registerProxyRoutes(app);
registerWebhookRoutes(app);
registerDeveloperRoutes(app);
registerPageRoutes(app);

// 404 handler — JSON response for unknown routes
app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    hint: "See GET / for available endpoints, or GET /openapi.yaml for the API spec",
    sandbox: true,
  });
});

// JSON parse error handler
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON", sandbox: true });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large (max 50kb)", sandbox: true });
  }
  log("error", "Unhandled error", { error: err.message || String(err) });
  res.status(500).json({ error: "Internal error", sandbox: true });
});

// --- Detect if running as main entry point (not imported by tests) ---
const _isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];

// Periodic upstream check (every 30s)
let healthTimer;
if (_isMain) {
  if (!FACILITATOR_API_KEY) {
    log("warn", "No FACILITATOR_API_KEY set — upstream /verify and /settle will return 401");
  }
  checkUpstream();
  healthTimer = setInterval(checkUpstream, 30_000);
  healthTimer.unref();
}

// --- Server with graceful shutdown ---
let server;

function startServer() {
  server = app.listen(PORT, () => {
    log("info", `Listening on port ${PORT}`, { service: "t402-sandbox", mode: "testnet" });
  });
  return server;
}

function shutdown(signal) {
  log("info", `${signal} received, shutting down`, { service: "t402-sandbox" });
  clearInterval(evictionTimer);
  clearInterval(historyEvictionTimer);
  clearPruneTimer();
  if (healthTimer) clearInterval(healthTimer);
  if (server) {
    server.close(() => process.exit(0));
    // Force exit after 5s if connections don't drain
    setTimeout(() => process.exit(1), 5000).unref();
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (_isMain) {
  startServer();
}

export { app, startServer, SUPPORTED_NETWORKS, SUPPORTED_KINDS, MAGIC_ADDRESSES, requestHistory, MAX_HISTORY_PER_SESSION, MAX_SESSIONS, SESSION_TTL_MS };
