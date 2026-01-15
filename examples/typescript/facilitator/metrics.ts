import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";
import type { Request, Response, NextFunction } from "express";

// Create a custom registry
export const register = new Registry();

// Add default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register });

// ============================================================================
// HTTP Request Metrics
// ============================================================================

/**
 * Total HTTP requests counter
 * Labels: endpoint, method, status
 */
export const httpRequestsTotal = new Counter({
  name: "facilitator_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["endpoint", "method", "status"] as const,
  registers: [register],
});

/**
 * HTTP request duration histogram
 * Labels: endpoint, method
 */
export const httpRequestDuration = new Histogram({
  name: "facilitator_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["endpoint", "method"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/**
 * Currently active requests gauge
 */
export const activeRequests = new Gauge({
  name: "facilitator_active_requests",
  help: "Number of currently active requests",
  registers: [register],
});

// ============================================================================
// Payment Verification Metrics
// ============================================================================

/**
 * Total verification operations counter
 * Labels: status (valid, invalid), network, scheme
 */
export const verificationsTotal = new Counter({
  name: "facilitator_verifications_total",
  help: "Total number of payment verification operations",
  labelNames: ["status", "network", "scheme"] as const,
  registers: [register],
});

/**
 * Verification duration histogram
 * Labels: network, scheme
 */
export const verificationDuration = new Histogram({
  name: "facilitator_verification_duration_seconds",
  help: "Payment verification duration in seconds",
  labelNames: ["network", "scheme"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// ============================================================================
// Payment Settlement Metrics
// ============================================================================

/**
 * Total settlement operations counter
 * Labels: status (success, failed), network, scheme
 */
export const settlementsTotal = new Counter({
  name: "facilitator_settlements_total",
  help: "Total number of payment settlement operations",
  labelNames: ["status", "network", "scheme"] as const,
  registers: [register],
});

/**
 * Settlement duration histogram
 * Labels: network, scheme
 */
export const settlementDuration = new Histogram({
  name: "facilitator_settlement_duration_seconds",
  help: "Payment settlement duration in seconds",
  labelNames: ["network", "scheme"] as const,
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Payment volume counter (in smallest token units)
 * Labels: network, token
 */
export const paymentVolumeTotal = new Counter({
  name: "facilitator_payment_volume_total",
  help: "Total payment volume processed (in smallest token units)",
  labelNames: ["network", "token"] as const,
  registers: [register],
});

/**
 * Payment volume in USD equivalent
 * Labels: network
 */
export const paymentVolumeUsd = new Counter({
  name: "facilitator_payment_volume_usd_total",
  help: "Total payment volume processed in USD equivalent",
  labelNames: ["network"] as const,
  registers: [register],
});

// ============================================================================
// Error Metrics
// ============================================================================

/**
 * Total errors counter
 * Labels: type (verification, settlement, internal), network
 */
export const errorsTotal = new Counter({
  name: "facilitator_errors_total",
  help: "Total number of errors",
  labelNames: ["type", "network"] as const,
  registers: [register],
});

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Express middleware to track HTTP request metrics
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Skip metrics endpoint to avoid recursive tracking
  if (req.path === "/metrics") {
    next();
    return;
  }

  const startTime = process.hrtime.bigint();
  activeRequests.inc();

  // Capture the original end method
  const originalEnd = res.end.bind(res);

  // Override end to capture metrics
  res.end = function (
    this: Response,
    ...args: Parameters<Response["end"]>
  ): Response {
    const endTime = process.hrtime.bigint();
    const durationSeconds = Number(endTime - startTime) / 1e9;

    // Normalize endpoint path (remove query params, normalize patterns)
    const endpoint = normalizeEndpoint(req.path);
    const method = req.method;
    const status = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.inc({ endpoint, method, status });
    httpRequestDuration.observe({ endpoint, method }, durationSeconds);
    activeRequests.dec();

    // Call original end
    return originalEnd.apply(this, args);
  } as Response["end"];

  next();
}

/**
 * Normalize endpoint path for consistent metric labels
 */
function normalizeEndpoint(path: string): string {
  // Remove trailing slashes
  const normalized = path.replace(/\/+$/, "") || "/";

  // Known endpoints
  const knownEndpoints = ["/verify", "/settle", "/supported", "/metrics", "/health"];
  if (knownEndpoints.includes(normalized)) {
    return normalized;
  }

  // Default to the path as-is for unknown endpoints
  return normalized;
}

// ============================================================================
// Helper Functions for Business Metrics
// ============================================================================

/**
 * Record a verification operation
 */
export function recordVerification(
  isValid: boolean,
  network: string,
  scheme: string,
  durationMs: number,
): void {
  const status = isValid ? "valid" : "invalid";
  verificationsTotal.inc({ status, network, scheme });
  verificationDuration.observe({ network, scheme }, durationMs / 1000);
}

/**
 * Record a settlement operation
 */
export function recordSettlement(
  success: boolean,
  network: string,
  scheme: string,
  durationMs: number,
  amountRaw?: bigint,
  token?: string,
  amountUsd?: number,
): void {
  const status = success ? "success" : "failed";
  settlementsTotal.inc({ status, network, scheme });
  settlementDuration.observe({ network, scheme }, durationMs / 1000);

  // Record payment volume if settlement was successful
  if (success && amountRaw !== undefined && token) {
    paymentVolumeTotal.inc({ network, token }, Number(amountRaw));
  }
  if (success && amountUsd !== undefined) {
    paymentVolumeUsd.inc({ network }, amountUsd);
  }
}

/**
 * Record an error
 */
export function recordError(
  type: "verification" | "settlement" | "internal",
  network?: string,
): void {
  errorsTotal.inc({ type, network: network || "unknown" });
}
