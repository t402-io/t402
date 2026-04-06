/**
 * T402 Bazaar — Service Marketplace API
 *
 * Enables AI agents to discover, register, and search for
 * t402-protected paid API services.
 *
 * GET    /api/v1/search?q=weather&category=data&maxPrice=10
 * GET    /api/v1/services/:id
 * POST   /api/v1/services          (register new service)
 * PUT    /api/v1/services/:id      (update service)
 * DELETE /api/v1/services/:id      (remove service)
 * GET    /api/v1/services/:id/verify
 * GET    /api/v1/featured
 * GET    /api/v1/categories
 * GET    /api/v1/stats
 * GET    /health
 * GET    /ready
 * GET    /metrics
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";
import {
  rateLimit,
  requireAuth,
  requireServiceAuth,
  hashApiKey,
  validateServiceInput,
  sanitizeString,
  verifyServiceUrl,
  isPrivateIP,
  requestId,
  requestLogger,
  sendWithEtag,
  logger,
  getMetrics,
  recordRegistration,
  errorHandler,
} from "./middleware.js";
import { store, seedStore, getNextId } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "100kb" }));

// Security headers
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'",
  );
  res.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("X-Permitted-Cross-Domain-Policies", "none");
  next();
});

const PORT = process.env.PORT || 3402;
const MAX_SEARCH_LIMIT = 100;
const REVERIFY_INTERVAL = parseInt(process.env.REVERIFY_INTERVAL_MS || String(30 * 60_000)); // 30 min
const REVERIFY_STALE_HOURS = parseInt(process.env.REVERIFY_STALE_HOURS || "24");

// CORS headers
app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
  if (_req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Request ID (correlation) — must be before compression so header is set early
app.use(requestId);

// Structured request logging
app.use(requestLogger);

// Compression — registered after requestId and requestLogger so their
// headers (X-Request-Id) are already on the response before compression
// intercepts res.end / res.write.
app.use(compression());

// Rate limiting on all routes
app.use(rateLimit);

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, "..", "public")));

// Initialize store with seed data
seedStore();

// Ensure seed services have verification metadata so /featured works
for (const svc of store.getAll()) {
  if (svc.verified && !svc.verification) {
    svc.verification = { reachable: true, returns402: true, statusCode: 402, latencyMs: 0 };
    svc.updatedAt = new Date().toISOString();
    store.set(svc.id, svc);
  }
}

// ── Search ────────────────────────────────────────────────────────────
app.get("/api/v1/search", (req, res) => {
  const { q, query, category, maxPrice, network, token, tags, verified, limit = "20", offset = "0" } = req.query;
  const searchTerm = q || query;
  let results = store.getAll();

  if (searchTerm) {
    // Multi-word search: all terms must match somewhere
    const terms = String(searchTerm).toLowerCase().split(/\s+/).filter(Boolean);
    results = results
      .map((s) => {
        let score = 0;
        const nameLower = s.name.toLowerCase();
        const descLower = s.description.toLowerCase();
        const catLower = s.category.toLowerCase();
        const tagsLower = (s.tags || []).join(" ").toLowerCase();

        for (const term of terms) {
          let termScore = 0;
          if (nameLower.includes(term)) termScore += 10;
          if (descLower.includes(term)) termScore += 3;
          if (catLower.includes(term)) termScore += 2;
          if (tagsLower.includes(term)) termScore += 4;
          if (termScore === 0) return { ...s, _score: 0 }; // all terms must match
          score += termScore;
        }

        if (nameLower === String(searchTerm).toLowerCase()) score += 5;
        return { ...s, _score: score };
      })
      .filter((s) => s._score > 0);

    results.sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      if (a._score !== b._score) return b._score - a._score;
      return b.registeredAt.localeCompare(a.registeredAt);
    });

    results = results.map(({ _score, ...rest }) => rest);
  } else {
    results.sort((a, b) => {
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return b.registeredAt.localeCompare(a.registeredAt);
    });
  }

  if (category) {
    results = results.filter((s) => s.category === category);
  }

  if (network) {
    results = results.filter((s) => s.price.network === network);
  }

  if (token) {
    results = results.filter((s) => s.price.token === token);
  }

  if (tags) {
    const filterTags = String(tags).split(",").map((t) => t.trim().toLowerCase());
    results = results.filter((s) => {
      const svcTags = (s.tags || []).map((t) => t.toLowerCase());
      return filterTags.some((t) => svcTags.includes(t));
    });
  }

  if (verified === "true") {
    results = results.filter((s) => s.verified);
  } else if (verified === "false") {
    results = results.filter((s) => !s.verified);
  }

  if (maxPrice) {
    const max = parseFloat(maxPrice) * 1e6;
    results = results.filter((s) => parseInt(s.price.amount) <= max);
  }

  const parsedOffset = Math.max(0, parseInt(offset) || 0);
  const parsedLimit = Math.min(Math.max(1, parseInt(limit) || 20), MAX_SEARCH_LIMIT);
  const total = results.length;
  results = results.slice(parsedOffset, parsedOffset + parsedLimit);

  const body = {
    services: results,
    count: results.length,
    total,
    query: { q: searchTerm, category, maxPrice, network },
    pagination: { offset: parsedOffset, limit: parsedLimit },
  };
  sendWithEtag(req, res, body, "public, max-age=30");
});

// ── Get service by ID ─────────────────────────────────────────────────
app.get("/api/v1/services/:id", (req, res) => {
  const service = store.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  sendWithEtag(req, res, service, "public, max-age=60");
});

// ── Register new service ──────────────────────────────────────────────
app.post("/api/v1/services", requireAuth, (req, res) => {
  const errors = validateServiceInput(req.body);
  if (errors.length > 0) {
    recordRegistration(true, false);
    return res.status(400).json({ error: "Validation failed", details: errors });
  }

  const { url, name, description, category, price, methods, owner, tags } = req.body;

  const existing = store.getByUrl(url);
  if (existing) {
    recordRegistration(false, true);
    return res.status(409).json({ error: "Service already registered", existingId: existing.id });
  }

  const id = getNextId();
  const now = new Date().toISOString();
  const service = {
    id,
    url,
    name: sanitizeString(name),
    description: sanitizeString(description || ""),
    category: sanitizeString(category || "other"),
    price,
    methods: methods || ["GET"],
    tags: Array.isArray(tags) ? tags.map((t) => sanitizeString(String(t)).toLowerCase()).slice(0, 20) : [],
    owner: owner || "unknown",
    verified: false,
    registeredAt: now,
    updatedAt: now,
  };

  // Store hash of the caller's API key for per-service auth on future updates/deletes
  const callerKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  service.apiKeyHash = callerKey ? hashApiKey(callerKey) : null;

  store.set(id, service);
  recordRegistration(false, false);
  logger.info("service registered", { id, url, name: service.name });
  res.set("Cache-Control", "no-store");
  res.status(201).json(service);

  // Async verification
  verifyServiceUrl(url).then((result) => {
    const svc = store.get(id);
    if (svc) {
      svc.verified = result.returns402;
      svc.verification = result;
      if (result.discovery) svc.discovery = result.discovery;
      svc.updatedAt = new Date().toISOString();
      store.set(id, svc);
      logger.info("service verified", { id, verified: svc.verified, latencyMs: result.latencyMs });
    }
  });
});

// ── Update service ────────────────────────────────────────────────────
app.put("/api/v1/services/:id", requireServiceAuth((id) => store.get(id)), (req, res) => {
  const service = store.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }

  const { url, name, description, category, price, methods, owner, tags } = req.body;

  if (url !== undefined) {
    if (typeof url !== "string" || url.length > 2000) {
      return res.status(400).json({ error: "url must be a string of at most 2000 characters" });
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: "url must be a valid URL" });
    }
    if (isPrivateIP(parsed.hostname)) {
      return res.status(400).json({ error: "URL must not point to a private/internal address" });
    }
    // Check for duplicates (another service with same URL)
    const existing = store.getByUrl(url);
    if (existing && existing.id !== req.params.id) {
      return res.status(409).json({ error: "URL already registered by another service", existingId: existing.id });
    }
    service.url = url;
  }
  if (name !== undefined) {
    if (typeof name !== "string" || name.length > 200) {
      return res.status(400).json({ error: "name must be a string of at most 200 characters" });
    }
    service.name = sanitizeString(name);
  }
  if (description !== undefined) {
    if (typeof description !== "string" || description.length > 2000) {
      return res.status(400).json({ error: "description must be a string of at most 2000 characters" });
    }
    service.description = sanitizeString(description);
  }
  if (category !== undefined) {
    if (typeof category !== "string" || category.length > 50) {
      return res.status(400).json({ error: "category must be a string of at most 50 characters" });
    }
    service.category = sanitizeString(category);
  }
  if (price !== undefined) {
    if (typeof price !== "object" || !price.amount || !price.token || !price.network) {
      return res.status(400).json({ error: "price must include amount, token, and network" });
    }
    service.price = price;
  }
  if (methods !== undefined) {
    if (!Array.isArray(methods)) {
      return res.status(400).json({ error: "methods must be an array" });
    }
    service.methods = methods;
  }
  if (owner !== undefined) {
    service.owner = owner;
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: "tags must be an array" });
    }
    service.tags = tags.map((t) => sanitizeString(String(t)).toLowerCase()).slice(0, 20);
  }

  service.updatedAt = new Date().toISOString();
  store.set(req.params.id, service);
  logger.info("service updated", { id: req.params.id });
  res.set("Cache-Control", "no-store");
  res.json(service);
});

// ── Delete service ────────────────────────────────────────────────────
app.delete("/api/v1/services/:id", requireServiceAuth((id) => store.get(id)), (req, res) => {
  const service = store.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  store.delete(req.params.id);
  logger.info("service deleted", { id: req.params.id, name: service.name });
  res.set("Cache-Control", "no-store");
  res.json({ deleted: true, id: req.params.id });
});

// ── Re-verify service ─────────────────────────────────────────────────
app.get("/api/v1/services/:id/verify", async (req, res) => {
  const service = store.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }

  const result = await verifyServiceUrl(service.url);
  service.verified = result.returns402;
  service.verification = result;
  if (result.discovery) service.discovery = result.discovery;
  service.updatedAt = new Date().toISOString();
  store.set(req.params.id, service);
  res.json({ id: service.id, url: service.url, ...result });
});

// ── Featured ──────────────────────────────────────────────────────────
app.get("/api/v1/featured", (req, res) => {
  const featured = store
    .getAll()
    .filter((s) => s.verified)
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
    .slice(0, 5);
  sendWithEtag(req, res, { services: featured, count: featured.length }, "public, max-age=300");
});

// ── MCP Marketplace ──────────────────────────────────────────────────

// List all MCP tools across all services
app.get("/api/v1/mcp/tools", (req, res) => {
  const mcpServices = store.getAll().filter((s) => s.serviceType === "mcp");
  const tools = [];
  for (const svc of mcpServices) {
    for (const tool of svc.mcpTools || []) {
      tools.push({
        ...tool,
        serviceId: svc.id,
        serviceName: svc.name,
        serviceUrl: svc.url,
        price: svc.price,
        verified: svc.verified,
        commissionRate: svc.commissionRate,
      });
    }
  }
  const { q, category } = req.query;
  let filtered = tools;
  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(
      (t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query),
    );
  }
  if (category) {
    const mcpInCategory = store.getAll().filter((s) => s.serviceType === "mcp" && s.category === category);
    const ids = new Set(mcpInCategory.map((s) => s.id));
    filtered = filtered.filter((t) => ids.has(t.serviceId));
  }
  sendWithEtag(req, res, { tools: filtered, count: filtered.length }, "public, max-age=60");
});

// Get specific tool schema
app.get("/api/v1/mcp/tools/:toolName/schema", (req, res) => {
  const { toolName } = req.params;
  const mcpServices = store.getAll().filter((s) => s.serviceType === "mcp");
  for (const svc of mcpServices) {
    const tool = (svc.mcpTools || []).find((t) => t.name === toolName);
    if (tool) {
      return res.json({
        tool: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        serviceId: svc.id,
        serviceName: svc.name,
        serviceUrl: svc.url,
        price: svc.price,
      });
    }
  }
  res.status(404).json({ error: `Tool '${toolName}' not found` });
});

// MCP marketplace stats
app.get("/api/v1/mcp/stats", (req, res) => {
  const mcpServices = store.getAll().filter((s) => s.serviceType === "mcp");
  let totalTools = 0;
  let totalCalls = 0;
  const categories = {};
  for (const svc of mcpServices) {
    totalTools += (svc.mcpTools || []).length;
    totalCalls += svc.totalCalls || 0;
    categories[svc.category] = (categories[svc.category] || 0) + 1;
  }
  sendWithEtag(req, res, {
    services: mcpServices.length,
    tools: totalTools,
    totalCalls,
    categories,
    commissionRate: 0.15,
  }, "public, max-age=60");
});

// Record a tool call (for commission tracking)
app.post("/api/v1/mcp/call", requireAuth, (req, res) => {
  const { serviceId, toolName, amount } = req.body;
  if (!serviceId || !toolName) {
    return res.status(400).json({ error: "serviceId and toolName required" });
  }
  const service = store.get(serviceId);
  if (!service || service.serviceType !== "mcp") {
    return res.status(404).json({ error: "MCP service not found" });
  }
  const tool = (service.mcpTools || []).find((t) => t.name === toolName);
  if (!tool) {
    return res.status(404).json({ error: `Tool '${toolName}' not found in service` });
  }

  // Update call count and revenue
  service.totalCalls = (service.totalCalls || 0) + 1;
  const callAmount = parseInt(amount || service.price.amount || "0");
  const commission = Math.floor(callAmount * (service.commissionRate || 0.15));
  const currentRevenue = BigInt(service.totalRevenue || "0");
  service.totalRevenue = (currentRevenue + BigInt(callAmount - commission)).toString();
  service.updatedAt = new Date().toISOString();
  store.set(serviceId, service);

  res.json({
    success: true,
    tool: toolName,
    amount: callAmount,
    commission,
    vendorReceives: callAmount - commission,
    totalCalls: service.totalCalls,
  });
});

// ── Categories ────────────────────────────────────────────────────────
app.get("/api/v1/categories", (req, res) => {
  const categories = {};
  for (const s of store.getAll()) {
    categories[s.category] = (categories[s.category] || 0) + 1;
  }
  sendWithEtag(req, res, { categories }, "public, max-age=60");
});

// ── Tags ──────────────────────────────────────────────────────────────
app.get("/api/v1/tags", (req, res) => {
  const tagCounts = {};
  for (const s of store.getAll()) {
    for (const t of s.tags || []) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }
  sendWithEtag(req, res, { tags: tagCounts }, "public, max-age=60");
});

// ── Stats ─────────────────────────────────────────────────────────────
app.get("/api/v1/stats", (req, res) => {
  const all = store.getAll();
  const networks = {};
  const tokens = {};
  for (const s of all) {
    networks[s.price.network] = (networks[s.price.network] || 0) + 1;
    tokens[s.price.token] = (tokens[s.price.token] || 0) + 1;
  }
  sendWithEtag(req, res, {
    totalServices: all.length,
    verified: store.countVerified(),
    networks,
    tokens,
  }, "public, max-age=60");
});

// ── Health / Ready / Metrics ──────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json({ status: "ok", service: "t402-bazaar", services: store.size() });
});

app.get("/ready", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  if (store.size() === 0) {
    return res.status(503).json({ status: "not ready", reason: "No services loaded" });
  }
  res.json({ status: "ready", services: store.size() });
});

app.get("/metrics", (_req, res) => {
  res.json({
    ...getMetrics(),
    store: {
      services: store.size(),
      verified: store.countVerified(),
      engine: store.isMemory() ? "memory" : "sqlite",
    },
  });
});

// ── Prometheus metrics ────────────────────────────────────────────────
app.get("/metrics/prometheus", (_req, res) => {
  const m = getMetrics();
  const lines = [];

  lines.push("# HELP bazaar_requests_total Total requests");
  lines.push("# TYPE bazaar_requests_total counter");
  for (const [method, count] of Object.entries(m.requests.byMethod || {})) {
    lines.push(`bazaar_requests_total{method="${method}"} ${count}`);
  }
  for (const [status, count] of Object.entries(m.requests.byStatus || {})) {
    lines.push(`bazaar_requests_total{status="${status}"} ${count}`);
  }

  lines.push("");
  lines.push("# HELP bazaar_services_total Total registered services");
  lines.push("# TYPE bazaar_services_total gauge");
  lines.push(`bazaar_services_total ${store.size()}`);

  lines.push("");
  lines.push("# HELP bazaar_services_verified Verified services count");
  lines.push("# TYPE bazaar_services_verified gauge");
  lines.push(`bazaar_services_verified ${store.countVerified()}`);

  lines.push("");
  lines.push("# HELP bazaar_uptime_seconds Service uptime");
  lines.push("# TYPE bazaar_uptime_seconds gauge");
  lines.push(`bazaar_uptime_seconds ${Math.floor(m.uptime)}`);

  lines.push("");
  lines.push("# HELP bazaar_errors_total Total errors");
  lines.push("# TYPE bazaar_errors_total counter");
  lines.push(`bazaar_errors_total ${m.errors}`);

  lines.push("");
  lines.push("# HELP bazaar_verifications_total Total verifications");
  lines.push("# TYPE bazaar_verifications_total counter");
  lines.push(`bazaar_verifications_total ${m.verifications.total}`);

  lines.push("");
  lines.push("# HELP bazaar_verifications_successful Successful verifications");
  lines.push("# TYPE bazaar_verifications_successful counter");
  lines.push(`bazaar_verifications_successful ${m.verifications.successful}`);

  lines.push("");
  lines.push("# HELP bazaar_registrations_total Total registrations");
  lines.push("# TYPE bazaar_registrations_total counter");
  lines.push(`bazaar_registrations_total ${m.registrations.total}`);

  lines.push("");

  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n"));
});

// ── OpenAPI spec ──────────────────────────────────────────────────────
let openapiSpec;
try {
  openapiSpec = readFileSync(path.join(__dirname, "..", "openapi.yaml"), "utf8");
} catch {
  // openapi.yaml not available (e.g., in minimal Docker build)
}

app.get("/openapi.yaml", (_req, res) => {
  if (!openapiSpec) {
    return res.status(404).json({ error: "OpenAPI spec not available" });
  }
  res.type("text/yaml").send(openapiSpec);
});

// ── Frontend fallback ─────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── 404 catch-all ────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── Error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ── Periodic re-verification ──────────────────────────────────────────
async function reverifyStaleServices() {
  const cutoff = new Date(Date.now() - REVERIFY_STALE_HOURS * 3600_000).toISOString();
  const stale = store.getStale(cutoff, 5);

  if (stale.length === 0) return;

  logger.info("re-verification started", { count: stale.length });

  for (const svc of stale) {
    try {
      const result = await verifyServiceUrl(svc.url);
      svc.verified = result.returns402;
      svc.verification = result;
      if (result.discovery) svc.discovery = result.discovery;
      svc.updatedAt = new Date().toISOString();
      store.set(svc.id, svc);
    } catch (e) {
      logger.error("re-verification failed", { id: svc.id, error: e.message });
    }
  }

  logger.info("re-verification complete", { count: stale.length });
}

const _reverifyInterval = setInterval(reverifyStaleServices, REVERIFY_INTERVAL);
_reverifyInterval.unref();

// ── Start server ──────────────────────────────────────────────────────
let server;
const isDirectRun =
  process.argv[1] && new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;

if (isDirectRun) {
  server = app.listen(PORT, () => {
    logger.info("server started", {
      port: PORT,
      services: store.size(),
      store: store.isMemory() ? "memory" : "sqlite",
      endpoints: ["/api/v1/search", "/api/v1/services", "/api/v1/categories", "/api/v1/stats", "/api/v1/featured"],
    });
  });
}

export default app;

// Graceful shutdown
function shutdown(signal) {
  logger.info("shutdown initiated", { signal });
  server.close(() => {
    store.close();
    logger.info("server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
