/**
 * T402 Sandbox — Testnet Facilitator Proxy
 *
 * Lightweight proxy with rate limiting, usage tracking, and mock fallback.
 * In production, proxies to a real testnet facilitator.
 * In standalone mode, returns mock responses for development.
 */

import express from "express";
import compression from "compression";

// --- Structured JSON logging ---
function log(level, message, data = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...data }));
}

const app = express();

const PORT = parseInt(process.env.PORT || "3406");
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:8080";
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "100");
const VERIFY_TIMEOUT_MS = 30_000;
const SETTLE_TIMEOUT_MS = 90_000;

// Compress responses
app.use(compression());

// Body parser with explicit size limit
app.use(express.json({ limit: "50kb" }));

// Security headers
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.set("Content-Security-Policy", "default-src 'none'");
  next();
});

// --- Rate limiter with periodic cleanup ---
const limits = new Map();
const RATE_WINDOW_MS = 60_000;

// Evict stale entries every 60s
const evictionTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of limits) {
    if (now - entry.start > RATE_WINDOW_MS) limits.delete(ip);
  }
}, RATE_WINDOW_MS);
evictionTimer.unref();

app.use((req, res, next) => {
  const ip = req.headers["cf-connecting-ip"] || req.ip;
  const now = Date.now();
  let entry = limits.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { count: 0, start: now };
    limits.set(ip, entry);
  }
  entry.count++;
  res.set("X-RateLimit-Limit", String(RATE_LIMIT));
  res.set("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT - entry.count)));
  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded", sandbox: true });
  }
  next();
});

// CORS
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- Supported testnet networks ---
const SUPPORTED_NETWORKS = [
  "eip155:84532",     // Base Sepolia
  "eip155:11155111",  // Ethereum Sepolia
  "eip155:421614",    // Arbitrum Sepolia
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet
];

// SupportedKind objects matching SDK SupportedResponse type
const SUPPORTED_KINDS = SUPPORTED_NETWORKS.map((network) => ({
  t402Version: 2,
  scheme: "exact",
  network,
}));

// --- Usage tracking ---
let totalRequests = 0;
let upstreamErrors = 0;

// --- Upstream health state ---
let upstreamHealthy = null; // null = unknown, true/false after first check

async function checkUpstream() {
  try {
    const res = await fetch(`${FACILITATOR_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    upstreamHealthy = res.ok;
  } catch {
    upstreamHealthy = false;
  }
}

// Detect if running as main entry point (not imported by tests)
const _isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];

// Periodic upstream check (every 30s)
if (_isMain) {
  checkUpstream();
  const healthTimer = setInterval(checkUpstream, 30_000);
  healthTimer.unref();
}

// --- Helper: proxy to facilitator ---
async function proxyToFacilitator(path, body, timeoutMs) {
  const res = await fetch(`${FACILITATOR_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    throw new Error(`Upstream returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

// --- Routes ---

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "t402-sandbox", mode: "testnet" });
});

app.get("/ready", async (_req, res) => {
  await checkUpstream();
  if (upstreamHealthy) {
    res.json({ ready: true, upstream: "connected", service: "t402-sandbox" });
  } else {
    res.status(503).json({ ready: false, upstream: "unreachable", service: "t402-sandbox", note: "Mock fallback active" });
  }
});

app.get("/supported", (_req, res) => {
  totalRequests++;
  res.json({
    kinds: SUPPORTED_KINDS,
    extensions: ["erc8004"],
    signers: {
      "eip155:*": ["0x0000000000000000000000000000000000000000"],
      "solana:*": [],
    },
    sandbox: true,
    hint: "Testnet only — get test tokens at /faucets",
  });
});

app.get("/faucets", (_req, res) => {
  totalRequests++;
  res.json({
    faucets: [
      { network: "eip155:84532", name: "Base Sepolia", tokens: [
        { symbol: "USDC", url: "https://portal.cdp.coinbase.com/products/faucet" },
        { symbol: "ETH (gas)", url: "https://portal.cdp.coinbase.com/products/faucet" },
      ]},
      { network: "eip155:11155111", name: "Ethereum Sepolia", tokens: [
        { symbol: "ETH (gas)", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
        { symbol: "USDC", url: "https://faucet.circle.com/" },
      ]},
      { network: "eip155:421614", name: "Arbitrum Sepolia", tokens: [
        { symbol: "ETH (gas)", url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
      ]},
      { network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", name: "Solana Devnet", tokens: [
        { symbol: "SOL (gas)", url: "https://faucet.solana.com/" },
        { symbol: "USDC", url: "https://faucet.circle.com/" },
      ]},
    ],
    sandbox: true,
  });
});

function validateNetwork(network) {
  if (network && !SUPPORTED_NETWORKS.includes(network)) {
    return `Sandbox only supports testnets: ${SUPPORTED_NETWORKS.join(", ")}`;
  }
  return null;
}

app.post("/verify", async (req, res) => {
  totalRequests++;
  const network = req.body?.paymentRequirements?.network;
  const networkError = validateNetwork(network);
  if (networkError) {
    return res.status(400).json({ isValid: false, invalidReason: networkError, sandbox: true });
  }
  try {
    const result = await proxyToFacilitator("/verify", req.body, VERIFY_TIMEOUT_MS);
    res.status(result.status).json(result.data);
  } catch (err) {
    upstreamErrors++;
    log("error", "/verify upstream error", { error: err.message });
    res.json({
      isValid: true,
      payer: "0x0000000000000000000000000000000000C0FFEE",
      sandbox: true,
      mock: true,
      note: "Mock response — facilitator unreachable. Connect a real testnet facilitator for on-chain verification.",
    });
  }
});

app.post("/settle", async (req, res) => {
  totalRequests++;
  const network = req.body?.paymentRequirements?.network;
  const networkError = validateNetwork(network);
  if (networkError) {
    return res.status(400).json({ success: false, errorReason: networkError, sandbox: true });
  }
  try {
    const result = await proxyToFacilitator("/settle", req.body, SETTLE_TIMEOUT_MS);
    res.status(result.status).json(result.data);
  } catch (err) {
    upstreamErrors++;
    log("error", "/settle upstream error", { error: err.message });
    res.json({
      success: true,
      transaction: "0x" + "0".repeat(64),
      network: network || "eip155:84532",
      sandbox: true,
      mock: true,
      note: "Mock response — no on-chain settlement. Connect a real testnet facilitator.",
    });
  }
});

app.get("/usage", (_req, res) => {
  res.json({ totalRequests, upstreamErrors, rateLimit: RATE_LIMIT, upstreamHealthy });
});

// Landing page
app.get("/", (_req, res) => {
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Sandbox</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui;background:#0a0a0b;color:#e5e7eb;max-width:700px;margin:0 auto;padding:2rem}
h1{color:#50AF95;font-size:1.6rem}
a{color:#50AF95}
code{background:#1f2937;padding:.15em .4em;border-radius:4px;font-size:.9em}
pre{background:#1f2937;padding:1rem;border-radius:8px;overflow-x:auto}
.badge{display:inline-block;background:#065f46;color:#6ee7b7;padding:.2em .6em;border-radius:4px;font-size:.75rem;margin-left:.5rem}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th{text-align:left;padding:.5rem;color:#9ca3af;font-size:.85rem;border-bottom:1px solid #1f2937}
td{padding:.5rem;border-bottom:1px solid #111827}
</style></head>
<body>
<h1>T402 Sandbox<span class="badge">TESTNET</span></h1>
<p>Public testnet facilitator for developer testing. No API key needed. No real funds.</p>

<h2>Quick Start</h2>
<pre><code>const client = new HTTPFacilitatorClient({
  url: "https://sandbox.t402.io"
});</code></pre>

<h2>Supported Networks</h2>
<table>
<tr><th>Network</th><th>CAIP-2</th><th>Token</th></tr>
<tr><td>Base Sepolia</td><td><code>eip155:84532</code></td><td>USDC</td></tr>
<tr><td>Ethereum Sepolia</td><td><code>eip155:11155111</code></td><td>USDC</td></tr>
<tr><td>Arbitrum Sepolia</td><td><code>eip155:421614</code></td><td>USDC</td></tr>
<tr><td>Solana Devnet</td><td><code>solana:EtWTRA...</code></td><td>USDC</td></tr>
</table>

<h2>Endpoints</h2>
<table>
<tr><th>Method</th><th>Path</th><th>Description</th></tr>
<tr><td>GET</td><td><a href="/health">/health</a></td><td>Health check</td></tr>
<tr><td>GET</td><td><a href="/ready">/ready</a></td><td>Readiness (checks upstream)</td></tr>
<tr><td>GET</td><td><a href="/supported">/supported</a></td><td>Supported testnet kinds</td></tr>
<tr><td>GET</td><td><a href="/faucets">/faucets</a></td><td>Testnet token faucets</td></tr>
<tr><td>GET</td><td><a href="/usage">/usage</a></td><td>Usage statistics</td></tr>
<tr><td>POST</td><td>/verify</td><td>Verify payment</td></tr>
<tr><td>POST</td><td>/settle</td><td>Settle payment</td></tr>
</table>

<h2>Rate Limits</h2>
<p>100 requests/minute per IP. Headers: <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>.</p>

<p style="color:#6b7280;margin-top:2rem;font-size:.85rem">
  <a href="https://docs.t402.io">Docs</a> · <a href="https://github.com/t402-io/t402">GitHub</a> · Powered by <a href="https://t402.io">T402</a>
</p>
</body></html>`);
});

// JSON parse error handler
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON", sandbox: true });
  }
  log("error", "Unhandled error", { error: err.message || String(err) });
  res.status(500).json({ error: "Internal error", sandbox: true });
});

// --- Server with graceful shutdown ---
let server;

function startServer() {
  server = app.listen(PORT, () => {
    log("info", `Listening on port ${PORT}`, { service: "t402-sandbox", mode: "testnet" });
  });
  return server;
}

function shutdown(signal) {
  log("info", `${signal} received, shutting down`, { service: "t402-sandbox" });
  if (server) {
    server.close(() => process.exit(0));
    // Force exit after 5s if connections don't drain
    setTimeout(() => process.exit(1), 5000).unref();
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

if (_isMain) {
  startServer();
}

export { app, startServer, SUPPORTED_NETWORKS, SUPPORTED_KINDS };
