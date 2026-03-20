/**
 * T402 Payment Explorer — Transaction browser for t402 settlements
 *
 * GET /                           — HTML explorer UI
 * GET /tx/:hash                   — HTML transaction detail page
 * GET /network/:networkId         — HTML network detail page
 * GET /token/:tokenSymbol         — HTML token detail page
 * GET /api/v1/transactions        — List transactions (cursor-based pagination)
 * GET /api/v1/transactions/:hash  — Get transaction details (JSON)
 * GET /api/v1/stats               — Protocol statistics
 * GET /api/v1/search?q=           — Search by hash, address
 * GET /api/v1/networks            — List unique networks with counts
 * GET /api/v1/tokens              — List unique tokens with counts
 * GET /api/v1/export?format=csv   — Export transactions as CSV
 * GET /address/:address            — HTML address page
 * GET /api/v1/address/:address    — Address transactions (JSON)
 * GET /health                     — Health check
 * GET /metrics                    — Prometheus metrics
 */

import express from "express";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  initDb,
  getTransactions,
  getTransaction,
  getTransactionsByAddress,
  getAllTransactionsForExport,
  getNetworkStats,
  getTokenStats,
  search,
  getStats,
  getNetworks,
  getTokens,
  close,
  getDbStatus,
  insertSeedData,
} from "./db.js";
import { seedTransactions, startSync, stopSync } from "./indexer.js";
import { renderIndex, renderDetail, renderAddressPage, renderNetworkPage, renderTokenPage } from "./templates.js";

export function log(level, message, data = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 't402-explorer', message, ...data }));
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(compression());
app.use(express.json());

const PORT = process.env.PORT || 3404;
const DATABASE_URL = process.env.DATABASE_URL || undefined;
const SQLITE_PATH = process.env.SQLITE_PATH || undefined;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MS, 10) || 60000;
const EXPLORER_MODE = process.env.EXPLORER_MODE || "auto";
let resolvedMode = EXPLORER_MODE; // updated in start() to "seed" or "live"

const rateLimitMap = new Map();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60', 10);
setInterval(() => rateLimitMap.clear(), 60000);

function rateLimit(req, res, next) {
  const ip = req.headers['cf-connecting-ip'] || req.ip;
  const count = (rateLimitMap.get(ip) || 0) + 1;
  rateLimitMap.set(ip, count);
  if (count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
}

// Prometheus metrics state
const metricsRequestCount = new Map();
const metricsDurationBuckets = new Map();
const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function recordMetrics(method, path, status, durationSec) {
  const normalizedPath = normalizePath(path);
  const countKey = `${method}|${normalizedPath}|${status}`;
  metricsRequestCount.set(countKey, (metricsRequestCount.get(countKey) || 0) + 1);
  const bucketKey = normalizedPath;
  if (!metricsDurationBuckets.has(bucketKey)) {
    metricsDurationBuckets.set(bucketKey, { buckets: new Array(DURATION_BUCKETS.length).fill(0), sum: 0, count: 0 });
  }
  const entry = metricsDurationBuckets.get(bucketKey);
  entry.sum += durationSec;
  entry.count += 1;
  for (let i = 0; i < DURATION_BUCKETS.length; i++) {
    if (durationSec <= DURATION_BUCKETS[i]) entry.buckets[i] += 1;
  }
}

function normalizePath(path) {
  if (path.startsWith("/api/v1/transactions/")) return "/api/v1/transactions/:hash";
  if (path.startsWith("/api/v1/address/")) return "/api/v1/address/:address";
  if (path.startsWith("/tx/")) return "/tx/:hash";
  if (path.startsWith("/address/")) return "/address/:address";
  if (path.startsWith("/network/")) return "/network/:networkId";
  if (path.startsWith("/token/")) return "/token/:tokenSymbol";
  const qIdx = path.indexOf("?");
  return qIdx >= 0 ? path.slice(0, qIdx) : path;
}

function csvEscape(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  next();
});

app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use((req, _res, next) => {
  const start = Date.now();
  const orig = _res.end.bind(_res);
  _res.end = function (...args) {
    const ms = Date.now() - start;
    log("info", "request", { method: req.method, path: req.originalUrl, status: _res.statusCode, duration_ms: ms });
    recordMetrics(req.method, req.originalUrl, _res.statusCode, ms / 1000);
    return orig(...args);
  };
  next();
});

app.use("/static", express.static(join(__dirname, "..", "public"), { maxAge: "1h" }));

app.use('/api', rateLimit);

app.get("/api/v1/transactions", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const { network, token, scheme, limit = "20", cursor, dateFrom, dateTo, amountMin, amountMax, status, sortBy, sortDir } = req.query;
  const result = await getTransactions({
    network, token, scheme, status,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    amountMin: amountMin || undefined,
    amountMax: amountMax || undefined,
    sortBy: sortBy || undefined,
    sortDir: sortDir || undefined,
    limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
    cursor: cursor || undefined,
  });
  res.json({ mode: resolvedMode, ...result });
});

app.get("/api/v1/transactions/:hash", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const tx = await getTransaction(req.params.hash);
  if (!tx) return res.status(404).json({ mode: resolvedMode, error: "Transaction not found" });
  res.json({ mode: resolvedMode, ...tx });
});

app.get("/api/v1/search", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ mode: resolvedMode, results: [], query: q, total: 0 });
  const results = await search(q);
  res.json({ mode: resolvedMode, results, query: q, total: results.length });
});

app.get("/api/v1/stats", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  res.json({ mode: resolvedMode, ...(await getStats(days)) });
});

app.get("/api/v1/networks", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const networks = await getNetworks();
  res.json({ mode: resolvedMode, networks, total: networks.length });
});

app.get("/api/v1/tokens", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const tokens = await getTokens();
  res.json({ mode: resolvedMode, tokens, total: tokens.length });
});

app.get("/api/v1/export", async (req, res) => {
  const { format, network, token } = req.query;
  if (format !== "csv") {
    return res.status(400).json({ error: "Unsupported format. Use ?format=csv" });
  }
  res.set("Content-Type", "text/csv");
  res.set("Content-Disposition", 'attachment; filename="t402-transactions.csv"');
  res.set("Cache-Control", "no-cache");

  res.write("tx_hash,network,scheme,token,amount,from,to,status,settled_at\n");

  const rows = await getAllTransactionsForExport({ network, token });
  for (const row of rows) {
    const line = [
      csvEscape(row.tx_hash),
      csvEscape(row.network),
      csvEscape(row.scheme),
      csvEscape(row.asset),
      csvEscape(row.amount),
      csvEscape(row.from_address),
      csvEscape(row.to_address),
      csvEscape(row.status),
      csvEscape(row.confirmed_at || row.created_at || ""),
    ].join(",");
    res.write(line + "\n");
  }
  res.end();
});

app.get("/api/v1/address/:address", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const { limit = "20", cursor } = req.query;
  const result = await getTransactionsByAddress(
    req.params.address,
    Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
    cursor || undefined,
  );
  res.json({ mode: resolvedMode, address: req.params.address, ...result });
});

app.get("/address/:address", async (req, res) => {
  const result = await getTransactionsByAddress(req.params.address, 20);
  res.type("html").send(renderAddressPage(req.params.address, result.transactions, { total: result.total, totalVolume: result.totalVolume }));
});

app.get("/network/:networkId(*)", async (req, res) => {
  const networkId = req.params.networkId;
  const stats = await getNetworkStats(networkId);
  if (!stats) return res.status(404).type("html").send(renderNetworkPage(networkId, null, []));
  const txResult = await getTransactions({ network: networkId, limit: 20 });
  res.type("html").send(renderNetworkPage(networkId, stats, txResult.transactions));
});

app.get("/token/:tokenSymbol", async (req, res) => {
  const tokenSymbol = req.params.tokenSymbol;
  const stats = await getTokenStats(tokenSymbol);
  if (!stats) return res.status(404).type("html").send(renderTokenPage(tokenSymbol, null, []));
  const txResult = await getTransactions({ token: tokenSymbol, limit: 20 });
  res.type("html").send(renderTokenPage(tokenSymbol, stats, txResult.transactions));
});

app.get("/", async (_req, res) => {
  const [stats, txResult, networks, tokens] = await Promise.all([
    getStats(7), getTransactions({ limit: 20 }), getNetworks(), getTokens(),
  ]);
  res.type("html").send(renderIndex({
    stats, transactions: txResult.transactions, networks, tokens,
  }));
});

app.get("/tx/:hash", async (req, res) => {
  const tx = await getTransaction(req.params.hash);
  const status = tx ? 200 : 404;
  res.status(status).type("html").send(renderDetail(tx));
});

app.get("/metrics", (_req, res) => {
  const lines = [];

  lines.push("# HELP explorer_requests_total Total HTTP requests");
  lines.push("# TYPE explorer_requests_total counter");
  for (const [key, count] of metricsRequestCount) {
    const [method, path, status] = key.split("|");
    lines.push(`explorer_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
  }

  lines.push("# HELP explorer_request_duration_seconds Request duration");
  lines.push("# TYPE explorer_request_duration_seconds histogram");
  for (const [path, entry] of metricsDurationBuckets) {
    let cumulative = 0;
    for (let i = 0; i < DURATION_BUCKETS.length; i++) {
      cumulative += entry.buckets[i];
      lines.push(`explorer_request_duration_seconds_bucket{path="${path}",le="${DURATION_BUCKETS[i]}"} ${cumulative}`);
    }
    lines.push(`explorer_request_duration_seconds_bucket{path="${path}",le="+Inf"} ${entry.count}`);
    lines.push(`explorer_request_duration_seconds_sum{path="${path}"} ${entry.sum}`);
    lines.push(`explorer_request_duration_seconds_count{path="${path}"} ${entry.count}`);
  }

  const dbStatus = getDbStatus();
  const syncLag = dbStatus.lastSync ? (Date.now() - new Date(dbStatus.lastSync).getTime()) / 1000 : -1;
  lines.push("# HELP explorer_sync_lag_seconds Seconds since last PG sync");
  lines.push("# TYPE explorer_sync_lag_seconds gauge");
  lines.push(`explorer_sync_lag_seconds ${syncLag}`);

  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n") + "\n");
});

app.get("/health", (_req, res) => {
  const dbStatus = getDbStatus();
  res.json({ status: "ok", service: "t402-explorer", mode: EXPLORER_MODE, db: dbStatus });
});

app.use((err, _req, res, _next) => {
  log("error", "Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  const usePg = EXPLORER_MODE === "pg" || (EXPLORER_MODE === "auto" && DATABASE_URL);
  const pgUrl = usePg ? DATABASE_URL : undefined;
  const sqlitePath = SQLITE_PATH || (EXPLORER_MODE === "seed" ? ":memory:" : undefined);

  await initDb(pgUrl, sqlitePath || ":memory:");

  resolvedMode = (!usePg || EXPLORER_MODE === "seed") ? "seed" : "live";

  if (!usePg || EXPLORER_MODE === "seed") {
    const txs = seedTransactions(100);
    insertSeedData(txs);
    log("info", "Seeded 100 transactions");
  }

  if (usePg) { startSync(SYNC_INTERVAL); }

  app.listen(PORT, () => {
    log("info", "T402 Explorer started", { port: PORT, mode: EXPLORER_MODE, pg: !!pgUrl, sqlite: sqlitePath || ":memory:" });
  });
}

async function shutdown(signal) {
  log("info", "Shutdown signal received", { signal });
  stopSync();
  await close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => { log("error", "Failed to start", { error: err.message, stack: err.stack }); process.exit(1); });

export default app;
