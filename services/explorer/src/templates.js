import { escapeHtml, formatAmount, formatAddress, formatHash, formatTime, getNetworkName, getExplorerUrl, getAddressUrl } from "./utils.js";

function themeToggleScript() {
  return `<script>
(function(){
  var root = document.documentElement;
  var stored = localStorage.getItem("t402-theme");
  if (stored === "light") root.classList.add("light");
})();
</script>`;
}

function headerHtml(title, subtitle) {
  return `<div class="header-bar">
    <div>
      <h1><a href="/">${title}</a></h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
    </div>
    <button id="themeToggle" class="secondary theme-toggle" title="Toggle light/dark mode">Toggle Theme</button>
  </div>`;
}

export function renderIndex({ stats, transactions, networks, tokens }) {
  const networkOptions = (networks || []).map(n => `<option value="${escapeHtml(n.network)}">${escapeHtml(getNetworkName(n.network))} (${n.count})</option>`).join("");
  const tokenOptions = (tokens || []).map(t => `<option value="${escapeHtml(t.token)}">${escapeHtml(t.token)} (${t.count})</option>`).join("");
  const rows = (transactions || []).map(tx => renderRow(tx)).join("");
  const totalVol = stats ? formatAmount(stats.totalVolume, "USDT", null) : "0.00";
  const avgSize = stats ? formatAmount(stats.avgTransactionSize, "USDT", null) : "0.00";

  const networkLinks = (networks || []).map(n => `<a href="/network/${escapeHtml(encodeURIComponent(n.network))}" class="badge">${escapeHtml(getNetworkName(n.network))} (${n.count})</a>`).join(" ");
  const tokenLinks = (tokens || []).map(t => `<a href="/token/${escapeHtml(encodeURIComponent(t.token))}" class="badge badge-token">${escapeHtml(t.token)} (${t.count})</a>`).join(" ");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml("T402 Payment Explorer", "Real-time transaction browser for the T402 payment protocol")}
  <div class="stats">
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats?.totalTransactions ?? 0))}</div><div class="stat-label">Transactions (7d)</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Volume (7d)</div></div>
    <div class="stat"><div class="stat-value">${escapeHtml(String(Object.keys(stats?.byNetwork ?? {}).length))}</div><div class="stat-label">Networks</div></div>
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats?.uniquePayers ?? 0))}</div><div class="stat-label">Unique Payers</div></div>
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats?.uniqueRecipients ?? 0))}</div><div class="stat-label">Unique Recipients</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(avgSize)}</div><div class="stat-label">Avg Tx Size</div></div>
  </div>
  <div class="browse-links">
    <span class="muted">Networks:</span> ${networkLinks}
    <span class="muted" style="margin-left:1rem;">Tokens:</span> ${tokenLinks}
  </div>
  <div class="filters">
    <select id="networkFilter"><option value="">All Networks</option>${networkOptions}</select>
    <select id="tokenFilter"><option value="">All Tokens</option>${tokenOptions}</select>
    <input id="searchInput" placeholder="Search by tx hash or address...">
    <button id="searchBtn">Search</button>
    <button class="secondary" id="resetBtn">Reset</button>
  </div>
  <div class="filters">
    <label class="filter-label">From: <input type="date" id="dateFrom"></label>
    <label class="filter-label">To: <input type="date" id="dateTo"></label>
    <select id="sortBy">
      <option value="">Sort: Time (newest)</option>
      <option value="confirmed_at|ASC">Time (oldest)</option>
      <option value="amount|DESC">Amount (high-low)</option>
      <option value="amount|ASC">Amount (low-high)</option>
      <option value="network|ASC">Network (A-Z)</option>
      <option value="network|DESC">Network (Z-A)</option>
    </select>
  </div>
  <h2>Recent Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tx Hash</th><th>Network</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th>Scheme</th><th>Time</th></tr></thead>
      <tbody id="txBody">${rows}</tbody>
    </table>
  </div>
  <div id="loading" class="loading" style="display:none">Loading...</div>
  <div class="pagination">
    <button id="prevBtn" class="secondary" disabled>Previous</button>
    <span id="pageInfo" class="page-info">Page 1</span>
    <button id="nextBtn" class="secondary">Next</button>
  </div>
  <footer>
    <a href="/api/v1/transactions">Transactions API</a> ·
    <a href="/api/v1/stats">Stats API</a> ·
    <a href="/api/v1/networks">Networks API</a> ·
    <a href="/api/v1/tokens">Tokens API</a> ·
    <a href="/api/v1/export?format=csv">Export CSV</a> ·
    Powered by <a href="https://t402.io">T402</a>
  </footer>
  <script src="/static/app.js"></script>
</body></html>`;
}

function renderRow(tx) {
  const amount = formatAmount(tx.amount, tx.token, tx.network);
  return `<tr data-hash="${escapeHtml(tx.txHash)}">
    <td><code>${escapeHtml(formatHash(tx.txHash))}</code></td>
    <td><a href="/network/${escapeHtml(encodeURIComponent(tx.network))}"><span class="badge">${escapeHtml(getNetworkName(tx.network))}</span></a></td>
    <td><a href="/token/${escapeHtml(encodeURIComponent(tx.token))}"><span class="badge badge-token">${escapeHtml(tx.token)}</span></a></td>
    <td class="amount">$${escapeHtml(amount)}</td>
    <td><code>${escapeHtml(formatAddress(tx.from))}</code></td>
    <td><code>${escapeHtml(formatAddress(tx.to))}</code></td>
    <td>${escapeHtml(tx.scheme)}</td>
    <td class="time" title="${escapeHtml(tx.settledAt)}">${escapeHtml(formatTime(tx.settledAt))}</td>
  </tr>`;
}

export function renderDetail(tx) {
  if (!tx) return render404();
  const amount = formatAmount(tx.amount, tx.token, tx.network);
  const explorerUrl = getExplorerUrl(tx.network, tx.txHash);
  const fromUrl = getAddressUrl(tx.network, tx.from);
  const toUrl = getAddressUrl(tx.network, tx.to);
  const statusClass = tx.status === "confirmed" ? "status-confirmed" : tx.status === "pending" ? "status-pending" : "status-failed";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tx ${escapeHtml(formatHash(tx.txHash))} - T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Payment Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Transaction Details</h2>
    <div class="detail-row"><span class="detail-label">Status</span><span class="status-badge ${statusClass}">${escapeHtml(tx.status)}</span></div>
    <div class="detail-row"><span class="detail-label">Transaction Hash</span><span class="detail-value"><code>${escapeHtml(tx.txHash)}</code><button class="copy-btn" data-copy="${escapeHtml(tx.txHash)}" title="Copy">Copy</button>${explorerUrl ? `<a href="${escapeHtml(explorerUrl)}" target="_blank" rel="noopener noreferrer" class="explorer-link">View on Explorer</a>` : ""}</span></div>
    <div class="detail-row"><span class="detail-label">Network</span><span class="detail-value"><a href="/network/${escapeHtml(encodeURIComponent(tx.network))}"><span class="badge">${escapeHtml(getNetworkName(tx.network))}</span></a> <span class="muted">(${escapeHtml(tx.network)})</span></span></div>
    <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value amount-large">$${escapeHtml(amount)} <a href="/token/${escapeHtml(encodeURIComponent(tx.token))}"><span class="badge badge-token">${escapeHtml(tx.token)}</span></a></span></div>
    <div class="detail-row"><span class="detail-label">From</span><span class="detail-value"><code>${escapeHtml(tx.from)}</code><button class="copy-btn" data-copy="${escapeHtml(tx.from)}" title="Copy">Copy</button>${fromUrl ? `<a href="${escapeHtml(fromUrl)}" target="_blank" rel="noopener noreferrer" class="explorer-link">View</a>` : ""}</span></div>
    <div class="detail-row"><span class="detail-label">To</span><span class="detail-value"><code>${escapeHtml(tx.to)}</code><button class="copy-btn" data-copy="${escapeHtml(tx.to)}" title="Copy">Copy</button>${toUrl ? `<a href="${escapeHtml(toUrl)}" target="_blank" rel="noopener noreferrer" class="explorer-link">View</a>` : ""}</span></div>
    <div class="detail-row"><span class="detail-label">Scheme</span><span class="detail-value">${escapeHtml(tx.scheme)}</span></div>
    <div class="detail-row"><span class="detail-label">Raw Amount</span><span class="detail-value"><code>${escapeHtml(tx.amount)}</code> (smallest units)</span></div>
    ${tx.gasUsed && tx.gasUsed !== "0" ? `<div class="detail-row"><span class="detail-label">Gas Used</span><span class="detail-value">${escapeHtml(tx.gasUsed)}</span></div>` : ""}
    <div class="detail-row"><span class="detail-label">Settled At</span><span class="detail-value">${escapeHtml(tx.settledAt)}</span></div>
  </div>
  <script src="/static/app.js"></script>
</body></html>`;
}

export function renderAddressPage(address, transactions, stats) {
  const rows = (transactions || []).map(tx => renderRow(tx)).join("");
  const totalVol = stats ? formatAmount(stats.totalVolume, "USDT", null) : "0.00";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Address ${escapeHtml(formatAddress(address))} - T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Payment Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Address Details</h2>
    <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value"><code>${escapeHtml(address)}</code><button class="copy-btn" data-copy="${escapeHtml(address)}" title="Copy">Copy</button></span></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats?.total ?? 0))}</div><div class="stat-label">Transactions</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Volume</div></div>
  </div>
  <h2>Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tx Hash</th><th>Network</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th>Scheme</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <script src="/static/app.js"></script>
</body></html>`;
}

export function renderNetworkPage(networkId, stats, transactions) {
  const name = getNetworkName(networkId);
  const rows = (transactions || []).map(tx => renderRow(tx)).join("");

  if (!stats) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(name)} - T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Payment Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Network Not Found</h2>
    <p class="subtitle">No transactions found for network <code>${escapeHtml(networkId)}</code>.</p>
    <p><a href="/">Back to transactions</a></p>
  </div>
  <script src="/static/app.js"></script>
</body></html>`;
  }

  const totalVol = formatAmount(stats.totalVolume, "USDT", null);
  const avgSize = formatAmount(stats.avgTransactionSize, "USDT", null);
  const tokenBadges = (stats.tokens || []).map(t => `<a href="/token/${escapeHtml(encodeURIComponent(t.token))}" class="badge badge-token">${escapeHtml(t.token)} (${t.count})</a>`).join(" ");
  const schemeBadges = (stats.schemes || []).map(s => `<span class="badge">${escapeHtml(s.scheme)} (${s.count})</span>`).join(" ");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(name)} - T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Payment Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Network: ${escapeHtml(name)}</h2>
    <div class="detail-row"><span class="detail-label">CAIP-2 ID</span><span class="detail-value"><code>${escapeHtml(networkId)}</code><button class="copy-btn" data-copy="${escapeHtml(networkId)}" title="Copy">Copy</button></span></div>
    <div class="detail-row"><span class="detail-label">Tokens</span><span class="detail-value">${tokenBadges || "<span class=\"muted\">None</span>"}</span></div>
    <div class="detail-row"><span class="detail-label">Schemes</span><span class="detail-value">${schemeBadges || "<span class=\"muted\">None</span>"}</span></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats.totalTransactions))}</div><div class="stat-label">Transactions</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Total Volume</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(avgSize)}</div><div class="stat-label">Avg Tx Size</div></div>
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats.uniquePayers))}</div><div class="stat-label">Unique Payers</div></div>
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats.uniqueRecipients))}</div><div class="stat-label">Unique Recipients</div></div>
  </div>
  <h2>Recent Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tx Hash</th><th>Network</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th>Scheme</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <footer>
    <a href="/api/v1/export?format=csv&network=${escapeHtml(encodeURIComponent(networkId))}">Export CSV</a> ·
    Powered by <a href="https://t402.io">T402</a>
  </footer>
  <script src="/static/app.js"></script>
</body></html>`;
}

export function renderTokenPage(tokenSymbol, stats, transactions) {
  const rows = (transactions || []).map(tx => renderRow(tx)).join("");

  if (!stats) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(tokenSymbol)} - T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Payment Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Token Not Found</h2>
    <p class="subtitle">No transactions found for token <code>${escapeHtml(tokenSymbol)}</code>.</p>
    <p><a href="/">Back to transactions</a></p>
  </div>
  <script src="/static/app.js"></script>
</body></html>`;
  }

  const totalVol = formatAmount(stats.totalVolume, tokenSymbol, null);
  const avgSize = formatAmount(stats.avgTransactionSize, tokenSymbol, null);
  const networkBadges = (stats.networks || []).map(n => `<a href="/network/${escapeHtml(encodeURIComponent(n.network))}" class="badge">${escapeHtml(getNetworkName(n.network))} (${n.count})</a>`).join(" ");
  const schemeBadges = (stats.schemes || []).map(s => `<span class="badge">${escapeHtml(s.scheme)} (${s.count})</span>`).join(" ");

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(tokenSymbol)} - T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Payment Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Token: ${escapeHtml(tokenSymbol)}</h2>
    <div class="detail-row"><span class="detail-label">Networks</span><span class="detail-value">${networkBadges || "<span class=\"muted\">None</span>"}</span></div>
    <div class="detail-row"><span class="detail-label">Schemes</span><span class="detail-value">${schemeBadges || "<span class=\"muted\">None</span>"}</span></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats.totalTransactions))}</div><div class="stat-label">Transactions</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Total Volume</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(avgSize)}</div><div class="stat-label">Avg Tx Size</div></div>
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats.uniquePayers))}</div><div class="stat-label">Unique Payers</div></div>
    <div class="stat"><div class="stat-value">${escapeHtml(String(stats.uniqueRecipients))}</div><div class="stat-label">Unique Recipients</div></div>
  </div>
  <h2>Recent Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tx Hash</th><th>Network</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th>Scheme</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <footer>
    <a href="/api/v1/export?format=csv&token=${escapeHtml(encodeURIComponent(tokenSymbol))}">Export CSV</a> ·
    Powered by <a href="https://t402.io">T402</a>
  </footer>
  <script src="/static/app.js"></script>
</body></html>`;
}

function render404() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Not Found - T402 Explorer</title>
<link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Payment Explorer</a>', '')}
  <div class="tx-detail">
    <h2>Transaction Not Found</h2>
    <p class="subtitle">The transaction does not exist or has not been indexed yet.</p>
    <p><a href="/">Back to transactions</a></p>
  </div>
  <script src="/static/app.js"></script>
</body></html>`;
}
