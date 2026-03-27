import { escapeHtml, formatAmount, formatNumber, formatAddress, formatHash, formatTime, getNetworkName, getExplorerUrl, getAddressUrl } from "./utils.js";

function themeToggleScript() {
  return `<script src="/static/theme.js"></script>`;
}

function headerHtml(title, subtitle) {
  return `<div class="header-bar">
    <div>
      <h1>${title}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
    </div>
    <button id="themeToggle" class="secondary theme-toggle" title="Toggle theme">&#9680;</button>
  </div>`;
}

export function renderIndex({ stats, transactions, networks, tokens, totalAll }) {
  const networkOptions = (networks || []).map(n => `<option value="${escapeHtml(n.network)}">${escapeHtml(getNetworkName(n.network))} (${n.count})</option>`).join("");
  const tokenOptions = (tokens || []).filter(t => t.token !== "UNKNOWN").map(t => `<option value="${escapeHtml(t.token)}">${escapeHtml(t.token)} (${t.count})</option>`).join("");
  const rows = (transactions || []).map(tx => renderRow(tx)).join("");
  const totalVol = stats ? formatAmount(stats.totalVolume, "USDT", null) : "0.00";
  const avgSize = stats ? formatAmount(stats.avgTransactionSize, "USDT", null) : "0.00";
  const chainCount = Object.keys(stats?.byNetwork ?? {}).length;
  const totalSettlements = stats?.totalTransactions ?? 0;

  const networkLinks = (networks || []).map(n => `<a href="/network/${escapeHtml(encodeURIComponent(n.network))}" class="badge">${escapeHtml(getNetworkName(n.network))} (${n.count})</a>`).join(" ");
  const tokenLinks = (tokens || []).filter(t => t.token !== "UNKNOWN").map(t => `<a href="/token/${escapeHtml(encodeURIComponent(t.token))}" class="badge badge-token" title="${escapeHtml(tokenFullName(t.token))}">${escapeHtml(t.token)} (${t.count})</a>`).join(" ");

  return `<!DOCTYPE html>
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>T402 Explorer — Payment Settlement Browser</title>
<meta name="description" content="Browse real-time USDT/USDC payment settlements across Ethereum, Arbitrum, Solana, TON, TRON and more via the T402 protocol.">
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', 'Real-time settlement browser for the <a href="https://t402.io">T402 protocol</a>')}
  <p class="intro">Browse ${formatNumber(totalAll || totalSettlements)} settlements across ${(networks || []).length} blockchains via the <a href="https://t402.io">T402 protocol</a>.</p>
  <div class="stats">
    <div class="stat" title="Total confirmed settlements in the last 7 days"><div class="stat-value">${escapeHtml(formatNumber(totalSettlements))}</div><div class="stat-label">Settlements (7d)</div></div>
    <div class="stat" title="Total USD volume settled in the last 7 days"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Volume (7d)</div></div>
    <div class="stat" title="Number of distinct blockchains with activity"><div class="stat-value">${escapeHtml(String(chainCount))}</div><div class="stat-label">Chains</div></div>
    <div class="stat" title="Number of distinct token types used"><div class="stat-value">${escapeHtml(String(Object.keys(stats?.byToken ?? {}).length))}</div><div class="stat-label">Tokens</div></div>
    <div class="stat" title="Unique payer addresses in the last 7 days"><div class="stat-value">${escapeHtml(formatNumber(stats?.uniquePayers ?? 0))}</div><div class="stat-label">Payers</div></div>
    <div class="stat" title="Average settlement amount in USD"><div class="stat-value">$${escapeHtml(avgSize)}</div><div class="stat-label">Avg Size</div></div>
  </div>
  <div class="browse-section"><span class="browse-label">Chains</span> ${networkLinks}</div>
  <div class="browse-section"><span class="browse-label">Tokens</span> ${tokenLinks}</div>
  <div class="filters">
    <select id="networkFilter"><option value="">All Chains</option>${networkOptions}</select>
    <select id="tokenFilter"><option value="">All Tokens</option>${tokenOptions}</select>
    <select id="statusFilter"><option value="">All Status</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="failed">Failed</option></select>
    <label class="filter-label">From <input type="date" id="dateFrom"></label>
    <label class="filter-label">To <input type="date" id="dateTo"></label>
    <select id="sortBy">
      <option value="">Newest first</option>
      <option value="confirmed_at|ASC">Oldest first</option>
      <option value="amount|DESC">Amount ↓</option>
      <option value="amount|ASC">Amount ↑</option>
    </select>
    <button class="secondary" id="resetBtn">Reset</button>
  </div>
  <div class="filters">
    <input type="search" id="searchInput" placeholder="Search by tx hash (0x...) or wallet address">
    <button id="searchBtn">Search</button>
  </div>
  <h2>Recent Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Hash</th><th>Chain</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th>Purpose</th><th title="exact = direct gasless transfer; exact-legacy = approve + transferFrom">Scheme</th><th>Time</th></tr></thead>
      <tbody id="txBody">${rows}</tbody>
    </table>
  </div>
  <div id="loading" class="loading hidden">Loading...</div>
  <div class="pagination">
    <button id="prevBtn" class="secondary" disabled>Previous</button>
    <span id="pageInfo" class="page-info" data-total="${totalAll || totalSettlements}">Page 1 &middot; ${formatNumber(totalAll || totalSettlements)} settlements</span>
    <button id="nextBtn" class="secondary">Next</button>
  </div>
  <footer>
    <a href="/api/v1/export?format=csv">Export CSV</a> ·
    <a href="/api/v1/transactions">API</a> ·
    <a href="/api/v1/stats">Stats</a> ·
    <a href="/metrics">Metrics</a>
    <br><span class="text-sm">Powered by <a href="https://t402.io">T402 Protocol</a></span>
  </footer>
  <script src="/static/app.js"></script>
</body></html>`;
}

const FACILITATOR_ADDRESS = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";

function renderRow(tx) {
  const amount = formatAmount(tx.amount, tx.token, tx.network);
  const schemeClass = tx.scheme === "exact" ? "scheme-exact" : "scheme-legacy";
  const isEvm = tx.network && tx.network.startsWith("eip155:");
  const schemeTitle = tx.scheme === "exact" ? (isEvm ? "EIP-3009 gasless transfer" : "Direct transfer") : "approve + transferFrom";
  const toCell = tx.to && tx.to.toLowerCase() === FACILITATOR_ADDRESS.toLowerCase()
    ? `<span class="badge badge-facilitator" title="${escapeHtml(tx.to)}">Facilitator</span>`
    : `<code>${escapeHtml(formatAddress(tx.to))}</code>`;
  const tokenTitle = tokenFullName(tx.token);
  return `<tr data-hash="${escapeHtml(tx.txHash)}">
    <td><code>${escapeHtml(formatHash(tx.txHash))}</code></td>
    <td><a href="/network/${escapeHtml(encodeURIComponent(tx.network))}"><span class="badge">${escapeHtml(getNetworkName(tx.network))}</span></a></td>
    <td><a href="/token/${escapeHtml(encodeURIComponent(tx.token))}"><span class="badge badge-token" title="${escapeHtml(tokenTitle)}">${escapeHtml(tx.token)}</span></a></td>
    <td class="amount">$${escapeHtml(amount)}</td>
    <td><a href="/address/${escapeHtml(encodeURIComponent(tx.from))}"><code>${escapeHtml(formatAddress(tx.from))}</code></a></td>
    <td>${tx.to && tx.to.toLowerCase() === FACILITATOR_ADDRESS.toLowerCase() ? toCell : `<a href="/address/${escapeHtml(encodeURIComponent(tx.to))}">${toCell}</a>`}</td>
    <td class="purpose">${tx.description ? `<span class="badge badge-purpose" title="${escapeHtml(tx.source || '')}">${escapeHtml(tx.description)}</span>` : '<span class="muted">—</span>'}</td>
    <td><span class="badge ${schemeClass}" title="${escapeHtml(schemeTitle)}">${escapeHtml(tx.scheme)}</span></td>
    <td class="time" title="${escapeHtml(tx.settledAt)}">${escapeHtml(formatTime(tx.settledAt))}</td>
  </tr>`;
}

function tokenFullName(symbol) {
  const names = { "USDT": "Tether USD", "USDC": "USD Coin", "USDT0": "Tether USD (bridged)", "USAT": "Tether America USD" };
  return names[symbol] || symbol;
}

export function renderDetail(tx) {
  if (!tx) return render404();
  const amount = formatAmount(tx.amount, tx.token, tx.network);
  const explorerUrl = getExplorerUrl(tx.network, tx.txHash);
  const fromUrl = getAddressUrl(tx.network, tx.from);
  const toUrl = getAddressUrl(tx.network, tx.to);
  const statusClass = tx.status === "confirmed" ? "status-confirmed" : tx.status === "pending" ? "status-pending" : "status-failed";

  return `<!DOCTYPE html>
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>Tx ${escapeHtml(formatHash(tx.txHash))} - T402 Explorer</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Transaction Details</h2>
    <div class="detail-row"><span class="detail-label">Status</span><span class="status-badge ${statusClass}">${escapeHtml(tx.status)}</span></div>
    <div class="detail-row"><span class="detail-label">Transaction Hash</span><span class="detail-value"><code>${escapeHtml(tx.txHash)}</code><button class="copy-btn" data-copy="${escapeHtml(tx.txHash)}" title="Copy">Copy</button>${explorerUrl ? `<a href="${escapeHtml(explorerUrl)}" target="_blank" rel="noopener noreferrer" class="explorer-link">View on Explorer</a>` : ""}</span></div>
    <div class="detail-row"><span class="detail-label">Network</span><span class="detail-value"><a href="/network/${escapeHtml(encodeURIComponent(tx.network))}"><span class="badge">${escapeHtml(getNetworkName(tx.network))}</span></a> <span class="muted">(${escapeHtml(tx.network)})</span></span></div>
    <div class="detail-row"><span class="detail-label">Amount</span><span class="detail-value amount-large">$${escapeHtml(amount)} <a href="/token/${escapeHtml(encodeURIComponent(tx.token))}"><span class="badge badge-token">${escapeHtml(tx.token)}</span></a></span></div>
    <div class="detail-row"><span class="detail-label">From</span><span class="detail-value"><code>${escapeHtml(tx.from)}</code><button class="copy-btn" data-copy="${escapeHtml(tx.from)}" title="Copy">Copy</button>${fromUrl ? `<a href="${escapeHtml(fromUrl)}" target="_blank" rel="noopener noreferrer" class="explorer-link">View</a>` : ""}</span></div>
    <div class="detail-row"><span class="detail-label">To</span><span class="detail-value"><code>${escapeHtml(tx.to)}</code><button class="copy-btn" data-copy="${escapeHtml(tx.to)}" title="Copy">Copy</button>${toUrl ? `<a href="${escapeHtml(toUrl)}" target="_blank" rel="noopener noreferrer" class="explorer-link">View</a>` : ""}</span></div>
    ${tx.description ? `<div class="detail-row"><span class="detail-label">Purpose</span><span class="detail-value">${escapeHtml(tx.description)}${tx.resourceUrl ? ` &middot; <a href="${escapeHtml(tx.resourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tx.resourceUrl)}</a>` : ""}</span></div>` : ""}
    ${tx.source ? `<div class="detail-row"><span class="detail-label">Source</span><span class="detail-value">${escapeHtml(tx.source)}</span></div>` : ""}
    <div class="detail-row"><span class="detail-label">Scheme</span><span class="detail-value"><span class="badge ${tx.scheme === "exact" ? "scheme-exact" : "scheme-legacy"}" title="${tx.scheme === "exact" ? (tx.network && tx.network.startsWith("eip155:") ? "EIP-3009 gasless transfer" : "Direct transfer") : "approve + transferFrom"}">${escapeHtml(tx.scheme)}</span></span></div>
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
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>Address ${escapeHtml(formatAddress(address))} - T402 Explorer</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Address Details</h2>
    <div class="detail-row"><span class="detail-label">Address</span><span class="detail-value"><code>${escapeHtml(address)}</code><button class="copy-btn" data-copy="${escapeHtml(address)}" title="Copy">Copy</button></span></div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value">${escapeHtml(formatNumber(stats?.total ?? 0))}</div><div class="stat-label">Transactions</div></div>
    <div class="stat"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Volume</div></div>
  </div>
  <h2>Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tx Hash</th><th>Network</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th>Scheme</th><th>Time</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <footer>
    <a href="/">Back to Explorer</a> ·
    Powered by <a href="https://t402.io">T402</a>
  </footer>
  <script src="/static/app.js"></script>
</body></html>`;
}

export function renderNetworkPage(networkId, stats, transactions) {
  const name = getNetworkName(networkId);
  const rows = (transactions || []).map(tx => renderRow(tx)).join("");

  if (!stats) {
    return `<!DOCTYPE html>
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>${escapeHtml(name)} - T402 Explorer</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', '<a href="/">Back to transactions</a>')}
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
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>${escapeHtml(name)} - T402 Explorer</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Network: ${escapeHtml(name)}</h2>
    <div class="detail-row"><span class="detail-label">CAIP-2 ID</span><span class="detail-value"><code>${escapeHtml(networkId)}</code><button class="copy-btn" data-copy="${escapeHtml(networkId)}" title="Copy">Copy</button></span></div>
    <div class="detail-row"><span class="detail-label">Tokens</span><span class="detail-value">${tokenBadges || "<span class=\"muted\">None</span>"}</span></div>
    <div class="detail-row"><span class="detail-label">Schemes</span><span class="detail-value">${schemeBadges || "<span class=\"muted\">None</span>"}</span></div>
  </div>
  <div class="stats">
    <div class="stat" title="Total confirmed transactions on this network"><div class="stat-value">${escapeHtml(formatNumber(stats.totalTransactions))}</div><div class="stat-label">Transactions</div></div>
    <div class="stat" title="Total USD volume on this network"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Total Volume</div></div>
    <div class="stat" title="Average transaction size in USD"><div class="stat-value">$${escapeHtml(avgSize)}</div><div class="stat-label">Avg Tx Size</div></div>
    <div class="stat" title="Unique payer addresses on this network"><div class="stat-value">${escapeHtml(formatNumber(stats.uniquePayers))}</div><div class="stat-label">Unique Payers</div></div>
    <div class="stat" title="Unique recipient addresses on this network"><div class="stat-value">${escapeHtml(formatNumber(stats.uniqueRecipients))}</div><div class="stat-label">Unique Recipients</div></div>
  </div>
  <h2>Recent Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tx Hash</th><th>Network</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th title="exact = EIP-3009 gasless transfer; exact-legacy = approve + transferFrom">Scheme</th><th>Time</th></tr></thead>
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
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>${escapeHtml(tokenSymbol)} - T402 Explorer</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', '<a href="/">Back to transactions</a>')}
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
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>${escapeHtml(tokenSymbol)} - T402 Explorer</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', '<a href="/">Back to transactions</a>')}
  <div class="tx-detail">
    <h2>Token: ${escapeHtml(tokenSymbol)}</h2>
    <div class="detail-row"><span class="detail-label">Networks</span><span class="detail-value">${networkBadges || "<span class=\"muted\">None</span>"}</span></div>
    <div class="detail-row"><span class="detail-label">Schemes</span><span class="detail-value">${schemeBadges || "<span class=\"muted\">None</span>"}</span></div>
  </div>
  <div class="stats">
    <div class="stat" title="Total confirmed transactions for this token"><div class="stat-value">${escapeHtml(formatNumber(stats.totalTransactions))}</div><div class="stat-label">Transactions</div></div>
    <div class="stat" title="Total USD volume for this token"><div class="stat-value">$${escapeHtml(totalVol)}</div><div class="stat-label">Total Volume</div></div>
    <div class="stat" title="Average transaction size in USD"><div class="stat-value">$${escapeHtml(avgSize)}</div><div class="stat-label">Avg Tx Size</div></div>
    <div class="stat" title="Unique payer addresses for this token"><div class="stat-value">${escapeHtml(formatNumber(stats.uniquePayers))}</div><div class="stat-label">Unique Payers</div></div>
    <div class="stat" title="Unique recipient addresses for this token"><div class="stat-value">${escapeHtml(formatNumber(stats.uniqueRecipients))}</div><div class="stat-label">Unique Recipients</div></div>
  </div>
  <h2>Recent Transactions</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Tx Hash</th><th>Network</th><th>Token</th><th class="text-right">Amount</th><th>From</th><th>To</th><th title="exact = EIP-3009 gasless transfer; exact-legacy = approve + transferFrom">Scheme</th><th>Time</th></tr></thead>
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
<html lang="en" translate="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google" content="notranslate">
<title>Not Found - T402 Explorer</title>
<link rel="icon" type="image/svg+xml" href="/static/favicon.svg"><link rel="stylesheet" href="/static/style.css">
${themeToggleScript()}
</head>
<body>
  ${headerHtml('<a href="/">T402 Explorer</a>', '')}
  <div class="tx-detail">
    <h2>Transaction Not Found</h2>
    <p class="subtitle">The transaction does not exist or has not been indexed yet.</p>
    <p><a href="/">Back to transactions</a></p>
  </div>
  <script src="/static/app.js"></script>
</body></html>`;
}
