/**
 * Upstream facilitator health checking and proxying.
 */
import { FACILITATOR_URL, FACILITATOR_API_KEY } from "./config.js";
import { log } from "./logger.js";
import { metrics } from "./metrics.js";

export let upstreamHealthy = null; // null = unknown, true/false after first check
export let upstreamNetworks = [];  // networks the upstream facilitator actually supports
export let upstreamSigners = null; // signers from upstream /supported response

export async function checkUpstream() {
  const prev = upstreamHealthy;
  try {
    const res = await fetch(`${FACILITATOR_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    upstreamHealthy = res.ok;
  } catch (err) {
    upstreamHealthy = false;
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
  const start = Date.now();
  const headers = { "Content-Type": "application/json" };
  if (FACILITATOR_API_KEY) {
    headers["X-API-Key"] = FACILITATOR_API_KEY;
  }
  const res = await fetch(`${FACILITATOR_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const duration = Date.now() - start;
  metrics.upstreamLatency.push({ duration, timestamp: Date.now() });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    throw new Error(`Upstream returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}
