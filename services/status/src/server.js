/**
 * T402 Status Page — Public service health monitoring
 *
 * GET /              — HTML status page (AJAX auto-updating)
 * GET /service/:id   — Per-service detail page with latency chart
 * GET /api/status    — JSON status for all services
 * GET /api/incidents — Incident history
 * GET /api/uptime    — Uptime percentages per service
 * GET /api/service/:id — Per-service detail JSON
 * GET /api/maintenance — Upcoming maintenance windows
 * POST /api/incidents — Create manual incident (API key required)
 * PATCH /api/incidents/:id — Update incident (API key required)
 * POST /api/maintenance — Add maintenance window (API key required)
 * DELETE /api/maintenance/:id — Remove maintenance window (API key required)
 * GET /badge/:id     — Per-service SVG badge
 * GET /badge         — Overall SVG status badge
 * GET /rss           — RSS feed of recent incidents
 * GET /metrics       — Prometheus metrics
 * GET /health        — Own health check
 */

import express from "express";
import compression from "compression";
import { timingSafeEqual } from "node:crypto";
import { SERVICES, SERVICE_MAP, CHECK_INTERVAL, RATE_LIMIT, loadServices } from "./config.js";
import { init, recordCheck, getUptime, getDailyUptime, getIncidents, getIncidentsByService, getRecentChecks, getPercentiles, addManualIncident, updateIncident, isInitialCheckComplete, markInitialCheckComplete, flush } from "./history.js";
import { checkAll } from "./checker.js";
import { notifyStatusChange } from "./notifications.js";
import { loadMaintenance, getUpcoming, addWindow, removeWindow } from "./maintenance.js";

const app = express();
const PORT = process.env.PORT || 3403;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

// --- Middleware ---

app.use(compression());
app.disable("x-powered-by");

// Security headers (HSTS + Permissions-Policy added)
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("X-Permitted-Cross-Domain-Policies", "none");
  res.set("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  next();
});

// CORS + OPTIONS preflight
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Global rate limiting (covers ALL routes, not just /api)
const rateLimitMap = new Map();
setInterval(() => rateLimitMap.clear(), 60_000);

app.use((req, res, next) => {
  if (req.path === "/health") return next(); // exempt health checks
  const ip = req.headers["cf-connecting-ip"] || req.ip;
  const count = (rateLimitMap.get(ip) || 0) + 1;
  rateLimitMap.set(ip, count);
  if (count > RATE_LIMIT) {
    return res.status(429).json({ error: "Too many requests" });
  }
  next();
});

// JSON body parsing for POST/PATCH
app.use(express.json());

// --- State ---

const healthCache = new Map();
const failCounts = new Map();

// --- Admin auth middleware ---

function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) return res.status(503).json({ error: "Admin API not configured" });
  const key = req.headers["x-api-key"] || "";
  if (typeof key !== "string" || key.length !== ADMIN_API_KEY.length ||
      !timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_API_KEY))) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}

// --- Check cycle ---

let checking = false;
async function runChecks() {
  if (checking) return;
  checking = true;
  try {
  await checkAll(SERVICES, {
    healthCache,
    failCounts,
    onCheck: (check) => recordCheck(check.id, check.name, check.status, check.latencyMs),
    onComplete: async () => {
      if (!isInitialCheckComplete()) markInitialCheckComplete();
      await loadMaintenance(); // hot-reload maintenance windows
      await flush();
    },
  });
  } finally { checking = false; }
}

// Initialize + periodic checks (skip during tests)
let checkInterval;
if (process.env.NODE_ENV !== "test") {
  await loadServices();
  await init({ onStatusChange: notifyStatusChange });
  await loadMaintenance();
  runChecks();
  checkInterval = setInterval(runChecks, CHECK_INTERVAL);
}

// --- JSON APIs ---

app.get("/api/status", (_req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const services = Array.from(healthCache.values());
  const ready = isInitialCheckComplete();
  const allOk = services.length > 0 && services.every((s) => s.status === "operational");
  res.json({
    overall: !ready ? "checking" : allOk ? "operational" : services.some((s) => s.status === "down") ? "major_outage" : "degraded",
    services,
    checkedAt: services.length > 0
      ? new Date(Math.max(...services.map((s) => new Date(s.checkedAt).getTime()))).toISOString()
      : new Date().toISOString(),
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
  const recentChecks = getRecentChecks(req.params.id, 288);
  const dailyUptime = getDailyUptime(req.params.id, 90);
  const serviceIncidents = getIncidentsByService(req.params.id, 100);
  const percentiles = getPercentiles(req.params.id, 288);
  res.json({ service: { ...service, current }, recentChecks, dailyUptime, incidents: serviceIncidents, percentiles });
});

app.get("/api/maintenance", (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({ upcoming: getUpcoming() });
});

// --- Admin APIs ---

const VALID_SEVERITIES = ["degraded", "down"];

app.post("/api/incidents", requireAdmin, async (req, res) => {
  const { serviceId, title, description, severity } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  if (typeof title !== "string" || title.length > 500) return res.status(400).json({ error: "title must be a string (max 500 chars)" });
  if (description && typeof description !== "string") return res.status(400).json({ error: "description must be a string" });
  if (severity && !VALID_SEVERITIES.includes(severity)) return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITIES.join(", ")}` });
  if (serviceId && !SERVICE_MAP.has(serviceId)) return res.status(400).json({ error: "Unknown serviceId" });
  const incident = addManualIncident({ serviceId, title, description, severity });
  await flush();
  res.status(201).json({ incident });
});

app.patch("/api/incidents/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid incident ID" });
  const { description, status } = req.body;
  if (status && status !== "resolved") return res.status(400).json({ error: 'status must be "resolved"' });
  if (description && typeof description !== "string") return res.status(400).json({ error: "description must be a string" });
  const result = updateIncident(id, { description, status });
  if (!result) return res.status(404).json({ error: "Incident not found" });
  await flush();
  res.json({ incident: result });
});

app.post("/api/maintenance", requireAdmin, async (req, res) => {
  try {
    const window = await addWindow(req.body);
    res.status(201).json({ window });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/maintenance/:id", requireAdmin, async (req, res) => {
  const removed = await removeWindow(req.params.id);
  if (!removed) return res.status(404).json({ error: "Window not found" });
  res.json({ removed: true });
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

// --- Prometheus Metrics ---

function sanitizeLabel(str) {
  return String(str).replace(/["\\}\n]/g, "_");
}

app.get("/metrics", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  let out = "# HELP t402_status_service_up Service status (1=operational, 0.5=degraded, 0=down)\n";
  out += "# TYPE t402_status_service_up gauge\n";
  for (const [id, s] of healthCache) {
    const val = s.status === "operational" ? 1 : s.status === "degraded" ? 0.5 : 0;
    out += `t402_status_service_up{service="${sanitizeLabel(id)}"} ${val}\n`;
  }
  out += "# HELP t402_status_service_latency_ms Service response latency in milliseconds\n";
  out += "# TYPE t402_status_service_latency_ms gauge\n";
  for (const [id, s] of healthCache) {
    out += `t402_status_service_latency_ms{service="${sanitizeLabel(id)}"} ${s.latencyMs}\n`;
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

function statusColor(status) {
  if (status === "operational") return "#50AF95";
  if (status === "maintenance") return "#6B7280";
  if (status === "degraded") return "#EAB308";
  return "#EF4444";
}

app.get("/badge/:id", (req, res) => {
  res.set("Cache-Control", "no-cache");
  const service = healthCache.get(req.params.id);
  if (!service) return res.status(404).type("text/plain").send("Not found");
  res.type("image/svg+xml").send(badgeSvg(service.name, service.status, statusColor(service.status)));
});

app.get("/badge", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  const services = Array.from(healthCache.values());
  const nonMaint = services.filter((s) => s.status !== "maintenance");
  const allOk = nonMaint.length > 0 && nonMaint.every((s) => s.status === "operational");
  const anyDown = nonMaint.some((s) => s.status === "down");
  const anyMaint = services.some((s) => s.status === "maintenance");
  const status = allOk ? "operational" : anyDown ? "outage" : anyMaint ? "maintenance" : "degraded";
  res.type("image/svg+xml").send(badgeSvg("T402", status, statusColor(status)));
});

// --- Shared CSS ---

const CSS = `*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e5e7eb;max-width:860px;margin:0 auto;padding:1.5rem}
h1{font-size:1.5rem;margin-bottom:.25rem}
h2{color:#b0b8c4;font-size:1.25rem;font-weight:700;margin-top:2.5rem}
a{color:#50AF95}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;position:relative}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th{text-align:left;padding:.5rem .75rem;color:#b0b8c4;font-size:.85rem;white-space:nowrap}
td{padding:.6rem .75rem;border-bottom:1px solid #1f2937}
@media(hover:hover){tr:hover td{background:#111827}}
td a{color:#e5e7eb;text-decoration:none;display:block}
td a:hover{color:#50AF95}
.group-header{color:#b0b8c4;font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;padding-top:1.2rem;border-bottom:1px solid #1f2937;font-weight:600}
.bar-row{padding:0 .75rem .5rem;border-bottom:none}
.uptime-bar{display:flex;gap:1px;height:26px;position:relative;cursor:pointer}
.uptime-bar .day{flex:1;min-width:2px;border-radius:2px}
.bar-tip{display:none;position:absolute;bottom:calc(100% + 6px);background:#1f2937;color:#e5e7eb;padding:3px 8px;border-radius:4px;font-size:11px;white-space:nowrap;z-index:10;pointer-events:none;transform:translateX(-50%)}
.bar-tip.show{display:block}
.uptime-legend{display:flex;gap:.75rem;font-size:.7rem;color:#9ca3af;margin-top:4px;justify-content:flex-end}
.uptime-legend span::before{content:'';display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:3px;vertical-align:middle}
.uptime-legend .l-ok::before{background:#50AF95}
.uptime-legend .l-deg::before{background:#EAB308}
.uptime-legend .l-down::before{background:#EF4444}
.uptime-legend .l-na::before{background:#374151}
.incident{border-bottom:1px solid #1f2937;padding:.75rem 0}
.incident-desc{color:#9ca3af;font-size:.85rem;margin-top:.25rem}
.incident-updates{border-left:2px solid #374151;margin:.5rem 0 0 .5rem;padding-left:.75rem}
.incident-updates div{position:relative;padding:.25rem 0}
.incident-updates div::before{content:'';position:absolute;left:calc(-.75rem - 5px);top:.55rem;width:8px;height:8px;border-radius:50%;background:#374151}
.footer{color:#9ca3af;font-size:.8rem;margin-top:2rem}
.footer a{margin:0 .25rem}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:.75rem;margin:1rem 0}
.stat{padding:.5rem}
.stat-label{color:#9ca3af;font-size:.75rem}
.stat-value{font-size:1.2rem;font-weight:600}
.dep-note{color:#9ca3af;font-size:.75rem;font-style:italic}
.status-dot{font-style:normal;margin-right:4px}
.stale-banner{display:none;background:#92400e;color:#fbbf24;padding:.5rem 1rem;border-radius:6px;margin:.5rem 0;font-size:.85rem;text-align:center}
.stale-banner.show{display:block}
.loading-row td{color:#9ca3af;text-align:center;padding:2rem}
.pulse{animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.flash{animation:flash .6s ease}
@keyframes flash{0%{background:#1a2332}100%{background:transparent}}
.svc-nav{display:flex;gap:1rem;align-items:center;margin-bottom:.5rem}
.svc-nav a{font-size:.9rem}
@media(max-width:600px){
  body{padding:1rem .75rem}
  h1{font-size:1.2rem}
  th.col-lat,td.col-lat{display:none}
  th,td{padding:.4rem .5rem;font-size:.85rem}
  .stat-grid{grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:.5rem}
  .uptime-legend{font-size:.65rem}
}`;

// --- Relative time helper (inline JS for browser) ---

const CLIENT_JS = `function relTime(iso){
  var d=new Date(iso),s=Math.floor((Date.now()-d)/1e3);
  if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago';
  if(s<2592000)return Math.floor(s/86400)+'d ago';
  return d.toLocaleDateString()}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function updateTimes(){document.querySelectorAll('.rt').forEach(function(el){
  var t=el.getAttribute('data-t');if(t){el.textContent=relTime(t);el.title=new Date(t).toLocaleString()}
})}
function initBarTips(container){
  var tip=container.querySelector('.bar-tip');if(!tip)return;
  var days=container.querySelectorAll('.day');
  function show(e){var d=e.target.getAttribute('data-tip');if(!d)return;tip.textContent=d;tip.classList.add('show');
    var r=e.target.getBoundingClientRect(),cr=container.getBoundingClientRect();
    tip.style.left=Math.min(Math.max(r.left-cr.left+r.width/2,40),cr.width-40)+'px'}
  function hide(){tip.classList.remove('show')}
  days.forEach(function(d){d.addEventListener('mouseenter',show);d.addEventListener('mouseleave',hide);
    d.addEventListener('touchstart',function(e){show(e);setTimeout(hide,2000)},{passive:true})});
}`;

// --- HTML Status Page ---

app.get("/", (_req, res) => {
  res.set("Cache-Control", "no-cache, must-revalidate");
  const services = Array.from(healthCache.values());
  const ready = isInitialCheckComplete();
  const nonMaint = services.filter((s) => s.status !== "maintenance");
  const allMaint = ready && services.length > 0 && nonMaint.length === 0;
  const allOk = ready && nonMaint.length > 0 && nonMaint.every((s) => s.status === "operational");
  const overall = !ready ? "Checking Services..." : allMaint ? "Scheduled Maintenance" : allOk ? "All Systems Operational" : "Some Systems Experiencing Issues";
  const overallColor = !ready ? "#9ca3af" : allMaint ? "#6B7280" : allOk ? "#50AF95" : "#F87171";

  // Group services
  const groups = [...new Set(SERVICES.map((s) => s.group))];
  const grouped = {};
  for (const g of groups) grouped[g] = services.filter((s) => s.group === g);

  // Build service rows with uptime bars
  let rows = "";
  for (const g of groups) {
    if (!grouped[g] || grouped[g].length === 0) continue;
    rows += `<tr><td colspan="4" class="group-header">${g}</td></tr>`;
    for (const s of grouped[g]) {
      const dotEmoji = s.status === "operational" ? "🟢" : s.status === "maintenance" ? "🔵" : s.status === "degraded" ? "🟡" : "🔴";
      const uptime = getUptime(s.id, 30);
      const uptimeStr = uptime === null ? "N/A" : uptime + "%";
      const dailyData = getDailyUptime(s.id, 90);
      const bars = dailyData
        .map((d) => {
          const c = d.uptimePercent === null ? "#374151" : d.uptimePercent >= 99 ? "#50AF95" : d.uptimePercent >= 95 ? "#EAB308" : "#EF4444";
          const tip = d.uptimePercent === null ? `${d.date}: no data` : `${d.date}: ${d.uptimePercent}%`;
          return `<div class="day" style="background:${c}" data-tip="${escapeXml(tip)}"></div>`;
        })
        .join("");

      // Dependency note
      const svcConfig = SERVICE_MAP.get(s.id);
      let depNote = "";
      if (svcConfig?.dependsOn?.length) {
        const downDeps = svcConfig.dependsOn.filter((depId) => {
          const dep = healthCache.get(depId);
          return dep && dep.status !== "operational";
        });
        if (downDeps.length > 0) {
          const names = downDeps.map((id) => SERVICE_MAP.get(id)?.name || id).join(", ");
          depNote = `<span class="dep-note">Affected by: ${escapeXml(names)}</span>`;
        }
      }

      rows += `<tr data-svc="${escapeXml(s.id)}">
        <td><a href="/service/${escapeXml(s.id)}"><span class="status-dot" role="img" aria-label="${escapeXml(s.status)}">${dotEmoji}</span>${escapeXml(s.name)}</a> ${depNote}</td>
        <td class="col-status">${escapeXml(s.status)}</td>
        <td class="col-lat">${escapeXml(String(s.latencyMs))}ms</td>
        <td>${escapeXml(uptimeStr)}</td>
      </tr>
      <tr><td colspan="4" class="bar-row"><div class="uptime-bar" role="img" aria-label="90-day uptime for ${escapeXml(s.name)}">${bars}<div class="bar-tip"></div></div></td></tr>`;
    }
  }

  // Scheduled maintenance
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
            <strong>🔵 ${escapeXml(m.title)}</strong><br>
            <small style="color:#9ca3af">${escapeXml(svcName)} · ${start} — ${end}</small>
          </div>`;
        })
        .join("");

  // Loading skeleton
  if (!ready) {
    rows = `<tr class="loading-row"><td colspan="4"><span class="pulse">Checking all services...</span></td></tr>`;
  }

  const recentIncidents = getIncidents(10);
  const incidentRows =
    recentIncidents.length === 0
      ? `<p style="color:#9ca3af">No recent incidents.</p>`
      : recentIncidents
          .map((i) => {
            const badge =
              i.status === "ongoing"
                ? `<span style="color:#F87171">ongoing</span>`
                : `<span style="color:#50AF95">resolved</span>`;
            const desc = i.description ? `<div class="incident-desc">${escapeXml(i.description)}</div>` : "";
            return `<div class="incident">
            <strong>${escapeXml(i.title)}</strong> ${badge}<br>
            <small style="color:#9ca3af"><span class="rt" data-t="${i.startedAt}">Started: ${i.startedAt}</span>${i.resolvedAt ? ` · <span class="rt" data-t="${i.resolvedAt}">Resolved: ${i.resolvedAt}</span>` : ""}</small>
            ${desc}
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
<style>${CSS}</style></head>
<body>
  <h1 id="overall" style="color:${overallColor}">${overall}</h1>
  <p style="color:#9ca3af;font-size:.9rem" id="last-checked">Last checked: <span class="rt" data-t="${new Date().toISOString()}">${new Date().toISOString()}</span></p>
  <div class="table-wrap">
  <table>
    <tr><th>Service</th><th>Status</th><th class="col-lat">Latency</th><th>Uptime (30d)</th></tr>
    ${rows}
  </table>
  </div>
  <div class="uptime-legend"><span class="l-ok">Operational</span><span class="l-deg">Degraded</span><span class="l-down">Down</span><span class="l-na">No data</span></div>
  ${maintenanceHtml}
  <div class="stale-banner" id="stale"></div>
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
    ${CLIENT_JS}
    (function(){
      updateTimes();
      // Init uptime bar tooltips
      document.querySelectorAll('.uptime-bar').forEach(initBarTips);

      var lastChecked='',failCount=0;
      function poll(){
        fetch('/api/status').then(function(r){return r.json()}).then(function(d){
          failCount=0;
          var sb=document.getElementById('stale');if(sb)sb.classList.remove('show');
          if(d.checkedAt&&d.checkedAt!==lastChecked){
            lastChecked=d.checkedAt;
            var o=document.getElementById('overall');
            if(o){
              var txt=d.overall==='operational'?'All Systems Operational':d.overall==='checking'?'Checking Services...':'Some Systems Experiencing Issues';
              var clr=d.overall==='operational'?'#50AF95':d.overall==='checking'?'#9ca3af':'#F87171';
              o.textContent=txt;o.style.color=clr;
            }
            var dots={operational:'🟢',maintenance:'🔵',degraded:'🟡',down:'🔴'};
            d.services.forEach(function(s){
              var row=document.querySelector('tr[data-svc="'+s.id+'"]');
              if(!row)return;
              var a=row.querySelector('a');
              if(a){var sp=a.querySelector('.status-dot');if(sp){sp.textContent=dots[s.status]||'🔴';sp.setAttribute('aria-label',s.status)}}
              var cs=row.querySelector('.col-status');if(cs){cs.textContent=s.status;cs.classList.add('flash')}
              var cl=row.querySelector('.col-lat');if(cl)cl.textContent=s.latencyMs+'ms';
            });
            // Refresh incidents
            fetch('/api/incidents?limit=10').then(function(r){return r.json()}).then(function(id2){
              var ih=document.getElementById('incidents');
              if(!ih||!id2.incidents)return;
              if(id2.incidents.length===0){ih.innerHTML='<p style="color:#9ca3af">No recent incidents.</p>';return}
              ih.innerHTML=id2.incidents.map(function(i){
                var b=i.status==='ongoing'?'<span style="color:#F87171">ongoing</span>':'<span style="color:#50AF95">resolved</span>';
                var desc=i.description?'<div class="incident-desc">'+esc(i.description)+'</div>':'';
                return '<div class="incident"><strong>'+esc(i.title)+'</strong> '+b+'<br><small style="color:#9ca3af"><span class="rt" data-t="'+esc(i.startedAt)+'">'+esc(i.startedAt)+'</span>'+(i.resolvedAt?' · <span class="rt" data-t="'+esc(i.resolvedAt)+'">'+esc(i.resolvedAt)+'</span>':'')+'</small>'+desc+'</div>'
              }).join('');
              updateTimes();
            }).catch(function(){});
            var lc=document.getElementById('last-checked');
            if(lc){var sp=lc.querySelector('.rt');if(sp){sp.setAttribute('data-t',d.checkedAt)}}
            updateTimes();
          }
        }).catch(function(){
          failCount++;
          if(failCount>=3){
            var sb=document.getElementById('stale');
            if(sb){sb.textContent='Unable to reach status API — data may be outdated';sb.classList.add('show')}
          }
        }).finally(function(){setTimeout(poll,30000)});
      }
      setTimeout(poll,30000);
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
  const serviceIncidents = getIncidentsByService(req.params.id, 100);
  const pct = getPercentiles(req.params.id, 288);

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
    // Build invisible hover circles for interactivity
    const circles = recentChecks
      .map((c, i) => {
        const x = (i / (recentChecks.length - 1)) * w;
        const y = h - (c.latencyMs / maxLat) * (h - 10);
        const time = new Date(c.timestamp).toISOString();
        return `<circle cx="${x}" cy="${y}" r="8" fill="transparent" data-lat="${c.latencyMs}" data-time="${time}"><title>${c.latencyMs}ms</title></circle>`;
      })
      .join("");
    sparkline = `<div style="position:relative"><svg id="sparkline" viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px;margin:1rem 0">
      <polyline points="${points}" fill="none" stroke="#50AF95" stroke-width="2"/>
      ${circles}
      <text x="0" y="12" fill="#9ca3af" font-size="11">${maxLat}ms</text>
      <text x="0" y="${h}" fill="#9ca3af" font-size="11">0ms</text>
      <text x="0" y="${h - 4}" fill="#9ca3af" font-size="10" dy="12">24h ago</text>
      <text x="${w}" y="${h - 4}" fill="#9ca3af" font-size="10" text-anchor="end" dy="12">now</text>
    </svg><div id="spark-tip" style="display:none;position:absolute;background:#1f2937;color:#e5e7eb;padding:3px 8px;border-radius:4px;font-size:11px;white-space:nowrap;pointer-events:none;z-index:10"></div></div>`;
  }

  // Uptime bar (with CSS tooltips)
  const bars = dailyData
    .map((d) => {
      const c = d.uptimePercent === null ? "#374151" : d.uptimePercent >= 99 ? "#50AF95" : d.uptimePercent >= 95 ? "#EAB308" : "#EF4444";
      const tip = d.uptimePercent === null ? `${d.date}: no data` : `${d.date}: ${d.uptimePercent}%`;
      return `<div class="day" style="background:${c}" data-tip="${escapeXml(tip)}"></div>`;
    })
    .join("");

  const dot = current?.status === "operational" ? "🟢" : current?.status === "maintenance" ? "🔵" : current?.status === "degraded" ? "🟡" : "🔴";

  // Percentile stats
  const pctHtml = pct
    ? `<div class="stat"><div class="stat-label">p50</div><div class="stat-value" id="svc-p50">${pct.p50}ms</div></div>
       <div class="stat"><div class="stat-label">p95</div><div class="stat-value" id="svc-p95">${pct.p95}ms</div></div>
       <div class="stat"><div class="stat-label">p99</div><div class="stat-value" id="svc-p99">${pct.p99}ms</div></div>`
    : "";

  const incidentHtml =
    serviceIncidents.length === 0
      ? `<p style="color:#9ca3af">No incidents recorded.</p>`
      : serviceIncidents
          .map(
            (i) => {
              const updatesHtml = i.updates?.length
                ? `<div class="incident-updates">${i.updates.map((u) => `<div><small style="color:#9ca3af"><span class="rt" data-t="${u.timestamp}">${u.timestamp}</span> — ${escapeXml(u.description)}</small></div>`).join("")}</div>`
                : "";
              const desc = i.description ? `<div class="incident-desc">${escapeXml(i.description)}</div>` : "";
              return `<div class="incident"><strong>${escapeXml(i.title)}</strong> <span style="color:${i.status === "ongoing" ? "#F87171" : "#50AF95"}">${escapeXml(i.status)}</span><br><small style="color:#9ca3af"><span class="rt" data-t="${i.startedAt}">${i.startedAt}</span>${i.resolvedAt ? ` · <span class="rt" data-t="${i.resolvedAt}">${i.resolvedAt}</span>` : ""}</small>${desc}${updatesHtml}</div>`;
            },
          )
          .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head><title>${escapeXml(service.name)} — T402 Status</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeXml(service.name)} status — T402 health monitoring">
<meta property="og:title" content="${escapeXml(service.name)} — T402 Status">
<meta property="og:description" content="${escapeXml(current?.status || 'unknown')} · ${escapeXml(uptimeStr)} uptime (30d)">
<meta property="og:url" content="https://status.t402.io/service/${escapeXml(service.id)}">
<meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='%2350AF95'/></svg>">
<noscript><meta http-equiv="refresh" content="60"></noscript>
<style>${CSS}</style></head>
<body>
  <div class="svc-nav"><a href="/">&larr; All services</a></div>
  <h1><span class="status-dot" role="img" aria-label="${escapeXml(current?.status || "unknown")}">${dot}</span>${escapeXml(service.name)}</h1>
  <div class="stat-grid">
    <div class="stat"><div class="stat-label">Status</div><div class="stat-value" id="svc-status">${escapeXml(current?.status || "unknown")}</div></div>
    <div class="stat"><div class="stat-label">Latency</div><div class="stat-value" id="svc-latency">${escapeXml(String(current?.latencyMs || "—"))}ms</div></div>
    <div class="stat"><div class="stat-label">Uptime (30d)</div><div class="stat-value">${escapeXml(uptimeStr)}</div></div>
    <div class="stat"><div class="stat-label">Type</div><div class="stat-value">${escapeXml(service.type)}</div></div>
    ${pctHtml}
  </div>
  <h2>Response Time (24h)</h2>
  ${sparkline || '<p style="color:#9ca3af">Not enough data yet.</p>'}
  <h2>90-Day Uptime</h2>
  <div class="uptime-bar" role="img" aria-label="90-day uptime">${bars}<div class="bar-tip"></div></div>
  <div class="uptime-legend"><span class="l-ok">Operational</span><span class="l-deg">Degraded</span><span class="l-down">Down</span><span class="l-na">No data</span></div>
  <h2>Incidents</h2>
  ${incidentHtml}
  <script>
    ${CLIENT_JS}
    updateTimes();
    document.querySelectorAll('.uptime-bar').forEach(initBarTips);
    // Sparkline hover tooltip
    (function(){
      var svg=document.getElementById('sparkline'),tip=document.getElementById('spark-tip');
      if(svg&&tip){
        svg.querySelectorAll('circle').forEach(function(c){
          c.addEventListener('mouseenter',function(e){
            var lat=c.getAttribute('data-lat'),t=c.getAttribute('data-time');
            tip.textContent=lat+'ms · '+relTime(t);tip.title=new Date(t).toLocaleString();
            tip.style.display='block';
            var r=c.getBoundingClientRect(),pr=svg.parentElement.getBoundingClientRect();
            tip.style.left=Math.min(Math.max(r.left-pr.left,0),pr.width-80)+'px';
            tip.style.top=(r.top-pr.top-28)+'px';
          });
          c.addEventListener('mouseleave',function(){tip.style.display='none'});
        });
      }
    })();
    // Auto-refresh detail page
    (function(){
      var dots={operational:'🟢',maintenance:'🔵',degraded:'🟡',down:'🔴'};
      function poll(){
        fetch('/api/service/${escapeXml(service.id)}').then(function(r){return r.json()}).then(function(d){
          if(d.service&&d.service.current){
            var s=d.service.current;
            var st=document.getElementById('svc-status');if(st){st.textContent=s.status;st.classList.add('flash')}
            var lt=document.getElementById('svc-latency');if(lt)lt.textContent=(s.latencyMs||'—')+'ms';
            // Update dot
            var dot=document.querySelector('h1 .status-dot');
            if(dot){dot.textContent=dots[s.status]||'🔴';dot.setAttribute('aria-label',s.status)}
          }
          // Update percentiles
          if(d.percentiles){
            var pct=d.percentiles;
            var pg=document.querySelector('.stat-grid');
            if(pg){
              var p50=pg.querySelector('#svc-p50'),p95=pg.querySelector('#svc-p95'),p99=pg.querySelector('#svc-p99');
              if(p50)p50.textContent=pct.p50+'ms';if(p95)p95.textContent=pct.p95+'ms';if(p99)p99.textContent=pct.p99+'ms';
            }
          }
          // Update incidents
          if(d.incidents){
            var ih=document.querySelector('h2:last-of-type');
            if(ih&&ih.nextElementSibling){
              var container=ih.nextElementSibling;
              // Find all incidents after the h2
              var html='';
              if(d.incidents.length===0){html='<p style="color:#9ca3af">No incidents recorded.</p>'}
              else{html=d.incidents.map(function(i){
                var b=i.status==='ongoing'?'<span style="color:#F87171">ongoing</span>':'<span style="color:#50AF95">resolved</span>';
                var desc=i.description?'<div class="incident-desc">'+esc(i.description)+'</div>':'';
                var ups=i.updates&&i.updates.length?'<div class="incident-updates">'+i.updates.map(function(u){
                  return '<div><small style="color:#9ca3af"><span class="rt" data-t="'+esc(u.timestamp)+'">'+esc(u.timestamp)+'</span> — '+esc(u.description)+'</small></div>'
                }).join('')+'</div>':'';
                return '<div class="incident"><strong>'+esc(i.title)+'</strong> '+b+'<br><small style="color:#9ca3af"><span class="rt" data-t="'+esc(i.startedAt)+'">'+esc(i.startedAt)+'</span>'+(i.resolvedAt?' · <span class="rt" data-t="'+esc(i.resolvedAt)+'">'+esc(i.resolvedAt)+'</span>':'')+'</small>'+desc+ups+'</div>'
              }).join('')}
              // Replace incidents section content
              var wrapper=document.createElement('div');wrapper.innerHTML=html;
              var parent=ih.parentElement;
              // Remove old incident elements after the h2
              while(ih.nextElementSibling)ih.nextElementSibling.remove();
              while(wrapper.firstChild)parent.appendChild(wrapper.firstChild);
            }
          }
          updateTimes();
        }).catch(function(){}).finally(function(){setTimeout(poll,30000)});
      }
      setTimeout(poll,30000);
    })();
  </script>
</body></html>`);
});

// --- Utility ---

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

export { app, healthCache };

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
    setTimeout(() => process.exit(0), 10_000);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
