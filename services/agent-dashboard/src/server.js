/**
 * T402 Agent Dashboard — AI Agent Payment Monitoring
 *
 * Slim entry point: middleware stack + route registration + lifecycle.
 * Route handlers live in routes.js, templates in templates.js.
 */

import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import compression from "compression";

const __dirname = dirname(fileURLToPath(import.meta.url));
import { randomUUID, timingSafeEqual } from "node:crypto";
import { getMode, shutdown } from "./datasource.js";
import { registerRoutes } from "./routes.js";
import { log } from "./utils.js";

/** Constant-time string comparison to prevent timing attacks. */
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const app = express();

// ── Compression ─────────────────────────────────────────────────────
app.use(compression());

// ── X-Request-Id (validated: alphanumeric + hyphens, max 128 chars) ─
app.use((req, res, next) => {
  const incoming = req.get("X-Request-Id");
  req.id = (incoming && /^[a-zA-Z0-9_-]{1,128}$/.test(incoming)) ? incoming : randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

// ── Security headers + CSP nonce ────────────────────────────────────
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set(
    "Content-Security-Policy",
    "default-src 'none'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("Cross-Origin-Opener-Policy", "same-origin");
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  next();
});

// ── CORS — restricted in live mode, open in demo ────────────────────
app.use((req, res, next) => {
  if (getMode() === "live") {
    const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
    const origin = req.get("Origin");
    if (allowed.length > 0 && origin && allowed.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Vary", "Origin");
    }
    // In live mode with no ALLOWED_ORIGINS, deny cross-origin by default
  } else {
    res.set("Access-Control-Allow-Origin", "*");
  }
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Rate limiting (in-memory sliding window, no deps) ───────────────
const rateLimits = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "100", 10);

const MAX_RATE_LIMIT_ENTRIES = 100_000;

function rateLimit(limit) {
  const effectiveLimit = limit || RATE_LIMIT;
  return (req, res, next) => {
    // Use req.ip as primary; only trust cf-connecting-ip / x-forwarded-for if configured
    const ip = req.ip || "unknown";
    const key = `${ip}:${effectiveLimit}`;
    // Protect against memory exhaustion from unique IPs
    if (rateLimits.size > MAX_RATE_LIMIT_ENTRIES && !rateLimits.has(key)) {
      res.set("Retry-After", "60");
      return res.status(503).json({ error: "Service temporarily unavailable" });
    }
    const now = Date.now();
    const windowStart = now - 60000;
    let hits = rateLimits.get(key) || [];
    hits = hits.filter((t) => t > windowStart);
    if (hits.length >= effectiveLimit) {
      res.set("Retry-After", "60");
      return res.status(429).json({ error: "Too many requests" });
    }
    hits.push(now);
    rateLimits.set(key, hits);
    next();
  };
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, hits] of rateLimits) {
    const filtered = hits.filter((t) => t > cutoff);
    if (filtered.length === 0) rateLimits.delete(key);
    else rateLimits.set(key, filtered);
  }
}, 300000).unref();

// Apply global rate limit
app.use(rateLimit());

// ── Optional API key auth ───────────────────────────────────────────
const API_KEY = process.env.DASHBOARD_API_KEY || "";
if (API_KEY) {
  app.use("/api/v1", (req, res, next) => {
    const key = req.get("X-API-Key") || req.get("Authorization")?.replace(/^bearer\s+/i, "");
    if (!safeCompare(key, API_KEY)) return res.status(401).json({ error: "Unauthorized" });
    next();
  });
}

// ── Static files (CSS, JS — browser-cached) ────────────────────────
app.use(express.static(join(__dirname, "..", "public"), { maxAge: "1h", etag: true }));

// ── Routes ──────────────────────────────────────────────────────────
registerRoutes(app, { rateLimit });

// ── Error handling middleware ───────────────────────────────────────
app.use((err, req, res, _next) => {
  log("error", "Unhandled error", { error: err.message, requestId: req.id, path: req.path });
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3405;
const isDirectRun =
  process.argv[1] && new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;

if (isDirectRun) {
  const server = app.listen(PORT, () => {
    log("info", `T402 Agent Dashboard on http://localhost:${PORT}`, { mode: getMode() });
  });

  const graceful = () => {
    // Force exit after 10s if connections don't close
    setTimeout(() => process.exit(1), 10000).unref();
    server.close(() => {
      shutdown().then(() => process.exit(0));
    });
  };
  process.on("SIGINT", graceful);
  process.on("SIGTERM", graceful);
}

export default app;
