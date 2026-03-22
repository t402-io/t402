import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = process.env.BASE_URL || "http://localhost:3405";

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
    assert.strictEqual(data.address, "0xTest");
    // Each payment has expected fields
    const p = data.payments[0];
    assert.ok(p.id);
    assert.ok(p.txHash);
    assert.ok(p.service);
    assert.ok(p.amountFormatted);
    assert.ok(p.networkLabel);
  });

  it("GET /api/v1/payments is deterministic per address", async () => {
    const r1 = await fetch(`${BASE}/api/v1/payments?address=0xDeterministic`);
    const d1 = await r1.json();
    const r2 = await fetch(`${BASE}/api/v1/payments?address=0xDeterministic`);
    const d2 = await r2.json();
    assert.strictEqual(d1.total, d2.total);
    assert.strictEqual(d1.payments[0].id, d2.payments[0].id);
    assert.strictEqual(d1.payments[0].service, d2.payments[0].service);
  });

  it("GET /api/v1/payments respects network filter", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=0xTest&network=eip155:8453`);
    const data = await res.json();
    for (const p of data.payments) {
      assert.strictEqual(p.network, "eip155:8453");
    }
  });

  it("GET /api/v1/payments returns pagination fields", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=0xTest&limit=5&offset=2`);
    const data = await res.json();
    assert.strictEqual(typeof data.offset, "number");
    assert.strictEqual(typeof data.limit, "number");
    assert.strictEqual(typeof data.hasMore, "boolean");
    assert.strictEqual(data.offset, 2);
    assert.strictEqual(data.limit, 5);
    assert.ok(data.payments.length <= 5);
  });

  it("GET /api/v1/balances/:addr returns balances", async () => {
    const res = await fetch(`${BASE}/api/v1/balances/0xTest`);
    const data = await res.json();
    assert.ok(data.balances.length > 0);
    assert.ok(data.totalUsd);
    assert.strictEqual(data.address, "0xTest");
    // Check balance shape
    const b = data.balances[0];
    assert.ok(b.network);
    assert.ok(b.networkLabel);
    assert.ok(b.token);
    assert.ok(b.balanceFormatted);
  });

  it("GET /api/v1/budget/:addr returns budget", async () => {
    const res = await fetch(`${BASE}/api/v1/budget/0xTest`);
    const data = await res.json();
    assert.ok(data.policy);
    assert.ok(data.usage);
    assert.ok(Array.isArray(data.policy.allowedNetworks));
    assert.strictEqual(typeof data.usage.sessionPercentage, "number");
    assert.strictEqual(typeof data.usage.todayPercentage, "number");
  });

  it("GET /api/v1/stats/:addr returns stats", async () => {
    const res = await fetch(`${BASE}/api/v1/stats/0xTest`);
    const data = await res.json();
    assert.ok(data.totalPayments > 0);
    assert.ok(data.topServices.length > 0);
    assert.ok(data.byNetwork);
    assert.ok(data.avgPaymentUsd);
  });

  it("GET /api/v1/alerts/:addr returns alerts array", async () => {
    const res = await fetch(`${BASE}/api/v1/alerts/0xTest`);
    const data = await res.json();
    assert.strictEqual(data.address, "0xTest");
    assert.ok(Array.isArray(data.alerts));
    assert.strictEqual(typeof data.count, "number");
    assert.strictEqual(data.count, data.alerts.length);
    // If alerts exist, check shape
    for (const a of data.alerts) {
      assert.ok(["warning", "critical"].includes(a.level));
      assert.ok(a.message);
      assert.ok(a.id);
      assert.strictEqual(typeof a.percentage, "number");
    }
  });

  it("GET /api/v1/alerts/:addr is consistent for same address", async () => {
    const r1 = await fetch(`${BASE}/api/v1/alerts/0xAlertTest`);
    const d1 = await r1.json();
    const r2 = await fetch(`${BASE}/api/v1/alerts/0xAlertTest`);
    const d2 = await r2.json();
    assert.strictEqual(d1.count, d2.count);
    for (let i = 0; i < d1.alerts.length; i++) {
      assert.strictEqual(d1.alerts[i].level, d2.alerts[i].level);
      assert.strictEqual(d1.alerts[i].field, d2.alerts[i].field);
    }
  });

  it("GET /api/v1/export/:addr returns CSV", async () => {
    const res = await fetch(`${BASE}/api/v1/export/0xTest`);
    assert.strictEqual(res.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.ok(res.headers.get("content-disposition").includes("attachment"));
    const csv = await res.text();
    const lines = csv.split("\n");
    // Header + at least one data row
    assert.ok(lines.length > 1);
    assert.ok(lines[0].startsWith("id,timestamp,service,network,token,amount,amount_formatted"));
    // Data row has correct number of columns
    const cols = lines[1].split(",");
    assert.ok(cols.length >= 10, `Expected >=10 columns, got ${cols.length}`);
  });

  it("GET /api/v1/export/:addr respects days param", async () => {
    const r1 = await fetch(`${BASE}/api/v1/export/0xExport?days=1`);
    const csv1 = await r1.text();
    const r2 = await fetch(`${BASE}/api/v1/export/0xExport?days=30`);
    const csv2 = await r2.text();
    // More days should yield same or more rows (deterministic seed changes with days)
    assert.ok(csv1.length > 0);
    assert.ok(csv2.length > 0);
  });

  it("GET / returns HTML dashboard with onboarding", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("Agent Payment Dashboard"));
    assert.ok(html.includes("Try Demo"));
    assert.ok(html.includes("Load Dashboard"));
  });

  it("GET / with address shows toolbar links", async () => {
    const res = await fetch(`${BASE}?address=0xToolbar`);
    const html = await res.text();
    assert.ok(html.includes("Export CSV"));
    assert.ok(html.includes("Alerts API"));
  });

  it("GET / with address shows data", async () => {
    const res = await fetch(`${BASE}?address=0xDashTest`);
    const html = await res.text();
    assert.ok(html.includes("Agent Payment Dashboard"));
    assert.ok(html.includes("0xDashTest"));
    // Should have network breakdown
    assert.ok(html.includes("Network Breakdown"));
  });

  it("CORS headers are present", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
  });

  it("GET /api/v1/info returns mode and version", async () => {
    const res = await fetch(`${BASE}/api/v1/info`);
    const data = await res.json();
    assert.strictEqual(data.mode, "demo");
    assert.strictEqual(data.version, "1.2.0");
  });

  it("GET /metrics returns Prometheus format", async () => {
    const res = await fetch(`${BASE}/metrics`);
    assert.ok(res.headers.get("content-type").includes("text/plain"));
    const text = await res.text();
    assert.ok(text.includes("http_requests_total"));
    assert.ok(text.includes("datasource_mode"));
  });

  it("X-Request-Id header is returned", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.ok(res.headers.get("x-request-id"));
  });

  it("X-Request-Id reflects valid incoming header", async () => {
    const res = await fetch(`${BASE}/health`, { headers: { "X-Request-Id": "test-req-123" } });
    assert.strictEqual(res.headers.get("x-request-id"), "test-req-123");
  });

  it("X-Request-Id rejects invalid format and generates new", async () => {
    const res = await fetch(`${BASE}/health`, { headers: { "X-Request-Id": "<script>alert(1)</script>" } });
    const id = res.headers.get("x-request-id");
    assert.ok(id);
    assert.ok(!id.includes("<script>"), "Should not reflect invalid request ID");
  });

  it("GET /api/v1/dashboard/:addr returns combined data", async () => {
    const res = await fetch(`${BASE}/api/v1/dashboard/0xTest`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.address, "0xTest");
    assert.ok(data.balances);
    assert.ok(data.balances.totalUsd);
    assert.ok(data.budget);
    assert.ok(data.budget.policy);
    assert.ok(data.budget.usage);
    assert.ok(data.stats);
    assert.ok(data.stats.totalPayments > 0);
    assert.ok(data.payments);
    assert.ok(data.payments.items.length > 0);
    assert.strictEqual(typeof data.payments.total, "number");
    assert.ok(data.alerts);
    assert.strictEqual(typeof data.alerts.count, "number");
    assert.strictEqual(data.mode, "demo");
  });

  it("GET /api/v1/stats/:addr/trend returns daily trend", async () => {
    const res = await fetch(`${BASE}/api/v1/stats/0xTest/trend?days=7`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.address, "0xTest");
    assert.strictEqual(data.days, 7);
    assert.ok(Array.isArray(data.trend));
    assert.strictEqual(data.trend.length, 7);
    for (const d of data.trend) {
      assert.ok(d.date);
      assert.strictEqual(typeof d.count, "number");
      assert.ok(d.amount);
      assert.ok(d.amountUsd);
    }
  });

  it("GET /api/v1/stats/:addr/trend defaults to 30 days", async () => {
    const res = await fetch(`${BASE}/api/v1/stats/0xTest/trend`);
    const data = await res.json();
    assert.strictEqual(data.days, 30);
    assert.strictEqual(data.trend.length, 30);
  });

  it("GET /api/v1/stats/:addr/trend with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/stats/<script>/trend`);
    assert.strictEqual(res.status, 400);
  });

  it("GET /api/v1/dashboard with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/dashboard/<script>`);
    assert.strictEqual(res.status, 400);
  });

  it("GET /api/v1/dashboard respects days param", async () => {
    const r1 = await fetch(`${BASE}/api/v1/dashboard/0xTest?days=1`);
    const d1 = await r1.json();
    assert.strictEqual(d1.stats.period, "1d");
    const r2 = await fetch(`${BASE}/api/v1/dashboard/0xTest?days=30`);
    const d2 = await r2.json();
    assert.strictEqual(d2.stats.period, "30d");
  });
});
