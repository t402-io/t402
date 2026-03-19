/**
 * T402 Payment Explorer — Transaction browser for t402 settlements
 *
 * GET /                           — HTML explorer UI
 * GET /api/v1/transactions        — List recent transactions
 * GET /api/v1/transactions/:hash  — Get transaction details
 * GET /api/v1/stats               — Protocol statistics
 * GET /api/v1/search?q=           — Search by hash, address
 * GET /health                     — Health check
 */

import express from "express";

const app = express();
const PORT = process.env.PORT || 3404;

// In-memory transaction store (replace with PostgreSQL + chain indexer in production)
const transactions = [];
let txId = 1;

// Seed with example transactions
const networks = ["eip155:8453", "eip155:42161", "eip155:1", "eip155:137", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "ton:mainnet", "tron:mainnet"];
const tokens = ["USDC", "USDT0", "USDT"];
const schemes = ["exact", "exact-legacy"];

function randomHex(len) {
  return "0x" + Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

for (let i = 0; i < 50; i++) {
  const net = networks[i % networks.length];
  const ago = Math.floor(Math.random() * 86400 * 7); // up to 7 days ago
  transactions.push({
    id: txId++,
    txHash: randomHex(64),
    network: net,
    scheme: net.startsWith("eip155") ? schemes[i % 2] : "exact",
    token: tokens[i % tokens.length],
    amount: String(Math.floor(Math.random() * 100000) + 1000),
    from: randomHex(40),
    to: randomHex(40),
    status: "confirmed",
    settledAt: new Date(Date.now() - ago * 1000).toISOString(),
    facilitator: "facilitator.t402.io",
  });
}
transactions.sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt));

// List transactions
app.get("/api/v1/transactions", (req, res) => {
  const { network, token, limit = "20", offset = "0" } = req.query;
  let results = [...transactions];
  if (network) results = results.filter((t) => t.network === network);
  if (token) results = results.filter((t) => t.token === token);
  res.json({
    transactions: results.slice(+offset, +offset + +limit),
    total: results.length,
    limit: +limit,
    offset: +offset,
  });
});

// Get transaction
app.get("/api/v1/transactions/:hash", (req, res) => {
  const tx = transactions.find((t) => t.txHash === req.params.hash);
  if (!tx) return res.status(404).json({ error: "Transaction not found" });
  res.json(tx);
});

// Search
app.get("/api/v1/search", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  if (!q) return res.json({ results: [], query: q });
  const results = transactions.filter(
    (t) => t.txHash.includes(q) || t.from.includes(q) || t.to.includes(q),
  );
  res.json({ results: results.slice(0, 20), query: q, total: results.length });
});

// Stats
app.get("/api/v1/stats", (_req, res) => {
  const byNetwork = {};
  const byToken = {};
  let totalAmount = 0;
  for (const tx of transactions) {
    byNetwork[tx.network] = (byNetwork[tx.network] || 0) + 1;
    byToken[tx.token] = (byToken[tx.token] || 0) + 1;
    totalAmount += parseInt(tx.amount);
  }
  res.json({
    totalTransactions: transactions.length,
    totalVolume: String(totalAmount),
    byNetwork,
    byToken,
    period: "7d",
  });
});

// HTML explorer
app.get("/", (_req, res) => {
  const recent = transactions.slice(0, 15);
  const rows = recent
    .map((tx) => {
      const amount = (parseInt(tx.amount) / 1e6).toFixed(2);
      const time = new Date(tx.settledAt).toLocaleString();
      return `<tr>
        <td><code>${tx.txHash.slice(0, 10)}...${tx.txHash.slice(-6)}</code></td>
        <td>${tx.network}</td>
        <td>${amount} ${tx.token}</td>
        <td><code>${tx.from.slice(0, 8)}...</code></td>
        <td><code>${tx.to.slice(0, 8)}...</code></td>
        <td>${time}</td>
      </tr>`;
    })
    .join("");

  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Explorer</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui;background:#0a0a0b;color:#e5e7eb;max-width:1200px;margin:0 auto;padding:2rem}
  h1{color:#50AF95} code{color:#50AF95;font-size:.85em}
  table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.9rem}
  th{text-align:left;color:#9ca3af;border-bottom:2px solid #1f2937;padding:.5rem}
  td{padding:.5rem;border-bottom:1px solid #111827}
  tr:hover{background:#111827}
  .stats{display:flex;gap:2rem;margin:1.5rem 0}
  .stat{background:#111827;padding:1rem 1.5rem;border-radius:8px;flex:1}
  .stat-value{font-size:1.5rem;font-weight:bold;color:#50AF95}
  .stat-label{color:#6b7280;font-size:.8rem}
  input{background:#111827;border:1px solid #374151;color:#e5e7eb;padding:.5rem 1rem;border-radius:6px;width:100%;max-width:400px;margin:1rem 0}
  a{color:#50AF95}
</style></head>
<body>
  <h1>T402 Payment Explorer</h1>
  <div class="stats">
    <div class="stat"><div class="stat-value">${transactions.length}</div><div class="stat-label">Transactions (7d)</div></div>
    <div class="stat"><div class="stat-value">${new Set(transactions.map((t) => t.network)).size}</div><div class="stat-label">Networks</div></div>
    <div class="stat"><div class="stat-value">${new Set(transactions.map((t) => t.from)).size}</div><div class="stat-label">Unique Payers</div></div>
  </div>
  <input placeholder="Search by tx hash or address..." onkeyup="if(event.key==='Enter')location='/api/v1/search?q='+this.value">
  <h2 style="font-size:1.1rem;color:#9ca3af">Recent Transactions</h2>
  <table><tr><th>Tx Hash</th><th>Network</th><th>Amount</th><th>From</th><th>To</th><th>Time</th></tr>${rows}</table>
  <p style="color:#6b7280;font-size:.8rem"><a href="/api/v1/transactions">JSON API</a> · <a href="/api/v1/stats">Stats</a> · Powered by <a href="https://t402.io">T402</a></p>
</body></html>`);
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "t402-explorer" }));

app.listen(PORT, () => {
  console.log("🔍 T402 Explorer running on http://localhost:" + PORT);
  console.log("   " + transactions.length + " transactions indexed");
});
