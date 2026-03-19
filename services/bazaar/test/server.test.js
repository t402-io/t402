import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = process.env.BASE_URL || "http://localhost:3402";
const ADMIN_KEY = process.env.BAZAAR_ADMIN_KEY;

// ── Health / Ready / Metrics ──────────────────────────────────────────

describe("Health / Ready / Metrics", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.service, "t402-bazaar");
    assert.ok(data.services >= 8, `Expected >= 8 services, got ${data.services}`);
  });

  it("GET /ready returns ready", async () => {
    const res = await fetch(`${BASE}/ready`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, "ready");
  });

  it("GET /metrics returns request metrics", async () => {
    const res = await fetch(`${BASE}/metrics`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.uptime === "number", "uptime should be a number");
    assert.ok(data.requests, "requests object should exist");
    assert.ok(data.verifications, "verifications object should exist");
    assert.ok(data.registrations, "registrations object should exist");
    assert.ok(data.store, "store object should exist");
    assert.ok(data.store.services >= 8, `Expected >= 8 services in store, got ${data.store.services}`);
  });
});

// ── Search ────────────────────────────────────────────────────────────

describe("Search", () => {
  it("basic search q=weather", async () => {
    const res = await fetch(`${BASE}/api/v1/search?q=weather`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.services.length > 0, "Should find weather services");
    assert.ok(
      data.services[0].name.toLowerCase().includes("weather"),
      "First result should match weather"
    );
  });

  it("category filter (ai = 3 services)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?category=ai`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.total, 3, `Expected 3 AI services, got ${data.total}`);
    assert.ok(data.services.every((s) => s.category === "ai"));
  });

  it("network filter (eip155:42161 = 2)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?network=eip155:42161`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.total, 2, `Expected 2 services on eip155:42161, got ${data.total}`);
    assert.ok(data.services.every((s) => s.price.network === "eip155:42161"));
  });

  it("maxPrice filter (0.005)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?maxPrice=0.005`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.services.length > 0, "Should find services under 0.005");
    // 0.005 * 1e6 = 5000
    assert.ok(data.services.every((s) => parseInt(s.price.amount) <= 5000));
  });

  it("limit cap (999999 clamped to max 100)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?limit=999999`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(
      data.pagination.limit <= 100,
      `Limit should be capped at 100, got ${data.pagination.limit}`
    );
  });

  it("pagination (limit=2&offset=2)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?limit=2&offset=2`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.count, 2, "Should return 2 services");
    assert.strictEqual(data.pagination.offset, 2);
    assert.strictEqual(data.pagination.limit, 2);
    assert.ok(data.total >= 8, "Total should include all services");
  });

  it("sorted (verified first)", async () => {
    const res = await fetch(`${BASE}/api/v1/search`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Find the first unverified service index
    const firstUnverifiedIdx = data.services.findIndex((s) => !s.verified);
    if (firstUnverifiedIdx > -1) {
      // All services after this point should also be unverified
      const afterUnverified = data.services.slice(firstUnverifiedIdx);
      assert.ok(
        afterUnverified.every((s) => !s.verified),
        "All services after first unverified should be unverified"
      );
    }
  });

  it("empty query returns all (total >= 8)", async () => {
    const res = await fetch(`${BASE}/api/v1/search`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.total >= 8, `Expected >= 8 services, got ${data.total}`);
  });

  it("no match returns empty", async () => {
    const res = await fetch(`${BASE}/api/v1/search?q=xyznonexistent9999`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.services.length, 0, "Should return no services for nonexistent query");
    assert.strictEqual(data.total, 0);
  });

  it("multi-word query (weather+forecast matches, weather+zzzznonexistent fails)", async () => {
    // Both terms match
    const res1 = await fetch(`${BASE}/api/v1/search?q=weather+forecast`);
    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json();
    assert.ok(data1.services.length > 0, "weather+forecast should match");

    // Second term does not match
    const res2 = await fetch(`${BASE}/api/v1/search?q=weather+zzzznonexistent`);
    assert.strictEqual(res2.status, 200);
    const data2 = await res2.json();
    assert.strictEqual(data2.services.length, 0, "weather+zzzznonexistent should not match");
  });

  it("token filter (USDT0)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?token=USDT0`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.services.length > 0, "Should find USDT0 services");
    assert.ok(data.services.every((s) => s.price.token === "USDT0"));
  });

  it("tags filter (llm,inference)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?tags=llm,inference`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.services.length > 0, "Should find services with llm or inference tags");
    assert.ok(
      data.services.every((s) => {
        const tags = (s.tags || []).map((t) => t.toLowerCase());
        return tags.includes("llm") || tags.includes("inference");
      })
    );
  });

  it("verified filter (verified=true)", async () => {
    const res = await fetch(`${BASE}/api/v1/search?verified=true`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.services.length > 0, "Should find verified services");
    assert.ok(data.services.every((s) => s.verified === true));
  });
});

// ── CRUD ──────────────────────────────────────────────────────────────

describe("CRUD", () => {
  it("GET service by ID (svc-001, check updatedAt)", async () => {
    const res = await fetch(`${BASE}/api/v1/services/svc-001`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.id, "svc-001");
    assert.ok(data.updatedAt, "updatedAt should be present");
    assert.ok(data.name, "name should be present");
    assert.ok(data.price, "price should be present");
  });

  it("GET 404 for unknown", async () => {
    const res = await fetch(`${BASE}/api/v1/services/nonexistent-id`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });

  it("POST without auth returns 401 or 503", async () => {
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://no-auth-test.example.com",
        name: "No Auth Test",
        price: { amount: "1000", token: "USDC", network: "eip155:8453" },
      }),
    });
    assert.ok(
      res.status === 401 || res.status === 503,
      `Expected 401 or 503, got ${res.status}`
    );
  });

  it("POST with X-API-Key auth returns 201", async () => {
    if (!ADMIN_KEY) return;
    const uniqueUrl = `https://test-apikey-${Date.now()}.example.com`;
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({
        url: uniqueUrl,
        name: "API Key Auth Test Service",
        price: { amount: "1000", token: "USDC", network: "eip155:8453" },
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id.startsWith("svc-"), "ID should start with svc-");
    assert.strictEqual(data.url, uniqueUrl);
  });

  it("POST with Bearer auth returns 201", async () => {
    if (!ADMIN_KEY) return;
    const uniqueUrl = `https://test-bearer-${Date.now()}.example.com`;
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
      body: JSON.stringify({
        url: uniqueUrl,
        name: "Bearer Auth Test Service",
        price: { amount: "2000", token: "USDT", network: "eip155:1" },
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id.startsWith("svc-"), "ID should start with svc-");
  });

  it("POST rejects invalid input with 400 and details", async () => {
    if (!ADMIN_KEY) return;
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({
        // Missing url, name, price
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error, "Should have error message");
    assert.ok(Array.isArray(data.details), "Should have details array");
    assert.ok(data.details.length > 0, "Should have validation errors");
  });

  it("POST rejects unsupported token (DOGE) with 400", async () => {
    if (!ADMIN_KEY) return;
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({
        url: `https://test-doge-${Date.now()}.example.com`,
        name: "Doge Token Test",
        price: { amount: "1000", token: "DOGE", network: "eip155:8453" },
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.details.some((d) => d.includes("token")), "Should mention invalid token");
  });

  it("POST rejects duplicate URL with 409", async () => {
    if (!ADMIN_KEY) return;
    // Use the URL of an existing seed service
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({
        url: "https://api.weather402.com/forecast",
        name: "Duplicate Weather Service",
        price: { amount: "1000", token: "USDC", network: "eip155:8453" },
      }),
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.includes("already registered"));
    assert.ok(data.existingId, "Should return existing service ID");
  });

  it("POST sanitizes HTML (strips script/img tags)", async () => {
    if (!ADMIN_KEY) return;
    const uniqueUrl = `https://test-xss-${Date.now()}.example.com`;
    const res = await fetch(`${BASE}/api/v1/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({
        url: uniqueUrl,
        name: 'Test <script>alert("xss")</script> Service',
        description: 'Has <img src=x onerror=alert(1)> image',
        price: { amount: "1000", token: "USDC", network: "eip155:8453" },
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(!data.name.includes("<script>"), "Name should not contain script tags");
    assert.ok(!data.description.includes("<img"), "Description should not contain img tags");
    assert.ok(data.name.includes("Test"), "Name should still contain non-HTML text");
    assert.ok(data.name.includes("Service"), "Name should still contain non-HTML text");
  });

  it("PUT without auth returns 401 or 503", async () => {
    const res = await fetch(`${BASE}/api/v1/services/svc-001`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated Name" }),
    });
    assert.ok(
      res.status === 401 || res.status === 503,
      `Expected 401 or 503, got ${res.status}`
    );
  });

  it("PUT with auth updates (verify persistence with GET)", async () => {
    if (!ADMIN_KEY) return;
    const updatedName = `Updated Weather API ${Date.now()}`;
    const putRes = await fetch(`${BASE}/api/v1/services/svc-001`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({ name: updatedName }),
    });
    assert.strictEqual(putRes.status, 200);
    const putData = await putRes.json();
    assert.strictEqual(putData.name, updatedName);

    // Verify persistence with GET
    const getRes = await fetch(`${BASE}/api/v1/services/svc-001`);
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert.strictEqual(getData.name, updatedName, "Name should persist after PUT");
  });

  it("PUT 404 for unknown", async () => {
    if (!ADMIN_KEY) return;
    const res = await fetch(`${BASE}/api/v1/services/nonexistent-id`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_KEY,
      },
      body: JSON.stringify({ name: "Ghost Service" }),
    });
    assert.strictEqual(res.status, 404);
  });

  it("DELETE without auth returns 401 or 503", async () => {
    const res = await fetch(`${BASE}/api/v1/services/svc-001`, {
      method: "DELETE",
    });
    assert.ok(
      res.status === 401 || res.status === 503,
      `Expected 401 or 503, got ${res.status}`
    );
  });
});

// ── Tags ──────────────────────────────────────────────────────────────

describe("Tags", () => {
  it("GET /api/v1/tags returns tag counts (llm >= 1, weather >= 1)", async () => {
    const res = await fetch(`${BASE}/api/v1/tags`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.tags, "tags object should exist");
    assert.ok(data.tags["llm"] >= 1, `llm tag count should be >= 1, got ${data.tags["llm"]}`);
    assert.ok(
      data.tags["weather"] >= 1,
      `weather tag count should be >= 1, got ${data.tags["weather"]}`
    );
  });

  it("services include tags array (svc-001 has weather tag)", async () => {
    const res = await fetch(`${BASE}/api/v1/services/svc-001`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.tags), "tags should be an array");
    assert.ok(data.tags.includes("weather"), `svc-001 tags should include "weather", got ${JSON.stringify(data.tags)}`);
  });
});

// ── Discovery ─────────────────────────────────────────────────────────

describe("Discovery", () => {
  it("GET /api/v1/featured (verified, max 5)", async () => {
    const res = await fetch(`${BASE}/api/v1/featured`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.services), "services should be an array");
    assert.ok(data.count <= 5, `Featured should return at most 5 services, got ${data.count}`);
    assert.ok(
      data.services.every((s) => s.verified),
      "All featured services should be verified"
    );
  });

  it("GET /api/v1/categories (has ai, data)", async () => {
    const res = await fetch(`${BASE}/api/v1/categories`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.categories, "categories object should exist");
    assert.ok(data.categories["ai"] > 0, "Should have ai category");
    assert.ok(data.categories["data"] > 0, "Should have data category");
  });

  it("GET /api/v1/stats (totalServices >= 8, verified >= 8, networks, tokens)", async () => {
    const res = await fetch(`${BASE}/api/v1/stats`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.totalServices >= 8, `Expected >= 8 totalServices, got ${data.totalServices}`);
    assert.ok(data.verified >= 8, `Expected >= 8 verified, got ${data.verified}`);
    assert.ok(data.networks, "networks object should exist");
    assert.ok(Object.keys(data.networks).length > 0, "Should have at least one network");
    assert.ok(data.tokens, "tokens object should exist");
    assert.ok(Object.keys(data.tokens).length > 0, "Should have at least one token");
  });
});

// ── Security ──────────────────────────────────────────────────────────

describe("Security", () => {
  it("security headers present (nosniff, DENY, strict-origin-when-cross-origin)", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(
      res.headers.get("x-content-type-options"),
      "nosniff",
      "X-Content-Type-Options should be nosniff"
    );
    assert.strictEqual(
      res.headers.get("x-frame-options"),
      "DENY",
      "X-Frame-Options should be DENY"
    );
    assert.strictEqual(
      res.headers.get("referrer-policy"),
      "strict-origin-when-cross-origin",
      "Referrer-Policy should be strict-origin-when-cross-origin"
    );
  });

  it("CORS header (*)", async () => {
    const res = await fetch(`${BASE}/api/v1/search`);
    assert.strictEqual(
      res.headers.get("access-control-allow-origin"),
      "*",
      "Access-Control-Allow-Origin should be *"
    );
  });

  it("rate limiting headers", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.status, 200);
    assert.ok(
      res.headers.has("x-ratelimit-limit"),
      "X-RateLimit-Limit header should be present"
    );
    assert.ok(
      res.headers.has("x-ratelimit-remaining"),
      "X-RateLimit-Remaining header should be present"
    );
  });

  it("OPTIONS 204 preflight (methods include DELETE, PUT)", async () => {
    const res = await fetch(`${BASE}/api/v1/services`, { method: "OPTIONS" });
    assert.strictEqual(res.status, 204, `Expected 204 for OPTIONS, got ${res.status}`);
    const allowedMethods = res.headers.get("access-control-allow-methods");
    assert.ok(allowedMethods, "Access-Control-Allow-Methods should be present");
    assert.ok(allowedMethods.includes("DELETE"), "Allowed methods should include DELETE");
    assert.ok(allowedMethods.includes("PUT"), "Allowed methods should include PUT");
  });
});
