/**
 * Incident history and uptime tracking with optional file persistence.
 */

import { loadChecks, loadIncidents, saveChecks, saveIncidents } from "./storage.js";

const MAX_HISTORY = 100_000; // ~90 days for 11 services at 5-min intervals
const MAX_INCIDENTS = 10_000;
let checks = []; // { serviceId, status, latencyMs, timestamp }
let incidents = []; // { id, serviceId, title, status, severity, startedAt, resolvedAt }
let incidentId = 1;
let dirty = false;

// Notification callback — set via init()
let onStatusChange = null;

export async function init(opts = {}) {
  if (opts.onStatusChange) onStatusChange = opts.onStatusChange;
  const savedChecks = await loadChecks();
  if (savedChecks.length > 0) {
    checks = savedChecks;
  }
  const savedIncidents = await loadIncidents();
  if (savedIncidents.incidents?.length > 0) {
    incidents = savedIncidents.incidents;
    incidentId = savedIncidents.nextId || incidents.length + 1;
  }
}

export async function flush() {
  if (!dirty) return;
  try {
    await saveChecks(checks);
    await saveIncidents(incidents, incidentId);
    dirty = false;
  } catch (e) {
    console.error("Flush failed, will retry next cycle:", e.message);
  }
}

export function recordCheck(serviceId, serviceName, status, latencyMs) {
  checks.push({
    serviceId,
    status,
    latencyMs,
    timestamp: Date.now(),
  });
  if (checks.length > MAX_HISTORY) checks.splice(0, checks.length - MAX_HISTORY);
  dirty = true;

  // Auto-detect incidents
  if (status === "down" || status === "degraded") {
    const existing = incidents.find((i) => i.serviceId === serviceId && i.status === "ongoing");
    if (!existing) {
      const title = status === "down"
        ? `${serviceName} is unreachable`
        : `${serviceName} is degraded`;
      incidents.push({
        id: incidentId++,
        serviceId,
        title,
        severity: status,
        status: "ongoing",
        startedAt: new Date().toISOString(),
        resolvedAt: null,
      });
      if (incidents.length > MAX_INCIDENTS) incidents.splice(0, incidents.length - MAX_INCIDENTS);
      if (onStatusChange) onStatusChange({ serviceId, serviceName, from: "operational", to: status });
    }
  } else if (status === "operational") {
    const ongoing = incidents.find((i) => i.serviceId === serviceId && i.status === "ongoing");
    if (ongoing) {
      const prevStatus = ongoing.severity || "down";
      ongoing.status = "resolved";
      ongoing.resolvedAt = new Date().toISOString();
      if (onStatusChange) onStatusChange({ serviceId, serviceName, from: prevStatus, to: "operational" });
    }
  }
}

export function getUptime(serviceId, days = 30) {
  const cutoff = Date.now() - days * 86400_000;
  const relevant = checks.filter((c) => c.serviceId === serviceId && c.timestamp > cutoff);
  if (relevant.length === 0) return null;
  const up = relevant.filter((c) => c.status === "operational").length;
  return Math.round((up / relevant.length) * 10000) / 100;
}

export function getDailyUptime(serviceId, days = 90) {
  const result = [];
  const now = Date.now();
  for (let d = days - 1; d >= 0; d--) {
    const dayStart = now - (d + 1) * 86400_000;
    const dayEnd = now - d * 86400_000;
    const dayChecks = checks.filter(
      (c) => c.serviceId === serviceId && c.timestamp >= dayStart && c.timestamp < dayEnd,
    );
    const date = new Date(dayStart).toISOString().slice(0, 10);
    if (dayChecks.length === 0) {
      result.push({ date, uptimePercent: null });
    } else {
      const up = dayChecks.filter((c) => c.status === "operational").length;
      result.push({ date, uptimePercent: Math.round((up / dayChecks.length) * 10000) / 100 });
    }
  }
  return result;
}

export function getIncidents(limit = 20) {
  return incidents.slice(-limit).reverse();
}

export function getRecentChecks(serviceId, limit = 100) {
  return checks.filter((c) => c.serviceId === serviceId).slice(-limit);
}
