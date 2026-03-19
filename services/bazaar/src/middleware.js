/**
 * Middleware: rate limiting, API key auth, service verification
 */

// Simple in-memory rate limiter
const rateLimits = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60");
const RATE_WINDOW = 60_000;

export function rateLimit(req, res, next) {
  const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip;
  const now = Date.now();
  const key = ip;

  let entry = rateLimits.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    entry = { count: 0, windowStart: now };
    rateLimits.set(key, entry);
  }

  entry.count++;
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, RATE_LIMIT - entry.count));

  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded", retryAfter: Math.ceil((entry.windowStart + RATE_WINDOW - now) / 1000) });
  }
  next();
}

// Prune expired entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW * 2;
  for (const [key, entry] of rateLimits) {
    if (entry.windowStart < cutoff) rateLimits.delete(key);
  }
}, 300_000);

// API key auth for write operations
const ADMIN_API_KEY = process.env.BAZAAR_ADMIN_KEY;

export function requireAuth(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({ error: "Service registration disabled — BAZAAR_ADMIN_KEY not configured" });
  }

  const key = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized — provide X-API-Key header" });
  }
  next();
}

// Service URL verification — probe the URL to check if it returns 402
export async function verifyServiceUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, { signal: controller.signal, method: "GET" });
    clearTimeout(timeout);

    return {
      reachable: true,
      returns402: res.status === 402,
      statusCode: res.status,
      latencyMs: 0, // Would need timing
    };
  } catch (e) {
    return { reachable: false, returns402: false, error: e.message };
  }
}
