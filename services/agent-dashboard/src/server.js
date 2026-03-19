/**
 * T402 Agent Dashboard — AI Agent Payment Monitoring
 *
 * GET  /                          — Dashboard UI
 * GET  /api/v1/payments           — Payment history for an address
 * GET  /api/v1/balances/:addr     — Multi-chain balance check
 * GET  /api/v1/budget/:addr       — Budget usage vs policy limits
 * GET  /api/v1/stats/:addr        — Spending analytics
 * GET  /api/v1/alerts/:addr       — Active budget alerts
 * GET  /api/v1/export/:addr       — CSV export of payment history
 * GET  /health                    — Health check
 */

import express from "express";
import {
  generatePaymentHistory,
  generateBalances,
  generateBudget,
  generateStats,
  generateAlerts,
  exportPaymentsCsv,
} from "./data.js";

const app = express();
const PORT = process.env.PORT || 3405;

// ── CORS ─────────────────────────────────────────────────────────────

app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── API endpoints ────────────────────────────────────────────────────

// Payment history
app.get("/api/v1/payments", (req, res) => {
  const { address = "0xAgent", network, limit = "20", days = "7" } = req.query;
  let payments = generatePaymentHistory(address, +days);
  if (network) payments = payments.filter((p) => p.network === network);
  res.json({ payments: payments.slice(0, +limit), total: payments.length, address });
});

// Balances
app.get("/api/v1/balances/:address", (req, res) => {
  const { balances, totalUsd } = generateBalances(req.params.address);
  res.json({ address: req.params.address, balances, totalUsd });
});

// Budget usage
app.get("/api/v1/budget/:address", (req, res) => {
  const budget = generateBudget(req.params.address);
  res.json({ address: req.params.address, ...budget });
});

// Stats
app.get("/api/v1/stats/:address", (req, res) => {
  const { days = "7" } = req.query;
  const stats = generateStats(req.params.address, +days);
  res.json({ address: req.params.address, ...stats });
});

// Alerts
app.get("/api/v1/alerts/:address", (req, res) => {
  const alerts = generateAlerts(req.params.address);
  res.json({ address: req.params.address, alerts, count: alerts.length });
});

// CSV Export
app.get("/api/v1/export/:address", (req, res) => {
  const { days = "7" } = req.query;
  const csv = exportPaymentsCsv(req.params.address, +days);
  res.set("Content-Type", "text/csv");
  res.set("Content-Disposition", `attachment; filename="t402-payments-${req.params.address.slice(0, 10)}.csv"`);
  res.send(csv);
});

// ── HTML Dashboard ───────────────────────────────────────────────────

app.get("/", (req, res) => {
  const address = req.query.address || "0xYourAgentWallet";
  const hasAddress = address !== "0xYourAgentWallet";

  // Only generate data when a real address is provided
  const balData = hasAddress ? generateBalances(address) : null;
  const budget = hasAddress ? generateBudget(address) : null;
  const stats = hasAddress ? generateStats(address, 7) : null;
  const payments = hasAddress ? generatePaymentHistory(address, 7).slice(0, 15) : [];
  const alerts = hasAddress ? generateAlerts(address) : [];

  // Build network bar chart (text-based)
  let networkChart = "";
  if (stats && stats.byNetwork) {
    const entries = Object.entries(stats.byNetwork).sort(
      (a, b) => Number(b[1].amount) - Number(a[1].amount),
    );
    const maxAmt = entries.length > 0 ? Number(entries[0][1].amount) : 1;
    networkChart = entries
      .map(([net, d]) => {
        const pct = Math.round((Number(d.amount) / maxAmt) * 100);
        const label = net.replace("eip155:", "EIP-").replace("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "Solana").replace("ton:mainnet", "TON");
        const barW = Math.max(pct, 2);
        return `<div class="net-row">
          <span class="net-label">${label}</span>
          <div class="net-bar"><div class="net-fill" style="width:${barW}%"></div></div>
          <span class="net-val">$${(Number(d.amount) / 1e6).toFixed(2)} (${d.count})</span>
        </div>`;
      })
      .join("\n");
  }

  // Build alerts HTML
  let alertsHtml = "";
  if (alerts.length > 0) {
    alertsHtml = `<h2>Alerts</h2><div class="alerts">` +
      alerts
        .map(
          (a) =>
            `<div class="alert alert-${a.level}"><span class="alert-icon">${a.level === "critical" ? "!!!" : "(!)"}</span> ${a.message}</div>`,
        )
        .join("") +
      `</div>`;
  }

  // Build payments table rows
  const paymentRows = payments
    .map((p) => {
      const ago = timeAgo(new Date(p.timestamp));
      const netShort = p.networkLabel || p.network;
      return `<tr><td>${p.service}</td><td>$${p.amountFormatted} ${p.token}</td><td>${netShort}</td><td class="status-${p.status}">${p.status}</td><td>${ago}</td></tr>`;
    })
    .join("\n");

  // Summary cards
  const totalBal = balData ? balData.totalUsd : "--";
  const totalPay = stats ? stats.totalPayments : "--";
  const totalSpent = stats ? stats.totalSpentUsd : "--";
  const avgPay = stats ? stats.avgPaymentUsd : "--";

  // Budget section
  const sessionPct = budget ? budget.usage.sessionPercentage : 0;
  const dailyPct = budget ? budget.usage.todayPercentage : 0;
  const sessionClass = sessionPct >= 80 ? "warn" : "";
  const dailyClass = dailyPct >= 80 ? "warn" : "";
  const sessionSpentFmt = budget ? (Number(budget.usage.sessionSpent) / 1e6).toFixed(2) : "0";
  const sessionLimitFmt = budget ? (Number(budget.usage.sessionLimit) / 1e6).toFixed(2) : "0";
  const todaySpentFmt = budget ? (Number(budget.usage.todaySpent) / 1e6).toFixed(2) : "0";
  const todayLimitFmt = budget ? (Number(budget.usage.todayLimit) / 1e6).toFixed(2) : "0";

  // Top services
  const serviceRows = (stats ? stats.topServices : [])
    .map((s) => `<tr><td>${s.name}</td><td>${s.count}</td><td>$${(Number(s.amount) / 1e6).toFixed(2)}</td></tr>`)
    .join("\n");

  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Agent Dashboard</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e5e7eb;max-width:1060px;margin:0 auto;padding:1.5rem}
  h1{color:#50AF95;margin-bottom:.25rem} h2{color:#9ca3af;font-size:1.1rem;margin-top:2rem}
  .subtitle{color:#6b7280;font-size:.9rem;margin-bottom:1.5rem}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin:1rem 0}
  .card{background:#111827;padding:1.25rem;border-radius:8px;border:1px solid #1f2937}
  .card-value{font-size:1.7rem;font-weight:bold;color:#50AF95}
  .card-label{color:#6b7280;font-size:.82rem;margin-top:.2rem}
  .bar{height:8px;background:#1f2937;border-radius:4px;overflow:hidden;margin-top:.5rem}
  .bar-fill{height:100%;background:#50AF95;border-radius:4px;transition:width .3s}
  .warn .bar-fill{background:#F59E0B}
  .warn .card-value{color:#F59E0B}
  input{background:#111827;border:1px solid #374151;color:#e5e7eb;padding:.75rem 1rem;border-radius:8px;width:100%;max-width:520px;margin:1rem 0;font-size:1rem}
  input:focus{outline:none;border-color:#50AF95}
  table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:1rem}
  th{text-align:left;color:#6b7280;padding:.5rem;border-bottom:2px solid #1f2937;white-space:nowrap}
  td{padding:.5rem;border-bottom:1px solid #111827}
  code{color:#50AF95;font-size:.8em}
  a{color:#50AF95;text-decoration:none} a:hover{text-decoration:underline}
  .status-settled{color:#10B981} .status-pending{color:#F59E0B} .status-failed{color:#EF4444}
  .warn{color:#F59E0B}

  /* Alerts */
  .alerts{display:flex;flex-direction:column;gap:.5rem;margin-top:.75rem}
  .alert{padding:.75rem 1rem;border-radius:8px;font-size:.9rem}
  .alert-warning{background:#422006;border:1px solid #F59E0B;color:#FCD34D}
  .alert-critical{background:#450a0a;border:1px solid #EF4444;color:#FCA5A5}
  .alert-icon{font-weight:bold;margin-right:.5rem}

  /* Network chart */
  .net-row{display:flex;align-items:center;gap:.5rem;margin:.35rem 0;font-size:.85rem}
  .net-label{width:90px;text-align:right;color:#9ca3af;flex-shrink:0}
  .net-bar{flex:1;height:14px;background:#1f2937;border-radius:3px;overflow:hidden;min-width:60px}
  .net-fill{height:100%;background:#50AF95;border-radius:3px}
  .net-val{color:#e5e7eb;white-space:nowrap;flex-shrink:0;width:120px}

  /* Toolbar */
  .toolbar{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin-top:1rem}
  .btn{display:inline-block;padding:.5rem 1rem;border-radius:6px;background:#1f2937;color:#50AF95;border:1px solid #374151;font-size:.85rem;cursor:pointer;text-decoration:none}
  .btn:hover{background:#374151}

  /* Mobile */
  @media(max-width:640px){
    body{padding:1rem .75rem}
    .cards{grid-template-columns:1fr 1fr}
    .card{padding:1rem}
    .card-value{font-size:1.3rem}
    table{font-size:.75rem}
    th,td{padding:.35rem .25rem}
    .net-label{width:70px;font-size:.75rem}
    .net-val{width:100px;font-size:.75rem}
    .toolbar{flex-direction:column;align-items:stretch}
    input{max-width:100%}
  }
  @media(max-width:400px){
    .cards{grid-template-columns:1fr}
  }
</style></head>
<body>
  <h1>Agent Payment Dashboard</h1>
  <div class="subtitle">T402 Protocol — AI Agent Payment Monitoring</div>
  <form method="get"><input name="address" placeholder="Enter agent wallet address (0x...)" value="${hasAddress ? address : ""}"></form>

  ${alertsHtml}

  <div class="cards">
    <div class="card"><div class="card-value">$${totalBal}</div><div class="card-label">Total Balance</div></div>
    <div class="card"><div class="card-value">${totalPay}</div><div class="card-label">Payments (7d)</div></div>
    <div class="card"><div class="card-value">$${totalSpent}</div><div class="card-label">Spent (7d)</div></div>
    <div class="card"><div class="card-value">$${avgPay}</div><div class="card-label">Avg Payment</div></div>
  </div>

  <h2>Budget Usage</h2>
  <div class="cards">
    <div class="card ${sessionClass}">
      <div class="card-label">Session Budget</div>
      <div class="card-value">${sessionPct}%</div>
      <div class="bar"><div class="bar-fill" style="width:${Math.min(sessionPct, 100)}%"></div></div>
      <div class="card-label">$${sessionSpentFmt} / $${sessionLimitFmt}</div>
    </div>
    <div class="card ${dailyClass}">
      <div class="card-label">Daily Budget</div>
      <div class="card-value">${dailyPct}%</div>
      <div class="bar"><div class="bar-fill" style="width:${Math.min(dailyPct, 100)}%"></div></div>
      <div class="card-label">$${todaySpentFmt} / $${todayLimitFmt}</div>
    </div>
  </div>

  ${networkChart ? `<h2>Network Breakdown</h2><div style="margin-top:.75rem">${networkChart}</div>` : ""}

  <h2>Top Services</h2>
  <table>
    <tr><th>Service</th><th>Payments</th><th>Amount</th></tr>
    ${serviceRows || '<tr><td colspan="3" style="color:#6b7280">No data</td></tr>'}
  </table>

  <h2>Recent Payments</h2>
  <table>
    <tr><th>Service</th><th>Amount</th><th>Network</th><th>Status</th><th>Time</th></tr>
    ${paymentRows || '<tr><td colspan="5" style="color:#6b7280">No data</td></tr>'}
  </table>

  <div class="toolbar">
    <a class="btn" href="/api/v1/export/${address}?days=7">Export CSV</a>
    <a class="btn" href="/api/v1/payments?address=${address}">Payments API</a>
    <a class="btn" href="/api/v1/balances/${address}">Balances API</a>
    <a class="btn" href="/api/v1/budget/${address}">Budget API</a>
    <a class="btn" href="/api/v1/stats/${address}">Stats API</a>
    <a class="btn" href="/api/v1/alerts/${address}">Alerts API</a>
  </div>

  <p style="color:#6b7280;font-size:.8rem;margin-top:2rem">
    Powered by <a href="https://t402.io">T402</a>
  </p>
</body></html>`);
});

// ── Health ────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok", service: "t402-agent-dashboard" }));

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Start ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`T402 Agent Dashboard on http://localhost:${PORT}`);
});
