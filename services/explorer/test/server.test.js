import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = "http://localhost:3404";

describe("Explorer API", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
  });

  it("GET /api/v1/transactions returns list", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions`);
    const data = await res.json();
    assert.ok(data.transactions.length > 0);
    assert.ok(data.total > 0);
  });

  it("GET /api/v1/transactions?network= filters", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?network=eip155:8453`);
    const data = await res.json();
    assert.ok(data.transactions.every(t => t.network === "eip155:8453"));
  });

  it("GET /api/v1/stats returns totals", async () => {
    const res = await fetch(`${BASE}/api/v1/stats`);
    const data = await res.json();
    assert.ok(data.totalTransactions > 0);
    assert.ok(Object.keys(data.byNetwork).length > 0);
  });

  it("GET / returns HTML", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("T402 Explorer"));
  });
});
