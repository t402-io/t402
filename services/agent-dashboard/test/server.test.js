import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = "http://localhost:3405";

describe("Agent Dashboard API", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
  });

  it("GET /api/v1/payments returns history", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=0xTest`);
    const data = await res.json();
    assert.ok(data.payments.length > 0);
  });

  it("GET /api/v1/balances/:addr returns balances", async () => {
    const res = await fetch(`${BASE}/api/v1/balances/0xTest`);
    const data = await res.json();
    assert.ok(data.balances.length > 0);
    assert.ok(data.totalUsd);
  });

  it("GET /api/v1/budget/:addr returns budget", async () => {
    const res = await fetch(`${BASE}/api/v1/budget/0xTest`);
    const data = await res.json();
    assert.ok(data.policy);
    assert.ok(data.usage);
  });

  it("GET /api/v1/stats/:addr returns stats", async () => {
    const res = await fetch(`${BASE}/api/v1/stats/0xTest`);
    const data = await res.json();
    assert.ok(data.totalPayments > 0);
    assert.ok(data.topServices.length > 0);
  });

  it("GET / returns HTML dashboard", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("Agent Payment Dashboard"));
  });
});
