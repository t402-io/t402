import { describe, it, before, after } from "node:test";
import assert from "node:assert";

const BASE = "http://localhost:3402";
let server;

describe("Bazaar API", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
  });

  it("GET /api/v1/search returns services", async () => {
    const res = await fetch(`${BASE}/api/v1/search?q=weather`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.services.length > 0);
    assert.ok(data.services[0].name.toLowerCase().includes("weather"));
  });

  it("GET /api/v1/search with category filter", async () => {
    const res = await fetch(`${BASE}/api/v1/search?category=ai`);
    const data = await res.json();
    assert.ok(data.services.every(s => s.category === "ai"));
  });

  it("GET /api/v1/categories returns counts", async () => {
    const res = await fetch(`${BASE}/api/v1/categories`);
    const data = await res.json();
    assert.ok(Object.keys(data.categories).length > 0);
  });

  it("GET /api/v1/stats returns totals", async () => {
    const res = await fetch(`${BASE}/api/v1/stats`);
    const data = await res.json();
    assert.ok(data.totalServices > 0);
  });

  it("GET /api/v1/services/:id returns 404 for unknown", async () => {
    const res = await fetch(`${BASE}/api/v1/services/nonexistent`);
    assert.strictEqual(res.status, 404);
  });

  it("POST /api/v1/services registers new service", async () => {
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://test.example.com",
        name: "Test Service",
        price: { amount: "1000", token: "USDC", network: "eip155:8453" },
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id.startsWith("svc-"));
  });
});
