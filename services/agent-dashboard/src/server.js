/**
 * T402 Agent Dashboard — AI Agent Payment Monitoring
 *
 * GET  /                        — Dashboard UI
 * GET  /api/v1/payments         — Payment history for an address
 * GET  /api/v1/balances/:addr   — Multi-chain balance check
 * GET  /api/v1/budget/:addr     — Budget usage vs policy limits
 * GET  /api/v1/stats/:addr      — Spending analytics
 * GET  /health                  — Health check
 */

import express from "express";

const app = express();
const PORT = process.env.PORT || 3405;

// Mock data for demo
function generatePayments(address) {
  const networks = ["eip155:8453", "eip155:42161", "eip155:1", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"];
  const tokens = ["USDC", "USDT0"];
  const services = ["Weather API", "LLM Inference", "Image Gen", "Analytics", "Translate"];
  const payments = [];

  for (let i = 0; i < 25; i++) {
    const ago = Math.floor(Math.random() * 86400 * 7);
    payments.push({
      id: `pay-${String(i + 1).padStart(4, "0")}`,
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      network: networks[i % networks.length],
      token: tokens[i % tokens.length],
      amount: String(Math.floor(Math.random() * 50000) + 500),
      to: "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      service: services[i % services.length],
      status: "settled",
      timestamp: new Date(Date.now() - ago * 1000).toISOString(),
    });
  }
  return payments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Payment history
app.get("/api/v1/payments", (req, res) => {
  const { address = "0xAgent", network, limit = "20" } = req.query;
  let payments = generatePayments(address);
  if (network) payments = payments.filter((p) => p.network === network);
  res.json({ payments: payments.slice(0, +limit), total: payments.length, address });
});

// Balances
app.get("/api/v1/balances/:address", (req, res) => {
  res.json({
    address: req.params.address,
    balances: [
      { network: "eip155:8453", token: "USDC", balance: "4523000", balanceFormatted: "4.52" },
      { network: "eip155:42161", token: "USDT0", balance: "12800000", balanceFormatted: "12.80" },
      { network: "eip155:1", token: "USDC", balance: "890000", balanceFormatted: "0.89" },
      { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", token: "USDC", balance: "7100000", balanceFormatted: "7.10" },
    ],
    totalUsd: "25.31",
  });
});

// Budget usage
app.get("/api/v1/budget/:address", (req, res) => {
  res.json({
    address: req.params.address,
    policy: {
      maxPerPayment: "1000000",
      maxPerSession: "10000000",
      maxPerDay: "50000000",
      allowedNetworks: ["eip155:8453", "eip155:42161"],
    },
    usage: {
      todaySpent: "3200000",
      todayLimit: "50000000",
      todayPercentage: 6.4,
      sessionSpent: "8500000",
      sessionLimit: "10000000",
      sessionPercentage: 85.0,
      paymentsThisHour: 12,
    },
  });
});

// Stats
app.get("/api/v1/stats/:address", (req, res) => {
  res.json({
    address: req.params.address,
    period: "7d",
    totalPayments: 47,
    totalSpent: "152300000",
    totalSpentUsd: "152.30",
    avgPaymentSize: "3240425",
    topServices: [
      { name: "LLM Inference", count: 18, amount: "90000000" },
      { name: "Weather API", count: 12, amount: "12000000" },
      { name: "Image Gen", count: 9, amount: "18000000" },
    ],
    byNetwork: {
      "eip155:8453": { count: 25, amount: "82000000" },
      "eip155:42161": { count: 15, amount: "55000000" },
    },
  });
});

// HTML Dashboard
app.get("/", (req, res) => {
  const address = req.query.address || "0xYourAgentWallet";
  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Agent Dashboard</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui;background:#0a0a0b;color:#e5e7eb;max-width:1000px;margin:0 auto;padding:2rem}
  h1{color:#50AF95} h2{color:#9ca3af;font-size:1.1rem;margin-top:2rem}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:1rem 0}
  .card{background:#111827;padding:1.5rem;border-radius:8px;border:1px solid #1f2937}
  .card-value{font-size:1.8rem;font-weight:bold;color:#50AF95}
  .card-label{color:#6b7280;font-size:.85rem;margin-top:.25rem}
  .bar{height:8px;background:#1f2937;border-radius:4px;overflow:hidden;margin-top:.5rem}
  .bar-fill{height:100%;background:#50AF95;border-radius:4px}
  input{background:#111827;border:1px solid #374151;color:#e5e7eb;padding:.75rem 1rem;border-radius:8px;width:100%;max-width:500px;margin:1rem 0;font-size:1rem}
  table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:1rem}
  th{text-align:left;color:#6b7280;padding:.5rem;border-bottom:2px solid #1f2937}
  td{padding:.5rem;border-bottom:1px solid #111827}
  code{color:#50AF95;font-size:.8em}
  a{color:#50AF95}
  .warn{color:#EF4444}
</style></head>
<body>
  <h1>🤖 Agent Payment Dashboard</h1>
  <form method="get"><input name="address" placeholder="Enter agent wallet address (0x...)" value="${address !== "0xYourAgentWallet" ? address : ""}"></form>
  
  <div class="cards">
    <div class="card"><div class="card-value">$25.31</div><div class="card-label">Total Balance</div></div>
    <div class="card"><div class="card-value">47</div><div class="card-label">Payments (7d)</div></div>
    <div class="card"><div class="card-value">$152.30</div><div class="card-label">Spent (7d)</div></div>
    <div class="card"><div class="card-value">$3.24</div><div class="card-label">Avg Payment</div></div>
  </div>

  <h2>Budget Usage</h2>
  <div class="cards">
    <div class="card">
      <div class="card-label">Session Budget</div>
      <div class="card-value ${85 > 80 ? "warn" : ""}">85%</div>
      <div class="bar"><div class="bar-fill" style="width:85%"></div></div>
      <div class="card-label">$8.50 / $10.00</div>
    </div>
    <div class="card">
      <div class="card-label">Daily Budget</div>
      <div class="card-value">6.4%</div>
      <div class="bar"><div class="bar-fill" style="width:6.4%"></div></div>
      <div class="card-label">$3.20 / $50.00</div>
    </div>
  </div>

  <h2>Top Services</h2>
  <table>
    <tr><th>Service</th><th>Payments</th><th>Amount</th></tr>
    <tr><td>LLM Inference</td><td>18</td><td>$90.00</td></tr>
    <tr><td>Weather API</td><td>12</td><td>$12.00</td></tr>
    <tr><td>Image Generation</td><td>9</td><td>$18.00</td></tr>
  </table>

  <h2>Recent Payments</h2>
  <table>
    <tr><th>Service</th><th>Amount</th><th>Network</th><th>Time</th></tr>
    <tr><td>LLM Inference</td><td>$0.05 USDC</td><td>Base</td><td>2 min ago</td></tr>
    <tr><td>Weather API</td><td>$0.001 USDC</td><td>Base</td><td>15 min ago</td></tr>
    <tr><td>Image Gen</td><td>$0.02 USDT0</td><td>Arbitrum</td><td>1 hr ago</td></tr>
    <tr><td>Analytics</td><td>$0.15 USDC</td><td>Base</td><td>3 hr ago</td></tr>
  </table>

  <p style="color:#6b7280;font-size:.8rem;margin-top:2rem">
    <a href="/api/v1/payments?address=${address}">Payments API</a> · 
    <a href="/api/v1/balances/${address}">Balances API</a> · 
    <a href="/api/v1/budget/${address}">Budget API</a> · 
    <a href="/api/v1/stats/${address}">Stats API</a> ·
    Powered by <a href="https://t402.io">T402</a>
  </p>
</body></html>`);
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "t402-agent-dashboard" }));

app.listen(PORT, () => {
  console.log("🤖 T402 Agent Dashboard on http://localhost:" + PORT);
});
