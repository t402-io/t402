/**
 * Incident history and uptime tracking.
 */

const MAX_HISTORY = 1000;
const checks = []; // { serviceId, status, latencyMs, timestamp }
const incidents = []; // { id, serviceId, title, status, startedAt, resolvedAt }
let incidentId = 1;

export function recordCheck(serviceId, status, latencyMs) {
  checks.push({
    serviceId,
    status,
    latencyMs,
    timestamp: Date.now(),
  });
  if (checks.length > MAX_HISTORY) checks.splice(0, checks.length - MAX_HISTORY);

  // Auto-detect incidents
  if (status === "down") {
    const existing = incidents.find((i) => i.serviceId === serviceId && i.status === "ongoing");
    if (!existing) {
      incidents.push({
        id: incidentId++,
        serviceId,
        title: `${serviceId} is unreachable`,
        status: "ongoing",
        startedAt: new Date().toISOString(),
        resolvedAt: null,
      });
    }
  } else if (status === "operational") {
    const ongoing = incidents.find((i) => i.serviceId === serviceId && i.status === "ongoing");
    if (ongoing) {
      ongoing.status = "resolved";
      ongoing.resolvedAt = new Date().toISOString();
    }
  }
}

export function getUptime(serviceId, days = 30) {
  const cutoff = Date.now() - days * 86400_000;
  const relevant = checks.filter((c) => c.serviceId === serviceId && c.timestamp > cutoff);
  if (relevant.length === 0) return 100;
  const up = relevant.filter((c) => c.status === "operational").length;
  return Math.round((up / relevant.length) * 10000) / 100;
}

export function getIncidents(limit = 20) {
  return incidents.slice(-limit).reverse();
}

export function getRecentChecks(serviceId, limit = 100) {
  return checks.filter((c) => c.serviceId === serviceId).slice(-limit);
}
