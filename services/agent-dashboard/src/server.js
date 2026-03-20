/**
 * T402 Agent Dashboard — AI Agent Payment Monitoring
 *
 * Slim entry point: middleware stack + route registration + lifecycle.
 * Route handlers live in routes.js, templates in templates.js.
 */

import express from "express";
import compression from "compression";
import { randomBytes, randomUUID } from "node:crypto";
import { getMode, shutdown } from "./datasource.js";
import { registerRoutes } from "./routes.js";
import { log } from "./utils.js";

const app = express();

// ── Compression ─────────────────────────────────────────────────────
app.use(compression());

// ── X-Request-Id ────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.id = req.get("X-Request-Id") || randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

// ── Security headers + CSP nonce ────────────────────────────────────
app.disable("x-powered-by");
app.use((_req, res, next) => {
  const nonce = randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
  );
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
    } else if (allowed.length === 0) {
      res.set("Access-Control-Allow-Origin", "*");
    }
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

function rateLimit(limit) {
  const effectiveLimit = limit || RATE_LIMIT;
  return (req, res, next) => {
    const ip = req.get("cf-connecting-ip") || req.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip;
    const key = `${ip}:${effectiveLimit}`;
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
    const key = req.get("X-API-Key") || req.get("Authorization")?.replace("Bearer ", "");
    if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
  });
}

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
    server.close(() => {
      shutdown().then(() => process.exit(0));
    });
  };
  process.on("SIGINT", graceful);
  process.on("SIGTERM", graceful);
}

export default app;
