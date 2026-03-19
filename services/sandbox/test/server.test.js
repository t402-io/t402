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

describe("Health & Readiness", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.service, "t402-sandbox");
    assert.strictEqual(data.mode, "testnet");
  });

  it("GET /ready returns readiness status", async () => {
    const res = await fetch(`${BASE}/ready`);
    const data = await res.json();
    assert.ok("ready" in data);
    assert.ok("upstream" in data);
    assert.strictEqual(data.service, "t402-sandbox");
  });
});

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
});

describe("GET /faucets", () => {
  it("returns faucet info for all supported networks", async () => {
    const res = await fetch(`${BASE}/faucets`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.faucets));
    assert.ok(data.faucets.length >= 3);
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
});

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
    // Mock settle must include network (SettleResponse requires it)
    if (data.mock) {
      assert.ok(data.network, "Mock settle must include network");
      assert.ok(data.transaction, "Mock settle must include transaction");
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

describe("GET /usage", () => {
  it("returns usage stats", async () => {
    const res = await fetch(`${BASE}/usage`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.totalRequests === "number");
    assert.ok(typeof data.upstreamErrors === "number");
    assert.strictEqual(data.rateLimit, 100);
  });
});

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
});

describe("Landing page", () => {
  it("GET / returns HTML", async () => {
    const res = await fetch(`${BASE}/`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("html"));
    const text = await res.text();
    assert.ok(text.includes("T402 Sandbox"));
    assert.ok(text.includes("TESTNET"));
  });
});
