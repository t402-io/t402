/**
 * Shared utilities for the T402 Agent Dashboard.
 *
 * Centralises helpers that were previously duplicated across
 * server.js, data.js, and datasource.js.
 */

// ── HTML / Security ─────────────────────────────────────────────────

/** Escape HTML special characters to prevent XSS. */
export function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Validate wallet address format — alphanumeric plus : . _ - up to 128 chars. */
export function isValidAddress(addr) {
  return typeof addr === "string" && /^[a-zA-Z0-9:._-]{1,128}$/.test(addr);
}

/** Clamp an integer value between min and max, returning fallback on NaN. */
export function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ── Formatting ──────────────────────────────────────────────────────

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Status badge text indicators alongside the status word. */
export function statusIndicator(status) {
  switch (status) {
    case "settled":
      return "\u2713 settled";
    case "pending":
      return "\u231B pending";
    case "failed":
      return "\u2717 failed";
    default:
      return status;
  }
}

// ── CSV ─────────────────────────────────────────────────────────────

/** RFC 4180: wrap in double-quotes if value contains comma, quote, or newline.
 *  Also guards against CSV formula injection (=, +, -, @, \t, \r prefixes). */
export function csvField(value) {
  let str = String(value);
  // Prevent formula injection in Excel/Sheets
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Format an array of payment objects as a CSV string.
 * @param {Array<object>} payments
 * @returns {string}
 */
export function formatPaymentsCsv(payments) {
  const header = "id,timestamp,service,network,token,amount,amount_formatted,to,txHash,status";
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

// ── Alert Generation ────────────────────────────────────────────────

/**
 * Build alert objects from a budget's usage data.
 * Shared between demo (data.js) and live (datasource.js) paths.
 * @param {object} budget — { usage: { sessionPercentage, todayPercentage, ... } }
 * @returns {Array<object>}
 */
export function buildAlertsFromBudget(budget) {
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

// ── Stats Aggregation ───────────────────────────────────────────────

/**
 * Aggregate payment stats from settled payments.
 * Shared between demo (data.js) and live demo-mode fallback.
 * @param {Array<object>} settled — filtered settled payment objects
 * @param {number} days — lookback period
 * @returns {object}
 */
export function aggregatePaymentStats(settled, days) {
  // Aggregate by service (Object.create(null) prevents prototype pollution)
  const serviceMap = Object.create(null);
  for (const p of settled) {
    if (!serviceMap[p.service]) serviceMap[p.service] = { name: p.service, count: 0, amount: 0 };
    serviceMap[p.service].count++;
    serviceMap[p.service].amount += Number(p.amount);
  }
  const topServices = Object.values(serviceMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((s) => ({ ...s, amount: String(s.amount) }));

  // Aggregate by network (Object.create(null) prevents prototype pollution)
  const byNetwork = Object.create(null);
  for (const p of settled) {
    if (!byNetwork[p.network]) byNetwork[p.network] = { count: 0, amount: 0 };
    byNetwork[p.network].count++;
    byNetwork[p.network].amount += Number(p.amount);
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

// ── Structured Logging ──────────────────────────────────────────────

/**
 * Emit a structured JSON log line.
 * @param {"info"|"warn"|"error"} level
 * @param {string} message
 * @param {object} [data]
 */
export function log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: "agent-dashboard",
    message,
    ...data,
  };
  const out = level === "error" ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + "\n");
}
