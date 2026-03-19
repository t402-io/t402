/**
 * T402 Bazaar — Service Marketplace API
 *
 * Enables AI agents to discover, register, and search for
 * t402-protected paid API services.
 *
 * GET  /api/v1/search?q=weather&category=data&maxPrice=10
 * GET  /api/v1/services/:id
 * POST /api/v1/services (register new service)
 * GET  /api/v1/categories
 * GET  /api/v1/stats
 * GET  /health
 */

import express from "express";
import { rateLimit, requireAuth, verifyServiceUrl } from "./middleware.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3402;

// CORS headers
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");
  if (_req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Rate limiting on all routes
app.use(rateLimit);

// In-memory store (replace with PostgreSQL in production)
const services = new Map();
let nextId = 1;

// Seed with example services
const seeds = [
  {
    url: "https://api.weather402.com/forecast",
    name: "Weather Forecast API",
    description: "Global weather data with hourly resolution, 7-day forecast",
    category: "data",
    price: { amount: "1000", token: "USDC", network: "eip155:8453" },
    methods: ["GET"],
    owner: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  },
  {
    url: "https://api.llm402.com/v1/chat/completions",
    name: "LLM Inference API",
    description: "Pay-per-request access to GPT-4, Claude, and open models",
    category: "ai",
    price: { amount: "5000", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    owner: "0x1234567890abcdef1234567890abcdef12345678",
  },
  {
    url: "https://api.market402.com/report",
    name: "DeFi Market Intelligence",
    description: "Weekly DeFi market analysis with trading signals and risk metrics",
    category: "reports",
    price: { amount: "50000", token: "USDT0", network: "eip155:42161" },
    methods: ["GET"],
    owner: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  },
  {
    url: "https://api.image402.com/generate",
    name: "Image Generation API",
    description: "High-res image generation via Stable Diffusion XL and Flux",
    category: "ai",
    price: { amount: "2000", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    owner: "0x5678567856785678567856785678567856785678",
  },
  {
    url: "https://api.translate402.com/v1/translate",
    name: "Translation API",
    description: "Neural machine translation for 100+ languages",
    category: "ai",
    price: { amount: "500", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    owner: "0x9876987698769876987698769876987698769876",
  },
  {
    url: "https://api.code402.com/review",
    name: "AI Code Review",
    description: "Automated code review with security analysis and suggestions",
    category: "developer-tools",
    price: { amount: "10000", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    owner: "0xfedcfedcfedcfedcfedcfedcfedcfedcfedcfedc",
  },
  {
    url: "https://api.data402.com/blockchain/analytics",
    name: "Blockchain Analytics API",
    description: "On-chain data: wallet profiling, transaction clustering, risk scoring",
    category: "data",
    price: { amount: "15000", token: "USDC", network: "eip155:8453" },
    methods: ["GET", "POST"],
    owner: "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
  },
  {
    url: "https://api.compute402.com/gpu/run",
    name: "GPU Compute Service",
    description: "On-demand GPU compute for ML inference (A100, H100)",
    category: "compute",
    price: { amount: "100000", token: "USDT0", network: "eip155:42161" },
    methods: ["POST"],
    owner: "0xbbbb2222cccc3333dddd4444eeee5555ffff6666",
  },
];

for (const seed of seeds) {
  const id = `svc-${String(nextId++).padStart(3, "0")}`;
  services.set(id, {
    id,
    ...seed,
    verified: true,
    registeredAt: new Date().toISOString(),
  });
}

// Search services
app.get("/api/v1/search", (req, res) => {
  const { q, category, maxPrice, network, limit = "20" } = req.query;
  let results = Array.from(services.values());

  if (q) {
    const query = String(q).toLowerCase();
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query),
    );
  }

  if (category) {
    results = results.filter((s) => s.category === category);
  }

  if (network) {
    results = results.filter((s) => s.price.network === network);
  }

  if (maxPrice) {
    const max = parseInt(maxPrice) * 1e6; // Convert USD to smallest unit
    results = results.filter((s) => parseInt(s.price.amount) <= max);
  }

  results = results.slice(0, parseInt(limit));

  res.json({
    services: results,
    count: results.length,
    query: { q, category, maxPrice, network },
  });
});

// Get service by ID
app.get("/api/v1/services/:id", (req, res) => {
  const service = services.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }
  res.json(service);
});

// Register new service (auth required)
app.post("/api/v1/services", requireAuth, (req, res) => {
  const { url, name, description, category, price, methods, owner } = req.body;

  if (!url || !name || !price) {
    return res.status(400).json({ error: "url, name, and price are required" });
  }

  const id = `svc-${String(nextId++).padStart(3, "0")}`;
  const service = {
    id,
    url,
    name,
    description: description || "",
    category: category || "other",
    price,
    methods: methods || ["GET"],
    owner: owner || "unknown",
    verified: false,
    registeredAt: new Date().toISOString(),
  };

  services.set(id, service);
  res.status(201).json(service);

  // Async verification — probe the URL in the background
  verifyServiceUrl(url).then((result) => {
    const svc = services.get(id);
    if (svc) {
      svc.verified = result.returns402;
      svc.verification = result;
    }
  });
});

// Re-verify a service URL
app.get("/api/v1/services/:id/verify", async (req, res) => {
  const service = services.get(req.params.id);
  if (!service) {
    return res.status(404).json({ error: "Service not found" });
  }

  const result = await verifyServiceUrl(service.url);
  service.verified = result.returns402;
  service.verification = result;
  res.json({ id: service.id, url: service.url, ...result });
});

// Featured services — top 5 verified services
app.get("/api/v1/featured", (_req, res) => {
  const featured = Array.from(services.values())
    .filter((s) => s.verified)
    .slice(0, 5);
  res.json({ services: featured, count: featured.length });
});

// List categories
app.get("/api/v1/categories", (_req, res) => {
  const categories = {};
  for (const s of services.values()) {
    categories[s.category] = (categories[s.category] || 0) + 1;
  }
  res.json({ categories });
});

// Stats
app.get("/api/v1/stats", (_req, res) => {
  const all = Array.from(services.values());
  const networks = {};
  const tokens = {};
  for (const s of all) {
    networks[s.price.network] = (networks[s.price.network] || 0) + 1;
    tokens[s.price.token] = (tokens[s.price.token] || 0) + 1;
  }
  res.json({
    totalServices: all.length,
    verified: all.filter((s) => s.verified).length,
    networks,
    tokens,
  });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "t402-bazaar", services: services.size });
});

app.listen(PORT, () => {
  console.log(`🏪 T402 Bazaar running on http://localhost:${PORT}`);
  console.log(`   ${services.size} services indexed`);
  console.log(`   Endpoints: /api/v1/search, /api/v1/services, /api/v1/categories, /api/v1/stats`);
});
