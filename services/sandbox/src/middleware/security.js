/**
 * Security headers and X-Request-Id middleware.
 */
import { randomUUID } from "node:crypto";

export function securityHeaders(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.set("X-Request-Id", requestId);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.set("Content-Security-Policy", "default-src 'none'");
  next();
}
