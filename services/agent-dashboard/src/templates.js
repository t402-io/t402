/**
 * HTML template rendering for the T402 Agent Dashboard.
 *
 * Extracted from server.js to keep rendering separate from routing.
 */

import { escapeHtml, timeAgo, statusIndicator } from "./utils.js";

// ── CSS (static, never changes) ─────────────────────────────────────

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
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

label{color:#9ca3af;font-size:.85rem;display:block;margin-bottom:.35rem}
input{background:#111827;border:1px solid #374151;color:#e5e7eb;padding:.75rem 1rem;border-radius:8px;width:100%;max-width:420px;font-size:1rem}
input:focus{outline:none;border-color:#50AF95}
.form-row{display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap;margin:1rem 0}
.form-row input{margin:0}

table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:1rem}
thead th{text-align:left;color:#6b7280;padding:.5rem;border-bottom:2px solid #1f2937;white-space:nowrap;cursor:default}
tbody td{padding:.5rem;border-bottom:1px solid #111827}
code{color:#50AF95;font-size:.8em}
a{color:#50AF95;text-decoration:none} a:hover{text-decoration:underline}
.status-settled{color:#10B981} .status-pending{color:#F59E0B} .status-failed{color:#EF4444}
.warn{color:#F59E0B}

.alerts{display:flex;flex-direction:column;gap:.5rem;margin-top:.75rem}
.alert{padding:.75rem 1rem;border-radius:8px;font-size:.9rem}
.alert-warning{background:#422006;border:1px solid #F59E0B;color:#FCD34D}
.alert-critical{background:#450a0a;border:1px solid #EF4444;color:#FCA5A5}
.alert-icon{font-weight:bold;margin-right:.5rem}

.net-row{display:flex;align-items:center;gap:.5rem;margin:.35rem 0;font-size:.85rem}
.net-label{width:90px;text-align:right;color:#9ca3af;flex-shrink:0}
.net-bar{flex:1;height:14px;background:#1f2937;border-radius:3px;overflow:hidden;min-width:60px}
.net-fill{height:100%;background:#50AF95;border-radius:3px}
.net-val{color:#e5e7eb;white-space:nowrap;flex-shrink:0;width:120px}

.toolbar{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-top:1rem}
.btn{display:inline-block;padding:.5rem 1rem;border-radius:6px;background:#1f2937;color:#50AF95;border:1px solid #374151;font-size:.85rem;cursor:pointer;text-decoration:none;font-family:inherit}
.btn:hover{background:#374151}

/* Onboarding / empty state */
.onboarding{text-align:center;padding:3rem 1.5rem;margin:2rem 0;background:#111827;border-radius:12px;border:1px solid #1f2937}
.onboarding h2{color:#e5e7eb;font-size:1.5rem;margin-top:0;margin-bottom:.5rem}
.onboarding p{color:#9ca3af;max-width:520px;margin:0 auto .75rem}
.onboarding ul{list-style:none;padding:0;max-width:400px;margin:1.25rem auto;text-align:left}
.onboarding li{padding:.35rem 0;color:#d1d5db;font-size:.9rem}
.onboarding li::before{content:"\\2022";color:#50AF95;font-weight:bold;margin-right:.5rem}
.demo-btn{display:inline-block;padding:.85rem 2.25rem;border-radius:8px;background:linear-gradient(135deg,#10B981,#0D9488);color:#fff;font-size:1.1rem;font-weight:600;border:none;cursor:pointer;text-decoration:none;margin:1.25rem 0;transition:opacity .15s}
.demo-btn:hover{opacity:.88;text-decoration:none}

/* Date range selector */
.range-bar{display:flex;gap:.35rem;margin:1rem 0}
.range-btn{padding:.35rem .85rem;border-radius:5px;background:#1f2937;color:#9ca3af;border:1px solid #374151;font-size:.8rem;cursor:pointer;font-family:inherit}
.range-btn:hover{background:#374151;color:#e5e7eb}
.range-btn.active{background:#50AF95;color:#0a0a0b;border-color:#50AF95;font-weight:600}

/* Sort buttons in table headers */
.sort-btn{background:none;border:none;color:#6b7280;cursor:pointer;font:inherit;font-size:.85rem;padding:.5rem;text-align:left;white-space:nowrap;width:100%}
.sort-btn:hover{color:#e5e7eb}
.sort-btn .sort-arrow{margin-left:.25rem;font-size:.7rem}

/* Loading spinner */
.loading{display:inline-block;width:18px;height:18px;border:2px solid #374151;border-top-color:#50AF95;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-left:.5rem}
@keyframes spin{to{transform:rotate(360deg)}}

footer{color:#6b7280;font-size:.8rem;margin-top:2rem;padding-top:1rem;border-top:1px solid #1f2937}

@media(max-width:640px){
  body{padding:1rem .75rem}
  .cards{grid-template-columns:1fr 1fr}
  .card{padding:1rem}
  .card-value{font-size:1.3rem}
  table{font-size:.75rem}
  thead th,tbody td{padding:.35rem .25rem}
  .sort-btn{padding:.35rem .25rem;font-size:.75rem}
  .net-label{width:70px;font-size:.75rem}
  .net-val{width:100px;font-size:.75rem}
  .toolbar{flex-direction:column;align-items:stretch}
  input{max-width:100%}
  .form-row{flex-direction:column;align-items:stretch}
}
@media(max-width:400px){
  .cards{grid-template-columns:1fr}
}`;

// ── Client-side script template ─────────────────────────────────────

function clientScript(address, nonce) {
  return `
(function() {
  var addr = ${JSON.stringify(address).replace(/</g, "\\u003c")};
  var currentDays = 7;
  var sortCol = -1;
  var sortAsc = true;
  var refreshTimer = null;

  // ── Auto-refresh every 60s ──────────────────────────────────────
  function startAutoRefresh() {
    refreshTimer = setInterval(function() { refreshData(); }, 60000);
  }

  function refreshData() {
    var spinner = document.getElementById("refresh-spinner");
    if (spinner) spinner.style.display = "inline-block";
    Promise.all([
      fetch("/api/v1/stats/" + encodeURIComponent(addr) + "?days=" + currentDays).then(function(r){return r.json();}),
      fetch("/api/v1/payments?address=" + encodeURIComponent(addr) + "&days=" + currentDays + "&limit=15").then(function(r){return r.json();}),
      fetch("/api/v1/balances/" + encodeURIComponent(addr)).then(function(r){return r.json();}),
      fetch("/api/v1/budget/" + encodeURIComponent(addr)).then(function(r){return r.json();}),
      fetch("/api/v1/alerts/" + encodeURIComponent(addr)).then(function(r){return r.json();})
    ]).then(function(results) {
      var stats = results[0], payData = results[1], balData = results[2], budgetData = results[3], alertData = results[4];
      // Update summary cards
      var cards = document.querySelectorAll("[data-card]");
      cards.forEach(function(el) {
        var key = el.getAttribute("data-card");
        if (key === "balance") el.textContent = "$" + (balData.totalUsd || "--");
        if (key === "payments") el.textContent = stats.totalPayments != null ? stats.totalPayments : "--";
        if (key === "spent") el.textContent = "$" + (stats.totalSpentUsd || "--");
        if (key === "avg") el.textContent = "$" + (stats.avgPaymentUsd || "--");
      });
      // Update payments table body
      var tbody = document.getElementById("payments-tbody");
      if (tbody && payData.payments) {
        tbody.innerHTML = payData.payments.map(function(p) {
          var label = esc(p.networkLabel || p.network);
          var si = p.status === "settled" ? "\\u2713 " : p.status === "pending" ? "\\u231B " : p.status === "failed" ? "\\u2717 " : "";
          return "<tr><td>" + esc(p.service) + "</td><td>$" + esc(p.amountFormatted) + " " + esc(p.token) + "</td><td>" + label + "</td><td class=\\"status-" + esc(p.status) + "\\">" + esc(si + p.status) + "</td><td>" + esc(timeAgoClient(p.timestamp)) + "</td></tr>";
        }).join("");
      }
      if (spinner) spinner.style.display = "none";
    }).catch(function() {
      if (spinner) spinner.style.display = "none";
    });
  }

  // ── Date range selector ─────────────────────────────────────────
  document.querySelectorAll(".range-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      document.querySelectorAll(".range-btn").forEach(function(b){b.classList.remove("active");});
      btn.classList.add("active");
      currentDays = parseInt(btn.getAttribute("data-days"), 10);
      refreshData();
    });
  });

  // ── Manual refresh button ───────────────────────────────────────
  var refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function(e) {
      e.preventDefault();
      refreshData();
    });
  }

  // ── Click-to-sort on table headers ──────────────────────────────
  document.querySelectorAll(".sort-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var col = parseInt(btn.getAttribute("data-col"), 10);
      if (sortCol === col) { sortAsc = !sortAsc; } else { sortCol = col; sortAsc = true; }
      // Update arrows
      document.querySelectorAll(".sort-btn .sort-arrow").forEach(function(a){a.textContent = "";});
      var arrow = btn.querySelector(".sort-arrow");
      if (arrow) arrow.textContent = sortAsc ? "\\u25B2" : "\\u25BC";
      // Sort rows
      var tbody = document.getElementById("payments-tbody");
      if (!tbody) return;
      var rows = Array.from(tbody.querySelectorAll("tr"));
      rows.sort(function(a, b) {
        var aText = a.children[col] ? a.children[col].textContent.trim() : "";
        var bText = b.children[col] ? b.children[col].textContent.trim() : "";
        var cmp = aText.localeCompare(bText, undefined, {numeric: true});
        return sortAsc ? cmp : -cmp;
      });
      rows.forEach(function(r){tbody.appendChild(r);});
    });
  });

  // ── Utilities ───────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(s || ""));
    return d.innerHTML;
  }
  function timeAgoClient(iso) {
    var sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 0) return "just now";
    if (sec < 60) return sec + "s ago";
    var min = Math.floor(sec / 60);
    if (min < 60) return min + "m ago";
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    return Math.floor(hr / 24) + "d ago";
  }

  startAutoRefresh();
})();`;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Render the full dashboard HTML.
 * @param {{ address: string|null, hasAddress: boolean, balData: object|null,
 *           budget: object|null, stats: object|null, payments: Array,
 *           alerts: Array, cspNonce: string }} data
 * @returns {string} Full HTML document
 */
export function renderDashboard(data) {
  const { address, hasAddress, balData, budget, stats, payments, alerts, cspNonce } = data;

  // ── Empty / onboarding state ─────────────────────────────────────
  if (!hasAddress) {
    return `<!DOCTYPE html>
<html lang="en"><head><title>T402 Agent Dashboard</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style nonce="${cspNonce}">${CSS}</style></head>
<body>
  <header>
    <h1>Agent Payment Dashboard</h1>
    <div class="subtitle">T402 Protocol — AI Agent Payment Monitoring</div>
  </header>
  <main>
    <div class="onboarding">
      <h2>T402 Agent Dashboard</h2>
      <p>Monitor your AI agent's on-chain payment activity across multiple networks in real time.</p>
      <ul>
        <li>Multi-chain balance tracking (Base, Arbitrum, Ethereum, Solana, TON)</li>
        <li>Budget enforcement with session and daily limits</li>
        <li>Payment history with per-service and per-network breakdowns</li>
        <li>Alerts when spending approaches policy thresholds</li>
      </ul>
      <a class="demo-btn" href="?address=0xC88f67e776f16DcFBf42e6bDda1B82604448899B">Try Demo</a>
    </div>
    <form method="get">
      <label for="addr-input">Agent wallet address</label>
      <div class="form-row">
        <input id="addr-input" name="address" placeholder="Enter agent wallet address (0x...)" value="">
        <button class="btn" type="submit">Load Dashboard</button>
      </div>
    </form>
  </main>
  <footer>
    Powered by <a href="https://t402.io">T402</a>
  </footer>
</body></html>`;
  }

  const safeAddr = escapeHtml(address || "");
  const encodedAddr = encodeURIComponent(address || "");

  // ── Build network bar chart ──────────────────────────────────────
  let networkChart = "";
  if (stats && stats.byNetwork) {
    const entries = Object.entries(stats.byNetwork).sort(
      (a, b) => Number(b[1].amount) - Number(a[1].amount),
    );
    const maxAmt = entries.length > 0 ? Number(entries[0][1].amount) : 1;
    networkChart = entries
      .map(([net, d]) => {
        const pct = Math.round((Number(d.amount) / maxAmt) * 100);
        const label = escapeHtml(
          net
            .replace("eip155:", "EIP-")
            .replace("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "Solana")
            .replace("ton:mainnet", "TON"),
        );
        const barW = Math.max(pct, 2);
        return `<div class="net-row">
          <span class="net-label">${label}</span>
          <div class="net-bar"><div class="net-fill" style="width:${barW}%"></div></div>
          <span class="net-val">$${(Number(d.amount) / 1e6).toFixed(2)} (${escapeHtml(String(d.count))})</span>
        </div>`;
      })
      .join("\n");
  }

  // ── Alerts ───────────────────────────────────────────────────────
  let alertsHtml = "";
  if (alerts.length > 0) {
    alertsHtml =
      `<h2>Alerts</h2><div class="alerts">` +
      alerts
        .map(
          (a) =>
            `<div class="alert alert-${escapeHtml(a.level)}"><span class="alert-icon" aria-label="${escapeHtml(a.level)} alert">${a.level === "critical" ? "!!!" : "(!)"}</span> ${escapeHtml(a.message)}</div>`,
        )
        .join("") +
      `</div>`;
  }

  // ── Payment table rows ───────────────────────────────────────────
  const paymentRows = payments
    .map((p) => {
      const ago = timeAgo(new Date(p.timestamp));
      const netShort = escapeHtml(p.networkLabel || p.network);
      const indicator = statusIndicator(p.status);
      return `<tr><td>${escapeHtml(p.service)}</td><td>$${escapeHtml(p.amountFormatted)} ${escapeHtml(p.token)}</td><td>${netShort}</td><td class="status-${escapeHtml(p.status)}">${escapeHtml(indicator)}</td><td>${escapeHtml(ago)}</td></tr>`;
    })
    .join("\n");

  // ── Summary cards ────────────────────────────────────────────────
  const totalBal = balData ? escapeHtml(balData.totalUsd) : "--";
  const totalPay = stats ? escapeHtml(String(stats.totalPayments)) : "--";
  const totalSpent = stats ? escapeHtml(stats.totalSpentUsd) : "--";
  const avgPay = stats ? escapeHtml(stats.avgPaymentUsd) : "--";

  // ── Budget section ───────────────────────────────────────────────
  const sessionPct = budget ? budget.usage.sessionPercentage : 0;
  const dailyPct = budget ? budget.usage.todayPercentage : 0;
  const sessionClass = sessionPct >= 80 ? "warn" : "";
  const dailyClass = dailyPct >= 80 ? "warn" : "";
  const sessionSpentFmt = budget ? (Number(budget.usage.sessionSpent) / 1e6).toFixed(2) : "0";
  const sessionLimitFmt = budget ? (Number(budget.usage.sessionLimit) / 1e6).toFixed(2) : "0";
  const todaySpentFmt = budget ? (Number(budget.usage.todaySpent) / 1e6).toFixed(2) : "0";
  const todayLimitFmt = budget ? (Number(budget.usage.todayLimit) / 1e6).toFixed(2) : "0";

  // ── Top services ─────────────────────────────────────────────────
  const serviceRows = (stats ? stats.topServices : [])
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(String(s.count))}</td><td>$${(Number(s.amount) / 1e6).toFixed(2)}</td></tr>`,
    )
    .join("\n");

  // ── Full page ────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en"><head><title>T402 Agent Dashboard</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style nonce="${cspNonce}">${CSS}</style></head>
<body>
  <header>
    <h1>Agent Payment Dashboard</h1>
    <div class="subtitle">T402 Protocol — AI Agent Payment Monitoring</div>
    <form method="get">
      <label for="addr-input">Agent wallet address</label>
      <div class="form-row">
        <input id="addr-input" name="address" placeholder="Enter agent wallet address (0x...)" value="${safeAddr}">
        <button class="btn" type="submit">Load Dashboard</button>
      </div>
    </form>
  </header>

  <main>
    ${alertsHtml}

    <div class="range-bar">
      <button class="range-btn" data-days="1" type="button">1d</button>
      <button class="range-btn active" data-days="7" type="button">7d</button>
      <button class="range-btn" data-days="30" type="button">30d</button>
      <button class="btn" id="refresh-btn" type="button">Refresh <span id="refresh-spinner" class="loading" style="display:none"></span></button>
    </div>

    <div class="cards">
      <div class="card"><div class="card-value" data-card="balance">$${totalBal}</div><div class="card-label">Total Balance</div></div>
      <div class="card"><div class="card-value" data-card="payments">${totalPay}</div><div class="card-label">Payments (7d)</div></div>
      <div class="card"><div class="card-value" data-card="spent">$${totalSpent}</div><div class="card-label">Spent (7d)</div></div>
      <div class="card"><div class="card-value" data-card="avg">$${avgPay}</div><div class="card-label">Avg Payment</div></div>
    </div>

    <h2>Budget Usage</h2>
    <div class="cards">
      <div class="card ${sessionClass}">
        <div class="card-label">Session Budget</div>
        <div class="card-value">${sessionPct}%</div>
        <div class="bar" role="progressbar" aria-valuenow="${Math.min(sessionPct, 100)}" aria-valuemin="0" aria-valuemax="100"><div class="bar-fill" style="width:${Math.min(sessionPct, 100)}%"></div></div>
        <div class="card-label">$${sessionSpentFmt} / $${sessionLimitFmt}</div>
      </div>
      <div class="card ${dailyClass}">
        <div class="card-label">Daily Budget</div>
        <div class="card-value">${dailyPct}%</div>
        <div class="bar" role="progressbar" aria-valuenow="${Math.min(dailyPct, 100)}" aria-valuemin="0" aria-valuemax="100"><div class="bar-fill" style="width:${Math.min(dailyPct, 100)}%"></div></div>
        <div class="card-label">$${todaySpentFmt} / $${todayLimitFmt}</div>
      </div>
    </div>

    ${networkChart ? `<h2>Network Breakdown</h2><div style="margin-top:.75rem">${networkChart}</div>` : ""}

    <h2>Top Services</h2>
    <div style="overflow-x:auto">
    <table>
      <thead><tr><th>Service</th><th>Payments</th><th>Amount</th></tr></thead>
      <tbody>
        ${serviceRows || '<tr><td colspan="3" style="color:#6b7280">No data</td></tr>'}
      </tbody>
    </table>
    </div>

    <h2>Recent Payments</h2>
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th><button class="sort-btn" data-col="0" type="button">Service <span class="sort-arrow"></span></button></th>
          <th><button class="sort-btn" data-col="1" type="button">Amount <span class="sort-arrow"></span></button></th>
          <th><button class="sort-btn" data-col="2" type="button">Network <span class="sort-arrow"></span></button></th>
          <th><button class="sort-btn" data-col="3" type="button">Status <span class="sort-arrow"></span></button></th>
          <th><button class="sort-btn" data-col="4" type="button">Time <span class="sort-arrow"></span></button></th>
        </tr>
      </thead>
      <tbody id="payments-tbody">
        ${paymentRows || '<tr><td colspan="5" style="color:#6b7280">No data</td></tr>'}
      </tbody>
    </table>
    </div>

    <div class="toolbar">
      <a class="btn" href="/api/v1/export/${encodedAddr}?days=7">Export CSV</a>
      <a class="btn" href="/api/v1/payments?address=${encodedAddr}">Payments API</a>
      <a class="btn" href="/api/v1/balances/${encodedAddr}">Balances API</a>
      <a class="btn" href="/api/v1/budget/${encodedAddr}">Budget API</a>
      <a class="btn" href="/api/v1/stats/${encodedAddr}">Stats API</a>
      <a class="btn" href="/api/v1/alerts/${encodedAddr}">Alerts API</a>
    </div>
  </main>

  <footer>
    Powered by <a href="https://t402.io">T402</a>
  </footer>

  <script nonce="${cspNonce}">${clientScript(address)}</script>
</body></html>`;
}
