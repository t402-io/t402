/**
 * POST access logging middleware.
 */
import { TRUST_CF_HEADER } from "../lib/config.js";
import { log } from "../lib/logger.js";
import { metrics, incrementErrors } from "../lib/metrics.js";

export function loggingMiddleware(req, res, next) {
  if (req.method === "POST") {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log("info", `${req.method} ${req.path}`, {
        status: res.statusCode,
        duration,
        ip: TRUST_CF_HEADER ? (req.headers["cf-connecting-ip"] || req.ip) : req.ip,
        requestId: req.requestId,
      });
      if (res.statusCode >= 400) {
        incrementErrors();
      }
      metrics.requestsTotal.set(req.path, (metrics.requestsTotal.get(req.path) || 0) + 1);
      metrics.requestDuration.push({ endpoint: req.path, duration, timestamp: Date.now() });
    });
  }
  next();
}
