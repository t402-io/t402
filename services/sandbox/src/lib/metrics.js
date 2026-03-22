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

// Usage tracking
export let totalRequests = 0;
export let upstreamErrors = 0;

export function incrementRequests() {
  totalRequests++;
}

export function incrementUpstreamErrors() {
  upstreamErrors++;
}
