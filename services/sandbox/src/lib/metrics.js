/**
 * Metrics and usage tracking state.
 */

export const metrics = {
  requestsTotal: new Map(),    // label: endpoint -> count
  requestDuration: [],         // { endpoint, duration, timestamp }
  errorsTotal: 0,
  upstreamLatency: [],         // { duration, timestamp }
  rateLimitHits: 0,
};

export const METRICS_RETENTION_MS = 300_000; // Keep 5 minutes of histogram data

/**
 * Prune histogram arrays to remove entries older than METRICS_RETENTION_MS.
 * Called periodically to prevent unbounded memory growth.
 */
function pruneMetrics() {
  const cutoff = Date.now() - METRICS_RETENTION_MS;
  metrics.requestDuration = metrics.requestDuration.filter((e) => e.timestamp > cutoff);
  metrics.upstreamLatency = metrics.upstreamLatency.filter((e) => e.timestamp > cutoff);
}

// Periodic pruning timer — .unref() so it doesn't prevent process shutdown
const _pruneTimer = setInterval(pruneMetrics, 60_000);
_pruneTimer.unref();

/** Clear the periodic pruning timer (call during graceful shutdown). */
export function clearPruneTimer() {
  clearInterval(_pruneTimer);
}

// Usage tracking
export let totalRequests = 0;
export let upstreamErrors = 0;

export function incrementRequests() {
  totalRequests++;
}

export function incrementUpstreamErrors() {
  upstreamErrors++;
}

export function incrementErrors() {
  metrics.errorsTotal++;
}
