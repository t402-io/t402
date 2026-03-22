import { describe, it, before, after } from "node:test";
import assert from "node:assert";

// If BASE_URL is set, server is already running externally (CI mode)
// Otherwise, start our own server (local mode)
const EXTERNAL = !!process.env.BASE_URL;
const PORT = parseInt(process.env.PORT || "3406");
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;

let server;
let startServer;

before(async () => {
  if (!EXTERNAL) {
    const mod = await import("../src/proxy.js");
    startServer = mod.startServer;
    server = startServer();
  }
});

after(() => {
  server?.close();
});

// ─── Health & Readiness ───────────────────────────────────────────────────────

describe("Health & Readiness", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.service, "t402-sandbox");
    assert.strictEqual(data.mode, "testnet");
  });

  it("GET /ready returns 503 when upstream is unreachable", async () => {
    const res = await fetch(`${BASE}/ready`);
    // In test mode upstreamHealthy is null (never checked), which is falsy → 503
    assert.strictEqual(res.status, 503);
    const data = await res.json();
    assert.strictEqual(data.ready, false);
    assert.strictEqual(data.upstream, "unreachable");
    assert.strictEqual(data.service, "t402-sandbox");
    assert.ok(data.note, "Should include a note about mock fallback");
  });
});

// ─── GET /supported ───────────────────────────────────────────────────────────

describe("GET /supported", () => {
  it("returns SupportedResponse-shaped data", async () => {
    const res = await fetch(`${BASE}/supported`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    // kinds must be array of objects with t402Version, scheme, network
    assert.ok(Array.isArray(data.kinds));
    assert.ok(data.kinds.length > 0);
    for (const kind of data.kinds) {
      assert.strictEqual(typeof kind.t402Version, "number");
      assert.strictEqual(typeof kind.scheme, "string");
      assert.strictEqual(typeof kind.network, "string");
    }

    // extensions must be array of strings
    assert.ok(Array.isArray(data.extensions));

    // signers must be a record (object), not array
    assert.strictEqual(typeof data.signers, "object");
    assert.ok(!Array.isArray(data.signers));

    assert.strictEqual(data.sandbox, true);
  });

  it("only includes testnet networks", async () => {
    const res = await fetch(`${BASE}/supported`);
    const data = await res.json();
    const mainnets = ["eip155:1", "eip155:8453", "eip155:42161", "solana:mainnet"];
    for (const kind of data.kinds) {
      for (const m of mainnets) {
        assert.notStrictEqual(kind.network, m, `mainnet found: ${kind.network}`);
      }
    }
  });

  it("includes all 7 testnet networks", async () => {
    const res = await fetch(`${BASE}/supported`);
    const data = await res.json();
    assert.strictEqual(data.kinds.length, 7);
    const networks = data.kinds.map((k) => k.network);
    assert.ok(networks.includes("eip155:84532"), "Missing Base Sepolia");
    assert.ok(networks.includes("eip155:11155111"), "Missing Ethereum Sepolia");
    assert.ok(networks.includes("eip155:421614"), "Missing Arbitrum Sepolia");
    assert.ok(networks.includes("solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"), "Missing Solana Devnet");
    assert.ok(networks.includes("ton:testnet"), "Missing TON Testnet");
    assert.ok(networks.includes("tron:0x94a9059e"), "Missing TRON Nile");
    assert.ok(networks.includes("stellar:testnet"), "Missing Stellar Testnet");
  });

  it("includes signer families for all chain types", async () => {
    const res = await fetch(`${BASE}/supported`);
    const data = await res.json();
    assert.ok("eip155:*" in data.signers);
    assert.ok("solana:*" in data.signers);
    assert.ok("ton:*" in data.signers);
    assert.ok("tron:*" in data.signers);
    assert.ok("stellar:*" in data.signers);
  });
});

// ─── GET /faucets ─────────────────────────────────────────────────────────────

describe("GET /faucets", () => {
  it("returns faucet info for all supported networks", async () => {
    const res = await fetch(`${BASE}/faucets`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.faucets));
    for (const faucet of data.faucets) {
      assert.ok(faucet.network);
      assert.ok(faucet.name);
      assert.ok(Array.isArray(faucet.tokens));
      for (const token of faucet.tokens) {
        assert.ok(token.symbol);
        assert.ok(token.url);
      }
    }
  });

  it("returns faucet info for all 7 supported networks", async () => {
    const res = await fetch(`${BASE}/faucets`);
    const data = await res.json();
    assert.ok(data.faucets.length >= 7, `Expected at least 7 faucets, got ${data.faucets.length}`);
    const networks = data.faucets.map((f) => f.network);
    assert.ok(networks.includes("ton:testnet"), "Missing TON Testnet faucet");
    assert.ok(networks.includes("tron:0x94a9059e"), "Missing TRON Nile faucet");
    assert.ok(networks.includes("stellar:testnet"), "Missing Stellar Testnet faucet");
  });
});

// ─── GET /examples ────────────────────────────────────────────────────────────

describe("GET /examples", () => {
  it("returns example payloads", async () => {
    const res = await fetch(`${BASE}/examples`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.verify, "Missing verify section");
    assert.ok(data.verify.request, "Missing verify.request");
    assert.ok(data.verify.response, "Missing verify.response");
    assert.ok(data.settle, "Missing settle section");
    assert.ok(data.settle.request, "Missing settle.request");
    assert.ok(data.settle.response, "Missing settle.response");
    assert.ok(data.curl, "Missing curl section");
    assert.strictEqual(data.sandbox, true);
  });

  it("verify example includes correct fields", async () => {
    const res = await fetch(`${BASE}/examples`);
    const data = await res.json();
    assert.ok(data.verify.request.method);
    assert.ok(data.verify.request.url);
    assert.ok(data.verify.request.headers);
    assert.ok(data.verify.request.body.paymentPayload);
    assert.ok(data.verify.request.body.paymentRequirements);
  });

  it("curl examples include all endpoints", async () => {
    const res = await fetch(`${BASE}/examples`);
    const data = await res.json();
    assert.ok(data.curl.supported, "Missing curl.supported");
    assert.ok(data.curl.faucets, "Missing curl.faucets");
    assert.ok(data.curl.verify, "Missing curl.verify");
  });
});

// ─── POST /verify ─────────────────────────────────────────────────────────────

describe("POST /verify", () => {
  it("returns response for valid testnet network", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {},
        paymentRequirements: { network: "eip155:84532" },
      }),
    });
    const data = await res.json();
    // Should have isValid field (whether from upstream or mock)
    assert.ok("isValid" in data);
  });

  it("rejects mainnet networks", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {},
        paymentRequirements: { network: "eip155:1" },
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.isValid, false);
    assert.ok(data.invalidReason);
    assert.strictEqual(data.sandbox, true);
  });

  it("rejects unsupported testnet", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {},
        paymentRequirements: { network: "eip155:5" },
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  it("handles bad JSON gracefully", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid{json",
    });
    const data = await res.json();
    assert.ok(data.error);
    assert.ok(!data.stack, "Should not expose stack trace");
  });
});

// ─── POST /settle ─────────────────────────────────────────────────────────────

describe("POST /settle", () => {
  it("returns response for valid testnet network", async () => {
    const res = await fetch(`${BASE}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {},
        paymentRequirements: { network: "eip155:84532" },
      }),
    });
    const data = await res.json();
    assert.ok("success" in data);
    // Mock settle returns error (503) when upstream is unreachable
    if (data.mock) {
      assert.strictEqual(res.status, 503);
      assert.strictEqual(data.success, false);
      assert.ok(data.errorReason, "Mock settle must include errorReason");
    }
  });

  it("rejects mainnet networks", async () => {
    const res = await fetch(`${BASE}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {},
        paymentRequirements: { network: "eip155:8453" },
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.errorReason);
  });
});

// ─── Network validation ──────────────────────────────────────────────────────

describe("Network validation", () => {
  it("POST /verify rejects missing network", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload: {}, paymentRequirements: {} }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.isValid, false);
    assert.ok(data.invalidReason.includes("Missing"));
  });

  it("POST /verify rejects null network", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload: {}, paymentRequirements: { network: null } }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.isValid, false);
  });

  it("POST /verify rejects numeric network", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload: {}, paymentRequirements: { network: 12345 } }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.isValid, false);
  });

  it("POST /settle rejects missing network", async () => {
    const res = await fetch(`${BASE}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload: {}, paymentRequirements: {} }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.errorReason);
  });

  it("POST /settle rejects null network", async () => {
    const res = await fetch(`${BASE}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload: {}, paymentRequirements: { network: null } }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  it("POST /verify accepts new testnet networks", async () => {
    for (const network of ["ton:testnet", "tron:0x94a9059e", "stellar:testnet"]) {
      const res = await fetch(`${BASE}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPayload: {}, paymentRequirements: { network } }),
      });
      // Should not be 400 (network is valid) — will be 503 (mock) or 200 (upstream)
      assert.notStrictEqual(res.status, 400, `${network} should be accepted`);
    }
  });

  it("POST /settle accepts new testnet networks", async () => {
    for (const network of ["ton:testnet", "tron:0x94a9059e", "stellar:testnet"]) {
      const res = await fetch(`${BASE}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPayload: {}, paymentRequirements: { network } }),
      });
      assert.notStrictEqual(res.status, 400, `${network} should be accepted`);
    }
  });
});

// ─── Content-Type validation ─────────────────────────────────────────────────

describe("Content-Type validation", () => {
  it("rejects POST without Content-Type", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      body: "{}",
    });
    assert.strictEqual(res.status, 415);
    const data = await res.json();
    assert.ok(data.error.includes("Content-Type"));
  });

  it("rejects POST with text/plain", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    assert.strictEqual(res.status, 415);
    const data = await res.json();
    assert.ok(data.error.includes("Content-Type"));
    assert.strictEqual(data.sandbox, true);
  });

  it("rejects POST /settle without Content-Type", async () => {
    const res = await fetch(`${BASE}/settle`, {
      method: "POST",
      body: "{}",
    });
    assert.strictEqual(res.status, 415);
  });
});

// ─── Mock fallback behavior ──────────────────────────────────────────────────

describe("Mock fallback behavior", () => {
  it("POST /verify returns 503 with isValid:false when upstream down", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {},
        paymentRequirements: { network: "eip155:84532" },
      }),
    });
    // With no upstream, should get mock 503
    if (res.status === 503) {
      const data = await res.json();
      assert.strictEqual(data.isValid, false);
      assert.strictEqual(data.mock, true);
      assert.ok(data.invalidReason);
      assert.strictEqual(data.sandbox, true);
    }
    // If upstream is somehow running, 200 is also acceptable
    assert.ok([200, 503].includes(res.status), `Expected 200 or 503, got ${res.status}`);
  });

  it("POST /settle returns 503 with success:false when upstream down", async () => {
    const res = await fetch(`${BASE}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: {},
        paymentRequirements: { network: "eip155:84532" },
      }),
    });
    if (res.status === 503) {
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.mock, true);
      assert.ok(data.errorReason);
      assert.strictEqual(data.sandbox, true);
    }
    assert.ok([200, 503].includes(res.status), `Expected 200 or 503, got ${res.status}`);
  });
});

// ─── GET /usage ───────────────────────────────────────────────────────────────

describe("GET /usage", () => {
  it("returns usage stats", async () => {
    const res = await fetch(`${BASE}/usage`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.totalRequests === "number");
    assert.ok(typeof data.upstreamErrors === "number");
    assert.strictEqual(data.rateLimit, 100);
  });

  it("includes upstreamHealthy field", async () => {
    const res = await fetch(`${BASE}/usage`);
    const data = await res.json();
    assert.ok("upstreamHealthy" in data);
  });
});

// ─── Usage tracking ──────────────────────────────────────────────────────────

describe("Usage tracking", () => {
  it("totalRequests increments after API calls", async () => {
    const before = await fetch(`${BASE}/usage`).then((r) => r.json());
    await fetch(`${BASE}/supported`);
    await fetch(`${BASE}/faucets`);
    const after = await fetch(`${BASE}/usage`).then((r) => r.json());
    assert.ok(
      after.totalRequests >= before.totalRequests + 2,
      `Expected increment: before=${before.totalRequests}, after=${after.totalRequests}`,
    );
  });
});

// ─── Security headers ────────────────────────────────────────────────────────

describe("Security headers", () => {
  it("sets required security headers", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
    assert.ok(res.headers.get("strict-transport-security"));
    assert.ok(res.headers.get("referrer-policy"));
  });

  it("sets rate limit headers", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.ok(res.headers.get("x-ratelimit-limit"));
    assert.ok(res.headers.get("x-ratelimit-remaining"));
  });

  it("handles CORS preflight", async () => {
    const res = await fetch(`${BASE}/verify`, { method: "OPTIONS" });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
    assert.ok(res.headers.get("access-control-allow-methods"));
    assert.ok(res.headers.get("access-control-allow-headers"));
  });

  it("does not expose x-powered-by", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("x-powered-by"), null);
  });
});

// ─── CSP headers ─────────────────────────────────────────────────────────────

describe("CSP headers", () => {
  it("GET / has permissive CSP for inline styles and scripts", async () => {
    const res = await fetch(`${BASE}/`);
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp, "Should have CSP header");
    assert.ok(csp.includes("style-src"), "CSP should include style-src");
    assert.ok(csp.includes("script-src"), "CSP should include script-src");
  });

  it("non-root routes have strict CSP", async () => {
    const res = await fetch(`${BASE}/health`);
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp, "Should have CSP header");
    assert.ok(csp.includes("default-src 'none'"), "Non-root CSP should be strict");
  });
});

// ─── X-Request-Id ────────────────────────────────────────────────────────────

describe("X-Request-Id", () => {
  it("generates request ID when not provided", async () => {
    const res = await fetch(`${BASE}/health`);
    const id = res.headers.get("x-request-id");
    assert.ok(id, "Should have X-Request-Id");
    assert.ok(id.length > 10, "Should be UUID-like");
  });

  it("echoes provided request ID", async () => {
    const myId = "test-request-123";
    const res = await fetch(`${BASE}/health`, {
      headers: { "X-Request-Id": myId },
    });
    assert.strictEqual(res.headers.get("x-request-id"), myId);
  });

  it("generates unique IDs per request", async () => {
    const res1 = await fetch(`${BASE}/health`);
    const res2 = await fetch(`${BASE}/health`);
    const id1 = res1.headers.get("x-request-id");
    const id2 = res2.headers.get("x-request-id");
    assert.notStrictEqual(id1, id2, "Each request should get a unique ID");
  });
});

// ─── Rate limiting ───────────────────────────────────────────────────────────

describe("Rate limiting", () => {
  it("includes rate limit headers", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.ok(res.headers.get("x-ratelimit-limit"));
    const remaining = parseInt(res.headers.get("x-ratelimit-remaining"));
    assert.ok(remaining >= 0, "Remaining should be non-negative");
  });

  it("rate limit remaining decrements between requests", async () => {
    const res1 = await fetch(`${BASE}/health`);
    const rem1 = parseInt(res1.headers.get("x-ratelimit-remaining"));
    const res2 = await fetch(`${BASE}/health`);
    const rem2 = parseInt(res2.headers.get("x-ratelimit-remaining"));
    assert.ok(rem2 <= rem1, `Remaining should decrement: ${rem1} -> ${rem2}`);
  });

  it("limit header matches configured rate limit", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("x-ratelimit-limit"), "100");
  });
});

// ─── Unknown routes ──────────────────────────────────────────────────────────

describe("Unknown routes", () => {
  it("returns 404 for unknown paths", async () => {
    const res = await fetch(`${BASE}/nonexistent`);
    assert.strictEqual(res.status, 404);
  });

  it("returns 404 for unknown POST paths", async () => {
    const res = await fetch(`${BASE}/nonexistent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.strictEqual(res.status, 404);
  });
});

// ─── Body size limits ────────────────────────────────────────────────────────

describe("Body size limits", () => {
  it("rejects payloads over 50kb", async () => {
    const large = JSON.stringify({ data: "x".repeat(60000) });
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: large,
    });
    // Express returns 413 (entity too large) or 500 (caught by generic error handler)
    // Either way, the request should NOT succeed
    assert.ok(
      [400, 413, 500].includes(res.status),
      `Expected 400, 413, or 500, got ${res.status}`,
    );
    assert.notStrictEqual(res.status, 200, "Oversized payload should not succeed");
  });
});

// ─── Landing page ────────────────────────────────────────────────────────────

describe("Landing page", () => {
  it("GET / returns HTML", async () => {
    const res = await fetch(`${BASE}/`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("html"));
    const text = await res.text();
    assert.ok(text.includes("T402 Sandbox"));
    assert.ok(text.includes("TESTNET"));
  });

  it("landing page includes all supported networks", async () => {
    const res = await fetch(`${BASE}/`);
    const text = await res.text();
    assert.ok(text.includes("eip155:84532"), "Missing Base Sepolia in landing page");
    assert.ok(text.includes("ton:testnet"), "Missing TON Testnet in landing page");
    assert.ok(text.includes("tron:0x94a9059e"), "Missing TRON Nile in landing page");
    assert.ok(text.includes("stellar:testnet"), "Missing Stellar Testnet in landing page");
  });

  it("landing page includes SDK code examples", async () => {
    const res = await fetch(`${BASE}/`);
    const text = await res.text();
    assert.ok(text.includes("TypeScript"), "Missing TypeScript tab");
    assert.ok(text.includes("Go"), "Missing Go tab");
    assert.ok(text.includes("Python"), "Missing Python tab");
    assert.ok(text.includes("Java"), "Missing Java tab");
    assert.ok(text.includes("curl"), "Missing curl tab");
  });

  it("landing page links to playground", async () => {
    const res = await fetch(`${BASE}/`);
    const text = await res.text();
    assert.ok(text.includes("/playground"), "Missing playground link");
  });
});

describe("GET /playground", () => {
  it("returns HTML playground page", async () => {
    const res = await fetch(`${BASE}/playground`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("html"));
    const text = await res.text();
    assert.ok(text.includes("T402 Sandbox"), "Missing title");
    assert.ok(text.includes("Playground") || text.includes("playground"), "Missing playground content");
  });

  it("has permissive CSP for self connections", async () => {
    const res = await fetch(`${BASE}/playground`);
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp.includes("connect-src"), "Missing connect-src in CSP");
  });

  it("includes network selector and endpoint controls", async () => {
    const res = await fetch(`${BASE}/playground`);
    const text = await res.text();
    assert.ok(text.includes("eip155:84532"), "Missing Base Sepolia network");
    assert.ok(text.includes("ton:testnet"), "Missing TON Testnet network");
    assert.ok(text.includes("/verify"), "Missing verify endpoint");
    assert.ok(text.includes("/settle"), "Missing settle endpoint");
  });
});

describe("GET /metrics", () => {
  it("returns Prometheus exposition format", async () => {
    const res = await fetch(`${BASE}/metrics`);
    assert.strictEqual(res.status, 200);
    const ct = res.headers.get("content-type");
    assert.ok(ct.includes("text/plain"), "Content-Type should be text/plain");
    const text = await res.text();
    assert.ok(text.includes("# HELP"), "Missing HELP comments");
    assert.ok(text.includes("# TYPE"), "Missing TYPE comments");
  });

  it("includes core metrics", async () => {
    const res = await fetch(`${BASE}/metrics`);
    const text = await res.text();
    assert.ok(text.includes("sandbox_upstream_errors_total"), "Missing upstream errors counter");
    assert.ok(text.includes("sandbox_upstream_healthy"), "Missing upstream healthy gauge");
    assert.ok(text.includes("sandbox_rate_limit_hits_total"), "Missing rate limit counter");
    assert.ok(text.includes("sandbox_active_rate_limit_entries"), "Missing rate limit entries gauge");
  });

  it("tracks request counts after POST calls", async () => {
    // Make a POST request first
    await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload: {}, paymentRequirements: { network: "eip155:84532" } }),
    });
    const res = await fetch(`${BASE}/metrics`);
    const text = await res.text();
    assert.ok(text.includes('sandbox_requests_total{endpoint="/verify"}'), "Missing /verify request count");
  });

  it("does not count /metrics as totalRequests", async () => {
    const before = await fetch(`${BASE}/usage`).then(r => r.json());
    await fetch(`${BASE}/metrics`);
    await fetch(`${BASE}/metrics`);
    const after = await fetch(`${BASE}/usage`).then(r => r.json());
    assert.strictEqual(after.totalRequests, before.totalRequests, "/metrics should not increment totalRequests");
  });
});
