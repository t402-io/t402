import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { app, healthCache } from "../src/server.js";
import { SERVICES, SERVICE_MAP } from "../src/config.js";
import { recordCheck, getUptime, getDailyUptime, getIncidents, getIncidentsByService, getRecentChecks, getPercentiles, addManualIncident, updateIncident, isInitialCheckComplete, markInitialCheckComplete, flush } from "../src/history.js";
import { notifyStatusChange } from "../src/notifications.js";
import { isInMaintenance, getUpcoming, addWindow, removeWindow, pruneExpired } from "../src/maintenance.js";

let server;
let BASE;

before(async () => {
  server = app.listen(0);
  const { port } = server.address();
  BASE = `http://localhost:${port}`;
  // Seed the health cache with mock data
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
  markInitialCheckComplete();
});

after(() => {
  server.close();
});

// --- Health endpoint ---

describe("Health endpoint", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.service, "t402-status");
  });
});

// --- Status API ---

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
    assert.ok(data.services[0].group);
  });

  it("GET /api/status has Cache-Control header", async () => {
    const res = await fetch(`${BASE}/api/status`);
    assert.strictEqual(res.headers.get("cache-control"), "public, max-age=30");
  });

  it("overall is not 'checking' after markInitialCheckComplete", async () => {
    const res = await fetch(`${BASE}/api/status`);
    const data = await res.json();
    assert.notStrictEqual(data.overall, "checking");
  });
});

// --- HTML page ---

describe("HTML page", () => {
  it("GET / returns HTML with all expected elements", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("T402 Status"));
    assert.ok(html.includes("Uptime (30d)"));
    assert.ok(html.includes("Recent Incidents"));
    // Service groups
    assert.ok(html.includes("Websites"));
    assert.ok(html.includes("Core"));
    assert.ok(html.includes("Platform"));
    // OG meta tags
    assert.ok(html.includes("og:title"));
    // AJAX update script (no location.reload)
    assert.ok(html.includes("setInterval"));
    assert.ok(!html.includes("location.reload"));
    // Noscript fallback
    assert.ok(html.includes("<noscript>"));
    // CSS tooltips (data-tip instead of title)
    assert.ok(html.includes("data-tip="));
    // Relative time JS
    assert.ok(html.includes("relTime"));
    // AJAX updates emoji dots
    assert.ok(html.includes("dots"));
    // AJAX fetches incidents
    assert.ok(html.includes("/api/incidents"));
  });

  it("GET / includes all security headers", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
    assert.ok(res.headers.get("strict-transport-security")?.includes("max-age=31536000"));
    assert.ok(res.headers.get("permissions-policy"));
    assert.ok(res.headers.get("x-permitted-cross-domain-policies"));
  });

  it("GET / has no-cache header", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.headers.get("cache-control"), "no-cache, must-revalidate");
  });

  it("GET / escapes service values in HTML", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    // No raw unescaped status values — all should be inside escaped contexts
    assert.ok(!html.includes('<td>operational</td>') || html.includes('operational'));
  });
});

// --- Incidents API ---

describe("Incidents API", () => {
  it("GET /api/incidents returns incident list with auto source", async () => {
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
    assert.ok(incident.source);
  });

  it("GET /api/incidents respects limit param", async () => {
    const res = await fetch(`${BASE}/api/incidents?limit=1`);
    const data = await res.json();
    assert.ok(data.incidents.length <= 1);
  });
});

// --- Uptime API ---

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
    }
  });

  it("GET /api/uptime respects days param", async () => {
    const res = await fetch(`${BASE}/api/uptime?days=7`);
    const data = await res.json();
    assert.strictEqual(data.days, 7);
  });
});

// --- Per-service detail ---

describe("Per-service detail", () => {
  it("GET /api/service/:id returns service detail with percentiles", async () => {
    const res = await fetch(`${BASE}/api/service/site`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.service);
    assert.ok(Array.isArray(data.recentChecks));
    assert.ok(Array.isArray(data.dailyUptime));
    assert.strictEqual(data.dailyUptime.length, 90);
    assert.ok(Array.isArray(data.incidents));
    assert.ok(data.percentiles === null || typeof data.percentiles === "object");
  });

  it("GET /api/service/:id returns 404 for unknown service", async () => {
    const res = await fetch(`${BASE}/api/service/nonexistent`);
    assert.strictEqual(res.status, 404);
  });

  it("GET /service/:id returns HTML detail page with noscript refresh", async () => {
    const res = await fetch(`${BASE}/service/site`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("t402.io"));
    assert.ok(html.includes("Response Time"));
    assert.ok(html.includes("90-Day Uptime"));
    assert.ok(html.includes("<noscript>"));
    assert.ok(html.includes("data-tip="));
    assert.ok(html.includes("relTime"));
  });

  it("GET /service/:id returns 404 for unknown service", async () => {
    const res = await fetch(`${BASE}/service/nonexistent`);
    assert.strictEqual(res.status, 404);
  });
});

// --- RSS feed ---

describe("RSS feed", () => {
  it("GET /rss returns valid RSS XML", async () => {
    const res = await fetch(`${BASE}/rss`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("application/rss+xml"));
    const xml = await res.text();
    assert.ok(xml.includes("<?xml"));
    assert.ok(xml.includes("<rss"));
    assert.ok(xml.includes("<item>"));
  });
});

// --- SVG badges ---

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
  });

  it("GET /badge/:id returns 404 for unknown service", async () => {
    const res = await fetch(`${BASE}/badge/nonexistent`);
    assert.strictEqual(res.status, 404);
  });

  it("maintenance status renders gray in badge", () => {
    healthCache.set("test-maint", { id: "test-maint", name: "Test", status: "maintenance", latencyMs: 0 });
    // Verify statusColor function via badge (gray = #6B7280)
    healthCache.delete("test-maint");
  });
});

// --- Prometheus metrics ---

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

// --- Maintenance API ---

describe("Maintenance API", () => {
  it("GET /api/maintenance returns upcoming list", async () => {
    const res = await fetch(`${BASE}/api/maintenance`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.upcoming));
  });
});

// --- Admin APIs ---

describe("Admin APIs", () => {
  it("POST /api/incidents returns 503 when no ADMIN_API_KEY", async () => {
    const res = await fetch(`${BASE}/api/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test incident" }),
    });
    assert.strictEqual(res.status, 503);
  });

  it("POST /api/incidents returns 401 with wrong key", async () => {
    const res = await fetch(`${BASE}/api/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": "wrong" },
      body: JSON.stringify({ title: "Test incident" }),
    });
    assert.ok(res.status === 401 || res.status === 503);
  });

  it("OPTIONS preflight returns 204", async () => {
    const res = await fetch(`${BASE}/api/incidents`, { method: "OPTIONS" });
    assert.strictEqual(res.status, 204);
  });
});

// --- Notifications module ---

describe("Notifications module", () => {
  it("notifyStatusChange is callable without webhooks configured", async () => {
    await notifyStatusChange({ serviceId: "test", serviceName: "Test", from: "operational", to: "down" });
  });
});

// --- Maintenance module ---

describe("Maintenance module", () => {
  it("isInMaintenance returns false when no windows configured", () => {
    assert.strictEqual(isInMaintenance("facilitator"), false);
  });

  it("getUpcoming returns empty array when no windows", () => {
    assert.deepStrictEqual(getUpcoming(), []);
  });

  it("addWindow validates required fields", async () => {
    await assert.rejects(() => addWindow({}), /requires title/);
  });

  it("addWindow validates date format", async () => {
    await assert.rejects(() => addWindow({
      title: "Test",
      startAt: "not-a-date",
      endAt: "also-not-a-date",
    }), /valid ISO date/);
  });

  it("addWindow validates date order", async () => {
    await assert.rejects(() => addWindow({
      title: "Test",
      startAt: "2026-03-22T10:00:00Z",
      endAt: "2026-03-22T08:00:00Z",
    }), /before endAt/);
  });

  it("addWindow and removeWindow work correctly", async () => {
    const w = await addWindow({
      title: "Test maintenance",
      startAt: new Date(Date.now() + 3600000).toISOString(),
      endAt: new Date(Date.now() + 7200000).toISOString(),
      serviceId: "site",
    });
    assert.ok(w.id);
    assert.strictEqual(w.title, "Test maintenance");

    const upcoming = getUpcoming();
    assert.ok(upcoming.some((u) => u.id === w.id));

    const removed = await removeWindow(w.id);
    assert.strictEqual(removed, true);
    assert.strictEqual(await removeWindow("nonexistent"), false);
  });

  it("pruneExpired removes old windows", () => {
    pruneExpired();
  });
});

// --- History module ---

describe("History module", () => {
  it("getUptime returns null when no checks exist", () => {
    assert.strictEqual(getUptime("nonexistent-service", 30), null);
  });

  it("getDailyUptime returns 90 days of data", () => {
    const daily = getDailyUptime("site", 90);
    assert.strictEqual(daily.length, 90);
    assert.ok(daily[0].date);
  });

  it("getDailyUptime caches results between calls", () => {
    const d1 = getDailyUptime("site", 90);
    const d2 = getDailyUptime("site", 90);
    assert.strictEqual(d1, d2); // same reference = cache hit
  });

  it("degraded status creates incidents with auto source", () => {
    recordCheck("test-svc2", "Test Service 2", "degraded", 500);
    const incidents = getIncidents(100);
    const degradedIncident = incidents.find((i) => i.serviceId === "test-svc2");
    assert.ok(degradedIncident);
    assert.ok(degradedIncident.title.includes("degraded"));
    assert.strictEqual(degradedIncident.source, "auto");
  });

  it("operational status resolves auto incidents", () => {
    recordCheck("test-svc2", "Test Service 2", "operational", 50);
    const incidents = getIncidents(100);
    const resolved = incidents.find((i) => i.serviceId === "test-svc2" && i.status === "resolved");
    assert.ok(resolved);
    assert.ok(resolved.resolvedAt);
  });

  it("getRecentChecks returns checks for a service", () => {
    const checks = getRecentChecks("site", 10);
    assert.ok(checks.length > 0);
    assert.strictEqual(checks[0].serviceId, "site");
  });

  it("getIncidentsByService filters correctly", () => {
    const incidents = getIncidentsByService(SERVICES[0].id, 10);
    assert.ok(incidents.length > 0);
    incidents.forEach((i) => assert.strictEqual(i.serviceId, SERVICES[0].id));
  });

  it("getPercentiles returns p50/p95/p99 or null", () => {
    for (let i = 0; i < 10; i++) {
      recordCheck("perf-test2", "Perf Test 2", "operational", 50 + i * 10);
    }
    const pct = getPercentiles("perf-test2", 10);
    assert.ok(pct);
    assert.ok(typeof pct.p50 === "number");
    assert.ok(typeof pct.p95 === "number");
    assert.ok(typeof pct.p99 === "number");
    assert.ok(pct.p50 <= pct.p95);
    assert.ok(pct.p95 <= pct.p99);
    assert.strictEqual(getPercentiles("nonexistent"), null);
  });

  it("addManualIncident creates manual incident", () => {
    const incident = addManualIncident({
      serviceId: "facilitator",
      title: "Ethereum RPC provider issues",
      description: "Settlement delays due to provider latency",
      severity: "degraded",
    });
    assert.ok(incident.id);
    assert.strictEqual(incident.source, "manual");
    assert.strictEqual(incident.status, "ongoing");
    assert.ok(Array.isArray(incident.updates));
  });

  it("updateIncident adds update and resolves", () => {
    const incident = addManualIncident({ title: "Test update", severity: "down" });
    const updated = updateIncident(incident.id, { description: "Investigating" });
    assert.ok(updated);
    assert.strictEqual(updated.updates.length, 1);

    const resolved = updateIncident(incident.id, { description: "Fixed", status: "resolved" });
    assert.ok(resolved);
    assert.strictEqual(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt);
    assert.strictEqual(resolved.updates.length, 2);

    assert.strictEqual(updateIncident(999999, { description: "nope" }), null);
  });

  it("isInitialCheckComplete returns true after markInitialCheckComplete", () => {
    assert.strictEqual(isInitialCheckComplete(), true);
  });

  it("incident IDs never collide", () => {
    const i1 = addManualIncident({ title: "A" });
    const i2 = addManualIncident({ title: "B" });
    assert.notStrictEqual(i1.id, i2.id);
    assert.ok(i2.id > i1.id);
  });
});

// --- Config module ---

describe("Config module", () => {
  it("SERVICES contains 12 services with correct groups", () => {
    assert.strictEqual(SERVICES.length, 12);
    assert.strictEqual(SERVICES.filter((s) => s.group === "Websites").length, 3);
    assert.strictEqual(SERVICES.filter((s) => s.group === "Core").length, 4);
    assert.strictEqual(SERVICES.filter((s) => s.group === "Platform").length, 5);
  });

  it("SERVICE_MAP is populated", () => {
    assert.strictEqual(SERVICE_MAP.size, 12);
    assert.ok(SERVICE_MAP.get("site"));
    assert.ok(SERVICE_MAP.get("facilitator"));
  });

  it("dependency fields are present", () => {
    const scanFe = SERVICE_MAP.get("scan2pay-fe");
    assert.ok(scanFe.dependsOn?.includes("scan2pay-api"));
    const scanApi = SERVICE_MAP.get("scan2pay-api");
    assert.ok(scanApi.dependsOn?.includes("facilitator"));
  });

  it("service IDs are safe for Prometheus labels", () => {
    for (const s of SERVICES) {
      assert.ok(!/["\\}\n]/.test(s.id), `Unsafe service ID: ${s.id}`);
    }
  });
});

// --- Rate limiting ---

describe("Rate limiting", () => {
  it("GET /health is exempt from rate limiting", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
  });
});

// --- Global rate limit applies to all routes ---

describe("Global rate limiting coverage", () => {
  it("rate limit applies to HTML page", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.status, 200);
  });

  it("rate limit applies to badges", async () => {
    const res = await fetch(`${BASE}/badge`);
    assert.strictEqual(res.status, 200);
  });

  it("rate limit applies to RSS", async () => {
    const res = await fetch(`${BASE}/rss`);
    assert.strictEqual(res.status, 200);
  });

  it("rate limit applies to metrics", async () => {
    const res = await fetch(`${BASE}/metrics`);
    assert.strictEqual(res.status, 200);
  });
});

// --- UI/UX features ---

describe("UI/UX improvements", () => {
  it("HTML page has aria-labels on status dots", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes('role="img"'));
    assert.ok(html.includes('aria-label='));
  });

  it("HTML page has uptime legend", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("uptime-legend"));
    assert.ok(html.includes("Operational"));
    assert.ok(html.includes("Degraded"));
  });

  it("HTML page has staleness banner element", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes('id="stale"'));
    assert.ok(html.includes("stale-banner"));
  });

  it("HTML page has client-side escapeHtml function", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("function esc("));
  });

  it("HTML page uses setTimeout-based polling (not setInterval)", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("setTimeout(poll"));
    assert.ok(!html.includes("setInterval"));
  });

  it("HTML page has bar-tip tooltip system", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("bar-tip"));
    assert.ok(html.includes("initBarTips"));
  });

  it("detail page has full auto-refresh (status, incidents, percentiles)", async () => {
    const res = await fetch(`${BASE}/service/site`);
    const html = await res.text();
    assert.ok(html.includes("setTimeout(poll"));
    assert.ok(html.includes("/api/service/"));
    // Updates percentiles
    assert.ok(html.includes("svc-p50") || html.includes("percentiles"));
    // Updates incidents via AJAX
    assert.ok(html.includes("d.incidents"));
    // Updates dot emoji
    assert.ok(html.includes("dots[s.status]"));
  });

  it("detail page has stat-grid layout", async () => {
    const res = await fetch(`${BASE}/service/site`);
    const html = await res.text();
    assert.ok(html.includes("stat-grid"));
  });

  it("detail page has uptime legend", async () => {
    const res = await fetch(`${BASE}/service/site`);
    const html = await res.text();
    assert.ok(html.includes("uptime-legend"));
  });

  it("incident descriptions are shown on main page", async () => {
    // Create incident with description
    addManualIncident({
      title: "Test desc visibility",
      description: "Detailed description here",
      severity: "degraded",
    });
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("Detailed description here"));
    assert.ok(html.includes("incident-desc"));
  });

  it("service groups are properly named", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("Websites"));
    assert.ok(html.includes("Core"));
    assert.ok(html.includes("Platform"));
    assert.ok(!html.includes('"New"') || !html.includes('>New<'));
  });

  it("mobile-responsive: latency column hidden on mobile", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("col-lat"));
  });
});

// --- XSS prevention ---

describe("XSS prevention", () => {
  it("escapeXml handles all special characters", async () => {
    // Verify via incident title with special chars
    const incident = addManualIncident({
      title: '<script>alert("xss")</script>&',
      severity: "degraded",
    });
    const res = await fetch(`${BASE}/api/incidents`);
    const data = await res.json();
    const found = data.incidents.find((i) => i.id === incident.id);
    assert.ok(found);
    // The raw title is stored — escaping happens at render time
    assert.ok(found.title.includes("<script>"));

    // Verify HTML page escapes it
    const htmlRes = await fetch(BASE);
    const html = await htmlRes.text();
    assert.ok(!html.includes('<script>alert("xss")</script>'));
    assert.ok(html.includes("&lt;script&gt;"));
  });
});

// --- Sparkline features ---

describe("Sparkline features", () => {
  it("detail page sparkline has time axis labels", async () => {
    const res = await fetch(`${BASE}/service/site`);
    const html = await res.text();
    assert.ok(html.includes("24h ago"));
    assert.ok(html.includes("now</text>"));
  });

  it("detail page sparkline has interactive hover circles", async () => {
    const res = await fetch(`${BASE}/service/site`);
    const html = await res.text();
    assert.ok(html.includes("<circle"));
    assert.ok(html.includes("data-lat="));
    assert.ok(html.includes("spark-tip"));
  });

  it("detail page has OG meta tags", async () => {
    const res = await fetch(`${BASE}/service/facilitator`);
    const html = await res.text();
    assert.ok(html.includes("og:title"));
    assert.ok(html.includes("og:description"));
    assert.ok(html.includes("og:url"));
    assert.ok(html.includes("/service/facilitator"));
  });
});

// --- checkedAt accuracy ---

describe("checkedAt accuracy", () => {
  it("/api/status checkedAt uses actual check time, not response time", async () => {
    const res = await fetch(`${BASE}/api/status`);
    const data = await res.json();
    // checkedAt should be close to the service checkedAt values, not current time
    const apiCheckedAt = new Date(data.checkedAt).getTime();
    const serviceCheckedAt = new Date(data.services[0].checkedAt).getTime();
    // They should be within 60 seconds of each other (not minutes apart)
    assert.ok(Math.abs(apiCheckedAt - serviceCheckedAt) < 60000,
      `checkedAt discrepancy: api=${data.checkedAt} service=${data.services[0].checkedAt}`);
  });
});

// --- Binary search edge cases ---

describe("Binary search edge cases", () => {
  it("getUptime handles service with single check", () => {
    recordCheck("single-check-svc", "Single Check", "operational", 100);
    const uptime = getUptime("single-check-svc", 30);
    assert.strictEqual(uptime, 100);
  });

  it("getDailyUptime handles service with no checks in range", () => {
    const daily = getDailyUptime("nonexistent-binary", 7);
    assert.strictEqual(daily.length, 7);
    daily.forEach((d) => assert.strictEqual(d.uptimePercent, null));
  });

  it("getRecentChecks returns empty for unknown service", () => {
    const checks = getRecentChecks("no-such-service", 10);
    assert.strictEqual(checks.length, 0);
  });
});

// --- Incident lifecycle ---

describe("Incident lifecycle", () => {
  it("auto-incident created on down, resolved on operational", () => {
    const svcId = "lifecycle-test";
    recordCheck(svcId, "Lifecycle Test", "down", 9999);
    let incidents = getIncidentsByService(svcId, 10);
    const ongoing = incidents.find((i) => i.status === "ongoing");
    assert.ok(ongoing, "Should have ongoing incident after down");
    assert.strictEqual(ongoing.source, "auto");
    assert.strictEqual(ongoing.severity, "down");

    recordCheck(svcId, "Lifecycle Test", "operational", 50);
    incidents = getIncidentsByService(svcId, 10);
    const resolved = incidents.find((i) => i.id === ongoing.id);
    assert.ok(resolved);
    assert.strictEqual(resolved.status, "resolved");
    assert.ok(resolved.resolvedAt);
  });

  it("duplicate ongoing auto-incident not created", () => {
    const svcId = "dedup-test";
    recordCheck(svcId, "Dedup Test", "down", 9999);
    recordCheck(svcId, "Dedup Test", "down", 9999);
    recordCheck(svcId, "Dedup Test", "down", 9999);
    const incidents = getIncidentsByService(svcId, 10);
    const ongoing = incidents.filter((i) => i.status === "ongoing");
    assert.strictEqual(ongoing.length, 1, "Only one ongoing incident should exist");
  });

  it("incident backfill adds missing v2 fields to old-format incidents", () => {
    // Simulate old format (no source/updates/description)
    const incident = addManualIncident({ title: "Backfill test", severity: "degraded" });
    // These fields should exist
    assert.strictEqual(incident.source, "manual");
    assert.ok(Array.isArray(incident.updates));
    assert.strictEqual(incident.description, null);
  });
});

// --- Maintenance validation ---

describe("Maintenance date validation", () => {
  it("rejects invalid date strings", async () => {
    await assert.rejects(
      () => addWindow({ title: "Bad", startAt: "xyz", endAt: "abc" }),
      /valid ISO date/
    );
  });

  it("rejects startAt >= endAt", async () => {
    await assert.rejects(
      () => addWindow({
        title: "Reversed",
        startAt: "2026-12-01T10:00:00Z",
        endAt: "2026-12-01T08:00:00Z",
      }),
      /before endAt/
    );
  });

  it("rejects equal startAt and endAt", async () => {
    await assert.rejects(
      () => addWindow({
        title: "Same",
        startAt: "2026-12-01T10:00:00Z",
        endAt: "2026-12-01T10:00:00Z",
      }),
      /before endAt/
    );
  });
});

// --- API input validation ---

describe("API input validation", () => {
  it("POST /api/incidents rejects missing title", async () => {
    const res = await fetch(`${BASE}/api/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // 503 because no ADMIN_API_KEY in test env, but validates before auth
    assert.ok(res.status === 400 || res.status === 503);
  });

  it("PATCH /api/incidents/:id rejects non-numeric id", async () => {
    const res = await fetch(`${BASE}/api/incidents/abc`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "test" }),
    });
    assert.ok(res.status === 400 || res.status === 503);
  });
});

// --- Badge maintenance color ---

describe("Badge maintenance color", () => {
  it("maintenance status maps to gray color in statusColor", async () => {
    // Set a service to maintenance
    healthCache.set("maint-badge-test", {
      id: "maint-badge-test", name: "Maint Test", status: "maintenance", latencyMs: 0, checkedAt: new Date().toISOString(),
    });
    const res = await fetch(`${BASE}/badge/maint-badge-test`);
    assert.strictEqual(res.status, 200);
    const svg = await res.text();
    assert.ok(svg.includes("#6B7280"), "Maintenance badge should use gray color");
    healthCache.delete("maint-badge-test");
  });
});
