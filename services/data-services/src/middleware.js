/**
 * Merged middleware for data-services (bazaar + explorer).
 *
 * Rate limiting, structured logging, request metrics, security headers,
 * auth helpers, SSRF protection, validation, ETag support, Prometheus formatting.
 */

import crypto from "crypto";

// ── Structured logging ────────────────────────────────────────────────
function logEntry(level, msg, data) {
  const entry = {
    time: new Date().toISOString(),
    level,
    service: "data-services",
    msg,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (msg, data) => logEntry("info", msg, data),
  warn: (msg, data) => logEntry("warn", msg, data),
  error: (msg, data) => logEntry("error", msg, data),
};

// Also export as `log` for explorer compatibility
export function log(level, message, data = {}) {
  logEntry(level, message, data);
}

// ── Metrics ───────────────────────────────────────────────────────────
const metrics = {
  startedAt: new Date().toISOString(),
  requests: { total: 0, byMethod: {}, byStatus: {}, byPath: {} },
  errors: 0,
  verifications: { total: 0, successful: 0, returned402: 0 },
  registrations: { total: 0, rejected: 0, duplicates: 0 },
};

export function getMetrics() {
  return { ...metrics, uptime: process.uptime() };
}

function recordRequest(method, path, status) {
  metrics.requests.total++;
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1;
  metrics.requests.byStatus[status] = (metrics.requests.byStatus[status] || 0) + 1;

  // Normalize path — collapse IDs to :id
  const normalized = path
    .replace(/\/svc-\d+/g, "/:id")
    .replace(/\/0x[a-fA-F0-9]+/g, "/:hash")
    .split("?")[0];
  metrics.requests.byPath[normalized] = (metrics.requests.byPath[normalized] || 0) + 1;
}

export function recordError() {
  metrics.errors++;
}

export function recordVerification(reachable, returns402) {
  metrics.verifications.total++;
  if (reachable) metrics.verifications.successful++;
  if (returns402) metrics.verifications.returned402++;
}

export function recordRegistration(rejected, duplicate) {
  metrics.registrations.total++;
  if (rejected) metrics.registrations.rejected++;
  if (duplicate) metrics.registrations.duplicates++;
}

// ── Explorer-specific metrics (Prometheus histograms) ────────────────
const explorerRequestCount = new Map();
const explorerDurationBuckets = new Map();
const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export function recordExplorerMetrics(method, path, status, durationSec) {
  const normalizedPath = normalizeExplorerPath(path);
  const countKey = `${method}|${normalizedPath}|${status}`;
  explorerRequestCount.set(countKey, (explorerRequestCount.get(countKey) || 0) + 1);
  const bucketKey = normalizedPath;
  if (!explorerDurationBuckets.has(bucketKey)) {
    explorerDurationBuckets.set(bucketKey, { buckets: new Array(DURATION_BUCKETS.length).fill(0), sum: 0, count: 0 });
  }
  const entry = explorerDurationBuckets.get(bucketKey);
  entry.sum += durationSec;
  entry.count += 1;
  for (let i = 0; i < DURATION_BUCKETS.length; i++) {
    if (durationSec <= DURATION_BUCKETS[i]) { entry.buckets[i] += 1; break; }
  }
}

function normalizeExplorerPath(path) {
  if (path.startsWith("/api/v1/transactions/")) return "/api/v1/transactions/:hash";
  if (path.startsWith("/api/v1/address/")) return "/api/v1/address/:address";
  if (path.startsWith("/tx/")) return "/tx/:hash";
  if (path.startsWith("/address/")) return "/address/:address";
  if (path.startsWith("/network/")) return "/network/:networkId";
  if (path.startsWith("/token/")) return "/token/:tokenSymbol";
  const qIdx = path.indexOf("?");
  return qIdx >= 0 ? path.slice(0, qIdx) : path;
}

export function getExplorerPrometheusData() {
  return { requestCount: explorerRequestCount, durationBuckets: explorerDurationBuckets, DURATION_BUCKETS };
}

// ── Request ID middleware ─────────────────────────────────────────────
export function requestId(req, res, next) {
  const id = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = id;
  res.set("X-Request-Id", id);
  next();
}

// ── Request logging middleware ────────────────────────────────────────
export function requestLogger(req, res, next) {
  const start = performance.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Math.round(performance.now() - start);
    recordRequest(req.method, req.url, res.statusCode);
    recordExplorerMetrics(req.method, req.originalUrl, res.statusCode, duration / 1000);

    const ua = req.headers["user-agent"] || "";

    logger.info("request", {
      requestId: req.id,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration_ms: duration,
      content_length: res.getHeader("content-length") || 0,
      user_agent: ua.length > 100 ? ua.slice(0, 100) : ua,
      ip: req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip,
    });

    originalEnd.apply(res, args);
  };

  next();
}

// ── ETag / Conditional request support ───────────────────────────────
export function sendWithEtag(req, res, body, cacheControl) {
  const json = JSON.stringify(body);
  const etag = `"${crypto.createHash("md5").update(json).digest("hex")}"`;

  if (cacheControl) {
    res.set("Cache-Control", cacheControl);
  }
  res.set("ETag", etag);

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }

  res.set("Content-Type", "application/json");
  res.send(json);
}

// ── Rate limiting (shared counter, 60 req/min per IP) ────────────────
const rateLimits = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60");
const RATE_WINDOW = 60_000;
const MAX_RATE_LIMIT_ENTRIES = 10_000;

export function rateLimit(req, res, next) {
  const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip;
  const now = Date.now();
  const key = ip;

  let entry = rateLimits.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    if (!entry && rateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      pruneExpiredEntries();
    }
    entry = { count: 0, windowStart: now };
    rateLimits.set(key, entry);
  }

  entry.count++;
  res.set("X-RateLimit-Limit", String(RATE_LIMIT));
  res.set("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT - entry.count)));

  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded", retryAfter: Math.ceil((entry.windowStart + RATE_WINDOW - now) / 1000) });
  }
  next();
}

function pruneExpiredEntries() {
  const cutoff = Date.now() - RATE_WINDOW * 2;
  for (const [key, entry] of rateLimits) {
    if (entry.windowStart < cutoff) rateLimits.delete(key);
  }
}

const _pruneInterval = setInterval(pruneExpiredEntries, 300_000);
_pruneInterval.unref();

// ── Security headers ─────────────────────────────────────────────────
export function securityHeaders(_req, res, next) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'",
  );
  res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("X-Permitted-Cross-Domain-Policies", "none");
  next();
}

// ── CORS headers ─────────────────────────────────────────────────────
export function corsHeaders(req, res, next) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

// ── Auth — Bazaar admin ──────────────────────────────────────────────
const BAZAAR_ADMIN_KEY = process.env.BAZAAR_ADMIN_KEY;

export function requireAuth(req, res, next) {
  if (!BAZAAR_ADMIN_KEY) {
    return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
  }

  const key = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (!key || key.length !== BAZAAR_ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(BAZAAR_ADMIN_KEY))) {
    return res.status(401).json({ error: "Unauthorized \u2014 provide X-API-Key header" });
  }
  req.isAdmin = true;
  next();
}

/**
 * Hash an API key for storage (SHA-256).
 */
export function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Require service-level auth: admin key OR the service's own API key.
 */
export function requireServiceAuth(getById) {
  return (req, res, next) => {
    const key = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
    if (!key) {
      return res.status(401).json({ error: "Unauthorized \u2014 provide X-API-Key header" });
    }

    // Admin key always works
    if (BAZAAR_ADMIN_KEY && key.length === BAZAAR_ADMIN_KEY.length &&
        crypto.timingSafeEqual(Buffer.from(key), Buffer.from(BAZAAR_ADMIN_KEY))) {
      req.isAdmin = true;
      return next();
    }

    // Check per-service key
    const service = getById(req.params.id);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    if (service.api_key_hash && service.api_key_hash === hashApiKey(key)) {
      return next();
    }

    return res.status(403).json({ error: "Forbidden \u2014 you do not own this service" });
  };
}

// ── Auth — Explorer admin ────────────────────────────────────────────
export function requireExplorerAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  if (!apiKey || apiKey !== process.env.EXPLORER_ADMIN_KEY) {
    return res.status(401).json({ error: "Authentication required for export" });
  }
  next();
}

// ── SSRF protection ──────────────────────────────────────────────────
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
]);

export function isPrivateIP(hostname) {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;

  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }

  return false;
}

// ── Input validation ─────────────────────────────────────────────────
const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_CATEGORY_LENGTH = 50;
const MAX_METHODS = 10;
const VALID_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const VALID_TOKENS = new Set(["USDC", "USDT", "USDT0", "USAT"]);

export function validateServiceInput(body) {
  const errors = [];

  if (!body.url || typeof body.url !== "string") {
    errors.push("url is required and must be a string");
  } else {
    try {
      const parsed = new URL(body.url);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        errors.push("URL must use http or https protocol");
      }
    } catch {
      errors.push("Invalid URL format");
    }
  }

  if (!body.name || typeof body.name !== "string") {
    errors.push("name is required and must be a string");
  } else if (body.name.length > MAX_NAME_LENGTH) {
    errors.push(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  if (!body.price || typeof body.price !== "object") {
    errors.push("price is required and must be an object");
  } else {
    if (!body.price.amount || typeof body.price.amount !== "string" || !/^\d+$/.test(body.price.amount)) {
      errors.push("price.amount must be a numeric string (smallest unit)");
    }
    if (!body.price.token || !VALID_TOKENS.has(body.price.token)) {
      errors.push(`price.token must be one of: ${[...VALID_TOKENS].join(", ")}`);
    }
    if (!body.price.network || typeof body.price.network !== "string") {
      errors.push("price.network is required (CAIP-2 format, e.g. eip155:8453)");
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      errors.push("description must be a string");
    } else if (body.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }
  }

  if (body.category !== undefined) {
    if (typeof body.category !== "string") {
      errors.push("category must be a string");
    } else if (body.category.length > MAX_CATEGORY_LENGTH) {
      errors.push(`category must be at most ${MAX_CATEGORY_LENGTH} characters`);
    }
  }

  if (body.methods !== undefined) {
    if (!Array.isArray(body.methods)) {
      errors.push("methods must be an array");
    } else if (body.methods.length > MAX_METHODS) {
      errors.push(`methods must have at most ${MAX_METHODS} entries`);
    } else {
      for (const m of body.methods) {
        if (!VALID_METHODS.has(m)) {
          errors.push(`Invalid method: ${m}`);
        }
      }
    }
  }

  if (body.owner !== undefined && typeof body.owner !== "string") {
    errors.push("owner must be a string");
  }

  return errors;
}

// ── Sanitization ─────────────────────────────────────────────────────
export function sanitizeString(str) {
  return str.replace(/<[^>]*>/g, "").trim();
}

// ── Service verification ─────────────────────────────────────────────
export async function verifyServiceUrl(url) {
  try {
    const parsed = new URL(url);
    if (isPrivateIP(parsed.hostname)) {
      recordVerification(false, false);
      return { reachable: false, returns402: false, error: "URL points to a private/internal address" };
    }

    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, {
      signal: controller.signal,
      method: "GET",
      redirect: "manual",
    });
    clearTimeout(timeout);
    const latencyMs = Math.round(performance.now() - start);

    const result = {
      reachable: true,
      returns402: res.status === 402,
      statusCode: res.status,
      latencyMs,
    };

    // Extract discovery info from 402 response
    if (res.status === 402) {
      try {
        const body = await res.json();
        result.discovery = extractDiscoveryInfo(body);
      } catch {
        // Response wasn't JSON
      }
    }

    recordVerification(true, res.status === 402);
    return result;
  } catch (e) {
    recordVerification(false, false);
    return { reachable: false, returns402: false, error: e.message };
  }
}

function extractDiscoveryInfo(body) {
  // V2: extensions.bazaar.info
  if (body?.extensions?.bazaar?.info) {
    return {
      version: 2,
      input: body.extensions.bazaar.info.input || null,
      output: body.extensions.bazaar.info.output || null,
    };
  }

  // V1: outputSchema (legacy)
  if (body?.paymentRequirements?.[0]?.outputSchema || body?.requirements?.outputSchema) {
    const schema = body.paymentRequirements?.[0]?.outputSchema || body.requirements?.outputSchema;
    return {
      version: 1,
      output: { type: "json", schema },
    };
  }

  return null;
}

// ── Error handler ────────────────────────────────────────────────────
export function errorHandler(err, _req, res, _next) {
  recordError();
  logger.error("unhandled error", { requestId: _req.id, error: err.message, stack: err.stack });

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  res.status(500).json({ error: "Internal server error" });
}

// ── Prometheus formatting helpers ────────────────────────────────────
export function formatBazaarPrometheus(store) {
  const m = getMetrics();
  const lines = [];

  lines.push("# HELP bazaar_requests_total Total requests");
  lines.push("# TYPE bazaar_requests_total counter");
  for (const [method, count] of Object.entries(m.requests.byMethod || {})) {
    lines.push(`bazaar_requests_total{method="${method}"} ${count}`);
  }
  for (const [status, count] of Object.entries(m.requests.byStatus || {})) {
    lines.push(`bazaar_requests_total{status="${status}"} ${count}`);
  }

  lines.push("");
  lines.push("# HELP bazaar_services_total Total registered services");
  lines.push("# TYPE bazaar_services_total gauge");
  lines.push(`bazaar_services_total ${store.size()}`);

  lines.push("");
  lines.push("# HELP bazaar_services_verified Verified services count");
  lines.push("# TYPE bazaar_services_verified gauge");
  lines.push(`bazaar_services_verified ${store.countVerified()}`);

  lines.push("");
  lines.push("# HELP bazaar_uptime_seconds Service uptime");
  lines.push("# TYPE bazaar_uptime_seconds gauge");
  lines.push(`bazaar_uptime_seconds ${Math.floor(m.uptime)}`);

  lines.push("");
  lines.push("# HELP bazaar_errors_total Total errors");
  lines.push("# TYPE bazaar_errors_total counter");
  lines.push(`bazaar_errors_total ${m.errors}`);

  lines.push("");
  lines.push("# HELP bazaar_verifications_total Total verifications");
  lines.push("# TYPE bazaar_verifications_total counter");
  lines.push(`bazaar_verifications_total ${m.verifications.total}`);

  lines.push("");
  lines.push("# HELP bazaar_verifications_successful Successful verifications");
  lines.push("# TYPE bazaar_verifications_successful counter");
  lines.push(`bazaar_verifications_successful ${m.verifications.successful}`);

  lines.push("");
  lines.push("# HELP bazaar_registrations_total Total registrations");
  lines.push("# TYPE bazaar_registrations_total counter");
  lines.push(`bazaar_registrations_total ${m.registrations.total}`);

  return lines;
}

export function formatExplorerPrometheus(getDbStatus) {
  const { requestCount, durationBuckets, DURATION_BUCKETS: buckets } = getExplorerPrometheusData();
  const lines = [];

  lines.push("# HELP explorer_requests_total Total HTTP requests");
  lines.push("# TYPE explorer_requests_total counter");
  for (const [key, count] of requestCount) {
    const [method, path, status] = key.split("|");
    lines.push(`explorer_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
  }

  lines.push("# HELP explorer_request_duration_seconds Request duration");
  lines.push("# TYPE explorer_request_duration_seconds histogram");
  for (const [path, entry] of durationBuckets) {
    let cumulative = 0;
    for (let i = 0; i < buckets.length; i++) {
      cumulative += entry.buckets[i];
      lines.push(`explorer_request_duration_seconds_bucket{path="${path}",le="${buckets[i]}"} ${cumulative}`);
    }
    lines.push(`explorer_request_duration_seconds_bucket{path="${path}",le="+Inf"} ${entry.count}`);
    lines.push(`explorer_request_duration_seconds_sum{path="${path}"} ${entry.sum}`);
    lines.push(`explorer_request_duration_seconds_count{path="${path}"} ${entry.count}`);
  }

  const dbStatus = getDbStatus();
  const syncLag = dbStatus.lastSync ? (Date.now() - new Date(dbStatus.lastSync).getTime()) / 1000 : -1;
  lines.push("# HELP explorer_sync_lag_seconds Seconds since last Facilitator sync");
  lines.push("# TYPE explorer_sync_lag_seconds gauge");
  lines.push(`explorer_sync_lag_seconds ${syncLag}`);

  return lines;
}
