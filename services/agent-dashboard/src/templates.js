/**
 * HTML template rendering for the T402 Agent Dashboard.
 *
 * CSS → public/style.css · JS → public/app.js
 */

import { escapeHtml, timeAgo, statusIndicator } from "./utils.js";

// Explorer URL lookup for server-rendered tx links
const EXPLORER_URLS = {
  "eip155:1": "https://etherscan.io/tx/",
  "eip155:8453": "https://basescan.org/tx/",
  "eip155:42161": "https://arbiscan.io/tx/",
  "eip155:137": "https://polygonscan.com/tx/",
  "eip155:10": "https://optimistic.etherscan.io/tx/",
  "eip155:56": "https://bscscan.com/tx/",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "https://solscan.io/tx/",
  "ton:mainnet": "https://tonviewer.com/transaction/",
  "stellar:pubnet": "https://stellarchain.io/tx/",
  "tron:mainnet": "https://tronscan.org/#/transaction/",
};

const HEAD = `<!DOCTYPE html>
<html lang="en"><head><title>T402 Agent Dashboard</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/style.css"></head>
<body>`;

const FOOTER = `  <footer>Powered by <a href="https://t402.io">T402</a></footer>
  <script src="/app.js" defer></script>
</body></html>`;

/**
 * Render the full dashboard HTML.
 * @param {{ address: string|null, hasAddress: boolean, balData: object|null,
 *           budget: object|null, stats: object|null, payments: Array,
 *           alerts: Array, cspNonce: string }} data
 * @returns {string} Full HTML document
 */
export function renderDashboard(data) {
  const { address, hasAddress, balData, budget, stats, payments, alerts } = data;

  // ── Empty / onboarding state ─────────────────────────────────────
  if (!hasAddress) {
    return `${HEAD}
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
${FOOTER}`;
  }

  const safeAddr = escapeHtml(address || "");
  const encodedAddr = encodeURIComponent(address || "");

  // ── Network bar chart ────────────────────────────────────────────
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
      const explorerBase = EXPLORER_URLS[p.network];
      const txCell =
        explorerBase && p.txHash
          ? `<a href="${escapeHtml(explorerBase + p.txHash)}" target="_blank" rel="noopener"><code>${escapeHtml(p.txHash.slice(0, 10))}\u2026</code></a>`
          : `<code>${escapeHtml((p.txHash || "").slice(0, 10))}\u2026</code>`;
      return `<tr><td>${escapeHtml(p.service)}</td><td>$${escapeHtml(p.amountFormatted)} ${escapeHtml(p.token)}</td><td>${netShort}</td><td class="status-${escapeHtml(p.status)}">${escapeHtml(indicator)}</td><td>${txCell}</td><td>${escapeHtml(ago)}</td></tr>`;
    })
    .join("\n");

  // ── Summary values ───────────────────────────────────────────────
  const totalBal = balData ? escapeHtml(balData.totalUsd) : "--";
  const totalPay = stats ? escapeHtml(String(stats.totalPayments)) : "--";
  const totalSpent = stats ? escapeHtml(stats.totalSpentUsd) : "--";
  const avgPay = stats ? escapeHtml(stats.avgPaymentUsd) : "--";

  const sessionPct = budget ? budget.usage.sessionPercentage : 0;
  const dailyPct = budget ? budget.usage.todayPercentage : 0;
  const sessionClass = sessionPct >= 80 ? "warn" : "";
  const dailyClass = dailyPct >= 80 ? "warn" : "";
  const sessionSpentFmt = budget ? (Number(budget.usage.sessionSpent) / 1e6).toFixed(2) : "0";
  const sessionLimitFmt = budget ? (Number(budget.usage.sessionLimit) / 1e6).toFixed(2) : "0";
  const todaySpentFmt = budget ? (Number(budget.usage.todaySpent) / 1e6).toFixed(2) : "0";
  const todayLimitFmt = budget ? (Number(budget.usage.todayLimit) / 1e6).toFixed(2) : "0";

  const serviceRows = (stats ? stats.topServices : [])
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(String(s.count))}</td><td>$${(Number(s.amount) / 1e6).toFixed(2)}</td></tr>`,
    )
    .join("\n");

  // ── Full page ────────────────────────────────────────────────────
  return `${HEAD}
  <header>
    <h1>Agent Payment Dashboard</h1>
    <button class="theme-toggle" id="theme-toggle" type="button">\u2600 Light</button>
    <div class="subtitle">T402 Protocol — AI Agent Payment Monitoring</div>
    <form method="get">
      <label for="addr-input">Agent wallet address</label>
      <div class="form-row">
        <input id="addr-input" name="address" placeholder="Enter agent wallet address (0x...)" value="${safeAddr}">
        <button class="btn" type="submit">Load Dashboard</button>
      </div>
    </form>
  </header>

  <main data-address="${safeAddr}">
    <div id="error-banner" class="error-banner"></div>
    ${alertsHtml}

    <div class="range-bar">
      <button class="range-btn" data-days="1" type="button">1d</button>
      <button class="range-btn active" data-days="7" type="button">7d</button>
      <button class="range-btn" data-days="30" type="button">30d</button>
      <button class="btn" id="refresh-btn" type="button">Refresh <span id="refresh-spinner" class="loading" style="display:none"></span></button>
    </div>

    <div class="cards">
      <div class="card"><div class="card-value" data-card="balance">$${totalBal}</div><div class="card-label">Total Balance</div></div>
      <div class="card"><div class="card-value" data-card="payments">${totalPay}</div><div class="card-label" data-period-label="Payments (7d)">Payments (7d)</div></div>
      <div class="card"><div class="card-value" data-card="spent">$${totalSpent}</div><div class="card-label" data-period-label="Spent (7d)">Spent (7d)</div></div>
      <div class="card"><div class="card-value" data-card="avg">$${avgPay}</div><div class="card-label">Avg Payment</div></div>
    </div>

    <div class="sparkline-container">
      <h3>Spending Trend</h3>
      <div class="sparkline" id="sparkline-chart"></div>
    </div>

    <h2>Budget Usage</h2>
    <div class="cards">
      <div class="card ${sessionClass}">
        <div class="card-label">Session Budget</div>
        <div class="card-value">${sessionPct}%</div>
        <div class="bar" role="progressbar" aria-valuenow="${Math.min(sessionPct, 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Session budget usage"><div class="bar-fill" style="width:${Math.min(sessionPct, 100)}%"></div></div>
        <div class="card-label">$${sessionSpentFmt} / $${sessionLimitFmt}</div>
      </div>
      <div class="card ${dailyClass}">
        <div class="card-label">Daily Budget</div>
        <div class="card-value">${dailyPct}%</div>
        <div class="bar" role="progressbar" aria-valuenow="${Math.min(dailyPct, 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="Daily budget usage"><div class="bar-fill" style="width:${Math.min(dailyPct, 100)}%"></div></div>
        <div class="card-label">$${todaySpentFmt} / $${todayLimitFmt}</div>
      </div>
    </div>

    ${networkChart ? `<h2>Network Breakdown</h2><div style="margin-top:.75rem">${networkChart}</div>` : ""}

    <h2>Top Services</h2>
    <div style="overflow-x:auto">
    <table>
      <thead><tr><th>Service</th><th>Payments</th><th>Amount</th></tr></thead>
      <tbody>
        ${serviceRows || '<tr><td colspan="3" style="color:var(--text-dim)">No data</td></tr>'}
      </tbody>
    </table>
    </div>

    <h2>Recent Payments</h2>
    <div class="filter-bar">
      <select id="network-filter" aria-label="Filter by network">
        <option value="">All Networks</option>
        <option value="eip155:1">Ethereum</option>
        <option value="eip155:8453">Base</option>
        <option value="eip155:42161">Arbitrum</option>
        <option value="eip155:137">Polygon</option>
        <option value="eip155:10">Optimism</option>
        <option value="eip155:56">BNB Chain</option>
        <option value="solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp">Solana</option>
        <option value="ton:mainnet">TON</option>
        <option value="stellar:pubnet">Stellar</option>
        <option value="tron:mainnet">TRON</option>
      </select>
    </div>
    <div style="overflow-x:auto">
    <table>
      <thead>
        <tr>
          <th><button class="sort-btn" data-col="0" type="button">Service <span class="sort-arrow"></span></button></th>
          <th><button class="sort-btn" data-col="1" type="button">Amount <span class="sort-arrow"></span></button></th>
          <th><button class="sort-btn" data-col="2" type="button">Network <span class="sort-arrow"></span></button></th>
          <th><button class="sort-btn" data-col="3" type="button">Status <span class="sort-arrow"></span></button></th>
          <th>Tx</th>
          <th><button class="sort-btn" data-col="5" type="button">Time <span class="sort-arrow"></span></button></th>
        </tr>
      </thead>
      <tbody id="payments-tbody">
        ${paymentRows || '<tr><td colspan="6" style="color:var(--text-dim)">No data</td></tr>'}
      </tbody>
    </table>
    </div>
    <div class="pagination">
      <button class="btn" id="prev-btn" type="button" disabled>\u2190 Prev</button>
      <span class="page-info" id="page-info">Page 1</span>
      <button class="btn" id="next-btn" type="button">Next \u2192</button>
    </div>

    <div class="toolbar">
      <a class="btn" href="/api/v1/export/${encodedAddr}?days=7">Export CSV</a>
      <a class="btn" href="/api/v1/dashboard/${encodedAddr}">Dashboard API</a>
      <a class="btn" href="/api/v1/stats/${encodedAddr}/trend?days=30">Trend API</a>
      <a class="btn" href="/api/v1/alerts/${encodedAddr}">Alerts API</a>
    </div>
  </main>

${FOOTER}`;
}
