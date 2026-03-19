/**
 * T402 Status Page — Public service health monitoring
 *
 * GET /              — HTML status page
 * GET /api/status    — JSON status for all services
 * GET /api/history   — Incident history
 * GET /health        — Own health check
 */

import express from "express";

const app = express();
const PORT = process.env.PORT || 3403;

const SERVICES = [
  { id: "site", name: "t402.io", url: "https://t402.io", type: "website" },
  { id: "docs", name: "docs.t402.io", url: "https://docs.t402.io", type: "website" },
  { id: "demo", name: "demo.t402.io", url: "https://demo.t402.io", type: "website" },
  { id: "facilitator", name: "Facilitator API", url: "https://facilitator.t402.io/health", type: "api" },
  { id: "scan2pay-fe", name: "Scan2Pay Frontend", url: "https://scan2pay.t402.io", type: "website" },
  { id: "scan2pay-api", name: "Scan2Pay API", url: "https://scan2pay-api.t402.io/actuator/health", type: "api" },
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
    }
  }
}

// Initial check + periodic
checkAll();
setInterval(checkAll, CHECK_INTERVAL);

// JSON API
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

// HTML status page
app.get("/", (_req, res) => {
  const services = Array.from(healthCache.values());
  const allOk = services.every((s) => s.status === "operational");
  const overall = allOk ? "All Systems Operational" : "Some Systems Experiencing Issues";
  const color = allOk ? "#50AF95" : "#EF4444";

  const rows = services
    .map((s) => {
      const dot = s.status === "operational" ? "🟢" : s.status === "degraded" ? "🟡" : "🔴";
      return `<tr><td>${dot} ${s.name}</td><td>${s.status}</td><td>${s.latencyMs}ms</td></tr>`;
    })
    .join("");

  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Status</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui;background:#0a0a0b;color:#e5e7eb;max-width:800px;margin:0 auto;padding:2rem}
  h1{color:${color};font-size:1.5rem}
  table{width:100%;border-collapse:collapse;margin:2rem 0}
  td{padding:.75rem 1rem;border-bottom:1px solid #1f2937}
  tr:hover{background:#111827}
  .footer{color:#6b7280;font-size:.8rem;margin-top:2rem}
  a{color:#50AF95}
</style></head>
<body>
  <h1>${overall}</h1>
  <p style="color:#9ca3af">Last checked: ${new Date().toISOString()}</p>
  <table><tr><th>Service</th><th>Status</th><th>Latency</th></tr>${rows}</table>
  <div class="footer">
    <p>Checks run every ${CHECK_INTERVAL / 1000}s · <a href="/api/status">JSON API</a> · Powered by <a href="https://t402.io">T402</a></p>
  </div>
</body></html>`);
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "t402-status" }));

app.listen(PORT, () => {
  console.log("📊 T402 Status Page running on http://localhost:" + PORT);
});
