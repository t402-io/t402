import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = "http://localhost:3406";

describe("Sandbox API", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.mode, "testnet");
  });

  it("GET /supported returns testnet kinds only", async () => {
    const res = await fetch(`${BASE}/supported`);
    const data = await res.json();
    assert.ok(data.kinds.every(k => !k.includes("eip155:1:")));
    assert.strictEqual(data.sandbox, true);
  });

  it("GET /usage returns stats", async () => {
    const res = await fetch(`${BASE}/usage`);
    const data = await res.json();
    assert.ok(typeof data.totalRequests === "number");
    assert.strictEqual(data.rateLimit, 100);
  });

  it("POST /verify returns mock response", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPayload: {}, paymentRequirements: { network: "eip155:84532" } }),
    });
    const data = await res.json();
    assert.strictEqual(data.sandbox, true);
  });

  it("POST /verify with bad JSON returns clean error", async () => {
    const res = await fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid{json",
    });
    const data = await res.json();
    assert.ok(data.error);
    assert.ok(!data.stack); // No stack trace
  });

  it("has security headers", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
  });

  it("has rate limit headers", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.ok(res.headers.get("x-ratelimit-limit"));
    assert.ok(res.headers.get("x-ratelimit-remaining"));
  });
});
