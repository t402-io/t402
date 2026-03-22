/**
 * Health check logic — checks all configured services in parallel.
 * Consecutive failure tracking prevents false positives from transient errors.
 */

import { isInMaintenance } from "./maintenance.js";
import { FAIL_THRESHOLD } from "./config.js";

export async function checkService(service) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(service.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "T402-StatusChecker/1.0" },
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const isUp = res.ok || res.status === 429;

    // Response body validation for API services
    let bodyValid = true;
    if (isUp && service.expect) {
      try {
        const body = await res.text();
        bodyValid = body.includes(service.expect);
      } catch {
        bodyValid = false;
      }
    } else {
      // Drain response body to allow connection reuse
      await res.body?.cancel().catch(() => {});
    }

    // During maintenance, override status
    const maint = isInMaintenance(service.id);
    if (maint && (!isUp || !bodyValid)) {
      return { id: service.id, name: service.name, group: service.group, status: "maintenance", statusCode: res.status, latencyMs: latency, checkedAt: new Date().toISOString() };
    }
    if (!isUp || !bodyValid) {
      return { id: service.id, name: service.name, group: service.group, status: "degraded", statusCode: res.status, latencyMs: latency, checkedAt: new Date().toISOString() };
    }
    return { id: service.id, name: service.name, group: service.group, status: "operational", statusCode: res.status, latencyMs: latency, checkedAt: new Date().toISOString() };
  } catch (e) {
    if (isInMaintenance(service.id)) {
      return { id: service.id, name: service.name, group: service.group, status: "maintenance", error: e.message, latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
    }
    return { id: service.id, name: service.name, group: service.group, status: "down", error: e.message, latencyMs: Date.now() - start, checkedAt: new Date().toISOString() };
  }
}

export async function checkAll(services, { healthCache, failCounts, onCheck, onComplete }) {
  const results = await Promise.allSettled(services.map(checkService));
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const check = r.value;

    // Consecutive failure tracking — require FAIL_THRESHOLD failures before marking down/degraded
    if (check.status === "down" || check.status === "degraded") {
      const count = (failCounts.get(check.id) || 0) + 1;
      failCounts.set(check.id, count);
      if (count < FAIL_THRESHOLD) {
        // Keep previous status, just update timestamp
        const prev = healthCache.get(check.id);
        if (prev) {
          prev.checkedAt = check.checkedAt;
          continue;
        }
      }
    } else {
      failCounts.set(check.id, 0);
    }

    healthCache.set(check.id, check);
    onCheck(check);
  }
  await onComplete();
}
