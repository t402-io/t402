/**
 * T402 Status Page — Public service health monitoring
 *
 * GET /              — HTML status page
 * GET /api/status    — JSON status for all services
 * GET /api/incidents — Incident history
 * GET /api/uptime    — Uptime percentages per service
 * GET /rss           — RSS feed of recent incidents
 * GET /health        — Own health check
 */

import express from "express";
import { recordCheck, getUptime, getIncidents, getRecentChecks } from "./history.js";

const app = express();
const PORT = process.env.PORT || 3403;

// CORS headers
app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const SERVICES = [
  { id: "site", name: "t402.io", url: "https://t402.io", type: "website" },
  { id: "docs", name: "docs.t402.io", url: "https://docs.t402.io", type: "website" },
  { id: "demo", name: "demo.t402.io", url: "https://demo.t402.io", type: "website" },
  { id: "facilitator", name: "Facilitator API", url: "https://facilitator.t402.io/health", type: "api" },
  { id: "scan2pay-fe", name: "Scan2Pay Frontend", url: "https://scan2pay.t402.io", type: "website" },
  { id: "scan2pay-api", name: "Scan2Pay API", url: "https://scan2pay-api.t402.io/health", type: "api" },
  { id: "grafana", name: "Grafana", url: "https://grafana-facilitator.t402.io", type: "monitoring" },
];

// Health check results cache
const healthCache = new Map();
const CHECK_INTERVAL = 60_000; // 1 minute

async function checkService(service) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(service.url, { signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    return {
      id: service.id,
      name: service.name,
      status: res.ok ? "operational" : "degraded",
      statusCode: res.status,
      latencyMs: latency,
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      id: service.id,
      name: service.name,
      status: "down",
      error: e.message,
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function checkAll() {
  const results = await Promise.allSettled(SERVICES.map(checkService));
  for (const r of results) {
    if (r.status === "fulfilled") {
      healthCache.set(r.value.id, r.value);
      recordCheck(r.value.id, r.value.status, r.value.latencyMs);
    }
  }
}

// Initial check + periodic (skip during tests)
if (process.env.NODE_ENV !== "test") {
  checkAll();
  setInterval(checkAll, CHECK_INTERVAL);
}

// JSON API — service statuses
app.get("/api/status", (_req, res) => {
  const services = Array.from(healthCache.values());
  const allOk = services.every((s) => s.status === "operational");
  res.json({
    overall: allOk ? "operational" : services.some((s) => s.status === "down") ? "major_outage" : "degraded",
    services,
    checkedAt: new Date().toISOString(),
    checkInterval: CHECK_INTERVAL,
  });
});

// JSON API — incident history
app.get("/api/incidents", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json({ incidents: getIncidents(limit) });
});

// JSON API — uptime percentages per service
app.get("/api/uptime", (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const uptimes = {};
  for (const service of SERVICES) {
    uptimes[service.id] = { name: service.name, uptimePercent: getUptime(service.id, days) };
  }
  res.json({ days, uptimes });
});

// RSS feed of recent incidents
app.get("/rss", (_req, res) => {
  const recentIncidents = getIncidents(20);
  const items = recentIncidents
    .map(
      (i) =>
        `    <item>
      <title>${escapeXml(i.title)}</title>
      <description>${escapeXml(i.serviceId)} — ${escapeXml(i.status)}${i.resolvedAt ? ` (resolved ${escapeXml(i.resolvedAt)})` : ""}</description>
      <pubDate>${new Date(i.startedAt).toUTCString()}</pubDate>
      <guid>incident-${i.id}</guid>
    </item>`,
    )
    .join("\n");

  res.type("application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>T402 Status — Incidents</title>
    <link>https://status.t402.io</link>
    <description>T402 service incident feed</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`);
});

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// HTML status page
app.get("/", (_req, res) => {
  const services = Array.from(healthCache.values());
  const allOk = services.every((s) => s.status === "operational");
  const overall = allOk ? "All Systems Operational" : "Some Systems Experiencing Issues";
  const color = allOk ? "#50AF95" : "#EF4444";

  const rows = services
    .map((s) => {
      const dot = s.status === "operational" ? "🟢" : s.status === "degraded" ? "🟡" : "🔴";
      const uptime = getUptime(s.id, 30);
      return `<tr><td>${dot} ${s.name}</td><td>${s.status}</td><td>${s.latencyMs}ms</td><td>${uptime}%</td></tr>`;
    })
    .join("");

  const recentIncidents = getIncidents(10);
  const incidentRows = recentIncidents.length === 0
    ? `<p style="color:#6b7280">No recent incidents.</p>`
    : recentIncidents
        .map((i) => {
          const badge = i.status === "ongoing"
            ? `<span style="color:#EF4444">ongoing</span>`
            : `<span style="color:#50AF95">resolved</span>`;
          return `<div style="border-bottom:1px solid #1f2937;padding:.5rem 0">
            <strong>${i.title}</strong> ${badge}<br>
            <small style="color:#6b7280">Started: ${i.startedAt}${i.resolvedAt ? ` · Resolved: ${i.resolvedAt}` : ""}</small>
          </div>`;
        })
        .join("");

  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Status</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="alternate" type="application/rss+xml" title="T402 Status Incidents" href="/rss">
<style>
  body{font-family:system-ui;background:#0a0a0b;color:#e5e7eb;max-width:800px;margin:0 auto;padding:2rem}
  h1{color:${color};font-size:1.5rem}
  h2{color:#9ca3af;font-size:1.1rem;margin-top:2.5rem}
  table{width:100%;border-collapse:collapse;margin:1rem 0}
  th{text-align:left;padding:.5rem 1rem;color:#9ca3af;font-size:.85rem}
  td{padding:.75rem 1rem;border-bottom:1px solid #1f2937}
  tr:hover{background:#111827}
  .footer{color:#6b7280;font-size:.8rem;margin-top:2rem}
  a{color:#50AF95}
</style></head>
<body>
  <h1>${overall}</h1>
  <p style="color:#9ca3af">Last checked: ${new Date().toISOString()}</p>
  <table>
    <tr><th>Service</th><th>Status</th><th>Latency</th><th>Uptime (30d)</th></tr>
    ${rows}
  </table>
  <h2>Recent Incidents</h2>
  ${incidentRows}
  <div class="footer">
    <p>Checks run every ${CHECK_INTERVAL / 1000}s ·
      <a href="/api/status">JSON API</a> ·
      <a href="/api/incidents">Incidents API</a> ·
      <a href="/api/uptime">Uptime API</a> ·
      <a href="/rss">RSS</a> ·
      Powered by <a href="https://t402.io">T402</a></p>
  </div>
</body></html>`);
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "t402-status" }));

export { app, SERVICES, healthCache, checkAll };

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log("T402 Status Page running on http://localhost:" + PORT);
  });
}
