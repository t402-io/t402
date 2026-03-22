/**
 * Negative and edge-case tests for the Agent Dashboard API.
 * Covers input validation, XSS prevention, and error handling.
 */
import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = process.env.BASE_URL || "http://localhost:3405";

describe("Input validation", () => {
  // ── Payments endpoint ──────────────────────────────────────────────

  it("GET /api/v1/payments without address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/payments`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, "address parameter required");
  });

  it("GET /api/v1/payments with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=<script>alert(1)</script>`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, "invalid address format");
  });

  it("GET /api/v1/payments with overly long address returns 400", async () => {
    const longAddr = "0x" + "a".repeat(200);
    const res = await fetch(`${BASE}/api/v1/payments?address=${longAddr}`);
    assert.strictEqual(res.status, 400);
  });

  it("GET /api/v1/payments clamps limit to valid range", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=0xTest&limit=999`);
    const data = await res.json();
    assert.ok(data.payments.length <= 100, "limit should be clamped to 100");
  });

  it("GET /api/v1/payments handles NaN limit gracefully", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=0xTest&limit=abc`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.payments.length > 0, "should use default limit");
  });

  it("GET /api/v1/payments handles negative days gracefully", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=0xTest&days=-5`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.payments.length > 0, "should clamp days to minimum 1");
  });

  it("GET /api/v1/payments handles zero limit gracefully", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=0xTest&limit=0`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // limit=0 gets clamped to 1
    assert.ok(data.payments.length <= 1);
  });

  // ── Balances endpoint ──────────────────────────────────────────────

  it("GET /api/v1/balances with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/balances/%3Cscript%3E`);
    assert.strictEqual(res.status, 400);
  });

  // ── Budget endpoint ────────────────────────────────────────────────

  it("GET /api/v1/budget with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/budget/a%20b%20c`);
    assert.strictEqual(res.status, 400);
  });

  // ── Stats endpoint ─────────────────────────────────────────────────

  it("GET /api/v1/stats with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/stats/test%22onmouseover%3D%22alert(1)`);
    assert.strictEqual(res.status, 400);
  });

  it("GET /api/v1/stats clamps days parameter", async () => {
    const res = await fetch(`${BASE}/api/v1/stats/0xTest?days=9999`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.period, "365d"); // clamped to max 365
  });

  // ── Alerts endpoint ────────────────────────────────────────────────

  it("GET /api/v1/alerts with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/alerts/{}`);
    assert.strictEqual(res.status, 400);
  });

  // ── Export endpoint ────────────────────────────────────────────────

  it("GET /api/v1/export with invalid address returns 400", async () => {
    const res = await fetch(`${BASE}/api/v1/export/<img>`);
    assert.strictEqual(res.status, 400);
  });

  it("GET /api/v1/export Content-Disposition filename is sanitized", async () => {
    const res = await fetch(`${BASE}/api/v1/export/0xTestAddr`);
    const cd = res.headers.get("content-disposition");
    assert.ok(cd.includes("0xTestAddr"), "filename should contain safe portion");
    assert.ok(!cd.includes("<"), "filename should not contain angle brackets");
  });
});

describe("XSS prevention", () => {
  it("GET / with XSS address does not inject raw HTML", async () => {
    const xss = encodeURIComponent('"><script>alert(1)</script>');
    const res = await fetch(`${BASE}/?address=${xss}`);
    const html = await res.text();
    // The raw script tag should NOT appear unescaped
    assert.ok(!html.includes("<script>alert(1)</script>"), "XSS payload should be escaped");
  });

  it("GET / with event handler XSS is escaped", async () => {
    const xss = encodeURIComponent('" onfocus="alert(1)" autofocus="');
    const res = await fetch(`${BASE}/?address=${xss}`);
    const html = await res.text();
    assert.ok(!html.includes('onfocus="alert'), "Event handler should be escaped");
  });

  it("GET / with invalid address shows onboarding instead of data", async () => {
    const xss = encodeURIComponent("<script>alert(1)</script>");
    const res = await fetch(`${BASE}/?address=${xss}`);
    const html = await res.text();
    // Invalid address should trigger overview (empty state), not data view
    assert.ok(html.includes("Global Overview"), "Should show overview for invalid address");
  });
});

describe("Security headers", () => {
  it("CSP header is set with self directives", async () => {
    const res = await fetch(`${BASE}/health`);
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp, "CSP header should be present");
    assert.ok(csp.includes("default-src 'none'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("connect-src 'self'"));
    assert.ok(csp.includes("script-src 'self'"));
    assert.ok(csp.includes("style-src 'self'"));
  });

  it("X-Frame-Options is DENY", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
  });

  it("X-Content-Type-Options is nosniff", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
  });

  it("Permissions-Policy is set", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.ok(res.headers.get("permissions-policy"));
  });

  it("Cross-Origin-Opener-Policy is same-origin", async () => {
    const res = await fetch(`${BASE}/health`);
    assert.strictEqual(res.headers.get("cross-origin-opener-policy"), "same-origin");
  });

  it("Strict-Transport-Security is set", async () => {
    const res = await fetch(`${BASE}/health`);
    const hsts = res.headers.get("strict-transport-security");
    assert.ok(hsts);
    assert.ok(hsts.includes("max-age="));
    assert.ok(hsts.includes("includeSubDomains"));
  });
});

describe("CORS", () => {
  it("OPTIONS returns 204 with CORS headers", async () => {
    const res = await fetch(`${BASE}/api/v1/payments`, { method: "OPTIONS" });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
    assert.ok(res.headers.get("access-control-allow-methods").includes("GET"));
  });
});

describe("Edge cases", () => {
  it("Empty address string returns 400 for payments", async () => {
    const res = await fetch(`${BASE}/api/v1/payments?address=`);
    assert.strictEqual(res.status, 400);
  });

  it("Valid addresses with special chars work", async () => {
    // CAIP-2 format with colons and dots
    const res = await fetch(`${BASE}/api/v1/balances/eip155:8453.test`);
    assert.strictEqual(res.status, 200);
  });

  it("Cache-Control header is set on API responses", async () => {
    const res = await fetch(`${BASE}/api/v1/balances/0xTest`);
    // In demo mode, should be public
    assert.strictEqual(res.headers.get("cache-control"), "public, max-age=60");
  });
});
