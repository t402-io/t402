/**
 * Data source abstraction for T402 Agent Dashboard.
 *
 * Reads from:
 * - Facilitator PostgreSQL (if DATABASE_URL env is set)
 * - Synthetic data (fallback — existing data.js)
 *
 * The public API mirrors data.js so server.js can swap transparently.
 */

import {
  generatePaymentHistory,
  generateBalances,
  generateBudget,
  generateStats,
  generateAlerts,
  exportPaymentsCsv,
} from "./data.js";

// ── Mode detection ──────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL || "";

/** @returns {"live"|"demo"} */
export function getMode() {
  return DATABASE_URL ? "live" : "demo";
}

// ── PostgreSQL pool (lazy init) ─────────────────────────────────────

/** @type {import("pg").Pool|null} */
let _pool = null;

async function getPool() {
  if (_pool) return _pool;
  // Dynamic import so pg is only required when DATABASE_URL is set.
  const { default: pg } = await import("pg");
  _pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  // Verify connectivity once at startup.
  const client = await _pool.connect();
  client.release();
  return _pool;
}

/**
 * Gracefully shut down the pool (call on process exit).
 */
export async function shutdown() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// ── Network metadata lookup ─────────────────────────────────────────

const NETWORK_META = {
  "eip155:1": { label: "Ethereum", token: "USDC", decimals: 6 },
  "eip155:8453": { label: "Base", token: "USDC", decimals: 6 },
  "eip155:42161": { label: "Arbitrum", token: "USDT0", decimals: 6 },
  "eip155:137": { label: "Polygon", token: "USDC", decimals: 6 },
  "eip155:10": { label: "Optimism", token: "USDC", decimals: 6 },
  "eip155:56": { label: "BNB Chain", token: "USDT", decimals: 6 },
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": { label: "Solana", token: "USDC", decimals: 6 },
  "ton:mainnet": { label: "TON", token: "USDT", decimals: 6 },
  "stellar:pubnet": { label: "Stellar", token: "USDC", decimals: 7 },
  "tron:mainnet": { label: "TRON", token: "USDT", decimals: 6 },
};

function networkMeta(caip2) {
  return NETWORK_META[caip2] || { label: caip2, token: "USDT", decimals: 6 };
}

// ── Live data helpers ───────────────────────────────────────────────

/**
 * Map a settlements DB row to the payment object shape the API returns.
 */
function rowToPayment(row, index) {
  const network = row.network || "eip155:1";
  const meta = networkMeta(network);
  const amountRaw = Number(row.amount || 0);
  return {
    id: `pay-${String(index + 1).padStart(4, "0")}`,
    txHash: row.tx_hash || "",
    network,
    networkLabel: meta.label,
    token: row.token || meta.token,
    amount: String(amountRaw),
    amountFormatted: (amountRaw / 10 ** meta.decimals).toFixed(meta.decimals === 7 ? 2 : 4),
    to: row.to_address || "",
    service: row.service || row.resource || "Unknown",
    status: row.status || "settled",
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get payment history for an address.
 * @param {string} address
 * @param {{ days?: number, limit?: number, network?: string }} [options]
 * @returns {Promise<{ payments: Array<object>, total: number }>}
 */
export async function getPayments(address, options = {}) {
  const { days = 7, limit = 20, network = null } = options;

  if (getMode() === "demo") {
    let payments = generatePaymentHistory(address, days);
    if (network) payments = payments.filter((p) => p.network === network);
    return { payments: payments.slice(0, limit), total: payments.length };
  }

  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  let query, params;

  if (network) {
    query = `SELECT * FROM settlements
             WHERE (from_address = $1 OR to_address = $1)
               AND created_at >= $2
               AND network = $3
             ORDER BY created_at DESC
             LIMIT $4`;
    params = [address, cutoff, network, limit];
  } else {
    query = `SELECT * FROM settlements
             WHERE (from_address = $1 OR to_address = $1)
               AND created_at >= $2
             ORDER BY created_at DESC
             LIMIT $3`;
    params = [address, cutoff, limit];
  }

  const result = await pool.query(query, params);

  // Get total count for pagination info.
  const countQuery = network
    ? `SELECT COUNT(*) as cnt FROM settlements
       WHERE (from_address = $1 OR to_address = $1) AND created_at >= $2 AND network = $3`
    : `SELECT COUNT(*) as cnt FROM settlements
       WHERE (from_address = $1 OR to_address = $1) AND created_at >= $2`;
  const countParams = network ? [address, cutoff, network] : [address, cutoff];
  const countResult = await pool.query(countQuery, countParams);

  const payments = result.rows.map((row, i) => rowToPayment(row, i));
  const total = parseInt(countResult.rows[0]?.cnt || "0", 10);

  return { payments, total };
}

/**
 * Get aggregated balances for an address.
 * @param {string} address
 * @returns {Promise<{ balances: Array<object>, totalUsd: string }>}
 */
export async function getBalances(address) {
  if (getMode() === "demo") {
    return generateBalances(address);
  }

  const pool = await getPool();
  // Aggregate settled amounts by network for this address as a proxy for balance.
  const result = await pool.query(
    `SELECT network,
            COALESCE(SUM(CASE WHEN to_address = $1 THEN CAST(amount AS BIGINT) ELSE 0 END), 0)
              - COALESCE(SUM(CASE WHEN from_address = $1 THEN CAST(amount AS BIGINT) ELSE 0 END), 0)
              AS net_balance
     FROM settlements
     WHERE (from_address = $1 OR to_address = $1)
       AND status = 'settled'
     GROUP BY network
     ORDER BY net_balance DESC`,
    [address],
  );

  let totalRaw = 0;
  const balances = result.rows.map((row) => {
    const network = row.network || "eip155:1";
    const meta = networkMeta(network);
    const raw = Math.max(0, Number(row.net_balance || 0));
    totalRaw += raw;
    return {
      network,
      networkLabel: meta.label,
      token: meta.token,
      balance: String(raw),
      balanceFormatted: (raw / 1e6).toFixed(2),
    };
  });

  return { balances, totalUsd: (totalRaw / 1e6).toFixed(2) };
}

/**
 * Get budget / policy usage for an address.
 * In live mode, budget is computed from actual settlement totals.
 * @param {string} address
 * @returns {Promise<object>}
 */
export async function getBudget(address) {
  if (getMode() === "demo") {
    return generateBudget(address);
  }

  const pool = await getPool();
  const maxPerPayment = 1000000; // $1
  const maxPerSession = 10000000; // $10
  const maxPerDay = 50000000; // $50

  // Today's spending
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayResult = await pool.query(
    `SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) AS total
     FROM settlements
     WHERE from_address = $1
       AND status = 'settled'
       AND created_at >= $2`,
    [address, todayStart],
  );
  const todaySpent = Number(todayResult.rows[0]?.total || 0);

  // Last hour spending as session proxy
  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const sessionResult = await pool.query(
    `SELECT COALESCE(SUM(CAST(amount AS BIGINT)), 0) AS total,
            COUNT(*) AS cnt
     FROM settlements
     WHERE from_address = $1
       AND status = 'settled'
       AND created_at >= $2`,
    [address, hourAgo],
  );
  const sessionSpent = Number(sessionResult.rows[0]?.total || 0);
  const paymentsThisHour = Number(sessionResult.rows[0]?.cnt || 0);

  const sessionPct = +((sessionSpent / maxPerSession) * 100).toFixed(1);
  const todayPct = +((todaySpent / maxPerDay) * 100).toFixed(1);

  return {
    policy: {
      maxPerPayment: String(maxPerPayment),
      maxPerSession: String(maxPerSession),
      maxPerDay: String(maxPerDay),
      allowedNetworks: ["eip155:8453", "eip155:42161", "eip155:137"],
    },
    usage: {
      sessionSpent: String(sessionSpent),
      sessionLimit: String(maxPerSession),
      sessionPercentage: sessionPct,
      todaySpent: String(todaySpent),
      todayLimit: String(maxPerDay),
      todayPercentage: todayPct,
      paymentsThisHour,
    },
  };
}

/**
 * Get spending analytics / stats for an address.
 * @param {string} address
 * @param {number} [days=7]
 * @returns {Promise<object>}
 */
export async function getStats(address, days = 7) {
  if (getMode() === "demo") {
    return generateStats(address, days);
  }

  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);

  // Aggregate stats from settled payments
  const result = await pool.query(
    `SELECT network, COALESCE(service, resource, 'Unknown') AS svc,
            CAST(amount AS BIGINT) AS amt
     FROM settlements
     WHERE (from_address = $1 OR to_address = $1)
       AND status = 'settled'
       AND created_at >= $2
     ORDER BY created_at DESC`,
    [address, cutoff],
  );

  const rows = result.rows;
  let totalSpent = 0;

  // Aggregate by service
  const serviceMap = {};
  for (const row of rows) {
    const amt = Number(row.amt || 0);
    totalSpent += amt;
    const svc = row.svc || "Unknown";
    const s = (serviceMap[svc] ||= { name: svc, count: 0, amount: 0 });
    s.count++;
    s.amount += amt;
  }
  const topServices = Object.values(serviceMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((s) => ({ ...s, amount: String(s.amount) }));

  // Aggregate by network
  const byNetwork = {};
  for (const row of rows) {
    const n = (byNetwork[row.network] ||= { count: 0, amount: 0 });
    n.count++;
    n.amount += Number(row.amt || 0);
  }
  for (const k of Object.keys(byNetwork)) {
    byNetwork[k].amount = String(byNetwork[k].amount);
  }

  const avgPayment = rows.length > 0 ? Math.floor(totalSpent / rows.length) : 0;

  return {
    period: `${days}d`,
    totalPayments: rows.length,
    totalSpent: String(totalSpent),
    totalSpentUsd: (totalSpent / 1e6).toFixed(2),
    avgPaymentSize: String(avgPayment),
    avgPaymentUsd: (avgPayment / 1e6).toFixed(4),
    topServices,
    byNetwork,
  };
}

/**
 * Get active alerts for an address (budget threshold checks).
 * @param {string} address
 * @returns {Promise<Array<object>>}
 */
export async function getAlerts(address) {
  if (getMode() === "demo") {
    return generateAlerts(address);
  }

  // Use live budget data to compute alerts.
  const budget = await getBudget(address);
  const alerts = [];
  const alertTimestamp = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();

  const sessionPct = budget.usage.sessionPercentage;
  const todayPct = budget.usage.todayPercentage;

  if (sessionPct >= 100) {
    alerts.push({
      id: "alert-session-exceeded",
      level: "critical",
      message: `Session budget exceeded: ${sessionPct.toFixed(1)}% used ($${(Number(budget.usage.sessionSpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.sessionLimit) / 1e6).toFixed(2)})`,
      field: "session",
      percentage: sessionPct,
      timestamp: alertTimestamp,
    });
  } else if (sessionPct >= 80) {
    alerts.push({
      id: "alert-session-warning",
      level: "warning",
      message: `Session budget nearing limit: ${sessionPct.toFixed(1)}% used ($${(Number(budget.usage.sessionSpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.sessionLimit) / 1e6).toFixed(2)})`,
      field: "session",
      percentage: sessionPct,
      timestamp: alertTimestamp,
    });
  }

  if (todayPct >= 100) {
    alerts.push({
      id: "alert-daily-exceeded",
      level: "critical",
      message: `Daily budget exceeded: ${todayPct.toFixed(1)}% used ($${(Number(budget.usage.todaySpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.todayLimit) / 1e6).toFixed(2)})`,
      field: "daily",
      percentage: todayPct,
      timestamp: alertTimestamp,
    });
  } else if (todayPct >= 80) {
    alerts.push({
      id: "alert-daily-warning",
      level: "warning",
      message: `Daily budget nearing limit: ${todayPct.toFixed(1)}% used ($${(Number(budget.usage.todaySpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.todayLimit) / 1e6).toFixed(2)})`,
      field: "daily",
      percentage: todayPct,
      timestamp: alertTimestamp,
    });
  }

  return alerts;
}

/**
 * Export payment history as CSV string.
 * @param {string} address
 * @param {number} [days=7]
 * @returns {Promise<string>}
 */
export async function getExportCsv(address, days = 7) {
  if (getMode() === "demo") {
    return exportPaymentsCsv(address, days);
  }

  // Fetch all payments for the period (no limit).
  const { payments } = await getPayments(address, { days, limit: 10000 });

  const header = "id,timestamp,service,network,token,amount,amount_usd,to,txHash,status";

  function csvField(value) {
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  const rows = payments.map((p) =>
    [
      p.id,
      p.timestamp,
      csvField(p.service),
      csvField(p.network),
      p.token,
      p.amount,
      p.amountFormatted,
      csvField(p.to),
      csvField(p.txHash),
      p.status,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
