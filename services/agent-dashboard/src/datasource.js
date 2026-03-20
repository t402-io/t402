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
  exportPaymentsCsv,
} from "./data.js";
import { networkMeta } from "./networks.js";
import { buildAlertsFromBudget, formatPaymentsCsv, log } from "./utils.js";

// ── Mode detection ──────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL || "";

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

  let query, params;
  if (network) {
    query = {
      name: "get-payments-filtered",
      text: `SELECT * FROM settlements
             WHERE (from_address = $1 OR to_address = $1)
               AND created_at >= $2
               AND network = $3
             ORDER BY created_at DESC
             LIMIT $4 OFFSET $5`,
      values: [address, cutoff, network, limit, offset],
    };
  } else {
    query = {
      name: "get-payments",
      text: `SELECT * FROM settlements
             WHERE (from_address = $1 OR to_address = $1)
               AND created_at >= $2
             ORDER BY created_at DESC
             LIMIT $3 OFFSET $4`,
      values: [address, cutoff, limit, offset],
    };
  }

  const result = await pool.query(query);

  // Get total count for pagination info.
  const countQuery = network
    ? {
        name: "count-payments-filtered",
        text: `SELECT COUNT(*) as cnt FROM settlements
               WHERE (from_address = $1 OR to_address = $1) AND created_at >= $2 AND network = $3`,
        values: [address, cutoff, network],
      }
    : {
        name: "count-payments",
        text: `SELECT COUNT(*) as cnt FROM settlements
               WHERE (from_address = $1 OR to_address = $1) AND created_at >= $2`,
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
     FROM settlements
     WHERE (from_address = $1 OR to_address = $1)
       AND status = 'settled'
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
     FROM settlements
     WHERE from_address = $1
       AND status = 'settled'
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
     FROM settlements
     WHERE from_address = $1
       AND status = 'settled'
       AND created_at >= $2`,
    values: [address, hourAgo],
  });
  const sessionSpent = Number(sessionResult.rows[0]?.total || 0);
  const paymentsThisHour = Number(sessionResult.rows[0]?.cnt || 0);

  const sessionPct = +((sessionSpent / MAX_PER_SESSION) * 100).toFixed(1);
  const todayPct = +((todaySpent / MAX_PER_DAY) * 100).toFixed(1);

  return {
    policy: {
      maxPerPayment: String(MAX_PER_PAYMENT),
      maxPerSession: String(MAX_PER_SESSION),
      maxPerDay: String(MAX_PER_DAY),
      allowedNetworks: ["eip155:8453", "eip155:42161", "eip155:137"],
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
           FROM settlements
           WHERE (from_address = $1 OR to_address = $1)
             AND status = 'settled'
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
           FROM settlements
           WHERE (from_address = $1 OR to_address = $1)
             AND status = 'settled'
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
