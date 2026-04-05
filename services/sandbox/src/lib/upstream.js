/**
 * Upstream facilitator health checking, proxying, circuit breaker, and retry.
 */
import { FACILITATOR_URL, FACILITATOR_API_KEY } from "./config.js";
import { log } from "./logger.js";
import { metrics } from "./metrics.js";

export let upstreamHealthy = null; // null = unknown, true/false after first check
export let upstreamNetworks = [];  // networks the upstream facilitator actually supports
export let upstreamSigners = null; // signers from upstream /supported response

// --- Circuit Breaker ---
// States: "closed" (normal), "open" (skip upstream), "half-open" (probe one request)
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30_000;

let circuitState = "closed";
let consecutiveFailures = 0;
let lastFailureTime = 0;

export function getCircuitState() {
  if (circuitState === "open" && Date.now() - lastFailureTime >= RESET_TIMEOUT_MS) {
    circuitState = "half-open";
  }
  return circuitState;
}

function recordSuccess() {
  consecutiveFailures = 0;
  if (circuitState !== "closed") {
    log("info", "Circuit breaker closed — upstream recovered");
  }
  circuitState = "closed";
}

function recordFailure() {
  consecutiveFailures++;
  lastFailureTime = Date.now();
  if (consecutiveFailures >= FAILURE_THRESHOLD && circuitState === "closed") {
    circuitState = "open";
    log("warn", "Circuit breaker OPEN — upstream failed " + consecutiveFailures + " times consecutively", {
      resetAfterMs: RESET_TIMEOUT_MS,
    });
  } else if (circuitState === "half-open") {
    circuitState = "open";
    log("warn", "Circuit breaker re-opened — half-open probe failed");
  }
}

export async function checkUpstream() {
  const prev = upstreamHealthy;
  try {
    const res = await fetch(`${FACILITATOR_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    upstreamHealthy = res.ok;
    if (res.ok) recordSuccess();
    else recordFailure();
  } catch (err) {
    upstreamHealthy = false;
    recordFailure();
    if (prev !== false) {
      log("warn", "Upstream became unreachable", { error: err.message, facilitatorUrl: FACILITATOR_URL });
    }
  }
  if (prev === false && upstreamHealthy === true) {
    log("info", "Upstream recovered", { facilitatorUrl: FACILITATOR_URL });
  }
  // Refresh upstream supported networks periodically
  if (upstreamHealthy) {
    try {
      const sRes = await fetch(`${FACILITATOR_URL}/supported`, { signal: AbortSignal.timeout(5000) });
      if (sRes.ok) {
        const data = await sRes.json();
        upstreamNetworks = (data.kinds || []).map(k => k.network);
        if (data.signers) upstreamSigners = data.signers;
      }
    } catch { /* non-critical */ }
  }
}

export async function proxyToFacilitator(path, body, timeoutMs) {
  // Circuit breaker: if open, fail fast
  const state = getCircuitState();
  if (state === "open") {
    throw new Error("Circuit breaker is open — upstream unavailable");
  }

  const start = Date.now();
  const headers = { "Content-Type": "application/json" };
  if (FACILITATOR_API_KEY) {
    headers["X-API-Key"] = FACILITATOR_API_KEY;
  }

  try {
    const res = await fetch(`${FACILITATOR_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const duration = Date.now() - start;
    metrics.upstreamLatency.push({ duration, timestamp: Date.now() });
    const text = await res.text();

    recordSuccess();

    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      throw new Error(`Upstream returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
  } catch (err) {
    recordFailure();
    throw err;
  }
}
