/**
 * T402 Sandbox — Testnet Facilitator Proxy
 *
 * Lightweight proxy with rate limiting, usage tracking, and mock fallback.
 * In production, proxies to a real testnet facilitator.
 * In standalone mode, returns mock responses for development.
 */

import express from "express";

const app = express();
app.use(express.json());

// Security headers
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

const PORT = process.env.PORT || 3406;
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:8080";
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "100");

// Rate limiter
const limits = new Map();
app.use((req, res, next) => {
  const ip = req.headers["cf-connecting-ip"] || req.ip;
  const now = Date.now();
  let entry = limits.get(ip);
  if (!entry || now - entry.start > 60000) {
    entry = { count: 0, start: now };
    limits.set(ip, entry);
  }
  entry.count++;
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, RATE_LIMIT - entry.count));
  if (entry.count > RATE_LIMIT) return res.status(429).json({ error: "Rate limit exceeded" });
  next();
});

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

let totalRequests = 0;

app.get("/supported", (_req, res) => {
  totalRequests++;
  res.json({
    kinds: ["exact:eip155:84532", "exact:eip155:11155111", "exact:eip155:421614"],
    extensions: ["erc8004"],
    signers: ["eoa", "eip1271"],
    sandbox: true,
    hint: "Testnet only. Get USDC: https://portal.cdp.coinbase.com/products/faucet",
  });
});

const SUPPORTED_NETWORKS = ["eip155:84532", "eip155:11155111", "eip155:421614"];

app.post("/verify", async (req, res) => {
  totalRequests++;
  const network = req.body?.paymentRequirements?.network;
  if (network && !SUPPORTED_NETWORKS.includes(network)) {
    return res.status(400).json({ isValid: false, error: `Sandbox only supports testnets: ${SUPPORTED_NETWORKS.join(", ")}`, sandbox: true });
  }
  try {
    const r = await fetch(FACILITATOR_URL + "/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body) });
    res.status(r.status).json(await r.json());
  } catch {
    res.json({ isValid: true, payer: "0xSandboxMock", sandbox: true, note: "Mock — connect facilitator for real verification" });
  }
});

app.post("/settle", async (req, res) => {
  totalRequests++;
  const network = req.body?.paymentRequirements?.network;
  if (network && !SUPPORTED_NETWORKS.includes(network)) {
    return res.status(400).json({ success: false, error: `Sandbox only supports testnets: ${SUPPORTED_NETWORKS.join(", ")}`, sandbox: true });
  }
  try {
    const r = await fetch(FACILITATOR_URL + "/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body) });
    res.status(r.status).json(await r.json());
  } catch {
    res.json({ success: true, transaction: "0xsandbox" + Date.now().toString(16), sandbox: true, note: "Mock — no on-chain tx" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok", service: "t402-sandbox", mode: "testnet" }));
app.get("/usage", (_req, res) => res.json({ totalRequests, rateLimit: RATE_LIMIT }));

// JSON parse error handler
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON", sandbox: true });
  }
  res.status(500).json({ error: "Internal error", sandbox: true });
});

app.listen(PORT, () => console.log("Sandbox on http://localhost:" + PORT));
