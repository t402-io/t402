/**
 * Health, readiness, usage, and metrics routes.
 */
import { RATE_LIMIT } from "../lib/config.js";
import { metrics, METRICS_RETENTION_MS, totalRequests, upstreamErrors } from "../lib/metrics.js";
import { upstreamHealthy, upstreamNetworks } from "../lib/upstream.js";
import { SUPPORTED_NETWORKS } from "../lib/magic.js";
import { limits } from "../middleware/rateLimit.js";

export function registerHealthRoutes(app) {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "t402-sandbox", mode: "testnet" });
  });

  app.get("/ready", (_req, res) => {
    if (upstreamHealthy) {
      const liveCount = SUPPORTED_NETWORKS.filter(n => upstreamNetworks.includes(n)).length;
      res.json({ ready: true, upstream: "connected", service: "t402-sandbox", liveNetworks: liveCount, totalNetworks: SUPPORTED_NETWORKS.length });
    } else {
      res.status(503).json({ ready: false, upstream: "unreachable", service: "t402-sandbox", note: "Mock fallback active" });
    }
  });

  app.get("/usage", (_req, res) => {
    res.json({ totalRequests, upstreamErrors, rateLimit: RATE_LIMIT, upstreamHealthy });
  });

  app.get("/metrics", (_req, res) => {
    const now = Date.now();
    // Prune old histogram data
    const cutoff = now - METRICS_RETENTION_MS;
    metrics.requestDuration = metrics.requestDuration.filter(m => m.timestamp > cutoff);
    metrics.upstreamLatency = metrics.upstreamLatency.filter(m => m.timestamp > cutoff);

    const lines = [
      "# HELP sandbox_requests_total Total requests by endpoint",
      "# TYPE sandbox_requests_total counter",
    ];

    for (const [endpoint, count] of metrics.requestsTotal) {
      lines.push(`sandbox_requests_total{endpoint="${endpoint}"} ${count}`);
    }

    lines.push(
      "# HELP sandbox_upstream_errors_total Total upstream errors",
      "# TYPE sandbox_upstream_errors_total counter",
      `sandbox_upstream_errors_total ${upstreamErrors}`,
      "# HELP sandbox_upstream_healthy Whether upstream facilitator is reachable",
      "# TYPE sandbox_upstream_healthy gauge",
      `sandbox_upstream_healthy ${upstreamHealthy === true ? 1 : 0}`,
      "# HELP sandbox_rate_limit_hits_total Rate limit rejections",
      "# TYPE sandbox_rate_limit_hits_total counter",
      `sandbox_rate_limit_hits_total ${metrics.rateLimitHits}`,
      "# HELP sandbox_active_rate_limit_entries Number of tracked IPs",
      "# TYPE sandbox_active_rate_limit_entries gauge",
      `sandbox_active_rate_limit_entries ${limits.size}`,
    );

    // Request duration histogram (5min window)
    if (metrics.requestDuration.length > 0) {
      const buckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
      lines.push(
        "# HELP sandbox_request_duration_seconds Request duration histogram",
        "# TYPE sandbox_request_duration_seconds histogram",
      );
      let sum = 0;
      for (const b of buckets) {
        const count = metrics.requestDuration.filter(m => m.duration / 1000 <= b).length;
        lines.push(`sandbox_request_duration_seconds_bucket{le="${b}"} ${count}`);
      }
      lines.push(`sandbox_request_duration_seconds_bucket{le="+Inf"} ${metrics.requestDuration.length}`);
      for (const m of metrics.requestDuration) sum += m.duration / 1000;
      lines.push(`sandbox_request_duration_seconds_sum ${sum.toFixed(6)}`);
      lines.push(`sandbox_request_duration_seconds_count ${metrics.requestDuration.length}`);
    }

    // Upstream latency histogram
    if (metrics.upstreamLatency.length > 0) {
      const buckets = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 90];
      lines.push(
        "# HELP sandbox_upstream_latency_seconds Upstream facilitator latency histogram",
        "# TYPE sandbox_upstream_latency_seconds histogram",
      );
      let sum = 0;
      for (const b of buckets) {
        const count = metrics.upstreamLatency.filter(m => m.duration / 1000 <= b).length;
        lines.push(`sandbox_upstream_latency_seconds_bucket{le="${b}"} ${count}`);
      }
      lines.push(`sandbox_upstream_latency_seconds_bucket{le="+Inf"} ${metrics.upstreamLatency.length}`);
      for (const m of metrics.upstreamLatency) sum += m.duration / 1000;
      lines.push(`sandbox_upstream_latency_seconds_sum ${sum.toFixed(6)}`);
      lines.push(`sandbox_upstream_latency_seconds_count ${metrics.upstreamLatency.length}`);
    }

    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(lines.join("\n") + "\n");
  });
}
