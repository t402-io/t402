/**
 * T402 Status Page — Public service health monitoring
 *
 * GET /              — HTML status page (auto-refreshing)
 * GET /api/status    — JSON status for all services
 * GET /api/incidents — Incident history
 * GET /api/uptime    — Uptime percentages per service
 * GET /api/service/:id — Per-service detail with latency trend
 * GET /badge/:id     — SVG status badge
 * GET /badge         — Overall SVG status badge
 * GET /rss           — RSS feed of recent incidents
 * GET /metrics       — Prometheus metrics
 * GET /health        — Own health check
 */

import express from "express";
import compression from "compression";
import { init, recordCheck, getUptime, getDailyUptime, getIncidents, getRecentChecks, flush } from "./history.js";
import { notifyStatusChange } from "./notifications.js";
import { loadMaintenance, getUpcoming, isInMaintenance } from "./maintenance.js";

const app = express();

// Rate limiting — 60 requests per minute per IP
const rateLimitMap = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10);

setInterval(() => rateLimitMap.clear(), 60_000);

function rateLimit(req, res, next) {
  const ip = req.headers['cf-connecting-ip'] || req.ip;
  const count = (rateLimitMap.get(ip) || 0) + 1;
  rateLimitMap.set(ip, count);
  if (count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
}

// Compression
app.use(compression());

// Security headers
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  next();
});

const PORT = process.env.PORT || 3403;

// CORS headers
app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const SERVICES = [
  // Vercel-hosted
  { id: "site", name: "t402.io", url: "https://t402.io", type: "website", group: "Vercel" },
  { id: "docs", name: "docs.t402.io", url: "https://docs.t402.io", type: "website", group: "Vercel" },
  { id: "demo", name: "demo.t402.io", url: "https://demo.t402.io", type: "website", group: "Vercel" },
  // Core services
  { id: "facilitator", name: "Facilitator API", url: "https://facilitator.t402.io/health", type: "api", group: "Core", expect: "healthy" },
  { id: "scan2pay-fe", name: "Scan2Pay Frontend", url: "https://scan2pay.t402.io", type: "website", group: "Core" },
  { id: "scan2pay-api", name: "Scan2Pay API", url: "https://scan2pay-api.t402.io/health", type: "api", group: "Core", expect: "OK" },
  { id: "grafana", name: "Grafana", url: "https://grafana-facilitator.t402.io", type: "monitoring", group: "Core" },
  // New services
  { id: "bazaar", name: "Bazaar", url: "https://bazaar.t402.io/health", type: "api", group: "New", expect: "ok" },
  { id: "explorer", name: "Explorer", url: "https://explorer.t402.io/health", type: "api", group: "New", expect: "ok" },
  { id: "dashboard", name: "Agent Dashboard", url: "https://agents.t402.io/health", type: "api", group: "New", expect: "ok" },
  { id: "sandbox", name: "Sandbox", url: "https://sandbox.t402.io/health", type: "api", group: "New", expect: "ok" },
];

// Build service lookup
const SERVICE_MAP = new Map(SERVICES.map((s) => [s.id, s]));

// Health check results cache
const healthCache = new Map();
const CHECK_INTERVAL = 300_000; // 5 minutes
const failCounts = new Map(); // consecutive failure tracking
const FAIL_THRESHOLD = 2; // require 2 consecutive failures before marking down

async function checkService(service) {
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
    }

    // During maintenance, override status to "maintenance"
    const maint = isInMaintenance(service.id);
    if (maint && (!isUp || !bodyValid)) {
      return { id: service.id, name: service.name, group: service.group, status: "maintenance", statusCode: res.status, latencyMs: latency, checkedAt: new Date().toISOString() };
    }
    if (!isUp) {
      return { id: service.id, name: service.name, group: service.group, status: "degraded", statusCode: res.status, latencyMs: latency, checkedAt: new Date().toISOString() };
    }
    if (!bodyValid) {
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

async function checkAll() {
  const results = await Promise.allSettled(SERVICES.map(checkService));
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const check = r.value;

    // Consecutive failure tracking — require FAIL_THRESHOLD failures before marking down/degraded
    if (check.status === "down" || check.status === "degraded") {
      const count = (failCounts.get(check.id) || 0) + 1;
      failCounts.set(check.id, count);
      if (count < FAIL_THRESHOLD) {
        // Keep previous status (or operational if first check)
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
    recordCheck(check.id, check.name, check.status, check.latencyMs);
  }
  // Persist to disk after each check cycle
  await flush();
}

// Initialize + periodic checks (skip during tests)
let checkInterval;
if (process.env.NODE_ENV !== "test") {
  await init({ onStatusChange: notifyStatusChange });
  await loadMaintenance();
  checkAll();
  checkInterval = setInterval(checkAll, CHECK_INTERVAL);
}

// --- JSON APIs ---

app.use('/api', rateLimit);

app.get("/api/status", (_req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const services = Array.from(healthCache.values());
  const allOk = services.every((s) => s.status === "operational");
  res.json({
    overall: allOk ? "operational" : services.some((s) => s.status === "down") ? "major_outage" : "degraded",
    services,
    checkedAt: new Date().toISOString(),
    checkInterval: CHECK_INTERVAL,
  });
});

app.get("/api/incidents", (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  res.json({ incidents: getIncidents(limit) });
});

app.get("/api/uptime", (req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const uptimes = {};
  for (const service of SERVICES) {
    uptimes[service.id] = { name: service.name, uptimePercent: getUptime(service.id, days) };
  }
  res.json({ days, uptimes });
});

app.get("/api/service/:id", (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const service = SERVICE_MAP.get(req.params.id);
  if (!service) return res.status(404).json({ error: "Service not found" });
  const current = healthCache.get(req.params.id);
  const recentChecks = getRecentChecks(req.params.id, 288); // 24h at 5-min intervals
  const dailyUptime = getDailyUptime(req.params.id, 90);
  const serviceIncidents = getIncidents(100).filter((i) => i.serviceId === req.params.id);
  res.json({ service: { ...service, current }, recentChecks, dailyUptime, incidents: serviceIncidents });
});

app.get("/api/maintenance", (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({ upcoming: getUpcoming() });
});

// --- RSS Feed ---

app.get("/rss", (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// --- Prometheus Metrics ---

app.get("/metrics", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  let out = "# HELP t402_status_service_up Service status (1=operational, 0.5=degraded, 0=down)\n";
  out += "# TYPE t402_status_service_up gauge\n";
  for (const [id, s] of healthCache) {
    const val = s.status === "operational" ? 1 : s.status === "degraded" ? 0.5 : 0;
    out += `t402_status_service_up{service="${id}"} ${val}\n`;
  }
  out += "# HELP t402_status_service_latency_ms Service response latency in milliseconds\n";
  out += "# TYPE t402_status_service_latency_ms gauge\n";
  for (const [id, s] of healthCache) {
    out += `t402_status_service_latency_ms{service="${id}"} ${s.latencyMs}\n`;
  }
  res.type("text/plain; version=0.0.4; charset=utf-8").send(out);
});

// --- SVG Badges ---

function badgeSvg(label, value, color) {
  const labelWidth = label.length * 6.5 + 12;
  const valueWidth = value.length * 6.5 + 12;
  const totalWidth = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${escapeXml(value)}</text>
  </g>
</svg>`;
}

app.get("/badge/:id", (req, res) => {
  res.set("Cache-Control", "no-cache");
  const service = healthCache.get(req.params.id);
  if (!service) return res.status(404).type("text/plain").send("Not found");
  const color = service.status === "operational" ? "#50AF95" : service.status === "degraded" ? "#EAB308" : "#EF4444";
  res.type("image/svg+xml").send(badgeSvg(service.name, service.status, color));
});

app.get("/badge", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  const services = Array.from(healthCache.values());
  const allOk = services.every((s) => s.status === "operational");
  const anyDown = services.some((s) => s.status === "down");
  const status = allOk ? "operational" : anyDown ? "outage" : "degraded";
  const color = allOk ? "#50AF95" : anyDown ? "#EF4444" : "#EAB308";
  res.type("image/svg+xml").send(badgeSvg("T402", status, color));
});

// --- HTML Status Page ---

app.get("/", (_req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  const services = Array.from(healthCache.values());
  const nonMaint = services.filter((s) => s.status !== "maintenance");
  const allOk = nonMaint.every((s) => s.status === "operational");
  const overall = allOk ? "All Systems Operational" : "Some Systems Experiencing Issues";
  const overallColor = allOk ? "#50AF95" : "#EF4444";

  // Group services
  const groups = ["Vercel", "Core", "New"];
  const grouped = {};
  for (const g of groups) grouped[g] = services.filter((s) => s.group === g);

  // Build service rows with uptime bars
  let rows = "";
  for (const g of groups) {
    if (grouped[g].length === 0) continue;
    rows += `<tr><td colspan="4" class="group-header">${g}</td></tr>`;
    for (const s of grouped[g]) {
      const dot = s.status === "operational" ? "🟢" : s.status === "maintenance" ? "🔵" : s.status === "degraded" ? "🟡" : "🔴";
      const uptime = getUptime(s.id, 30);
      const uptimeStr = uptime === null ? "N/A" : uptime + "%";
      const dailyData = getDailyUptime(s.id, 90);
      const bars = dailyData
        .map((d) => {
          const c = d.uptimePercent === null ? "#374151" : d.uptimePercent >= 99 ? "#50AF95" : d.uptimePercent >= 95 ? "#EAB308" : "#EF4444";
          const tip = d.uptimePercent === null ? `${d.date}: no data` : `${d.date}: ${d.uptimePercent}%`;
          return `<div class="day" style="background:${c}" title="${tip}"></div>`;
        })
        .join("");
      rows += `<tr>
        <td><a href="/service/${s.id}">${dot} ${escapeHtml(s.name)}</a></td>
        <td>${s.status}</td>
        <td>${s.latencyMs}ms</td>
        <td>${uptimeStr}</td>
      </tr>
      <tr><td colspan="4" class="bar-row"><div class="uptime-bar">${bars}</div></td></tr>`;
    }
  }

  // Scheduled maintenance section
  const upcoming = getUpcoming();
  const maintenanceHtml = upcoming.length === 0
    ? ""
    : `<h2>Scheduled Maintenance</h2>` +
      upcoming
        .map((m) => {
          const svcName = SERVICE_MAP.get(m.serviceId)?.name || m.serviceId || "All services";
          const start = new Date(m.startAt).toUTCString();
          const end = new Date(m.endAt).toUTCString();
          return `<div class="incident">
            <strong>🔵 ${escapeHtml(m.title)}</strong><br>
            <small style="color:#6b7280">${escapeHtml(svcName)} · ${start} — ${end}</small>
          </div>`;
        })
        .join("");

  const recentIncidents = getIncidents(10);
  const incidentRows =
    recentIncidents.length === 0
      ? `<p style="color:#6b7280">No recent incidents.</p>`
      : recentIncidents
          .map((i) => {
            const badge =
              i.status === "ongoing"
                ? `<span style="color:#EF4444">ongoing</span>`
                : `<span style="color:#50AF95">resolved</span>`;
            return `<div class="incident">
            <strong>${escapeHtml(i.title)}</strong> ${badge}<br>
            <small style="color:#6b7280">Started: ${i.startedAt}${i.resolvedAt ? ` · Resolved: ${i.resolvedAt}` : ""}</small>
          </div>`;
          })
          .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><title>T402 Status</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Real-time health monitoring for T402 services">
<meta property="og:title" content="T402 Status">
<meta property="og:description" content="Real-time health monitoring for T402 services">
<meta property="og:url" content="https://status.t402.io">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='${encodeURIComponent(overallColor)}'/></svg>">
<link rel="alternate" type="application/rss+xml" title="T402 Status Incidents" href="/rss">
<noscript><meta http-equiv="refresh" content="60"></noscript>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e5e7eb;max-width:860px;margin:0 auto;padding:1.5rem}
  h1{color:${overallColor};font-size:1.5rem;margin-bottom:.25rem}
  h2{color:#9ca3af;font-size:1.1rem;margin-top:2.5rem}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{width:100%;border-collapse:collapse;margin:1rem 0}
  th{text-align:left;padding:.5rem .75rem;color:#9ca3af;font-size:.85rem;white-space:nowrap}
  td{padding:.6rem .75rem;border-bottom:1px solid #1f2937}
  tr:hover td{background:#111827}
  td a{color:#e5e7eb;text-decoration:none}
  td a:hover{color:#50AF95}
  .group-header{color:#9ca3af;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;padding-top:1.2rem;border-bottom:1px solid #1f2937;font-weight:600}
  .bar-row{padding:0 .75rem .5rem;border-bottom:none}
  .uptime-bar{display:flex;gap:1px;height:14px}
  .uptime-bar .day{flex:1;min-width:2px;border-radius:1px;cursor:default}
  .incident{border-bottom:1px solid #1f2937;padding:.5rem 0}
  .footer{color:#6b7280;font-size:.8rem;margin-top:2rem}
  a{color:#50AF95}
  @media(max-width:600px){
    body{padding:1rem .75rem}
    h1{font-size:1.2rem}
    th,td{padding:.4rem .5rem;font-size:.85rem}
  }
</style></head>
<body>
  <h1>${overall}</h1>
  <p style="color:#9ca3af;font-size:.9rem" id="last-checked">Last checked: ${new Date().toISOString()}</p>
  <div class="table-wrap">
  <table>
    <tr><th>Service</th><th>Status</th><th>Latency</th><th>Uptime (30d)</th></tr>
    ${rows}
  </table>
  </div>
  ${maintenanceHtml}
  <h2>Recent Incidents</h2>
  <div id="incidents">${incidentRows}</div>
  <div class="footer">
    <p>Checks run every ${CHECK_INTERVAL / 1000}s ·
      <a href="/api/status">JSON</a> ·
      <a href="/api/incidents">Incidents</a> ·
      <a href="/api/uptime">Uptime</a> ·
      <a href="/rss">RSS</a> ·
      <a href="/metrics">Metrics</a> ·
      <a href="/badge">Badge</a> ·
      Powered by <a href="https://t402.io">T402</a></p>
  </div>
  <script>
    (function(){
      let lastChecked='${new Date().toISOString()}';
      setInterval(async()=>{
        try{
          const r=await fetch('/api/status');
          const d=await r.json();
          if(d.checkedAt&&d.checkedAt!==lastChecked){
            lastChecked=d.checkedAt;
            location.reload();
          }
        }catch{}
      },60000);
    })();
  </script>
</body></html>`);
});

// --- Per-service detail page ---

app.get("/service/:id", (req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  const service = SERVICE_MAP.get(req.params.id);
  if (!service) return res.status(404).type("text/plain").send("Service not found");
  const current = healthCache.get(req.params.id);
  const recentChecks = getRecentChecks(req.params.id, 288);
  const dailyData = getDailyUptime(req.params.id, 90);
  const uptime30 = getUptime(req.params.id, 30);
  const uptimeStr = uptime30 === null ? "N/A" : uptime30 + "%";
  const serviceIncidents = getIncidents(100).filter((i) => i.serviceId === req.params.id);

  // SVG sparkline for latency
  let sparkline = "";
  if (recentChecks.length > 1) {
    const maxLat = Math.max(...recentChecks.map((c) => c.latencyMs), 1);
    const w = 760;
    const h = 120;
    const points = recentChecks
      .map((c, i) => {
        const x = (i / (recentChecks.length - 1)) * w;
        const y = h - (c.latencyMs / maxLat) * (h - 10);
        return `${x},${y}`;
      })
      .join(" ");
    sparkline = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;margin:1rem 0">
      <polyline points="${points}" fill="none" stroke="#50AF95" stroke-width="2"/>
      <text x="0" y="12" fill="#6b7280" font-size="11">${maxLat}ms</text>
      <text x="0" y="${h}" fill="#6b7280" font-size="11">0ms</text>
    </svg>`;
  }

  // Uptime bar
  const bars = dailyData
    .map((d) => {
      const c = d.uptimePercent === null ? "#374151" : d.uptimePercent >= 99 ? "#50AF95" : d.uptimePercent >= 95 ? "#EAB308" : "#EF4444";
      const tip = d.uptimePercent === null ? `${d.date}: no data` : `${d.date}: ${d.uptimePercent}%`;
      return `<div class="day" style="background:${c}" title="${tip}"></div>`;
    })
    .join("");

  const dot = current?.status === "operational" ? "🟢" : current?.status === "maintenance" ? "🔵" : current?.status === "degraded" ? "🟡" : "🔴";
  const incidentHtml =
    serviceIncidents.length === 0
      ? `<p style="color:#6b7280">No incidents recorded.</p>`
      : serviceIncidents
          .map(
            (i) =>
              `<div class="incident"><strong>${escapeHtml(i.title)}</strong> <span style="color:${i.status === "ongoing" ? "#EF4444" : "#50AF95"}">${i.status}</span><br><small style="color:#6b7280">${i.startedAt}${i.resolvedAt ? " · " + i.resolvedAt : ""}</small></div>`,
          )
          .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><title>${escapeHtml(service.name)} — T402 Status</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%2350AF95'/></svg>">
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e5e7eb;max-width:860px;margin:0 auto;padding:1.5rem}
  h1{font-size:1.5rem;margin-bottom:.25rem}
  h2{color:#9ca3af;font-size:1rem;margin-top:2rem}
  a{color:#50AF95}
  .stat{display:inline-block;margin-right:2rem;margin-bottom:.5rem}
  .stat-label{color:#9ca3af;font-size:.8rem}
  .stat-value{font-size:1.2rem;font-weight:600}
  .uptime-bar{display:flex;gap:1px;height:20px;margin:1rem 0}
  .uptime-bar .day{flex:1;min-width:2px;border-radius:1px;cursor:default}
  .incident{border-bottom:1px solid #1f2937;padding:.5rem 0}
  @media(max-width:600px){body{padding:1rem .75rem}}
</style></head>
<body>
  <p><a href="/">&larr; All services</a></p>
  <h1>${dot} ${escapeHtml(service.name)}</h1>
  <div style="margin:1rem 0">
    <div class="stat"><div class="stat-label">Status</div><div class="stat-value">${current?.status || "unknown"}</div></div>
    <div class="stat"><div class="stat-label">Latency</div><div class="stat-value">${current?.latencyMs || "—"}ms</div></div>
    <div class="stat"><div class="stat-label">Uptime (30d)</div><div class="stat-value">${uptimeStr}</div></div>
    <div class="stat"><div class="stat-label">Type</div><div class="stat-value">${service.type}</div></div>
  </div>
  <h2>Response Time (24h)</h2>
  ${sparkline || '<p style="color:#6b7280">Not enough data yet.</p>'}
  <h2>90-Day Uptime</h2>
  <div class="uptime-bar">${bars}</div>
  <h2>Incidents</h2>
  ${incidentHtml}
</body></html>`);
});

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// --- Health check ---

app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json({ status: "ok", service: "t402-status" });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export { app, SERVICES, SERVICE_MAP, healthCache, checkAll };

// --- Start server with graceful shutdown ---

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(PORT, () => {
    console.log("T402 Status Page running on http://localhost:" + PORT);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    if (checkInterval) clearInterval(checkInterval);
    await flush();
    server.close(() => process.exit(0));
    // Force exit after 10s if connections don't drain
    setTimeout(() => process.exit(0), 10_000);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
