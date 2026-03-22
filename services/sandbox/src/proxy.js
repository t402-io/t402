/**
 * T402 Sandbox — Testnet Facilitator Proxy
 *
 * Lightweight proxy with rate limiting, usage tracking, and mock fallback.
 * In production, proxies to a real testnet facilitator.
 * In standalone mode, returns mock responses for development.
 */

import express from "express";
import compression from "compression";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const playgroundHtml = readFileSync(join(__dirname, "playground.html"), "utf8");

// --- Structured JSON logging ---
function log(level, message, data = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...data }));
}

const app = express();

const PORT = parseInt(process.env.PORT || "3406");
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:8080";
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "100");
const RATE_LIMIT_MAX_ENTRIES = 10_000; // Max unique IPs tracked before forced eviction
const VERIFY_TIMEOUT_MS = 30_000;
const SETTLE_TIMEOUT_MS = 90_000;
const TRUST_CF_HEADER = process.env.TRUST_CF_HEADER === "true";
const FACILITATOR_API_KEY = process.env.FACILITATOR_API_KEY || "";

// Validate FACILITATOR_URL at startup
try {
  const parsed = new URL(FACILITATOR_URL);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Invalid protocol: ${parsed.protocol}`);
  }
} catch (err) {
  log("error", "Invalid FACILITATOR_URL", { url: FACILITATOR_URL, error: err.message });
  process.exit(1);
}

// Compress responses
app.use(compression());

// Body parser with explicit size limit
app.use(express.json({ limit: "50kb" }));

// Security headers + request ID
app.disable("x-powered-by");
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.set("X-Request-Id", requestId);
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
  const ip = TRUST_CF_HEADER ? (req.headers["cf-connecting-ip"] || req.ip) : req.ip;
  const now = Date.now();
  let entry = limits.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    // Prevent unbounded Map growth under IP-spray attacks
    if (!entry && limits.size >= RATE_LIMIT_MAX_ENTRIES) {
      const oldest = limits.keys().next().value;
      limits.delete(oldest);
    }
    entry = { count: 0, start: now };
    limits.set(ip, entry);
  }
  entry.count++;
  res.set("X-RateLimit-Limit", String(RATE_LIMIT));
  res.set("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT - entry.count)));
  if (entry.count > RATE_LIMIT) {
    metrics.rateLimitHits++;
    return res.status(429).json({ error: "Rate limit exceeded", sandbox: true });
  }
  next();
});

// CORS
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Request-Id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Validate Content-Type for POST requests
app.use((req, res, next) => {
  if (req.method === "POST" && !req.is("application/json")) {
    return res.status(415).json({ error: "Content-Type must be application/json", sandbox: true });
  }
  next();
});

// Access logging for POST endpoints
app.use((req, res, next) => {
  if (req.method === "POST") {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log("info", `${req.method} ${req.path}`, {
        status: res.statusCode,
        duration,
        ip: TRUST_CF_HEADER ? (req.headers["cf-connecting-ip"] || req.ip) : req.ip,
        requestId: req.requestId,
      });
      metrics.requestsTotal.set(req.path, (metrics.requestsTotal.get(req.path) || 0) + 1);
      metrics.requestDuration.push({ endpoint: req.path, duration, timestamp: Date.now() });
    });
  }
  next();
});

// --- Supported testnet networks ---
const SUPPORTED_NETWORKS = [
  "eip155:84532",        // Base Sepolia
  "eip155:11155111",     // Ethereum Sepolia
  "eip155:421614",       // Arbitrum Sepolia
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet
  "ton:testnet",         // TON Testnet
  "tron:0x94a9059e",     // TRON Nile
  "stellar:testnet",     // Stellar Testnet
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

// --- Metrics ---
const metrics = {
  requestsTotal: new Map(),    // label: endpoint -> count
  requestDuration: [],         // { endpoint, duration, timestamp }
  errorsTotal: 0,
  upstreamLatency: [],         // { duration, timestamp }
  rateLimitHits: 0,
};

const METRICS_RETENTION_MS = 300_000; // Keep 5 minutes of histogram data

// --- Upstream health state ---
let upstreamHealthy = null; // null = unknown, true/false after first check

async function checkUpstream() {
  const prev = upstreamHealthy;
  try {
    const res = await fetch(`${FACILITATOR_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    upstreamHealthy = res.ok;
  } catch (err) {
    upstreamHealthy = false;
    if (prev !== false) {
      log("warn", "Upstream became unreachable", { error: err.message, facilitatorUrl: FACILITATOR_URL });
    }
  }
  if (prev === false && upstreamHealthy === true) {
    log("info", "Upstream recovered", { facilitatorUrl: FACILITATOR_URL });
  }
}

// Detect if running as main entry point (not imported by tests)
const _isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];

// Periodic upstream check (every 30s)
let healthTimer;
if (_isMain) {
  if (!FACILITATOR_API_KEY) {
    log("warn", "No FACILITATOR_API_KEY set — upstream /verify and /settle will return 401");
  }
  checkUpstream();
  healthTimer = setInterval(checkUpstream, 30_000);
  healthTimer.unref();
}

// --- Helper: proxy to facilitator ---
async function proxyToFacilitator(path, body, timeoutMs) {
  const start = Date.now();
  const headers = { "Content-Type": "application/json" };
  if (FACILITATOR_API_KEY) {
    headers["X-API-Key"] = FACILITATOR_API_KEY;
  }
  const res = await fetch(`${FACILITATOR_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const duration = Date.now() - start;
  metrics.upstreamLatency.push({ duration, timestamp: Date.now() });
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

app.get("/ready", (_req, res) => {
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
      "ton:*": [],
      "tron:*": [],
      "stellar:*": [],
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
      { network: "ton:testnet", name: "TON Testnet", tokens: [
        { symbol: "TON (gas)", url: "https://t.me/testgiver_ton_bot" },
      ]},
      { network: "tron:0x94a9059e", name: "TRON Nile", tokens: [
        { symbol: "TRX (gas)", url: "https://nileex.io/join/getJoinPage" },
      ]},
      { network: "stellar:testnet", name: "Stellar Testnet", tokens: [
        { symbol: "XLM (gas)", url: "https://friendbot.stellar.org" },
      ]},
    ],
    sandbox: true,
  });
});

app.get("/examples", (_req, res) => {
  totalRequests++;
  res.json({
    verify: {
      request: {
        method: "POST",
        url: "https://sandbox.t402.io/verify",
        headers: { "Content-Type": "application/json" },
        body: {
          paymentPayload: {
            signature: "0xabc123...",
            authorization: { payer: "0xYourWalletAddress" },
          },
          paymentRequirements: {
            scheme: "exact",
            network: "eip155:84532",
            maxAmountRequired: "1000000",
            resource: "https://example.com/api/data",
            payee: "0xRecipientAddress",
          },
        },
      },
      response: { isValid: true, payer: "0xYourWalletAddress" },
    },
    settle: {
      request: {
        method: "POST",
        url: "https://sandbox.t402.io/settle",
        headers: { "Content-Type": "application/json" },
        body: {
          paymentPayload: {
            signature: "0xabc123...",
            authorization: { payer: "0xYourWalletAddress" },
          },
          paymentRequirements: {
            scheme: "exact",
            network: "eip155:84532",
            maxAmountRequired: "1000000",
            resource: "https://example.com/api/data",
            payee: "0xRecipientAddress",
          },
        },
      },
      response: {
        success: true,
        transaction: "0x...",
        network: "eip155:84532",
        payer: "0xYourWalletAddress",
      },
    },
    curl: {
      supported: "curl -s https://sandbox.t402.io/supported | jq",
      faucets: "curl -s https://sandbox.t402.io/faucets | jq",
      verify: 'curl -s -X POST https://sandbox.t402.io/verify -H "Content-Type: application/json" -d \'{"paymentPayload":{},"paymentRequirements":{"network":"eip155:84532"}}\'',
    },
    sandbox: true,
  });
});

function validateNetwork(network) {
  if (!network || typeof network !== "string") {
    return "Missing or invalid paymentRequirements.network";
  }
  if (!SUPPORTED_NETWORKS.includes(network)) {
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
    if (result.status >= 500) {
      throw new Error(`Upstream returned ${result.status}`);
    }
    res.status(result.status).json(result.data);
  } catch (err) {
    upstreamErrors++;
    log("error", "/verify upstream error", { error: err.message });
    res.status(503).json({
      isValid: false,
      invalidReason: "Upstream facilitator unreachable — mock mode active. Responses are simulated, not verified on-chain.",
      sandbox: true,
      mock: true,
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
    if (result.status >= 500) {
      throw new Error(`Upstream returned ${result.status}`);
    }
    res.status(result.status).json(result.data);
  } catch (err) {
    upstreamErrors++;
    log("error", "/settle upstream error", { error: err.message });
    res.status(503).json({
      success: false,
      errorReason: "Upstream facilitator unreachable — mock mode active. No on-chain settlement occurred.",
      sandbox: true,
      mock: true,
    });
  }
});

app.get("/usage", (_req, res) => {
  res.json({ totalRequests, upstreamErrors, rateLimit: RATE_LIMIT, upstreamHealthy });
});

app.get("/metrics", (_req, res) => {
  const now = Date.now();
  // Prune old histogram data
  const cutoff = now - METRICS_RETENTION_MS;
  metrics.requestDuration = metrics.requestDuration.filter(m => m.timestamp > cutoff);
  metrics.upstreamLatency = metrics.upstreamLatency.filter(m => m.timestamp > cutoff);

  const lines = [
    "# HELP sandbox_requests_total Total requests by endpoint",
    "# TYPE sandbox_requests_total counter",
  ];

  for (const [endpoint, count] of metrics.requestsTotal) {
    lines.push(`sandbox_requests_total{endpoint="${endpoint}"} ${count}`);
  }

  lines.push(
    "# HELP sandbox_upstream_errors_total Total upstream errors",
    "# TYPE sandbox_upstream_errors_total counter",
    `sandbox_upstream_errors_total ${upstreamErrors}`,
    "# HELP sandbox_upstream_healthy Whether upstream facilitator is reachable",
    "# TYPE sandbox_upstream_healthy gauge",
    `sandbox_upstream_healthy ${upstreamHealthy === true ? 1 : 0}`,
    "# HELP sandbox_rate_limit_hits_total Rate limit rejections",
    "# TYPE sandbox_rate_limit_hits_total counter",
    `sandbox_rate_limit_hits_total ${metrics.rateLimitHits}`,
    "# HELP sandbox_active_rate_limit_entries Number of tracked IPs",
    "# TYPE sandbox_active_rate_limit_entries gauge",
    `sandbox_active_rate_limit_entries ${limits.size}`,
  );

  // Request duration histogram (5min window)
  if (metrics.requestDuration.length > 0) {
    const buckets = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    lines.push(
      "# HELP sandbox_request_duration_seconds Request duration histogram",
      "# TYPE sandbox_request_duration_seconds histogram",
    );
    let sum = 0;
    for (const b of buckets) {
      const count = metrics.requestDuration.filter(m => m.duration / 1000 <= b).length;
      lines.push(`sandbox_request_duration_seconds_bucket{le="${b}"} ${count}`);
    }
    lines.push(`sandbox_request_duration_seconds_bucket{le="+Inf"} ${metrics.requestDuration.length}`);
    for (const m of metrics.requestDuration) sum += m.duration / 1000;
    lines.push(`sandbox_request_duration_seconds_sum ${sum.toFixed(6)}`);
    lines.push(`sandbox_request_duration_seconds_count ${metrics.requestDuration.length}`);
  }

  // Upstream latency histogram
  if (metrics.upstreamLatency.length > 0) {
    const buckets = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 90];
    lines.push(
      "# HELP sandbox_upstream_latency_seconds Upstream facilitator latency histogram",
      "# TYPE sandbox_upstream_latency_seconds histogram",
    );
    let sum = 0;
    for (const b of buckets) {
      const count = metrics.upstreamLatency.filter(m => m.duration / 1000 <= b).length;
      lines.push(`sandbox_upstream_latency_seconds_bucket{le="${b}"} ${count}`);
    }
    lines.push(`sandbox_upstream_latency_seconds_bucket{le="+Inf"} ${metrics.upstreamLatency.length}`);
    for (const m of metrics.upstreamLatency) sum += m.duration / 1000;
    lines.push(`sandbox_upstream_latency_seconds_sum ${sum.toFixed(6)}`);
    lines.push(`sandbox_upstream_latency_seconds_count ${metrics.upstreamLatency.length}`);
  }

  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n") + "\n");
});

// Playground page
app.get("/playground", (_req, res) => {
  totalRequests++;
  res.set("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'");
  res.type("html").send(playgroundHtml);
});

// Landing page
app.get("/", (_req, res) => {
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
  res.type("html").send(`<!DOCTYPE html>
<html><head><title>T402 Sandbox</title>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui;background:#0a0a0b;color:#e5e7eb;max-width:720px;margin:0 auto;padding:2rem}
h1{color:#50AF95;font-size:1.6rem}
h2{color:#d1d5db;font-size:1.1rem;margin-top:2rem}
a{color:#50AF95}
code{background:#1f2937;padding:.15em .4em;border-radius:4px;font-size:.85em}
pre{background:#1f2937;padding:1rem;border-radius:8px;overflow-x:auto;font-size:.85em;line-height:1.5}
.badge{display:inline-block;background:#065f46;color:#6ee7b7;padding:.2em .6em;border-radius:4px;font-size:.75rem;margin-left:.5rem}
table{width:100%;border-collapse:collapse;margin:1rem 0}
th{text-align:left;padding:.5rem;color:#9ca3af;font-size:.8rem;border-bottom:1px solid #1f2937}
td{padding:.5rem;border-bottom:1px solid #111827;font-size:.9em}
.tab-bar{display:flex;gap:0;margin-bottom:0}
.tab{padding:.4rem .8rem;background:#1f2937;color:#9ca3af;cursor:pointer;font-size:.8rem;border:1px solid #374151;border-bottom:none}
.tab:first-child{border-radius:6px 0 0 0}
.tab:last-child{border-radius:0 6px 0 0}
.tab.active{background:#111827;color:#50AF95}
.tab-content{display:none}
.tab-content.active{display:block}
.note{background:#1c1917;border-left:3px solid #f59e0b;padding:.75rem 1rem;margin:1rem 0;font-size:.85em;color:#fbbf24}
</style></head>
<body>
<h1>T402 Sandbox<span class="badge">TESTNET</span></h1>
<p>Public testnet facilitator for developer testing. No API key needed. No real funds.</p>

<h2>Quick Start</h2>
<div class="tab-bar">
  <div class="tab active" onclick="showTab('ts')">TypeScript</div>
  <div class="tab" onclick="showTab('go')">Go</div>
  <div class="tab" onclick="showTab('py')">Python</div>
  <div class="tab" onclick="showTab('java')">Java</div>
  <div class="tab" onclick="showTab('curl')">curl</div>
</div>
<pre id="tab-ts" class="tab-content active"><code>import { HTTPFacilitatorClient } from "@t402/http";

const client = new HTTPFacilitatorClient({
  url: "https://sandbox.t402.io"
});</code></pre>
<pre id="tab-go" class="tab-content"><code>import "github.com/t402-io/t402/sdks/go/http"

client := http.NewFacilitatorClient("https://sandbox.t402.io")</code></pre>
<pre id="tab-py" class="tab-content"><code>from t402 import FacilitatorClient

client = FacilitatorClient("https://sandbox.t402.io")</code></pre>
<pre id="tab-java" class="tab-content"><code># application.yml
t402:
  facilitator-url: https://sandbox.t402.io</code></pre>
<pre id="tab-curl" class="tab-content"><code># Check supported networks
curl -s https://sandbox.t402.io/supported | jq

# Get faucet links
curl -s https://sandbox.t402.io/faucets | jq

# Verify a payment
curl -s -X POST https://sandbox.t402.io/verify \\
  -H "Content-Type: application/json" \\
  -d '{"paymentPayload":{},"paymentRequirements":{"network":"eip155:84532"}}'</code></pre>

<h2>Supported Networks</h2>
<table>
<tr><th>Network</th><th>CAIP-2</th><th>Token</th></tr>
<tr><td>Base Sepolia</td><td><code>eip155:84532</code></td><td>USDC</td></tr>
<tr><td>Ethereum Sepolia</td><td><code>eip155:11155111</code></td><td>USDC</td></tr>
<tr><td>Arbitrum Sepolia</td><td><code>eip155:421614</code></td><td>USDC</td></tr>
<tr><td>Solana Devnet</td><td><code>solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1</code></td><td>USDC</td></tr>
<tr><td>TON Testnet</td><td><code>ton:testnet</code></td><td>USDT</td></tr>
<tr><td>TRON Nile</td><td><code>tron:0x94a9059e</code></td><td>USDT</td></tr>
<tr><td>Stellar Testnet</td><td><code>stellar:testnet</code></td><td>USDC</td></tr>
</table>

<h2>Endpoints</h2>
<table>
<tr><th>Method</th><th>Path</th><th>Description</th></tr>
<tr><td>GET</td><td><a href="/health">/health</a></td><td>Health check</td></tr>
<tr><td>GET</td><td><a href="/ready">/ready</a></td><td>Readiness (upstream status)</td></tr>
<tr><td>GET</td><td><a href="/supported">/supported</a></td><td>Supported testnet kinds</td></tr>
<tr><td>GET</td><td><a href="/faucets">/faucets</a></td><td>Testnet token faucets</td></tr>
<tr><td>GET</td><td><a href="/examples">/examples</a></td><td>Sample request/response payloads</td></tr>
<tr><td>GET</td><td><a href="/usage">/usage</a></td><td>Usage statistics</td></tr>
<tr><td>POST</td><td>/verify</td><td>Verify payment</td></tr>
<tr><td>POST</td><td>/settle</td><td>Settle payment</td></tr>
<tr><td>GET</td><td><a href="/playground">/playground</a></td><td>Interactive API playground</td></tr>
</table>

<h2>Rate Limits</h2>
<p>100 requests/minute per IP. Headers: <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>.</p>

<div class="note">When the upstream facilitator is unreachable, the sandbox returns error responses with <code>"mock": true</code>. Connect a testnet facilitator for real on-chain verification.</div>

<p style="color:#6b7280;margin-top:2rem;font-size:.85rem">
  <a href="/playground">Playground</a> · <a href="https://docs.t402.io">Docs</a> · <a href="https://github.com/t402-io/t402">GitHub</a> · Powered by <a href="https://t402.io">T402</a>
</p>
<script>
function showTab(id){
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  event.target.classList.add('active');
}
</script>
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
  clearInterval(evictionTimer);
  if (healthTimer) clearInterval(healthTimer);
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
