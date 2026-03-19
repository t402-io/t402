import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { app, SERVICES, SERVICE_MAP, healthCache, checkAll } from "../src/server.js";
import { recordCheck, getUptime, getDailyUptime, getIncidents, getRecentChecks } from "../src/history.js";

let server;
let BASE;

before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  BASE = `http://localhost:${port}`;
  // Seed the health cache with mock data so tests don't depend on real HTTP checks
  for (const svc of SERVICES) {
    healthCache.set(svc.id, {
      id: svc.id,
      name: svc.name,
      group: svc.group,
      status: "operational",
      statusCode: 200,
      latencyMs: 42,
      checkedAt: new Date().toISOString(),
    });
    recordCheck(svc.id, svc.name, "operational", 42);
  }
  // Record a down check for the first service to create an incident
  recordCheck(SERVICES[0].id, SERVICES[0].name, "down", 10000);
});

after(() => {
  server.close();
});

describe("Health endpoint", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.service, "t402-status");
  });
});

describe("Status API", () => {
  it("GET /api/status returns service statuses with groups", async () => {
    const res = await fetch(`${BASE}/api/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.overall);
    assert.ok(Array.isArray(data.services));
    assert.ok(data.services.length > 0);
    assert.ok(data.checkedAt);
    assert.ok(data.checkInterval);
    // Verify group field is present
    assert.ok(data.services[0].group);
  });

  it("GET /api/status has Cache-Control header", async () => {
    const res = await fetch(`${BASE}/api/status`);
    assert.strictEqual(res.headers.get("cache-control"), "public, max-age=30");
  });
});

describe("HTML page", () => {
  it("GET / returns HTML with uptime, incidents, service groups", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("T402 Status"));
    assert.ok(html.includes("Uptime (30d)"));
    assert.ok(html.includes("Recent Incidents"));
    assert.ok(html.includes("%")); // uptime percentage or N/A
    // Service groups
    assert.ok(html.includes("Vercel"));
    assert.ok(html.includes("Core"));
    assert.ok(html.includes("New"));
    // OG meta tags
    assert.ok(html.includes('og:title'));
    assert.ok(html.includes('og:description'));
    // Favicon
    assert.ok(html.includes('rel="icon"'));
    // Auto-refresh script
    assert.ok(html.includes("setInterval"));
    // Noscript fallback
    assert.ok(html.includes("<noscript>"));
  });

  it("GET / includes CORS and security headers", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
  });

  it("GET / has no-cache header", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.headers.get("cache-control"), "no-cache, must-revalidate");
  });
});

describe("Incidents API", () => {
  it("GET /api/incidents returns incident list with down events", async () => {
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
    // Verify incident title uses service name, not ID
    assert.ok(incident.title.includes(SERVICES[0].name));
  });

  it("GET /api/incidents respects limit param", async () => {
    const res = await fetch(`${BASE}/api/incidents?limit=1`);
    const data = await res.json();
    assert.ok(data.incidents.length <= 1);
  });
});

describe("Uptime API", () => {
  it("GET /api/uptime returns uptime percentages", async () => {
    const res = await fetch(`${BASE}/api/uptime`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.days);
    assert.ok(data.uptimes);
    for (const svc of SERVICES) {
      assert.ok(data.uptimes[svc.id], `Missing uptime for ${svc.id}`);
      const up = data.uptimes[svc.id].uptimePercent;
      assert.ok(up === null || typeof up === "number");
      assert.ok(data.uptimes[svc.id].name);
    }
  });

  it("GET /api/uptime respects days param", async () => {
    const res = await fetch(`${BASE}/api/uptime?days=7`);
    const data = await res.json();
    assert.strictEqual(data.days, 7);
  });
});

describe("Per-service detail", () => {
  it("GET /api/service/:id returns service detail with daily uptime", async () => {
    const res = await fetch(`${BASE}/api/service/site`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.service);
    assert.ok(data.service.name);
    assert.ok(Array.isArray(data.recentChecks));
    assert.ok(Array.isArray(data.dailyUptime));
    assert.strictEqual(data.dailyUptime.length, 90);
    assert.ok(Array.isArray(data.incidents));
  });

  it("GET /api/service/:id returns 404 for unknown service", async () => {
    const res = await fetch(`${BASE}/api/service/nonexistent`);
    assert.strictEqual(res.status, 404);
  });

  it("GET /service/:id returns HTML detail page", async () => {
    const res = await fetch(`${BASE}/service/site`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("t402.io"));
    assert.ok(html.includes("Response Time"));
    assert.ok(html.includes("90-Day Uptime"));
    assert.ok(html.includes("All services"));
  });

  it("GET /service/:id returns 404 for unknown service", async () => {
    const res = await fetch(`${BASE}/service/nonexistent`);
    assert.strictEqual(res.status, 404);
  });
});

describe("RSS feed", () => {
  it("GET /rss returns valid RSS XML with incidents", async () => {
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
});

describe("SVG badges", () => {
  it("GET /badge returns overall SVG badge", async () => {
    const res = await fetch(`${BASE}/badge`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("image/svg+xml"));
    const svg = await res.text();
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("T402"));
  });

  it("GET /badge/:id returns per-service SVG badge", async () => {
    const res = await fetch(`${BASE}/badge/site`);
    assert.strictEqual(res.status, 200);
    const svg = await res.text();
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("t402.io"));
  });

  it("GET /badge/:id returns 404 for unknown service", async () => {
    const res = await fetch(`${BASE}/badge/nonexistent`);
    assert.strictEqual(res.status, 404);
  });
});

describe("Prometheus metrics", () => {
  it("GET /metrics returns Prometheus exposition format", async () => {
    const res = await fetch(`${BASE}/metrics`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("# HELP t402_status_service_up"));
    assert.ok(text.includes("# TYPE t402_status_service_up gauge"));
    assert.ok(text.includes('t402_status_service_up{service="site"}'));
    assert.ok(text.includes("t402_status_service_latency_ms"));
  });
});

describe("Maintenance API", () => {
  it("GET /api/maintenance returns upcoming list", async () => {
    const res = await fetch(`${BASE}/api/maintenance`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.upcoming));
  });
});

describe("Notifications module", () => {
  it("notifyStatusChange is callable without webhooks configured", async () => {
    const { notifyStatusChange } = await import("../src/notifications.js");
    // Should not throw even with no WEBHOOK_URLS
    await notifyStatusChange({ serviceId: "test", serviceName: "Test", from: "operational", to: "down" });
  });
});

describe("Maintenance module", () => {
  it("isInMaintenance returns false when no windows configured", async () => {
    const { isInMaintenance } = await import("../src/maintenance.js");
    assert.strictEqual(isInMaintenance("facilitator"), false);
  });

  it("getUpcoming returns empty array when no windows", async () => {
    const { getUpcoming } = await import("../src/maintenance.js");
    assert.deepStrictEqual(getUpcoming(), []);
  });
});

describe("History module", () => {
  it("getUptime returns null when no checks exist for timeframe", () => {
    const uptime = getUptime("nonexistent-service", 30);
    assert.strictEqual(uptime, null);
  });

  it("getDailyUptime returns 90 days of data", () => {
    const daily = getDailyUptime("site", 90);
    assert.strictEqual(daily.length, 90);
    assert.ok(daily[0].date);
    // Most days should be null (no data) since we just started
    const nullDays = daily.filter((d) => d.uptimePercent === null);
    assert.ok(nullDays.length > 0);
  });

  it("degraded status creates incidents", () => {
    recordCheck("test-svc", "Test Service", "degraded", 500);
    const incidents = getIncidents(100);
    const degradedIncident = incidents.find((i) => i.serviceId === "test-svc");
    assert.ok(degradedIncident);
    assert.ok(degradedIncident.title.includes("degraded"));
  });

  it("getRecentChecks returns checks for a service", () => {
    const checks = getRecentChecks("site", 10);
    assert.ok(checks.length > 0);
    assert.strictEqual(checks[0].serviceId, "site");
  });
});
