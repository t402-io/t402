/**
 * Deterministic data generation for T402 Agent Dashboard.
 *
 * Every function takes an address string and produces data that is
 * consistent across calls — the same address always yields the same
 * payments, balances, budget, and stats.
 */

import { NETWORKS } from "./networks.js";
import { buildAlertsFromBudget, aggregatePaymentStats, formatPaymentsCsv } from "./utils.js";

// ── Deterministic hash / PRNG ────────────────────────────────────────

/** Simple 32-bit hash of a string (djb2). */
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Seedable xorshift32 PRNG — returns a function that yields [0, 1). */
function prng(seed) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/** Pick a deterministic hex string of `len` hex chars. */
function hexString(rand, len) {
  return Array.from({ length: len }, () =>
    Math.floor(rand() * 16).toString(16),
  ).join("");
}

// ── Constants ────────────────────────────────────────────────────────

const SERVICES = [
  "LLM Inference",
  "Weather API",
  "Image Gen",
  "Analytics",
  "Translate",
  "Code Review",
  "Search API",
  "PDF Parse",
];

const STATUSES = ["settled", "settled", "settled", "settled", "pending", "failed"];

// ── Public API ───────────────────────────────────────────────────────

/**
 * Generate deterministic payment history for an address.
 * @param {string} address  Wallet address
 * @param {number} [days=7] Lookback window in days
 * @returns {Array<object>}
 */
export function generatePaymentHistory(address, days = 7) {
  const seed = hash(address + ":payments");
  const rand = prng(seed);
  const baseTime = Math.floor(Date.now() / 86400000) * 86400000; // Start of today (UTC)
  const count = 15 + Math.floor(rand() * 40); // 15–54 payments
  const payments = [];

  for (let i = 0; i < count; i++) {
    const net = NETWORKS[Math.floor(rand() * NETWORKS.length)];
    const ago = Math.floor(rand() * 86400 * days);
    const amountRaw = Math.floor(rand() * 4990001) + 10000; // 10000–5000000 smallest units ($0.01–$5.00)
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];

    payments.push({
      id: `pay-${String(i + 1).padStart(4, "0")}`,
      txHash: "0x" + hexString(rand, 64),
      network: net.caip2,
      networkLabel: net.label,
      token: net.token,
      amount: String(amountRaw),
      amountFormatted: (amountRaw / 10 ** net.decimals).toFixed(net.decimals === 6 ? 4 : 2),
      to: "0x" + hexString(rand, 40),
      service: SERVICES[Math.floor(rand() * SERVICES.length)],
      status,
      timestamp: new Date(baseTime - ago * 1000).toISOString(),
    });
  }

  return payments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Generate deterministic per-network balances.
 * @param {string} address
 * @returns {{ balances: Array<object>, totalUsd: string }}
 */
export function generateBalances(address) {
  const seed = hash(address + ":balances");
  const rand = prng(seed);
  let totalRaw = 0;

  const balances = NETWORKS.map((net) => {
    const raw = Math.floor(rand() * 25000000) + 100000; // 0.10–25.10 USD range
    totalRaw += raw;
    return {
      network: net.caip2,
      networkLabel: net.label,
      token: net.token,
      balance: String(raw),
      balanceFormatted: (raw / 1e6).toFixed(2),
    };
  });

  return { balances, totalUsd: (totalRaw / 1e6).toFixed(2) };
}

/**
 * Generate deterministic budget / policy usage.
 * @param {string} address
 * @returns {object}
 */
export function generateBudget(address) {
  const seed = hash(address + ":budget");
  const rand = prng(seed);

  const maxPerPayment = 1000000; // $1
  const maxPerSession = 10000000; // $10
  const maxPerDay = 50000000; // $50

  const sessionSpent = Math.floor(rand() * maxPerSession * 1.1); // may exceed
  const todaySpent = Math.floor(rand() * maxPerDay);
  const paymentsThisHour = Math.floor(rand() * 30);

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
 * Generate deterministic spending analytics.
 * @param {string} address
 * @param {number} [days=7]
 * @param {Array<object>|null} [payments=null]
 * @returns {object}
 */
export function generateStats(address, days = 7, payments = null) {
  payments = payments ?? generatePaymentHistory(address, days);
  const settled = payments.filter((p) => p.status === "settled");
  return aggregatePaymentStats(settled, days);
}

/**
 * Generate active alerts for an address.
 * @param {string} address
 * @returns {Array<object>}
 */
export function generateAlerts(address) {
  return buildAlertsFromBudget(generateBudget(address));
}

/**
 * Generate deterministic daily spending trend.
 * @param {string} address
 * @param {number} [days=30]
 * @returns {Array<{ date: string, count: number, amount: string, amountUsd: string }>}
 */
export function generateTrendData(address, days = 30) {
  const payments = generatePaymentHistory(address, days);
  const settled = payments.filter((p) => p.status === "settled");

  // Aggregate by date
  const byDate = Object.create(null);
  for (const p of settled) {
    const date = p.timestamp.slice(0, 10);
    if (!byDate[date]) byDate[date] = { count: 0, amount: 0 };
    byDate[date].count++;
    byDate[date].amount += Number(p.amount);
  }

  // Fill in missing dates
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const entry = byDate[date] || { count: 0, amount: 0 };
    result.push({
      date,
      count: entry.count,
      amount: String(entry.amount),
      amountUsd: (entry.amount / 1e6).toFixed(2),
    });
  }

  return result;
}

/**
 * Export payment history as CSV string.
 * @param {string} address
 * @param {number} [days=7]
 * @returns {string}
 */
export function exportPaymentsCsv(address, days = 7) {
  return formatPaymentsCsv(generatePaymentHistory(address, days));
}

// ── Demo agent addresses ──────────────────────────────────────────

const DEMO_AGENTS = [
  { address: "0xC88f67e776f16DcFBf42e6bDda1B82604448899B", name: "Research Agent" },
  { address: "0xA1b2C3d4E5f6789012345678901234567890AbCd", name: "Trading Bot" },
  { address: "0xDeadBeef00000000000000000000000000000001", name: "Data Fetcher" },
  { address: "0x1234567890abcdef1234567890abcdef12345678", name: "Content Writer" },
  { address: "0xFEDCBA9876543210FEDCBA9876543210FEDCBA98", name: "Code Reviewer" },
];

/**
 * Generate a list of demo AI agents with synthetic activity data.
 * @returns {Array<object>}
 */
export function generateAgents() {
  return DEMO_AGENTS.map((agent, i) => {
    const seed = hash(agent.address + ":agent");
    const rand = prng(seed);
    const paymentCount = 5 + Math.floor(rand() * 50);
    const totalSpent = Math.floor(rand() * 80000000) + 1000000; // $1–$81 range
    const hoursAgo = Math.floor(rand() * 72);
    const statusRoll = rand();
    const status = statusRoll < 0.7 ? "active" : statusRoll < 0.9 ? "idle" : "budget_exceeded";

    return {
      id: `agent-${i + 1}`,
      address: agent.address,
      name: agent.name,
      status,
      paymentCount,
      totalSpent: String(totalSpent),
      totalSpentUsd: (totalSpent / 1e6).toFixed(2),
      lastActive: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
    };
  });
}

/**
 * Generate global stats across all demo agents.
 * @param {number} [days=7]
 * @returns {object}
 */
export function generateGlobalStats(days = 7) {
  const agents = generateAgents();
  let totalPayments = 0;
  let totalVolume = 0;

  for (const agent of agents) {
    totalPayments += agent.paymentCount;
    totalVolume += Number(agent.totalSpent);
  }

  const avgPayment = totalPayments > 0 ? Math.floor(totalVolume / totalPayments) : 0;

  return {
    period: `${days}d`,
    totalAgents: agents.length,
    totalPayments,
    totalVolume: String(totalVolume),
    totalVolumeUsd: (totalVolume / 1e6).toFixed(2),
    avgPaymentSize: String(avgPayment),
    avgPaymentUsd: (avgPayment / 1e6).toFixed(4),
  };
}

/**
 * Generate global transactions across all demo agents.
 * Merges and sorts payments from all demo agents.
 * @param {{ limit?: number, offset?: number, network?: string }} [options]
 * @returns {{ transactions: Array<object>, total: number }}
 */
export function generateGlobalTransactions(options = {}) {
  const { limit = 20, offset = 0, network = null } = options;

  let allPayments = [];
  for (const agent of DEMO_AGENTS) {
    const payments = generatePaymentHistory(agent.address, 7);
    allPayments = allPayments.concat(payments);
  }

  // Sort by timestamp descending
  allPayments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  if (network) {
    allPayments = allPayments.filter((p) => p.network === network);
  }

  const total = allPayments.length;
  const transactions = allPayments.slice(offset, offset + limit);

  return { transactions, total };
}
