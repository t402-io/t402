/**
 * T402 Data Services — merged Bazaar + Explorer
 *
 * Single Express app serving both the service marketplace (Bazaar)
 * and the payment explorer on port 3402.
 */

import express from "express";
import compression from "compression";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  rateLimit,
  requestId,
  requestLogger,
  securityHeaders,
  corsHeaders,
  requireAuth,
  requireServiceAuth,
  requireExplorerAuth,
  hashApiKey,
  validateServiceInput,
  sanitizeString,
  isPrivateIP,
  sendWithEtag,
  verifyServiceUrl,
  recordRegistration,
  logger,
  log,
  getMetrics,
  errorHandler,
  formatBazaarPrometheus,
  formatExplorerPrometheus,
} from "./middleware.js";

import { initBazaarStore } from "./bazaar/store.js";
import { createBazaarRouter } from "./bazaar/routes.js";
import { initExplorerDb } from "./explorer/db.js";
import { seedTransactions, startSync, stopSync } from "./explorer/indexer.js";
import * as templates from "./explorer/templates.js";
import { createExplorerRouter } from "./explorer/routes.js";

const require = createRequire(import.meta.url);
let Database = null;
try { Database = require("better-sqlite3"); } catch { /* not available */ }

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3402;
const FACILITATOR_URL = process.env.FACILITATOR_URL || undefined;
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || "";
const SQLITE_PATH = process.env.SQLITE_PATH || undefined;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MS, 10) || 60000;
const EXPLORER_MODE = process.env.EXPLORER_MODE || "auto";
const REVERIFY_INTERVAL = parseInt(process.env.REVERIFY_INTERVAL_MS || String(30 * 60_000));
const REVERIFY_STALE_HOURS = parseInt(process.env.REVERIFY_STALE_HOURS || "24");

let resolvedMode = EXPLORER_MODE;

// ── Express app ──────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", "loopback");
app.disable("x-powered-by");

// Core middleware
app.use(requestId);
app.use(requestLogger);
app.use(securityHeaders);
app.use(corsHeaders);
app.use(express.json({ limit: "100kb" }));
app.use(compression());
app.use(rateLimit);

// Static assets (explorer public files)
const explorerPublicDir = join(__dirname, "..", "..", "explorer", "public");
const bazaarPublicDir = join(__dirname, "..", "..", "bazaar", "public");

// Try explorer public first (has style.css, app.js, etc.), then bazaar public
app.use("/static", express.static(explorerPublicDir, { maxAge: "1h" }));
app.use("/bazaar", express.static(bazaarPublicDir, { maxAge: "1h" }));

// ── State (initialized in start()) ──────────────────────────────────
let bazaarState = null; // { store, seedStore, getNextId }
let explorerDb = null;
let sqliteDb = null;

// ── Start function ───────────────────────────────────────────────────
async function start({ listen = true } = {}) {
  // Open single shared SQLite database
  const useFacilitator = EXPLORER_MODE === "live" || EXPLORER_MODE === "pg" ||
    (EXPLORER_MODE === "auto" && FACILITATOR_URL);
  const sqlitePath = SQLITE_PATH || (EXPLORER_MODE === "seed" ? ":memory:" : undefined);

  if (Database) {
    try {
      sqliteDb = new Database(sqlitePath || ":memory:");
      sqliteDb.pragma("journal_mode = WAL");
      sqliteDb.pragma("synchronous = NORMAL");
      sqliteDb.pragma("foreign_keys = ON");
      sqliteDb.pragma("busy_timeout = 30000");
      logger.info("shared SQLite database opened", { path: sqlitePath || ":memory:" });
    } catch (e) {
      logger.warn("SQLite unavailable", { error: e.message });
    }
  }

  // Initialize bazaar store on the shared db
  bazaarState = initBazaarStore(sqliteDb);
  bazaarState.seedStore();

  // Ensure seed services have verification metadata so /featured works
  for (const svc of bazaarState.store.getAll()) {
    if (svc.verified && !svc.verification) {
      svc.verification = { reachable: true, returns402: true, statusCode: 402, latencyMs: 0 };
      svc.updatedAt = new Date().toISOString();
      bazaarState.store.set(svc.id, svc);
    }
  }

  // Initialize explorer db on the shared db
  explorerDb = initExplorerDb(sqliteDb);

  resolvedMode = (!useFacilitator || EXPLORER_MODE === "seed") ? "seed" : "live";

  if (!useFacilitator || EXPLORER_MODE === "seed") {
    const txs = seedTransactions(100);
    explorerDb.insertSeedData(txs);
    logger.info("seeded 100 explorer transactions");
  } else {
    explorerDb.clearCache();
  }

  // Mount explorer routes first (explorer owns /api/v1/search, /api/v1/stats, etc.)
  const explorerRouter = createExplorerRouter({
    db: explorerDb,
    templates,
    requireExplorerAuth,
    getResolvedMode: () => resolvedMode,
  });
  app.use(explorerRouter);

  // Mount bazaar routes (services, mcp, featured, categories, tags, bazaar-stats, bazaar-search)
  const bazaarRouter = createBazaarRouter({
    store: bazaarState.store,
    getNextId: bazaarState.getNextId,
    requireAuth,
    requireServiceAuth,
    hashApiKey,
    validateServiceInput,
    sanitizeString,
    isPrivateIP,
    sendWithEtag,
    verifyServiceUrl,
    recordRegistration,
    logger,
  });
  app.use(bazaarRouter);

  // ── OpenAPI spec (bazaar) ──────────────────────────────────────────
  let openapiSpec;
  try {
    openapiSpec = readFileSync(join(__dirname, "..", "..", "bazaar", "openapi.yaml"), "utf8");
  } catch { /* not available */ }

  app.get("/openapi.yaml", (_req, res) => {
    if (!openapiSpec) return res.status(404).json({ error: "OpenAPI spec not available" });
    res.type("text/yaml").send(openapiSpec);
  });

  // ── Health / Ready / Metrics ───────────────────────────────────────

  app.get("/health", (_req, res) => {
    res.set("Cache-Control", "no-cache");
    const dbStatus = explorerDb.getDbStatus();
    res.json({
      status: "ok",
      service: "data-services",
      bazaar: {
        services: bazaarState.store.size(),
        engine: bazaarState.store.isMemory() ? "memory" : "sqlite",
      },
      explorer: {
        mode: resolvedMode,
        db: dbStatus,
      },
    });
  });

  app.get("/ready", (_req, res) => {
    res.set("Cache-Control", "no-cache");
    if (bazaarState.store.size() === 0) {
      return res.status(503).json({ status: "not ready", reason: "No bazaar services loaded" });
    }
    res.json({ status: "ready", services: bazaarState.store.size() });
  });

  app.get("/metrics", (_req, res) => {
    res.json({
      ...getMetrics(),
      store: {
        services: bazaarState.store.size(),
        verified: bazaarState.store.countVerified(),
        engine: bazaarState.store.isMemory() ? "memory" : "sqlite",
      },
    });
  });

  // ── Prometheus metrics (combined) ──────────────────────────────────
  app.get("/metrics/prometheus", (_req, res) => {
    const bazaarLines = formatBazaarPrometheus(bazaarState.store);
    const explorerLines = formatExplorerPrometheus(explorerDb.getDbStatus);
    const allLines = [...bazaarLines, "", ...explorerLines, ""];
    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(allLines.join("\n"));
  });

  // ── 404 catch-all ──────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // ── Error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  // ── Periodic re-verification (bazaar) ──────────────────────────────
  async function reverifyStaleServices() {
    const cutoff = new Date(Date.now() - REVERIFY_STALE_HOURS * 3600_000).toISOString();
    const stale = bazaarState.store.getStale(cutoff, 5);
    if (stale.length === 0) return;

    logger.info("re-verification started", { count: stale.length });
    for (const svc of stale) {
      try {
        const result = await verifyServiceUrl(svc.url);
        svc.verified = result.returns402;
        svc.verification = result;
        if (result.discovery) svc.discovery = result.discovery;
        svc.updatedAt = new Date().toISOString();
        bazaarState.store.set(svc.id, svc);
      } catch (e) {
        logger.error("re-verification failed", { id: svc.id, error: e.message });
      }
    }
    logger.info("re-verification complete", { count: stale.length });
  }

  const _reverifyInterval = setInterval(reverifyStaleServices, REVERIFY_INTERVAL);
  _reverifyInterval.unref();

  // ── Facilitator sync (explorer) ────────────────────────────────────
  if (useFacilitator) {
    startSync(FACILITATOR_URL, FACILITATOR_API_KEY, SYNC_INTERVAL, explorerDb);
  }

  // ── Listen ─────────────────────────────────────────────────────────
  if (listen) {
    app.listen(PORT, () => {
      logger.info("data-services started", {
        port: PORT,
        bazaarServices: bazaarState.store.size(),
        explorerMode: resolvedMode,
        facilitator: !!FACILITATOR_URL,
        sqlite: sqlitePath || ":memory:",
      });
    });
  }
}

// ── Graceful shutdown ────────────────────────────────────────────────
function shutdown(signal) {
  logger.info("shutdown initiated", { signal });
  stopSync();
  if (sqliteDb) sqliteDb.close();
  logger.info("server closed");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Direct run ───────────────────────────────────────────────────────
const isDirectRun =
  process.argv[1] && new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;

if (isDirectRun) {
  start().catch((err) => {
    logger.error("failed to start", { error: err.message, stack: err.stack });
    process.exit(1);
  });
}

export { app as default, start };
