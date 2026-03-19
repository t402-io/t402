/**
 * T402 Payment Explorer — Transaction browser for t402 settlements
 *
 * GET /                           — HTML explorer UI
 * GET /api/v1/transactions        — List transactions (cursor-based pagination)
 * GET /api/v1/transactions/:hash  — Get transaction details
 * GET /api/v1/stats               — Protocol statistics
 * GET /api/v1/search?q=           — Search by hash, address
 * GET /api/v1/networks            — List unique networks with counts
 * GET /api/v1/tokens              — List unique tokens with counts
 * GET /health                     — Health check
 */

import express from "express";
import {
  seedTransactions,
  getTransactions,
  getTransaction,
  search,
  getStats,
} from "./indexer.js";

const app = express();
app.use(express.json());

// Security headers
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const PORT = process.env.PORT || 3404;

// CORS headers
app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Request logging
app.use((req, _res, next) => {
  const start = Date.now();
  const orig = _res.end.bind(_res);
  _res.end = function (...args) {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${_res.statusCode} ${ms}ms`);
    return orig(...args);
  };
  next();
});

// List transactions — supports cursor-based pagination
app.get("/api/v1/transactions", (req, res) => {
  const { network, token, scheme, limit = "20", cursor } = req.query;
  const result = getTransactions({
    network,
    token,
    scheme,
    limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
    cursor: cursor || undefined,
  });
  res.json(result);
});

// Get single transaction by hash
app.get("/api/v1/transactions/:hash", (req, res) => {
  const tx = getTransaction(req.params.hash);
  if (!tx) return res.status(404).json({ error: "Transaction not found" });
  res.json(tx);
});

// Search by hash or address
app.get("/api/v1/search", (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [], query: q, total: 0 });
  const results = search(q);
  res.json({ results, query: q, total: results.length });
});

// Protocol statistics
app.get("/api/v1/stats", (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  res.json(getStats(days));
});

// Networks with counts
app.get("/api/v1/networks", (_req, res) => {
  const { byNetwork } = getStats(30);
  const networks = Object.entries(byNetwork)
    .map(([network, count]) => ({ network, count }))
    .sort((a, b) => b.count - a.count);
  res.json({ networks, total: networks.length });
});

// Tokens with counts
app.get("/api/v1/tokens", (_req, res) => {
  const { byToken } = getStats(30);
  const tokens = Object.entries(byToken)
    .map(([token, count]) => ({ token, count }))
    .sort((a, b) => b.count - a.count);
  res.json({ tokens, total: tokens.length });
});

// HTML explorer UI
app.get("/", (_req, res) => {
  const stats = getStats(7);
  const { transactions: recent } = getTransactions({ limit: 20 });
  const { byNetwork } = getStats(30);
  const { byToken } = getStats(30);

  const networkOptions = Object.keys(byNetwork)
    .sort()
    .map((n) => `<option value="${n}">${n}</option>`)
    .join("");

  const tokenOptions = Object.keys(byToken)
    .sort()
    .map((t) => `<option value="${t}">${t}</option>`)
    .join("");

  const rows = recent
    .map((tx) => {
      const amount = (parseInt(tx.amount) / 1e6).toFixed(2);
      const time = new Date(tx.settledAt).toLocaleString();
      return `<tr onclick="location='/api/v1/transactions/${tx.txHash}'" style="cursor:pointer">
        <td><code>${tx.txHash.slice(0, 10)}...${tx.txHash.slice(-6)}</code></td>
        <td><span class="badge">${tx.network}</span></td>
        <td><span class="badge badge-token">${tx.token}</span></td>
        <td class="amount">${amount}</td>
        <td><code>${tx.from.slice(0, 8)}...</code></td>
        <td><code>${tx.to.slice(0, 8)}...</code></td>
        <td>${tx.scheme}</td>
        <td class="time">${time}</td>
      </tr>`;
    })
    .join("");

  const avgSize = stats.avgTransactionSize
    ? (parseInt(stats.avgTransactionSize) / 1e6).toFixed(2)
    : "0.00";
  const totalVol = (Number(stats.totalVolume) / 1e6).toFixed(2);

  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Explorer</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e5e7eb;max-width:1400px;margin:0 auto;padding:2rem}
  h1{color:#50AF95;font-size:1.5rem;margin-bottom:.5rem}
  h2{font-size:1rem;color:#9ca3af;margin:1.5rem 0 .5rem}
  code{color:#50AF95;font-size:.85em}
  a{color:#50AF95;text-decoration:none}
  a:hover{text-decoration:underline}

  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;margin:1.5rem 0}
  .stat{background:#111827;padding:1rem 1.25rem;border-radius:8px;border:1px solid #1f2937}
  .stat-value{font-size:1.4rem;font-weight:700;color:#50AF95}
  .stat-label{color:#6b7280;font-size:.75rem;margin-top:.25rem}

  .filters{display:flex;gap:.75rem;flex-wrap:wrap;margin:1rem 0;align-items:center}
  .filters select,.filters input{background:#111827;border:1px solid #374151;color:#e5e7eb;padding:.5rem .75rem;border-radius:6px;font-size:.85rem}
  .filters select{min-width:160px}
  .filters input{flex:1;min-width:200px;max-width:400px}
  .filters button{background:#50AF95;color:#fff;border:none;padding:.5rem 1rem;border-radius:6px;cursor:pointer;font-size:.85rem}
  .filters button:hover{background:#3d9478}
  .filters button.secondary{background:#374151}
  .filters button.secondary:hover{background:#4b5563}

  table{width:100%;border-collapse:collapse;margin:.5rem 0;font-size:.85rem}
  th{text-align:left;color:#9ca3af;border-bottom:2px solid #1f2937;padding:.6rem .5rem;white-space:nowrap}
  td{padding:.5rem;border-bottom:1px solid #111827;white-space:nowrap}
  tr:hover{background:#111827}
  .amount{font-weight:600;color:#e5e7eb;text-align:right}
  .time{color:#6b7280}
  .badge{background:#1f2937;padding:2px 8px;border-radius:4px;font-size:.8rem}
  .badge-token{background:#1a332d;color:#50AF95}

  .pagination{display:flex;gap:.75rem;align-items:center;margin:1rem 0}
  .pagination button:disabled{opacity:.4;cursor:not-allowed}

  footer{color:#6b7280;font-size:.8rem;margin-top:2rem;padding-top:1rem;border-top:1px solid #1f2937}
  footer a{margin:0 .25rem}
</style>
</head>
<body>
  <h1>T402 Payment Explorer</h1>
  <p style="color:#6b7280;font-size:.85rem">Real-time transaction browser for the T402 payment protocol</p>

  <div class="stats">
    <div class="stat"><div class="stat-value">${stats.totalTransactions}</div><div class="stat-label">Transactions (7d)</div></div>
    <div class="stat"><div class="stat-value">$${totalVol}</div><div class="stat-label">Volume (7d)</div></div>
    <div class="stat"><div class="stat-value">${Object.keys(byNetwork).length}</div><div class="stat-label">Networks</div></div>
    <div class="stat"><div class="stat-value">${stats.uniquePayers}</div><div class="stat-label">Unique Payers</div></div>
    <div class="stat"><div class="stat-value">${stats.uniqueRecipients}</div><div class="stat-label">Unique Recipients</div></div>
    <div class="stat"><div class="stat-value">$${avgSize}</div><div class="stat-label">Avg Tx Size</div></div>
  </div>

  <div class="filters">
    <select id="networkFilter" onchange="applyFilters()">
      <option value="">All Networks</option>
      ${networkOptions}
    </select>
    <select id="tokenFilter" onchange="applyFilters()">
      <option value="">All Tokens</option>
      ${tokenOptions}
    </select>
    <input id="searchInput" placeholder="Search by tx hash or address..." onkeyup="if(event.key==='Enter')doSearch()">
    <button onclick="doSearch()">Search</button>
    <button class="secondary" onclick="resetFilters()">Reset</button>
  </div>

  <h2>Recent Transactions</h2>
  <div style="overflow-x:auto">
    <table>
      <tr><th>Tx Hash</th><th>Network</th><th>Token</th><th style="text-align:right">Amount</th><th>From</th><th>To</th><th>Scheme</th><th>Time</th></tr>
      <tbody id="txBody">${rows}</tbody>
    </table>
  </div>

  <div class="pagination">
    <button id="prevBtn" class="secondary" disabled onclick="prevPage()">Previous</button>
    <span id="pageInfo" style="color:#6b7280;font-size:.85rem">Page 1</span>
    <button id="nextBtn" class="secondary" onclick="nextPage()">Next</button>
  </div>

  <footer>
    <a href="/api/v1/transactions">Transactions API</a> ·
    <a href="/api/v1/stats">Stats API</a> ·
    <a href="/api/v1/networks">Networks API</a> ·
    <a href="/api/v1/tokens">Tokens API</a> ·
    Powered by <a href="https://t402.io">T402</a>
  </footer>

  <script>
    let currentCursor = null;
    let cursorStack = [null];
    let page = 0;
    const PAGE_SIZE = 20;

    function buildUrl(cursor) {
      const net = document.getElementById('networkFilter').value;
      const tok = document.getElementById('tokenFilter').value;
      let url = '/api/v1/transactions?limit=' + PAGE_SIZE;
      if (net) url += '&network=' + encodeURIComponent(net);
      if (tok) url += '&token=' + encodeURIComponent(tok);
      if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
      return url;
    }

    async function loadPage(cursor) {
      const res = await fetch(buildUrl(cursor));
      const data = await res.json();
      renderRows(data.transactions);
      currentCursor = data.nextCursor;
      document.getElementById('nextBtn').disabled = !data.hasMore;
      document.getElementById('prevBtn').disabled = page === 0;
      document.getElementById('pageInfo').textContent = 'Page ' + (page + 1) + ' (' + data.total + ' total)';
    }

    function renderRows(txs) {
      document.getElementById('txBody').innerHTML = txs.map(function(tx) {
        var amount = (parseInt(tx.amount) / 1e6).toFixed(2);
        var time = new Date(tx.settledAt).toLocaleString();
        return '<tr onclick="location=\\'/api/v1/transactions/' + tx.txHash + '\\'\" style="cursor:pointer">'
          + '<td><code>' + tx.txHash.slice(0,10) + '...' + tx.txHash.slice(-6) + '</code></td>'
          + '<td><span class="badge">' + tx.network + '</span></td>'
          + '<td><span class="badge badge-token">' + tx.token + '</span></td>'
          + '<td class="amount">' + amount + '</td>'
          + '<td><code>' + tx.from.slice(0,8) + '...</code></td>'
          + '<td><code>' + tx.to.slice(0,8) + '...</code></td>'
          + '<td>' + tx.scheme + '</td>'
          + '<td class="time">' + time + '</td></tr>';
      }).join('');
    }

    function nextPage() {
      page++;
      cursorStack.push(currentCursor);
      loadPage(currentCursor);
    }

    function prevPage() {
      if (page > 0) {
        page--;
        cursorStack.pop();
        loadPage(cursorStack[cursorStack.length - 1]);
      }
    }

    function applyFilters() {
      page = 0;
      cursorStack = [null];
      loadPage(null);
    }

    function resetFilters() {
      document.getElementById('networkFilter').value = '';
      document.getElementById('tokenFilter').value = '';
      document.getElementById('searchInput').value = '';
      applyFilters();
    }

    async function doSearch() {
      var q = document.getElementById('searchInput').value.trim();
      if (!q) { applyFilters(); return; }
      var res = await fetch('/api/v1/search?q=' + encodeURIComponent(q));
      var data = await res.json();
      renderRows(data.results);
      document.getElementById('nextBtn').disabled = true;
      document.getElementById('prevBtn').disabled = true;
      document.getElementById('pageInfo').textContent = data.total + ' results';
    }
  </script>
</body></html>`);
});

// Health check
app.get("/health", (_req, res) =>
  res.json({ status: "ok", service: "t402-explorer" }),
);

// Seed data and start server
seedTransactions(100);

app.listen(PORT, () => {
  console.log("T402 Explorer running on http://localhost:" + PORT);
  console.log("  100 transactions indexed");
});

export default app;
