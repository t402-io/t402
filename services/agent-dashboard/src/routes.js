/**
 * API route handlers for the T402 Agent Dashboard.
 *
 * Extracted from server.js to separate routing from middleware.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { version: VERSION } = require("../package.json");

import {
  getPayments,
  getBalances,
  getBudget,
  getStats,
  getTrend,
  getAlerts,
  getExportCsv,
  getMode,
  getPoolStats,
  getAgents,
  getGlobalStats,
  getGlobalTransactions,
  getGlobalNetworkStats,
  getGlobalTrend,
} from "./datasource.js";
import { renderDashboard, renderApiDocs } from "./templates.js";
import { isValidAddress, isValidCaip2, clampInt, log } from "./utils.js";

// ── Metrics (hand-rolled Prometheus counters, no deps) ──────────────

const metrics = {
  requests: 0,
  errors: 0,
  requestsByPath: {},
  latencyBuckets: { 10: 0, 50: 0, 100: 0, 250: 0, 500: 0, 1000: 0, Infinity: 0 },
  latencySum: 0,
  latencyCount: 0,
  sseConnections: 0,
};

/**
 * Register all routes on the given Express app.
 * @param {import("express").Express} app
 * @param {{ rateLimit: Function }} opts
 */
export function registerRoutes(app, opts = {}) {
  const exportRateLimit = opts.rateLimit ? opts.rateLimit(5) : (_req, _res, next) => next();

  // ── Metrics tracking middleware ────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    metrics.requests++;
    res.on("finish", () => {
      const duration = Date.now() - start;
      // Only use matched route patterns to prevent cardinality explosion from arbitrary paths
      const routePath = req.route?.path || "unmatched";
      const key = `${req.method} ${routePath}`;
      metrics.requestsByPath[key] = (metrics.requestsByPath[key] || 0) + 1;
      if (res.statusCode >= 400) metrics.errors++;
      metrics.latencySum += duration;
      metrics.latencyCount++;
      for (const bucket of [10, 50, 100, 250, 500, 1000, Infinity]) {
        if (duration <= bucket) metrics.latencyBuckets[bucket]++;
      }
    });
    next();
  });

  const cacheHeader = () => (getMode() === "live" ? "private, max-age=30" : "public, max-age=60");

  // ── Payment history ────────────────────────────────────────────
  app.get("/api/v1/payments", async (req, res, next) => {
    try {
      if (!req.query.address) {
        return res.status(400).json({ error: "address parameter required" });
      }
      const address = req.query.address;
      if (!isValidAddress(address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const network = req.query.network || null;
      if (network && !isValidCaip2(network)) {
        return res.status(400).json({ error: "invalid network format" });
      }
      const limit = clampInt(req.query.limit, 1, 100, 20);
      const days = clampInt(req.query.days, 1, 365, 7);
      const offset = clampInt(req.query.offset, 0, 10000, 0);

      const { payments, total } = await getPayments(address, { days, limit, network, offset });
      res.set("Cache-Control", cacheHeader());
      res.json({ payments, total, offset, limit, hasMore: offset + payments.length < total, address });
    } catch (err) {
      next(err);
    }
  });

  // ── Balances ───────────────────────────────────────────────────
  app.get("/api/v1/balances/:address", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const { balances, totalUsd } = await getBalances(req.params.address);
      res.set("Cache-Control", cacheHeader());
      res.json({ address: req.params.address, balances, totalUsd });
    } catch (err) {
      next(err);
    }
  });

  // ── Budget usage ───────────────────────────────────────────────
  app.get("/api/v1/budget/:address", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const budget = await getBudget(req.params.address);
      res.set("Cache-Control", cacheHeader());
      res.json({ address: req.params.address, ...budget });
    } catch (err) {
      next(err);
    }
  });

  // ── Stats ──────────────────────────────────────────────────────
  app.get("/api/v1/stats/:address", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const days = clampInt(req.query.days, 1, 365, 7);
      const stats = await getStats(req.params.address, days);
      res.set("Cache-Control", cacheHeader());
      res.json({ address: req.params.address, ...stats });
    } catch (err) {
      next(err);
    }
  });

  // ── Alerts ─────────────────────────────────────────────────────
  app.get("/api/v1/alerts/:address", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const alerts = await getAlerts(req.params.address);
      res.set("Cache-Control", cacheHeader());
      res.json({ address: req.params.address, alerts, count: alerts.length });
    } catch (err) {
      next(err);
    }
  });

  // ── Spending trend (daily aggregation) ──────────────────────────
  app.get("/api/v1/stats/:address/trend", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const days = clampInt(req.query.days, 1, 365, 30);
      const trend = await getTrend(req.params.address, days);
      res.set("Cache-Control", cacheHeader());
      res.json({ address: req.params.address, days, trend });
    } catch (err) {
      next(err);
    }
  });

  // ── CSV Export (stricter rate limit) ───────────────────────────
  app.get("/api/v1/export/:address", exportRateLimit, async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const days = clampInt(req.query.days, 1, 365, 7);
      const csv = await getExportCsv(req.params.address, days);
      const safeFilename = req.params.address.slice(0, 10).replace(/[^a-zA-Z0-9]/g, "");
      res.set("Content-Type", "text/csv");
      res.set("Content-Disposition", `attachment; filename="t402-payments-${safeFilename}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  // ── HTML Dashboard (parallel data fetch) ───────────────────────
  app.get("/", async (req, res, next) => {
    try {
      const rawAddress = req.query.address || "";
      const hasAddress = rawAddress.length > 0 && isValidAddress(rawAddress);
      const address = hasAddress ? rawAddress : null;

      let balData = null,
        budget = null,
        stats = null,
        payments = [],
        alerts = [],
        agents = null,
        globalStats = null;

      if (hasAddress) {
        [balData, budget, stats, { payments }, alerts] = await Promise.all([
          getBalances(address),
          getBudget(address),
          getStats(address, 7),
          getPayments(address, { days: 7, limit: 15 }),
          getAlerts(address),
        ]);
      } else {
        // Overview page — fetch agents list and global stats
        [agents, globalStats] = await Promise.all([getAgents(), getGlobalStats(7)]);
      }

      res
        .type("html")
        .send(renderDashboard({ address, hasAddress, balData, budget, stats, payments, alerts, agents, globalStats }));
    } catch (err) {
      next(err);
    }
  });

  // ── SSE real-time event stream ──────────────────────────────────
  app.get("/api/v1/events/:address", (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const address = req.params.address;
      const days = clampInt(req.query.days, 1, 365, 7);

      res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      metrics.sseConnections++;

      let closed = false;

      // Send initial snapshot
      const sendEvent = (event, data) => {
        if (closed) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const sendSnapshot = async () => {
        if (closed) return;
        try {
          const [balData, budget, stats, { payments, total }, alerts] = await Promise.all([
            getBalances(address),
            getBudget(address),
            getStats(address, days),
            getPayments(address, { days, limit: 15 }),
            getAlerts(address),
          ]);
          sendEvent("snapshot", {
            balances: balData,
            budget,
            stats,
            payments: { items: payments, total },
            alerts: { items: alerts, count: alerts.length },
          });
        } catch (err) {
          sendEvent("error", { message: "Failed to fetch data" });
        }
      };

      // Initial snapshot
      sendSnapshot();

      // Periodic updates (every 30s)
      const interval = setInterval(sendSnapshot, 30000);

      // Heartbeat to keep connection alive (every 15s)
      const heartbeat = setInterval(() => {
        if (closed) return;
        res.write(": heartbeat\n\n");
      }, 15000);

      // Cleanup on disconnect
      req.on("close", () => {
        closed = true;
        metrics.sseConnections--;
        clearInterval(interval);
        clearInterval(heartbeat);
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Combined dashboard endpoint (single call for all data) ────
  app.get("/api/v1/dashboard/:address", async (req, res, next) => {
    try {
      if (!isValidAddress(req.params.address)) {
        return res.status(400).json({ error: "invalid address format" });
      }
      const address = req.params.address;
      const days = clampInt(req.query.days, 1, 365, 7);

      const [balData, budget, stats, { payments, total }, alerts] = await Promise.all([
        getBalances(address),
        getBudget(address),
        getStats(address, days),
        getPayments(address, { days, limit: 15 }),
        getAlerts(address),
      ]);

      res.set("Cache-Control", cacheHeader());
      res.json({
        address,
        mode: getMode(),
        balances: balData,
        budget,
        stats,
        payments: { items: payments, total },
        alerts: { items: alerts, count: alerts.length },
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Agents list ──────────────────────────────────────────────
  app.get("/api/agents", async (_req, res, next) => {
    try {
      const agents = await getAgents();
      res.set("Cache-Control", cacheHeader());
      res.json({ mode: getMode(), agents, total: agents.length });
    } catch (err) {
      next(err);
    }
  });

  // ── Global stats (no address required) ──────────────────────
  app.get("/api/stats", async (req, res, next) => {
    try {
      const days = clampInt(req.query.days, 1, 365, 7);
      const stats = await getGlobalStats(days);
      res.set("Cache-Control", cacheHeader());
      res.json({ mode: getMode(), ...stats });
    } catch (err) {
      next(err);
    }
  });

  // ── Global network distribution ─────────────────────────────
  app.get("/api/stats/networks", async (req, res, next) => {
    try {
      const days = clampInt(req.query.days, 1, 365, 7);
      const networks = await getGlobalNetworkStats(days);
      res.set("Cache-Control", cacheHeader());
      res.json({ mode: getMode(), period: `${days}d`, networks });
    } catch (err) {
      next(err);
    }
  });

  // ── Global daily trend ────────────────────────────────────
  app.get("/api/stats/trend", async (req, res, next) => {
    try {
      const days = clampInt(req.query.days, 1, 365, 30);
      const trend = await getGlobalTrend(days);
      res.set("Cache-Control", cacheHeader());
      res.json({ mode: getMode(), period: `${days}d`, trend });
    } catch (err) {
      next(err);
    }
  });

  // ── Global transactions (no address required) ───────────────
  app.get("/api/transactions", async (req, res, next) => {
    try {
      const limit = clampInt(req.query.limit, 1, 100, 20);
      const offset = clampInt(req.query.offset, 0, 10000, 0);
      const network = req.query.network || null;
      if (network && !isValidCaip2(network)) {
        return res.status(400).json({ error: "invalid network format" });
      }
      const { transactions, total } = await getGlobalTransactions({ limit, offset, network });
      res.set("Cache-Control", cacheHeader());
      res.json({ mode: getMode(), transactions, total, offset, limit, hasMore: offset + transactions.length < total });
    } catch (err) {
      next(err);
    }
  });

  // ── Info / Health ──────────────────────────────────────────────

  app.get("/api/v1/info", (_req, res) => {
    res.json({ mode: getMode(), version: VERSION });
  });

  app.get("/health", (_req, res) => {
    const health = { status: "ok", service: "t402-agent-dashboard", mode: getMode() };
    if (getMode() === "live") {
      const poolStats = getPoolStats();
      if (poolStats) health.pool = poolStats;
    }
    res.json(health);
  });

  // ── API Documentation ─────────────────────────────────────────────
  app.get("/docs", async (_req, res, next) => {
    try {
      const { readFile } = await import("node:fs/promises");
      const specPath = join(__dirname, "..", "openapi.yaml");
      const spec = await readFile(specPath, "utf-8");
      res.type("html").send(renderApiDocs(spec));
    } catch (err) {
      next(err);
    }
  });

  app.get("/openapi.yaml", async (_req, res, next) => {
    try {
      const { readFile } = await import("node:fs/promises");
      const specPath = join(__dirname, "..", "openapi.yaml");
      const spec = await readFile(specPath, "utf-8");
      res.type("text/yaml").send(spec);
    } catch (err) {
      next(err);
    }
  });

  // ── Prometheus metrics ─────────────────────────────────────────

  app.get("/metrics", (_req, res) => {
    const lines = [
      `# HELP http_requests_total Total HTTP requests`,
      `# TYPE http_requests_total counter`,
      `http_requests_total ${metrics.requests}`,
      `# HELP http_errors_total Total HTTP errors (4xx+5xx)`,
      `# TYPE http_errors_total counter`,
      `http_errors_total ${metrics.errors}`,
      `# HELP http_request_duration_ms Request duration histogram`,
      `# TYPE http_request_duration_ms histogram`,
      `http_request_duration_ms_bucket{le="10"} ${metrics.latencyBuckets[10]}`,
      `http_request_duration_ms_bucket{le="50"} ${metrics.latencyBuckets[50]}`,
      `http_request_duration_ms_bucket{le="100"} ${metrics.latencyBuckets[100]}`,
      `http_request_duration_ms_bucket{le="250"} ${metrics.latencyBuckets[250]}`,
      `http_request_duration_ms_bucket{le="500"} ${metrics.latencyBuckets[500]}`,
      `http_request_duration_ms_bucket{le="1000"} ${metrics.latencyBuckets[1000]}`,
      `http_request_duration_ms_bucket{le="+Inf"} ${metrics.latencyBuckets[Infinity]}`,
      `http_request_duration_ms_sum ${metrics.latencySum}`,
      `http_request_duration_ms_count ${metrics.latencyCount}`,
      `# HELP sse_active_connections Active SSE connections`,
      `# TYPE sse_active_connections gauge`,
      `sse_active_connections ${metrics.sseConnections}`,
      `# HELP datasource_mode Current data source mode`,
      `# TYPE datasource_mode gauge`,
      `datasource_mode{mode="${getMode()}"} 1`,
    ];

    // Pool stats (live mode only)
    const poolStats = getPoolStats();
    if (poolStats) {
      lines.push(
        `# HELP pg_pool_total Total pool connections`,
        `# TYPE pg_pool_total gauge`,
        `pg_pool_total ${poolStats.totalCount}`,
        `pg_pool_idle ${poolStats.idleCount}`,
        `pg_pool_waiting ${poolStats.waitingCount}`,
      );
    }

    for (const [path, count] of Object.entries(metrics.requestsByPath)) {
      // Sanitize for Prometheus label: strip control chars, limit length
      const safePath = path.replace(/["\\\n\r}]/g, "_").slice(0, 80);
      lines.push(`http_requests_by_path{path="${safePath}"} ${count}`);
    }

    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(lines.join("\n") + "\n");
  });
}
