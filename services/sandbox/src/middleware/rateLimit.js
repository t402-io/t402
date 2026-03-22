/**
 * Rate limiter with periodic cleanup.
 */
import { RATE_LIMIT, RATE_LIMIT_MAX_ENTRIES, TRUST_CF_HEADER } from "../lib/config.js";
import { metrics } from "../lib/metrics.js";

export const limits = new Map();
const RATE_WINDOW_MS = 60_000;

// Evict stale entries every 60s
export const evictionTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of limits) {
    if (now - entry.start > RATE_WINDOW_MS) limits.delete(ip);
  }
}, RATE_WINDOW_MS);
evictionTimer.unref();

export function rateLimitMiddleware(req, res, next) {
  const ip = TRUST_CF_HEADER ? (req.headers["cf-connecting-ip"] || req.ip) : req.ip;
  const now = Date.now();
  let entry = limits.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    // Prevent unbounded Map growth under IP-spray attacks
    if (!entry && limits.size >= RATE_LIMIT_MAX_ENTRIES) {
      const oldest = limits.keys().next().value;
      limits.delete(oldest);
    }
    entry = { count: 0, start: now };
    limits.set(ip, entry);
  }
  entry.count++;
  res.set("X-RateLimit-Limit", String(RATE_LIMIT));
  res.set("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT - entry.count)));
  if (entry.count > RATE_LIMIT) {
    metrics.rateLimitHits++;
    return res.status(429).json({ error: "Rate limit exceeded", sandbox: true });
  }
  next();
}
