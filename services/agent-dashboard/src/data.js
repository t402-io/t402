/**
 * Deterministic data generation for T402 Agent Dashboard.
 *
 * Every function takes an address string and produces data that is
 * consistent across calls — the same address always yields the same
 * payments, balances, budget, and stats.
 */

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

const NETWORKS = [
  { caip2: "eip155:8453", label: "Base", token: "USDC", decimals: 6 },
  { caip2: "eip155:42161", label: "Arbitrum", token: "USDT0", decimals: 6 },
  { caip2: "eip155:1", label: "Ethereum", token: "USDC", decimals: 6 },
  { caip2: "eip155:137", label: "Polygon", token: "USDC", decimals: 6 },
  {
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    label: "Solana",
    token: "USDC",
    decimals: 6,
  },
  { caip2: "ton:mainnet", label: "TON", token: "USDT", decimals: 6 },
];

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
    const amountRaw = Math.floor(rand() * 200000) + 100; // 100–200099 smallest units
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
 * @returns {object}
 */
export function generateStats(address, days = 7) {
  const payments = generatePaymentHistory(address, days);
  const settled = payments.filter((p) => p.status === "settled");

  // aggregate by service
  const serviceMap = {};
  for (const p of settled) {
    const s = (serviceMap[p.service] ||= { name: p.service, count: 0, amount: 0 });
    s.count++;
    s.amount += Number(p.amount);
  }
  const topServices = Object.values(serviceMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((s) => ({ ...s, amount: String(s.amount) }));

  // aggregate by network
  const byNetwork = {};
  for (const p of settled) {
    const n = (byNetwork[p.network] ||= { count: 0, amount: 0 });
    n.count++;
    n.amount += Number(p.amount);
  }
  for (const k of Object.keys(byNetwork)) {
    byNetwork[k].amount = String(byNetwork[k].amount);
  }

  const totalSpent = settled.reduce((s, p) => s + Number(p.amount), 0);
  const avgPayment = settled.length > 0 ? Math.floor(totalSpent / settled.length) : 0;

  return {
    period: `${days}d`,
    totalPayments: settled.length,
    totalSpent: String(totalSpent),
    totalSpentUsd: (totalSpent / 1e6).toFixed(2),
    avgPaymentSize: String(avgPayment),
    avgPaymentUsd: (avgPayment / 1e6).toFixed(4),
    topServices,
    byNetwork,
  };
}

/**
 * Generate active alerts for an address.
 * @param {string} address
 * @returns {Array<object>}
 */
export function generateAlerts(address) {
  const budget = generateBudget(address);
  const alerts = [];

  const sessionPct = budget.usage.sessionPercentage;
  const todayPct = budget.usage.todayPercentage;

  if (sessionPct >= 100) {
    alerts.push({
      id: "alert-session-exceeded",
      level: "critical",
      message: `Session budget exceeded: ${sessionPct.toFixed(1)}% used ($${(Number(budget.usage.sessionSpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.sessionLimit) / 1e6).toFixed(2)})`,
      field: "session",
      percentage: sessionPct,
      timestamp: new Date().toISOString(),
    });
  } else if (sessionPct >= 80) {
    alerts.push({
      id: "alert-session-warning",
      level: "warning",
      message: `Session budget nearing limit: ${sessionPct.toFixed(1)}% used ($${(Number(budget.usage.sessionSpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.sessionLimit) / 1e6).toFixed(2)})`,
      field: "session",
      percentage: sessionPct,
      timestamp: new Date().toISOString(),
    });
  }

  if (todayPct >= 100) {
    alerts.push({
      id: "alert-daily-exceeded",
      level: "critical",
      message: `Daily budget exceeded: ${todayPct.toFixed(1)}% used ($${(Number(budget.usage.todaySpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.todayLimit) / 1e6).toFixed(2)})`,
      field: "daily",
      percentage: todayPct,
      timestamp: new Date().toISOString(),
    });
  } else if (todayPct >= 80) {
    alerts.push({
      id: "alert-daily-warning",
      level: "warning",
      message: `Daily budget nearing limit: ${todayPct.toFixed(1)}% used ($${(Number(budget.usage.todaySpent) / 1e6).toFixed(2)} / $${(Number(budget.usage.todayLimit) / 1e6).toFixed(2)})`,
      field: "daily",
      percentage: todayPct,
      timestamp: new Date().toISOString(),
    });
  }

  return alerts;
}

/**
 * Export payment history as CSV string.
 * @param {string} address
 * @param {number} [days=7]
 * @returns {string}
 */
export function exportPaymentsCsv(address, days = 7) {
  const payments = generatePaymentHistory(address, days);
  const header = "id,timestamp,service,network,token,amount,amount_usd,to,txHash,status";
  const rows = payments.map((p) =>
    [
      p.id,
      p.timestamp,
      `"${p.service}"`,
      p.network,
      p.token,
      p.amount,
      p.amountFormatted,
      p.to,
      p.txHash,
      p.status,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
