/**
 * Middleware: rate limiting, API key auth, input validation, service verification, metrics
 */

import crypto from "crypto";

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
  const normalized = path.replace(/\/svc-\d+/g, "/:id").split("?")[0];
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

// ── Structured logging ────────────────────────────────────────────────
function log(level, msg, data) {
  const entry = {
    time: new Date().toISOString(),
    level,
    service: "t402-bazaar",
    msg,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  info: (msg, data) => log("info", msg, data),
  warn: (msg, data) => log("warn", msg, data),
  error: (msg, data) => log("error", msg, data),
};

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

// ── Rate limiting ─────────────────────────────────────────────────────
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

// ── Auth ──────────────────────────────────────────────────────────────
const ADMIN_API_KEY = process.env.BAZAAR_ADMIN_KEY;

export function requireAuth(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
  }

  const key = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (!key || key.length !== ADMIN_API_KEY.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_API_KEY))) {
    return res.status(401).json({ error: "Unauthorized — provide X-API-Key header" });
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
 * Must be used AFTER the route handler loads the service (req.params.id).
 * Attach the store's getById to req via dependency injection.
 */
export function requireServiceAuth(getById) {
  return (req, res, next) => {
    const key = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
    if (!key) {
      return res.status(401).json({ error: "Unauthorized — provide X-API-Key header" });
    }

    // Admin key always works
    if (ADMIN_API_KEY && key.length === ADMIN_API_KEY.length &&
        crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_API_KEY))) {
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

    return res.status(403).json({ error: "Forbidden — you do not own this service" });
  };
}

// ── Input validation ──────────────────────────────────────────────────
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

// ── Sanitization ──────────────────────────────────────────────────────
export function sanitizeString(str) {
  return str.replace(/<[^>]*>/g, "").trim();
}

// ── SSRF protection ───────────────────────────────────────────────────
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

// ── Service verification ──────────────────────────────────────────────
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
        // Response wasn't JSON — that's fine
      }
    }

    recordVerification(true, res.status === 402);
    return result;
  } catch (e) {
    recordVerification(false, false);
    return { reachable: false, returns402: false, error: e.message };
  }
}

/**
 * Extract bazaar discovery info from a 402 PaymentRequired response.
 * Supports both v2 (extensions.bazaar) and v1 (outputSchema) formats.
 */
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

// ── Error handler ─────────────────────────────────────────────────────
export function errorHandler(err, _req, res, _next) {
  recordError();
  logger.error("unhandled error", { requestId: _req.id, error: err.message, stack: err.stack });

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }

  res.status(500).json({ error: "Internal server error" });
}
