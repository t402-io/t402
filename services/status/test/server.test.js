import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { app, SERVICES, healthCache, checkAll } from "../src/server.js";
import { recordCheck } from "../src/history.js";

let server;
const PORT = 3404;
const BASE = `http://localhost:${PORT}`;

before(async () => {
  server = app.listen(PORT);
  // Seed the health cache with mock data so tests don't depend on real HTTP checks
  for (const svc of SERVICES) {
    healthCache.set(svc.id, {
      id: svc.id,
      name: svc.name,
      status: "operational",
      statusCode: 200,
      latencyMs: 42,
      checkedAt: new Date().toISOString(),
    });
    recordCheck(svc.id, "operational", 42);
  }
  // Record a down check for the first service to create an incident
  recordCheck(SERVICES[0].id, "down", 10000);
});

after(() => {
  server.close();
});

describe("Status API", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
  });

  it("GET /api/status returns service statuses", async () => {
    const res = await fetch(`${BASE}/api/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.overall);
    assert.ok(Array.isArray(data.services));
    assert.ok(data.services.length > 0);
    assert.ok(data.checkedAt);
    assert.ok(data.checkInterval);
  });

  it("GET / returns HTML with uptime and incidents", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("T402 Status"));
    assert.ok(html.includes("Uptime (30d)"));
    assert.ok(html.includes("Recent Incidents"));
    assert.ok(html.includes("%")); // uptime percentage
  });

  it("GET / includes CORS headers", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
  });

  it("GET /api/incidents returns incident list", async () => {
    const res = await fetch(`${BASE}/api/incidents`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.incidents));
    assert.ok(data.incidents.length > 0);
    const incident = data.incidents[0];
    assert.ok(incident.id);
    assert.ok(incident.serviceId);
    assert.ok(incident.title);
    assert.ok(incident.status);
    assert.ok(incident.startedAt);
  });

  it("GET /api/incidents respects limit param", async () => {
    const res = await fetch(`${BASE}/api/incidents?limit=1`);
    const data = await res.json();
    assert.ok(data.incidents.length <= 1);
  });

  it("GET /api/uptime returns uptime percentages", async () => {
    const res = await fetch(`${BASE}/api/uptime`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.days);
    assert.ok(data.uptimes);
    // Check that all services are represented
    for (const svc of SERVICES) {
      assert.ok(data.uptimes[svc.id], `Missing uptime for ${svc.id}`);
      assert.ok(typeof data.uptimes[svc.id].uptimePercent === "number");
      assert.ok(data.uptimes[svc.id].name);
    }
  });

  it("GET /api/uptime respects days param", async () => {
    const res = await fetch(`${BASE}/api/uptime?days=7`);
    const data = await res.json();
    assert.strictEqual(data.days, 7);
  });

  it("GET /rss returns valid RSS XML", async () => {
    const res = await fetch(`${BASE}/rss`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("application/rss+xml"));
    const xml = await res.text();
    assert.ok(xml.includes("<?xml"));
    assert.ok(xml.includes("<rss"));
    assert.ok(xml.includes("<channel>"));
    assert.ok(xml.includes("T402 Status"));
    assert.ok(xml.includes("<item>"));
  });

  it("GET /rss escapes XML entities", async () => {
    const res = await fetch(`${BASE}/rss`);
    const xml = await res.text();
    // Should not contain unescaped angle brackets inside content
    assert.ok(!xml.includes("<site>") || xml.includes("&lt;"));
  });
});
