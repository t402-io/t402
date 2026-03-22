/**
 * API route handlers for the T402 Agent Dashboard.
 *
 * Extracted from server.js to separate routing from middleware.
 */

import {
  getPayments,
  getBalances,
  getBudget,
  getStats,
  getAlerts,
  getExportCsv,
  getMode,
  getPoolStats,
} from "./datasource.js";
import { renderDashboard } from "./templates.js";
import { isValidAddress, clampInt, log } from "./utils.js";

// ── Metrics (hand-rolled Prometheus counters, no deps) ──────────────

const metrics = {
  requests: 0,
  errors: 0,
  requestsByPath: {},
  latencies: [],
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
      metrics.latencies.push(duration);
      if (metrics.latencies.length > 1000) metrics.latencies = metrics.latencies.slice(-500);
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
        alerts = [];

      if (hasAddress) {
        [balData, budget, stats, { payments }, alerts] = await Promise.all([
          getBalances(address),
          getBudget(address),
          getStats(address, 7),
          getPayments(address, { days: 7, limit: 15 }),
          getAlerts(address),
        ]);
      }

      const cspNonce = res.locals.cspNonce || "";
      res
        .type("html")
        .send(renderDashboard({ address, hasAddress, balData, budget, stats, payments, alerts, cspNonce }));
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

  // ── Info / Health ──────────────────────────────────────────────

  app.get("/api/v1/info", (_req, res) => {
    res.json({ mode: getMode(), version: "1.1.0" });
  });

  app.get("/health", (_req, res) => {
    const health = { status: "ok", service: "t402-agent-dashboard", mode: getMode() };
    if (getMode() === "live") {
      const poolStats = getPoolStats();
      if (poolStats) health.pool = poolStats;
    }
    res.json(health);
  });

  // ── Prometheus metrics ─────────────────────────────────────────

  app.get("/metrics", (_req, res) => {
    const avgLatency =
      metrics.latencies.length > 0
        ? (metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length).toFixed(1)
        : 0;

    const lines = [
      `# HELP http_requests_total Total HTTP requests`,
      `# TYPE http_requests_total counter`,
      `http_requests_total ${metrics.requests}`,
      `# HELP http_errors_total Total HTTP errors (4xx+5xx)`,
      `# TYPE http_errors_total counter`,
      `http_errors_total ${metrics.errors}`,
      `# HELP http_request_duration_ms_avg Average request duration`,
      `# TYPE http_request_duration_ms_avg gauge`,
      `http_request_duration_ms_avg ${avgLatency}`,
      `# HELP datasource_mode Current data source mode`,
      `# TYPE datasource_mode gauge`,
      `datasource_mode{mode="${getMode()}"} 1`,
    ];

    for (const [path, count] of Object.entries(metrics.requestsByPath)) {
      // Sanitize for Prometheus label: strip control chars, limit length
      const safePath = path.replace(/["\\\n\r}]/g, "_").slice(0, 80);
      lines.push(`http_requests_by_path{path="${safePath}"} ${count}`);
    }

    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(lines.join("\n") + "\n");
  });
}
