import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = "http://localhost:3403";

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
  });

  it("GET / returns HTML", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("T402 Status"));
  });
});
