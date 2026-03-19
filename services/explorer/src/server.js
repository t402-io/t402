/**
 * T402 Payment Explorer — Transaction browser for t402 settlements
 *
 * GET /                           — HTML explorer UI
 * GET /tx/:hash                   — HTML transaction detail page
 * GET /api/v1/transactions        — List transactions (cursor-based pagination)
 * GET /api/v1/transactions/:hash  — Get transaction details (JSON)
 * GET /api/v1/stats               — Protocol statistics
 * GET /api/v1/search?q=           — Search by hash, address
 * GET /api/v1/networks            — List unique networks with counts
 * GET /api/v1/tokens              — List unique tokens with counts
 * GET /health                     — Health check
 */

import express from "express";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  initDb,
  getTransactions,
  getTransaction,
  search,
  getStats,
  getNetworks,
  getTokens,
  close,
  getDbStatus,
  insertSeedData,
} from "./db.js";
import { seedTransactions, startSync, stopSync } from "./indexer.js";
import { renderIndex, renderDetail } from "./templates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(compression());
app.use(express.json());

const PORT = process.env.PORT || 3404;
const DATABASE_URL = process.env.DATABASE_URL || undefined;
const SQLITE_PATH = process.env.SQLITE_PATH || undefined;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MS, 10) || 60000;
const EXPLORER_MODE = process.env.EXPLORER_MODE || "auto";

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
    console.log(`${req.method} ${req.originalUrl} ${_res.statusCode} ${ms}ms`);
    return orig(...args);
  };
  next();
});

app.use("/static", express.static(join(__dirname, "..", "public"), { maxAge: "1h" }));

app.get("/api/v1/transactions", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const { network, token, scheme, limit = "20", cursor } = req.query;
  const result = await getTransactions({
    network, token, scheme,
    limit: Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100),
    cursor: cursor || undefined,
  });
  res.json(result);
});

app.get("/api/v1/transactions/:hash", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const tx = await getTransaction(req.params.hash);
  if (!tx) return res.status(404).json({ error: "Transaction not found" });
  res.json(tx);
});

app.get("/api/v1/search", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [], query: q, total: 0 });
  const results = await search(q);
  res.json({ results, query: q, total: results.length });
});

app.get("/api/v1/stats", async (req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
  res.json(await getStats(days));
});

app.get("/api/v1/networks", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const networks = await getNetworks();
  res.json({ networks, total: networks.length });
});

app.get("/api/v1/tokens", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=30");
  const tokens = await getTokens();
  res.json({ tokens, total: tokens.length });
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

app.get("/health", (_req, res) => {
  const dbStatus = getDbStatus();
  res.json({ status: "ok", service: "t402-explorer", mode: EXPLORER_MODE, db: dbStatus });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  const usePg = EXPLORER_MODE === "pg" || (EXPLORER_MODE === "auto" && DATABASE_URL);
  const pgUrl = usePg ? DATABASE_URL : undefined;
  const sqlitePath = SQLITE_PATH || (EXPLORER_MODE === "seed" ? ":memory:" : undefined);

  await initDb(pgUrl, sqlitePath || ":memory:");

  if (!usePg || EXPLORER_MODE === "seed") {
    const txs = seedTransactions(100);
    insertSeedData(txs);
    console.log("Seeded 100 transactions");
  }

  if (usePg) { startSync(SYNC_INTERVAL); }

  app.listen(PORT, () => {
    console.log(`T402 Explorer running on http://localhost:${PORT}`);
    console.log(`  Mode: ${EXPLORER_MODE}, PG: ${!!pgUrl}, SQLite: ${sqlitePath || ":memory:"}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  stopSync();
  await close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => { console.error("Failed to start:", err); process.exit(1); });

export default app;
