/**
 * Data source abstraction for T402 Agent Dashboard.
 *
 * Reads from:
 * - Facilitator PostgreSQL (if DATABASE_URL env is set)
 * - Synthetic data (fallback — data.js)
 *
 * The public API mirrors data.js so routes can swap transparently.
 */

import {
  generatePaymentHistory,
  generateBalances,
  generateBudget,
  generateStats as generateStatsSynthetic,
  generateAlerts,
  generateTrendData,
  exportPaymentsCsv,
  generateAgents,
  generateGlobalStats,
  generateGlobalTransactions,
  generateGlobalNetworkStats,
  generateGlobalTrendData,
} from "./data.js";
import { networkMeta, resolveTokenSymbol } from "./networks.js";
import { buildAlertsFromBudget, formatPaymentsCsv, log } from "./utils.js";

// ── Mode detection ──────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  log("warn", "DATABASE_URL not set — running in demo mode with synthetic data");
}

/** @returns {"live"|"demo"} */
export function getMode() {
  return DATABASE_URL ? "live" : "demo";
}

// ── Configurable budget limits ──────────────────────────────────────

const MAX_PER_PAYMENT = parseInt(process.env.BUDGET_MAX_PER_PAYMENT || "1000000", 10);
const MAX_PER_SESSION = parseInt(process.env.BUDGET_MAX_PER_SESSION || "10000000", 10);
const MAX_PER_DAY = parseInt(process.env.BUDGET_MAX_PER_DAY || "50000000", 10);

// ── PostgreSQL pool (lazy init) ─────────────────────────────────────

/** @type {import("pg").Pool|null} */
let _pool = null;
/** @type {Promise<import("pg").Pool>|null} */
let _poolPromise = null;

async function initPool() {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on("error", (err) => log("error", "PostgreSQL pool error", { error: err.message }));
  // Verify connectivity once at startup.
  const client = await pool.connect();
  client.release();
  log("info", "PostgreSQL pool connected", { max: 10 });
  _pool = pool;
  return pool;
}

/** Singleton pool getter — prevents race condition on concurrent first calls. */
async function getPool() {
  if (!_poolPromise) _poolPromise = initPool();
  return _poolPromise;
}

/**
 * Get pool statistics for health endpoint.
 * @returns {{ totalCount: number, idleCount: number, waitingCount: number }|null}
 */
export function getPoolStats() {
  if (!_pool) return null;
  return {
    totalCount: _pool.totalCount,
    idleCount: _pool.idleCount,
    waitingCount: _pool.waitingCount,
  };
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

// ── Live data helpers ───────────────────────────────────────────────

/**
 * Map a settlements DB row to the payment object shape the API returns.
 */
function rowToPayment(row, index) {
  const network = row.network || "eip155:1";
  const meta = networkMeta(network);
  const decimals = (row.metadata && typeof row.metadata === "object" && row.metadata.decimals) ? Number(row.metadata.decimals) : meta.decimals;
  const amountRaw = Number(row.amount || 0);
  return {
    id: `pay-${String(index + 1).padStart(4, "0")}`,
    txHash: row.tx_hash || "",
    network,
    networkLabel: meta.label,
    token: resolveTokenSymbol(row.token || row.asset) || meta.token,
    amount: String(amountRaw),
    amountFormatted: (amountRaw / 10 ** decimals).toFixed(decimals > 6 ? 4 : 4),
    to: row.to_address || "",
    service: row.service || row.resource || (row.metadata && typeof row.metadata === "object" ? (row.metadata.resource || row.metadata.service) : null) || "Payment",
    status: row.status === "confirmed" ? "settled" : (row.status || "settled"),
    timestamp: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get payment history for an address.
 * @param {string} address
 * @param {{ days?: number, limit?: number, network?: string, offset?: number }} [options]
 * @returns {Promise<{ payments: Array<object>, total: number }>}
 */
export async function getPayments(address, options = {}) {
  const { days = 7, limit = 20, network = null, offset = 0 } = options;

  if (getMode() === "demo") {
    let payments = generatePaymentHistory(address, days);
    if (network) payments = payments.filter((p) => p.network === network);
    const total = payments.length;
    return { payments: payments.slice(offset, offset + limit), total };
  }

  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);

  const statusFilter = `AND status = 'confirmed' AND CAST(amount AS NUMERIC) > 0`;
  let query, params;
  if (network) {
    query = {
      name: "get-payments-filtered-v2",
      text: `SELECT * FROM settlements_view
             WHERE (from_address = $1 OR to_address = $1)
               AND created_at >= $2
               AND network = $3
               ${statusFilter}
             ORDER BY created_at DESC
             LIMIT $4 OFFSET $5`,
      values: [address, cutoff, network, limit, offset],
    };
  } else {
    query = {
      name: "get-payments-v2",
      text: `SELECT * FROM settlements_view
             WHERE (from_address = $1 OR to_address = $1)
               AND created_at >= $2
               ${statusFilter}
             ORDER BY created_at DESC
             LIMIT $3 OFFSET $4`,
      values: [address, cutoff, limit, offset],
    };
  }

  const result = await pool.query(query);

  // Get total count for pagination info.
  const countQuery = network
    ? {
        name: "count-payments-filtered-v2",
        text: `SELECT COUNT(*) as cnt FROM settlements_view
               WHERE (from_address = $1 OR to_address = $1) AND created_at >= $2 AND network = $3
               ${statusFilter}`,
        values: [address, cutoff, network],
      }
    : {
        name: "count-payments-v2",
        text: `SELECT COUNT(*) as cnt FROM settlements_view
               WHERE (from_address = $1 OR to_address = $1) AND created_at >= $2
               ${statusFilter}`,
        values: [address, cutoff],
      };
  const countResult = await pool.query(countQuery);

  const payments = result.rows.map((row, i) => rowToPayment(row, offset + i));
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
  const result = await pool.query({
    name: "get-balances",
    text: `SELECT network,
            COALESCE(SUM(CASE WHEN to_address = $1 THEN CAST(amount AS NUMERIC) ELSE 0 END), 0)
              - COALESCE(SUM(CASE WHEN from_address = $1 THEN CAST(amount AS NUMERIC) ELSE 0 END), 0)
              AS net_balance
     FROM settlements_view
     WHERE (from_address = $1 OR to_address = $1)
       AND status = 'confirmed'
     GROUP BY network
     ORDER BY net_balance DESC`,
    values: [address],
  });

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
      balanceFormatted: (raw / 10 ** meta.decimals).toFixed(2),
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

  // Today's spending
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayResult = await pool.query({
    name: "budget-today",
    text: `SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS total
     FROM settlements_view
     WHERE from_address = $1
       AND status = 'confirmed'
       AND created_at >= $2`,
    values: [address, todayStart],
  });
  const todaySpent = Number(todayResult.rows[0]?.total || 0);

  // Last hour spending as session proxy
  const hourAgo = new Date(Date.now() - 3600 * 1000);
  const sessionResult = await pool.query({
    name: "budget-session",
    text: `SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS total,
            COUNT(*) AS cnt
     FROM settlements_view
     WHERE from_address = $1
       AND status = 'confirmed'
       AND created_at >= $2`,
    values: [address, hourAgo],
  });
  const sessionSpent = Number(sessionResult.rows[0]?.total || 0);
  const paymentsThisHour = Number(sessionResult.rows[0]?.cnt || 0);

  // Fetch distinct networks this address has actually used
  const netResult = await pool.query({
    name: "budget-networks",
    text: `SELECT DISTINCT network FROM settlements_view
           WHERE (from_address = $1 OR to_address = $1) AND status = 'confirmed'
           ORDER BY network`,
    values: [address],
  });
  const allowedNetworks = netResult.rows.map((r) => r.network).filter(Boolean);

  const sessionPct = +((sessionSpent / MAX_PER_SESSION) * 100).toFixed(1);
  const todayPct = +((todaySpent / MAX_PER_DAY) * 100).toFixed(1);

  return {
    policy: {
      maxPerPayment: String(MAX_PER_PAYMENT),
      maxPerSession: String(MAX_PER_SESSION),
      maxPerDay: String(MAX_PER_DAY),
      allowedNetworks,
    },
    usage: {
      sessionSpent: String(sessionSpent),
      sessionLimit: String(MAX_PER_SESSION),
      sessionPercentage: sessionPct,
      todaySpent: String(todaySpent),
      todayLimit: String(MAX_PER_DAY),
      todayPercentage: todayPct,
      paymentsThisHour,
    },
  };
}

/**
 * Get spending analytics / stats for an address.
 * Live mode uses SQL GROUP BY for efficient aggregation.
 * @param {string} address
 * @param {number} [days=7]
 * @returns {Promise<object>}
 */
export async function getStats(address, days = 7) {
  if (getMode() === "demo") {
    return generateStatsSynthetic(address, days);
  }

  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);

  // Top services (SQL aggregation)
  const svcResult = await pool.query({
    name: "stats-top-services",
    text: `SELECT COALESCE(service, resource, 'Unknown') AS svc,
                  COUNT(*) AS cnt, SUM(CAST(amount AS NUMERIC)) AS total
           FROM settlements_view
           WHERE (from_address = $1 OR to_address = $1)
             AND status = 'confirmed'
             AND created_at >= $2
           GROUP BY COALESCE(service, resource, 'Unknown') ORDER BY total DESC LIMIT 5`,
    values: [address, cutoff],
  });

  const topServices = svcResult.rows.map((row) => ({
    name: row.svc,
    count: Number(row.cnt),
    amount: String(row.total || 0),
  }));

  // By network (SQL aggregation)
  const netResult = await pool.query({
    name: "stats-by-network",
    text: `SELECT network, COUNT(*) AS cnt, SUM(CAST(amount AS NUMERIC)) AS total
           FROM settlements_view
           WHERE (from_address = $1 OR to_address = $1)
             AND status = 'confirmed'
             AND created_at >= $2
           GROUP BY network`,
    values: [address, cutoff],
  });

  const byNetwork = {};
  let totalSpent = 0;
  let totalPayments = 0;
  for (const row of netResult.rows) {
    const amt = Number(row.total || 0);
    const cnt = Number(row.cnt || 0);
    byNetwork[row.network] = { count: cnt, amount: String(amt) };
    totalSpent += amt;
    totalPayments += cnt;
  }

  const avgPayment = totalPayments > 0 ? Math.floor(totalSpent / totalPayments) : 0;

  return {
    period: `${days}d`,
    totalPayments,
    totalSpent: String(totalSpent),
    totalSpentUsd: (totalSpent / 1e6).toFixed(2),
    avgPaymentSize: String(avgPayment),
    avgPaymentUsd: (avgPayment / 1e6).toFixed(4),
    topServices,
    byNetwork,
  };
}

/**
 * Get daily spending trend for an address.
 * @param {string} address
 * @param {number} [days=30]
 * @returns {Promise<Array<{ date: string, count: number, amount: string, amountUsd: string }>>}
 */
export async function getTrend(address, days = 30) {
  if (getMode() === "demo") {
    return generateTrendData(address, days);
  }

  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);

  const result = await pool.query({
    name: "trend-daily",
    text: `SELECT DATE(created_at) AS day, COUNT(*) AS cnt,
                  COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS total
           FROM settlements_view
           WHERE (from_address = $1 OR to_address = $1)
             AND status = 'confirmed'
             AND created_at >= $2
           GROUP BY DATE(created_at)
           ORDER BY day ASC`,
    values: [address, cutoff],
  });

  return result.rows.map((row) => ({
    date: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
    count: Number(row.cnt),
    amount: String(row.total || 0),
    amountUsd: (Number(row.total || 0) / 1e6).toFixed(2),
  }));
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

  const budget = await getBudget(address);
  return buildAlertsFromBudget(budget);
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

  const { payments } = await getPayments(address, { days, limit: 10000 });
  return formatPaymentsCsv(payments);
}

/**
 * Get list of known agents.
 * In live mode, returns distinct payer addresses from settlements.
 * In demo mode, returns synthetic agent data.
 * @returns {Promise<Array<object>>}
 */
export async function getAgents() {
  if (getMode() === "demo") {
    return generateAgents();
  }

  const pool = await getPool();
  const result = await pool.query({
    name: "get-agents",
    text: `SELECT from_address AS address,
                  COUNT(*) AS payment_count,
                  COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS total_spent,
                  MAX(created_at) AS last_active
           FROM settlements_view
           WHERE status = 'confirmed'
           GROUP BY from_address
           ORDER BY total_spent DESC
           LIMIT 50`,
  });

  return result.rows.map((row, i) => {
    const lastActive = row.last_active ? new Date(row.last_active) : null;
    const hoursSinceActive = lastActive ? (Date.now() - lastActive.getTime()) / 3600000 : Infinity;
    let status = "inactive";
    if (hoursSinceActive < 1) status = "active";
    else if (hoursSinceActive < 168) status = "idle"; // 7 days

    return {
      id: `agent-${i + 1}`,
      address: row.address,
      name: `Agent ${i + 1}`,
      status,
      paymentCount: Number(row.payment_count),
      totalSpent: String(row.total_spent),
      totalSpentUsd: (Number(row.total_spent) / 1e6).toFixed(2),
      lastActive: lastActive ? lastActive.toISOString() : null,
    };
  });
}

/**
 * Get global stats across all agents.
 * @param {number} [days=7]
 * @returns {Promise<object>}
 */
export async function getGlobalStats(days = 7) {
  if (getMode() === "demo") {
    return generateGlobalStats(days);
  }

  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);

  const result = await pool.query({
    name: "global-stats",
    text: `SELECT COUNT(*) AS total_payments,
                  COUNT(DISTINCT from_address) AS unique_agents,
                  COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS total_volume
           FROM settlements_view
           WHERE status = 'confirmed'
             AND created_at >= $1`,
    values: [cutoff],
  });

  const row = result.rows[0] || {};
  const totalPayments = Number(row.total_payments || 0);
  const totalVolume = Number(row.total_volume || 0);

  return {
    period: `${days}d`,
    totalAgents: Number(row.unique_agents || 0),
    totalPayments,
    totalVolume: String(totalVolume),
    totalVolumeUsd: (totalVolume / 1e6).toFixed(2),
    avgPaymentSize: totalPayments > 0 ? String(Math.floor(totalVolume / totalPayments)) : "0",
    avgPaymentUsd: totalPayments > 0 ? (totalVolume / totalPayments / 1e6).toFixed(4) : "0.0000",
  };
}

/**
 * Get global transactions across all agents.
 * @param {{ limit?: number, offset?: number, network?: string }} [options]
 * @returns {Promise<{ transactions: Array<object>, total: number }>}
 */
export async function getGlobalTransactions(options = {}) {
  const { limit = 20, offset = 0, network = null } = options;

  if (getMode() === "demo") {
    return generateGlobalTransactions({ limit, offset, network });
  }

  const pool = await getPool();

  let query, countQuery;
  if (network) {
    query = {
      name: "global-tx-filtered-v2",
      text: `SELECT * FROM settlements_view
             WHERE status = 'confirmed'
               AND CAST(amount AS NUMERIC) > 0
               AND network = $1
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
      values: [network, limit, offset],
    };
    countQuery = {
      name: "global-tx-count-filtered-v2",
      text: `SELECT COUNT(*) AS cnt FROM settlements_view
             WHERE status = 'confirmed' AND CAST(amount AS NUMERIC) > 0 AND network = $1`,
      values: [network],
    };
  } else {
    query = {
      name: "global-tx-v2",
      text: `SELECT * FROM settlements_view
             WHERE status = 'confirmed'
               AND CAST(amount AS NUMERIC) > 0
             ORDER BY created_at DESC
             LIMIT $1 OFFSET $2`,
      values: [limit, offset],
    };
    countQuery = {
      name: "global-tx-count-v2",
      text: `SELECT COUNT(*) AS cnt FROM settlements_view
             WHERE status = 'confirmed' AND CAST(amount AS NUMERIC) > 0`,
    };
  }

  const [result, countResult] = await Promise.all([pool.query(query), pool.query(countQuery)]);

  const transactions = result.rows.map((row, i) => rowToPayment(row, offset + i));
  const total = parseInt(countResult.rows[0]?.cnt || "0", 10);

  return { transactions, total };
}

/**
 * Get payment volume by network across all agents.
 * @param {number} [days=7]
 * @returns {Promise<Array<object>>}
 */
export async function getGlobalNetworkStats(days = 7) {
  if (getMode() === "demo") return generateGlobalNetworkStats(days);
  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  const result = await pool.query({
    name: "global-network-stats",
    text: `SELECT network, COUNT(*) as count, COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as volume
           FROM settlements_view WHERE status = 'confirmed' AND created_at >= $1
           GROUP BY network ORDER BY volume DESC`,
    values: [cutoff],
  });
  return result.rows.map(row => {
    const meta = networkMeta(row.network);
    return {
      network: row.network, networkLabel: meta.label, token: meta.token,
      count: Number(row.count), volume: String(row.volume),
      volumeUsd: (Number(row.volume) / 1e6).toFixed(2),
    };
  });
}

/**
 * Get daily spending trend across all agents.
 * @param {number} [days=30]
 * @returns {Promise<Array<{ date: string, count: number, amount: string, amountUsd: string }>>}
 */
export async function getGlobalTrend(days = 30) {
  if (getMode() === "demo") return generateGlobalTrendData(days);
  const pool = await getPool();
  const cutoff = new Date(Date.now() - days * 86400 * 1000);
  const result = await pool.query({
    name: "global-trend",
    text: `SELECT DATE(created_at) AS day, COUNT(*) AS cnt, COALESCE(SUM(CAST(amount AS NUMERIC)), 0) AS total
           FROM settlements_view WHERE status = 'confirmed' AND created_at >= $1
           GROUP BY DATE(created_at) ORDER BY day ASC`,
    values: [cutoff],
  });
  // Fill in missing dates
  const byDate = Object.create(null);
  for (const row of result.rows) {
    const d = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day);
    byDate[d] = { count: Number(row.cnt), amount: Number(row.total) };
  }
  const trend = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const entry = byDate[date] || { count: 0, amount: 0 };
    trend.push({ date, count: entry.count, amount: String(entry.amount), amountUsd: (entry.amount / 1e6).toFixed(2) });
  }
  return trend;
}
