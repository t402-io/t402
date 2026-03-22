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
const landingHtml = readFileSync(join(__dirname, "landing.html"), "utf8");
const openapiSpec = readFileSync(join(__dirname, "openapi.yaml"), "utf8");

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
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Request-Id, X-Sandbox-Session");
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

// Record request/response in history for tracked sessions
app.use((req, res, next) => {
  const sessionId = req.headers["x-sandbox-session"];
  if (sessionId && typeof sessionId === "string" && sessionId.length <= 64) {
    const start = Date.now();

    // Capture response body
    const originalJson = res.json.bind(res);
    let responseBody;
    res.json = (body) => {
      responseBody = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      let session = requestHistory.get(sessionId);
      if (!session) {
        // Enforce max sessions
        if (requestHistory.size >= MAX_SESSIONS) {
          // Evict oldest session
          const oldest = requestHistory.keys().next().value;
          requestHistory.delete(oldest);
        }
        session = { entries: [], lastAccess: Date.now() };
        requestHistory.set(sessionId, session);
      }
      session.lastAccess = Date.now();

      const entry = {
        id: req.requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
        requestBody: req.method === "POST" ? req.body : undefined,
        responseBody: responseBody,
        headers: {
          "x-request-id": req.requestId,
          "x-ratelimit-remaining": res.getHeader("x-ratelimit-remaining"),
        },
      };

      session.entries.push(entry);
      // Trim to max
      if (session.entries.length > MAX_HISTORY_PER_SESSION) {
        session.entries.shift();
      }
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
  "tron:nile",     // TRON Nile
  "stellar:testnet",     // Stellar Testnet
];

// --- Magic test addresses for payment simulation ---
// These addresses trigger deterministic responses without hitting upstream.
// Like Stripe's test card numbers (4242...).
const MAGIC_ADDRESSES = {
  // Always verify as valid
  VERIFY_SUCCESS: "0x0000000000000000000000000000000000CAFE01",
  // Always verify as invalid (bad signature)
  VERIFY_FAIL_SIGNATURE: "0x0000000000000000000000000000000000CAFE02",
  // Always verify as invalid (expired)
  VERIFY_FAIL_EXPIRED: "0x0000000000000000000000000000000000CAFE03",
  // Always settle successfully
  SETTLE_SUCCESS: "0x0000000000000000000000000000000000CAFE11",
  // Always settle with failure (insufficient funds)
  SETTLE_FAIL_FUNDS: "0x0000000000000000000000000000000000CAFE12",
  // Always settle with failure (timeout)
  SETTLE_FAIL_TIMEOUT: "0x0000000000000000000000000000000000CAFE13",
  // Simulate slow response (2 second delay)
  SLOW_RESPONSE: "0x0000000000000000000000000000000000CAFE99",
};

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

// --- Request history (per-session, in-memory) ---
const MAX_HISTORY_PER_SESSION = 50;
const MAX_SESSIONS = 1000;
const SESSION_TTL_MS = 3_600_000; // 1 hour
const requestHistory = new Map(); // sessionId -> { entries: [], lastAccess: Date.now() }

// Evict expired sessions every 5 minutes
const historyEvictionTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of requestHistory) {
    if (now - session.lastAccess > SESSION_TTL_MS) {
      requestHistory.delete(id);
    }
  }
}, 300_000);
historyEvictionTimer.unref();

// --- Upstream health state ---
let upstreamHealthy = null; // null = unknown, true/false after first check
let upstreamNetworks = [];  // networks the upstream facilitator actually supports

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
  // Refresh upstream supported networks periodically
  if (upstreamHealthy) {
    try {
      const sRes = await fetch(`${FACILITATOR_URL}/supported`, { signal: AbortSignal.timeout(5000) });
      if (sRes.ok) {
        const data = await sRes.json();
        upstreamNetworks = (data.kinds || []).map(k => k.network);
      }
    } catch { /* non-critical */ }
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
    const liveCount = SUPPORTED_NETWORKS.filter(n => upstreamNetworks.includes(n)).length;
    res.json({ ready: true, upstream: "connected", service: "t402-sandbox", liveNetworks: liveCount, totalNetworks: SUPPORTED_NETWORKS.length });
  } else {
    res.status(503).json({ ready: false, upstream: "unreachable", service: "t402-sandbox", note: "Mock fallback active" });
  }
});

app.get("/supported", (_req, res) => {
  totalRequests++;
  const kinds = SUPPORTED_KINDS.map(k => ({
    ...k,
    upstream: upstreamNetworks.includes(k.network),
  }));
  res.json({
    kinds,
    extensions: ["erc8004"],
    signers: {
      "eip155:*": ["0x0000000000000000000000000000000000000000"],
      "solana:*": [],
      "ton:*": [],
      "tron:*": [],
      "stellar:*": [],
    },
    sandbox: true,
    upstreamHealthy: upstreamHealthy === true,
    hint: "Testnet only — networks with upstream:true have real on-chain verification. Others use mock fallback.",
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
      { network: "tron:nile", name: "TRON Nile", tokens: [
        { symbol: "TRX (gas)", url: "https://nileex.io/join/getJoinPage" },
      ]},
      { network: "stellar:testnet", name: "Stellar Testnet", tokens: [
        { symbol: "XLM (gas)", url: "https://friendbot.stellar.org" },
      ]},
    ],
    sandbox: true,
  });
});

app.get("/test-addresses", (_req, res) => {
  totalRequests++;
  res.json({
    testAddresses: {
      verifySuccess: {
        address: MAGIC_ADDRESSES.VERIFY_SUCCESS,
        description: "Always passes verification",
        verify: "isValid: true",
        settle: "success: true",
      },
      verifyFailSignature: {
        address: MAGIC_ADDRESSES.VERIFY_FAIL_SIGNATURE,
        description: "Fails verification with invalid_signature",
        verify: "isValid: false, invalidReason: 'invalid_signature'",
        settle: "success: true (verify-only failure)",
      },
      verifyFailExpired: {
        address: MAGIC_ADDRESSES.VERIFY_FAIL_EXPIRED,
        description: "Fails verification with authorization_expired",
        verify: "isValid: false, invalidReason: 'authorization_expired'",
        settle: "success: true (verify-only failure)",
      },
      settleSuccess: {
        address: MAGIC_ADDRESSES.SETTLE_SUCCESS,
        description: "Always settles successfully",
        verify: "isValid: true",
        settle: "success: true",
      },
      settleFailFunds: {
        address: MAGIC_ADDRESSES.SETTLE_FAIL_FUNDS,
        description: "Fails settlement with insufficient_funds",
        verify: "isValid: true",
        settle: "success: false, errorReason: 'insufficient_funds'",
      },
      settleFailTimeout: {
        address: MAGIC_ADDRESSES.SETTLE_FAIL_TIMEOUT,
        description: "Fails settlement with settlement_timeout",
        verify: "isValid: true",
        settle: "success: false, errorReason: 'settlement_timeout'",
      },
      slowResponse: {
        address: MAGIC_ADDRESSES.SLOW_RESPONSE,
        description: "Adds 2-second delay to response (for timeout testing)",
        verify: "isValid: true (after 2s delay)",
        settle: "success: true (after 2s delay)",
      },
    },
    usage: "Include any test address as the 'payer' field in paymentPayload.payload.payer, paymentPayload.authorization.payer, or paymentPayload.payer",
    sandbox: true,
  });
});

app.get("/examples", (_req, res) => {
  totalRequests++;

  // Example PaymentRequirements matching SDK PaymentRequirements type
  const exampleRequirements = {
    scheme: "exact",
    network: "eip155:84532",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    amount: "1000000",
    payTo: "0xRecipientAddress",
    maxTimeoutSeconds: 300,
    extra: {},
  };

  // Example PaymentPayload matching SDK PaymentPayload type
  const examplePayload = {
    t402Version: 2,
    accepted: exampleRequirements,
    payload: {
      payer: MAGIC_ADDRESSES.VERIFY_SUCCESS,
      signature: "0xabc123...",
    },
  };

  // Example verify/settle request body (matches SDK VerifyRequest/SettleRequest)
  const exampleVerifyBody = {
    paymentPayload: examplePayload,
    paymentRequirements: exampleRequirements,
  };

  res.json({
    note: "All examples use magic test addresses (0x...CAFE01) for deterministic responses. See GET /test-addresses for the full list.",
    verify: {
      request: {
        method: "POST",
        url: "https://sandbox.t402.io/verify",
        headers: { "Content-Type": "application/json" },
        body: exampleVerifyBody,
      },
      response: { isValid: true, payer: MAGIC_ADDRESSES.VERIFY_SUCCESS, sandbox: true, mock: true },
    },
    settle: {
      request: {
        method: "POST",
        url: "https://sandbox.t402.io/settle",
        headers: { "Content-Type": "application/json" },
        body: exampleVerifyBody,
      },
      response: {
        success: true,
        transaction: "0x" + "a".repeat(64),
        network: "eip155:84532",
        payer: MAGIC_ADDRESSES.VERIFY_SUCCESS,
        confirmations: "confirmed",
        sandbox: true,
        mock: true,
      },
    },
    webhook: {
      request: {
        method: "POST",
        url: "https://sandbox.t402.io/webhook/test",
        headers: { "Content-Type": "application/json" },
        body: {
          url: "https://your-server.com/webhook",
          event: "settlement.completed",
        },
      },
      response: {
        delivered: true,
        callbackId: "uuid",
        event: "settlement.completed",
        targetUrl: "https://your-server.com/webhook",
        targetStatus: 200,
        signatureSecret: "sandbox-webhook-test-secret",
      },
      events: ["verification.completed", "verification.failed", "settlement.completed", "settlement.failed"],
    },
    testAddresses: {
      description: "Magic test addresses simulate deterministic verify/settle outcomes without real tokens (like Stripe's test card numbers)",
      example: {
        method: "POST",
        url: "https://sandbox.t402.io/verify",
        headers: { "Content-Type": "application/json" },
        body: exampleVerifyBody,
      },
      addresses: MAGIC_ADDRESSES,
      listEndpoint: "GET /test-addresses",
    },
    curl: {
      supported: "curl -s https://sandbox.t402.io/supported | jq",
      faucets: "curl -s https://sandbox.t402.io/faucets | jq",
      testAddresses: "curl -s https://sandbox.t402.io/test-addresses | jq",
      verify: `curl -s -X POST https://sandbox.t402.io/verify -H "Content-Type: application/json" -d '${JSON.stringify(exampleVerifyBody)}'`,
    },
    openapi: "GET /openapi.yaml",
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

  // Check for magic test addresses
  const payer = req.body?.paymentPayload?.payload?.payer
    || req.body?.paymentPayload?.authorization?.payer
    || req.body?.paymentPayload?.payer;
  const upperPayer = payer?.toUpperCase?.();

  const magicMatch = (addr) => Object.entries(MAGIC_ADDRESSES).find(([, v]) => v.toUpperCase() === addr)?.[0];
  const magicKey = upperPayer ? magicMatch(upperPayer) : null;
  if (magicKey) {
    // Simulate latency for SLOW_RESPONSE
    if (magicKey === "SLOW_RESPONSE") {
      await new Promise(r => setTimeout(r, 2000));
    }

    if (magicKey === "VERIFY_SUCCESS" || magicKey === "SETTLE_SUCCESS") {
      return res.json({
        isValid: true,
        payer: payer,
        sandbox: true,
        mock: true,
        note: "Magic test address — simulated successful verification",
      });
    }
    if (magicKey === "VERIFY_FAIL_SIGNATURE") {
      return res.json({
        isValid: false,
        invalidReason: "invalid_signature",
        payer: payer,
        sandbox: true,
        mock: true,
        note: "Magic test address — simulated signature verification failure",
      });
    }
    if (magicKey === "VERIFY_FAIL_EXPIRED") {
      return res.json({
        isValid: false,
        invalidReason: "authorization_expired",
        payer: payer,
        sandbox: true,
        mock: true,
        note: "Magic test address — simulated expired authorization",
      });
    }
    // For settle-specific addresses, verify still succeeds (you'd verify before settling)
    if (magicKey === "SETTLE_FAIL_FUNDS" || magicKey === "SETTLE_FAIL_TIMEOUT") {
      return res.json({
        isValid: true,
        payer: payer,
        sandbox: true,
        mock: true,
        note: "Magic test address — verification passed (settle will fail with this address)",
      });
    }
    if (magicKey === "SLOW_RESPONSE") {
      return res.json({
        isValid: true,
        payer: payer,
        sandbox: true,
        mock: true,
        note: "Magic test address — simulated slow response (2s delay)",
      });
    }
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

  // Check for magic test addresses
  const settlerPayer = req.body?.paymentPayload?.payload?.payer
    || req.body?.paymentPayload?.authorization?.payer
    || req.body?.paymentPayload?.payer;
  const upperSettlePayer = settlerPayer?.toUpperCase?.();

  const settleMagicMatch = (addr) => Object.entries(MAGIC_ADDRESSES).find(([, v]) => v.toUpperCase() === addr)?.[0];
  const settleMagicKey = upperSettlePayer ? settleMagicMatch(upperSettlePayer) : null;
  if (settleMagicKey) {
    if (settleMagicKey === "SLOW_RESPONSE") {
      await new Promise(r => setTimeout(r, 2000));
    }

    const mockNetwork = network || "eip155:84532";
    const mockTxHash = "0x" + randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");

    if (settleMagicKey === "VERIFY_SUCCESS"
      || settleMagicKey === "SETTLE_SUCCESS"
      || settleMagicKey === "SLOW_RESPONSE") {
      return res.json({
        success: true,
        payer: settlerPayer,
        transaction: mockTxHash,
        network: mockNetwork,
        confirmations: "confirmed",
        sandbox: true,
        mock: true,
        note: "Magic test address — simulated successful settlement",
      });
    }
    if (settleMagicKey === "SETTLE_FAIL_FUNDS") {
      return res.json({
        success: false,
        errorReason: "insufficient_funds",
        payer: settlerPayer,
        network: mockNetwork,
        sandbox: true,
        mock: true,
        note: "Magic test address — simulated insufficient funds",
      });
    }
    if (settleMagicKey === "SETTLE_FAIL_TIMEOUT") {
      return res.json({
        success: false,
        errorReason: "settlement_timeout",
        payer: settlerPayer,
        network: mockNetwork,
        sandbox: true,
        mock: true,
        note: "Magic test address — simulated settlement timeout",
      });
    }
    // verify-specific fail addresses still settle (weird case, but handle gracefully)
    if (settleMagicKey === "VERIFY_FAIL_SIGNATURE"
      || settleMagicKey === "VERIFY_FAIL_EXPIRED") {
      return res.json({
        success: true,
        payer: settlerPayer,
        transaction: mockTxHash,
        network: mockNetwork,
        confirmations: "confirmed",
        sandbox: true,
        mock: true,
        note: "Magic test address — settlement succeeds (this address only fails verify)",
      });
    }
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
      payer: "0x0000000000000000000000000000000000000000",
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

// Webhook test endpoint
app.post("/webhook/test", async (req, res) => {
  totalRequests++;
  const { url, event } = req.body || {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing 'url' — provide the webhook URL to test", sandbox: true });
  }

  // Validate URL format and require HTTPS (except localhost for dev)
  try {
    const parsed = new URL(url);
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (!isLocalhost && parsed.protocol !== "https:") {
      return res.status(400).json({ error: "Webhook URL must use HTTPS (localhost exempt for development)", sandbox: true });
    }
  } catch {
    return res.status(400).json({ error: "Invalid webhook URL format", sandbox: true });
  }

  const eventType = event || "verification.completed";
  const validEvents = ["verification.completed", "verification.failed", "settlement.completed", "settlement.failed"];
  if (!validEvents.includes(eventType)) {
    return res.status(400).json({
      error: `Invalid event type. Valid types: ${validEvents.join(", ")}`,
      sandbox: true,
    });
  }

  // Generate sample callback payload matching T402 webhook spec
  const timestamp = new Date().toISOString();
  const callbackId = randomUUID();
  const isSuccess = eventType.endsWith(".completed");
  const isVerify = eventType.startsWith("verification");

  const payload = {
    id: callbackId,
    event: eventType,
    timestamp,
    sandbox: true,
    data: isVerify
      ? {
          isValid: isSuccess,
          payer: "0x0000000000000000000000000000000000C0FFEE",
          network: "eip155:84532",
          ...(isSuccess ? {} : { invalidReason: "Simulated verification failure for testing" }),
        }
      : {
          success: isSuccess,
          transaction: isSuccess ? "0x" + "a".repeat(64) : undefined,
          network: "eip155:84532",
          payer: "0x0000000000000000000000000000000000C0FFEE",
          ...(isSuccess ? {} : { errorReason: "Simulated settlement failure for testing" }),
        },
  };

  // Compute HMAC signature (using a test secret)
  const { createHmac } = await import("node:crypto");
  const secret = "sandbox-webhook-test-secret";
  const signature = createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");

  try {
    const callbackRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-T402-Signature": `sha256=${signature}`,
        "X-T402-Event": eventType,
        "X-T402-Delivery": callbackId,
        "User-Agent": "T402-Sandbox-Webhook/1.0",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    res.json({
      delivered: true,
      callbackId,
      event: eventType,
      targetUrl: url,
      targetStatus: callbackRes.status,
      signatureSecret: secret,
      signatureHeader: "X-T402-Signature",
      sandbox: true,
      note: `Verify signature with: HMAC-SHA256(body, "${secret}")`,
    });
  } catch (err) {
    res.status(502).json({
      delivered: false,
      callbackId,
      event: eventType,
      targetUrl: url,
      error: err.message,
      sandbox: true,
    });
  }
});

// Request history viewer
app.get("/history", (req, res) => {
  const sessionId = req.headers["x-sandbox-session"] || req.query.session;
  if (!sessionId) {
    return res.status(400).json({
      error: "Provide X-Sandbox-Session header or ?session= query parameter",
      usage: "Include 'X-Sandbox-Session: <your-uuid>' header in all requests, then GET /history to see them",
      sandbox: true,
    });
  }
  const session = requestHistory.get(sessionId);
  if (!session) {
    return res.json({
      session: sessionId,
      entries: [],
      note: "No history found. Include 'X-Sandbox-Session: " + sessionId + "' header in your requests to start tracking.",
      sandbox: true,
    });
  }
  session.lastAccess = Date.now();
  res.json({
    session: sessionId,
    count: session.entries.length,
    maxEntries: MAX_HISTORY_PER_SESSION,
    ttlMinutes: Math.round(SESSION_TTL_MS / 60000),
    entries: session.entries,
    sandbox: true,
  });
});

// OpenAPI spec
app.get("/openapi.yaml", (_req, res) => {
  res.type("text/yaml").send(openapiSpec);
});

app.get("/openapi.json", (_req, res) => {
  res.redirect("/openapi.yaml");
});

// Error catalog
app.get("/errors", (_req, res) => {
  totalRequests++;
  res.json({
    errors: [
      {
        status: 400,
        code: "missing_network",
        message: "Missing or invalid paymentRequirements.network",
        cause: "The request body is missing the paymentRequirements.network field, or it's not a string",
        fix: "Include a valid testnet network from /supported in your request body",
        example: { paymentRequirements: { network: "eip155:84532" } },
      },
      {
        status: 400,
        code: "unsupported_network",
        message: `Sandbox only supports testnets: ${SUPPORTED_NETWORKS.join(", ")}`,
        cause: "The network you specified is not a supported testnet",
        fix: "Use one of the networks listed at GET /supported. Mainnet networks are not allowed.",
      },
      {
        status: 400,
        code: "invalid_json",
        message: "Invalid JSON",
        cause: "The request body is not valid JSON",
        fix: "Ensure Content-Type is application/json and the body is valid JSON",
      },
      {
        status: 400,
        code: "missing_webhook_url",
        message: "Missing 'url' — provide the webhook URL to test",
        cause: "POST /webhook/test requires a 'url' field",
        fix: "Include { \"url\": \"https://your-server.com/webhook\" } in the body",
      },
      {
        status: 400,
        code: "invalid_webhook_url",
        message: "Webhook URL must use HTTPS",
        cause: "Non-localhost webhook URLs must use HTTPS for security",
        fix: "Use an HTTPS URL, or localhost/127.0.0.1 for development",
      },
      {
        status: 400,
        code: "invalid_event_type",
        message: "Invalid event type",
        cause: "The event field is not a recognized T402 webhook event",
        fix: "Use one of: verification.completed, verification.failed, settlement.completed, settlement.failed",
      },
      {
        status: 415,
        code: "wrong_content_type",
        message: "Content-Type must be application/json",
        cause: "POST requests must have Content-Type: application/json header",
        fix: "Add -H 'Content-Type: application/json' to your curl command",
      },
      {
        status: 429,
        code: "rate_limit_exceeded",
        message: "Rate limit exceeded",
        cause: "You've exceeded 100 requests/minute from your IP",
        fix: "Wait for the rate limit window to reset (1 minute). Check X-RateLimit-Remaining header.",
      },
      {
        status: 502,
        code: "webhook_delivery_failed",
        message: "Webhook delivery failed",
        cause: "The target webhook URL was unreachable or returned an error",
        fix: "Ensure your webhook server is running and accessible",
      },
      {
        status: 503,
        code: "upstream_unreachable",
        message: "Upstream facilitator unreachable — mock mode active",
        cause: "The sandbox cannot reach the upstream facilitator for real verification/settlement",
        fix: "Use magic test addresses (GET /test-addresses) for deterministic responses, or wait for upstream to recover (check GET /ready)",
      },
    ],
    sandbox: true,
  });
});

// Landing page
app.get("/", (_req, res) => {
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
  res.type("html").send(landingHtml);
});

// 404 handler — JSON response for unknown routes
app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    hint: "See GET / for available endpoints, or GET /openapi.yaml for the API spec",
    sandbox: true,
  });
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
  clearInterval(historyEvictionTimer);
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

export { app, startServer, SUPPORTED_NETWORKS, SUPPORTED_KINDS, MAGIC_ADDRESSES, requestHistory, MAX_HISTORY_PER_SESSION, MAX_SESSIONS, SESSION_TTL_MS };
