/**
 * Bazaar API routes — extracted from bazaar/server.js into an Express Router.
 *
 * Factory: createBazaarRouter({ store, getNextId, middleware })
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAX_SEARCH_LIMIT = 100;

export function createBazaarRouter({ store, getNextId, requireAuth, requireServiceAuth, hashApiKey, validateServiceInput, sanitizeString, isPrivateIP, sendWithEtag, verifyServiceUrl, recordRegistration, logger }) {
  const router = Router();

  // ── Search (also available at /api/v1/bazaar-search to avoid collision with explorer /api/v1/search) ──
  function handleSearch(req, res) {
    const { q, query, category, maxPrice, network, token, tags, verified, limit = "20", offset = "0" } = req.query;
    const searchTerm = q || query;
    let results = store.getAll();

    if (searchTerm) {
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
            if (termScore === 0) return { ...s, _score: 0 };
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

    if (category) results = results.filter((s) => s.category === category);
    if (network) results = results.filter((s) => s.price.network === network);
    if (token) results = results.filter((s) => s.price.token === token);

    if (tags) {
      const filterTags = String(tags).split(",").map((t) => t.trim().toLowerCase());
      results = results.filter((s) => {
        const svcTags = (s.tags || []).map((t) => t.toLowerCase());
        return filterTags.some((t) => svcTags.includes(t));
      });
    }

    if (verified === "true") results = results.filter((s) => s.verified);
    else if (verified === "false") results = results.filter((s) => !s.verified);

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
  }
  router.get("/api/v1/search", handleSearch);
  router.get("/api/v1/bazaar-search", handleSearch);

  // ── Get service by ID ───────────────────────────────────────────────
  router.get("/api/v1/services/:id", (req, res) => {
    const service = store.get(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    sendWithEtag(req, res, service, "public, max-age=60");
  });

  // ── Register new service ────────────────────────────────────────────
  router.post("/api/v1/services", requireAuth, (req, res) => {
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
    const { serviceType, mcpTools, commissionRate, vendorEmail, documentationUrl } = req.body;

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
      serviceType: serviceType === "mcp" ? "mcp" : "rest",
      mcpTools: Array.isArray(mcpTools) ? mcpTools : [],
      commissionRate: typeof commissionRate === "number" ? commissionRate : 0.15,
      totalCalls: 0,
      totalRevenue: "0",
      vendorEmail: sanitizeString(vendorEmail || ""),
      documentationUrl: sanitizeString(documentationUrl || ""),
    };

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

  // ── Update service ──────────────────────────────────────────────────
  router.put("/api/v1/services/:id", requireServiceAuth((id) => store.get(id)), (req, res) => {
    const service = store.get(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const { url, name, description, category, price, methods, owner, tags } = req.body;

    if (url !== undefined) {
      if (typeof url !== "string" || url.length > 2000) {
        return res.status(400).json({ error: "url must be a string of at most 2000 characters" });
      }
      let parsed;
      try { parsed = new URL(url); } catch {
        return res.status(400).json({ error: "url must be a valid URL" });
      }
      if (isPrivateIP(parsed.hostname)) {
        return res.status(400).json({ error: "URL must not point to a private/internal address" });
      }
      const existing = store.getByUrl(url);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ error: "URL already registered by another service", existingId: existing.id });
      }
      service.url = url;
    }
    if (name !== undefined) {
      if (typeof name !== "string" || name.length > 200) return res.status(400).json({ error: "name must be a string of at most 200 characters" });
      service.name = sanitizeString(name);
    }
    if (description !== undefined) {
      if (typeof description !== "string" || description.length > 2000) return res.status(400).json({ error: "description must be a string of at most 2000 characters" });
      service.description = sanitizeString(description);
    }
    if (category !== undefined) {
      if (typeof category !== "string" || category.length > 50) return res.status(400).json({ error: "category must be a string of at most 50 characters" });
      service.category = sanitizeString(category);
    }
    if (price !== undefined) {
      if (typeof price !== "object" || !price.amount || !price.token || !price.network) return res.status(400).json({ error: "price must include amount, token, and network" });
      service.price = price;
    }
    if (methods !== undefined) {
      if (!Array.isArray(methods)) return res.status(400).json({ error: "methods must be an array" });
      service.methods = methods;
    }
    if (owner !== undefined) service.owner = owner;
    if (tags !== undefined) {
      if (!Array.isArray(tags)) return res.status(400).json({ error: "tags must be an array" });
      service.tags = tags.map((t) => sanitizeString(String(t)).toLowerCase()).slice(0, 20);
    }

    service.updatedAt = new Date().toISOString();
    store.set(req.params.id, service);
    logger.info("service updated", { id: req.params.id });
    res.set("Cache-Control", "no-store");
    res.json(service);
  });

  // ── Delete service ──────────────────────────────────────────────────
  router.delete("/api/v1/services/:id", requireServiceAuth((id) => store.get(id)), (req, res) => {
    const service = store.get(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    store.delete(req.params.id);
    logger.info("service deleted", { id: req.params.id, name: service.name });
    res.set("Cache-Control", "no-store");
    res.json({ deleted: true, id: req.params.id });
  });

  // ── Re-verify service ───────────────────────────────────────────────
  router.get("/api/v1/services/:id/verify", async (req, res) => {
    const service = store.get(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const result = await verifyServiceUrl(service.url);
    service.verified = result.returns402;
    service.verification = result;
    if (result.discovery) service.discovery = result.discovery;
    service.updatedAt = new Date().toISOString();
    store.set(req.params.id, service);
    res.json({ id: service.id, url: service.url, ...result });
  });

  // ── Featured ────────────────────────────────────────────────────────
  router.get("/api/v1/featured", (req, res) => {
    const featured = store.getAll()
      .filter((s) => s.verified)
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
      .slice(0, 5);
    sendWithEtag(req, res, { services: featured, count: featured.length }, "public, max-age=300");
  });

  // ── MCP Marketplace ─────────────────────────────────────────────────

  // List all MCP tools across all services
  router.get("/api/v1/mcp/tools", (req, res) => {
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
  router.get("/api/v1/mcp/tools/:toolName/schema", (req, res) => {
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
  router.get("/api/v1/mcp/stats", (req, res) => {
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

  // Record a tool call
  router.post("/api/v1/mcp/call", requireAuth, (req, res) => {
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

  // ── Categories ──────────────────────────────────────────────────────
  router.get("/api/v1/categories", (req, res) => {
    const categories = {};
    for (const s of store.getAll()) {
      categories[s.category] = (categories[s.category] || 0) + 1;
    }
    sendWithEtag(req, res, { categories }, "public, max-age=60");
  });

  // ── Tags ────────────────────────────────────────────────────────────
  router.get("/api/v1/tags", (req, res) => {
    const tagCounts = {};
    for (const s of store.getAll()) {
      for (const t of s.tags || []) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
    sendWithEtag(req, res, { tags: tagCounts }, "public, max-age=60");
  });

  // ── Bazaar Stats (renamed to avoid collision with explorer /api/v1/stats) ─
  router.get("/api/v1/bazaar-stats", (req, res) => {
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

  return router;
}
