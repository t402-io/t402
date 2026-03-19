import { describe, it } from "node:test";
import assert from "node:assert";

const BASE = "http://localhost:3404";

describe("Explorer API", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert.strictEqual(data.status, "ok");
    assert.strictEqual(data.service, "t402-explorer");
  });

  it("GET /api/v1/transactions returns list with pagination fields", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions`);
    const data = await res.json();
    assert.ok(data.transactions.length > 0);
    assert.ok(data.total > 0);
    assert.strictEqual(typeof data.hasMore, "boolean");
    assert.ok(data.nextCursor === null || typeof data.nextCursor === "string");
  });

  it("GET /api/v1/transactions respects limit parameter", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?limit=5`);
    const data = await res.json();
    assert.ok(data.transactions.length <= 5);
    assert.strictEqual(typeof data.hasMore, "boolean");
  });

  it("GET /api/v1/transactions supports cursor-based pagination", async () => {
    const page1 = await fetch(`${BASE}/api/v1/transactions?limit=5`);
    const data1 = await page1.json();
    assert.strictEqual(data1.transactions.length, 5);
    assert.ok(data1.hasMore);
    assert.ok(data1.nextCursor);

    const page2 = await fetch(`${BASE}/api/v1/transactions?limit=5&cursor=${data1.nextCursor}`);
    const data2 = await page2.json();
    assert.ok(data2.transactions.length > 0);
    // Ensure no overlap between pages
    const hashes1 = new Set(data1.transactions.map((t) => t.txHash));
    for (const tx of data2.transactions) {
      assert.ok(!hashes1.has(tx.txHash), "Pages should not overlap");
    }
  });

  it("GET /api/v1/transactions?network= filters by network", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?network=eip155:8453`);
    const data = await res.json();
    assert.ok(data.transactions.every((t) => t.network === "eip155:8453"));
  });

  it("GET /api/v1/transactions?token= filters by token", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?token=USDC`);
    const data = await res.json();
    assert.ok(data.transactions.length > 0);
    assert.ok(data.transactions.every((t) => t.token === "USDC"));
  });

  it("GET /api/v1/transactions/:hash returns single transaction", async () => {
    const list = await fetch(`${BASE}/api/v1/transactions?limit=1`);
    const { transactions } = await list.json();
    const hash = transactions[0].txHash;

    const res = await fetch(`${BASE}/api/v1/transactions/${hash}`);
    const tx = await res.json();
    assert.strictEqual(tx.txHash, hash);
    assert.ok(tx.network);
    assert.ok(tx.amount);
    assert.ok(tx.from);
    assert.ok(tx.to);
  });

  it("GET /api/v1/transactions/:hash returns 404 for unknown hash", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions/0xdeadbeef`);
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.error, "Transaction not found");
  });

  it("GET /api/v1/stats returns totals with all fields", async () => {
    const res = await fetch(`${BASE}/api/v1/stats`);
    const data = await res.json();
    assert.ok(data.totalTransactions >= 0);
    assert.ok(typeof data.totalVolume === "string");
    assert.ok(typeof data.uniquePayers === "number");
    assert.ok(typeof data.uniqueRecipients === "number");
    assert.ok(Object.keys(data.byNetwork).length > 0);
    assert.ok(Object.keys(data.byToken).length > 0);
    assert.ok(Object.keys(data.byScheme).length > 0);
    assert.ok(data.period);
  });

  it("GET /api/v1/stats?days= accepts custom period", async () => {
    const res = await fetch(`${BASE}/api/v1/stats?days=30`);
    const data = await res.json();
    assert.strictEqual(data.period, "30d");
  });

  it("GET /api/v1/networks returns unique networks with counts", async () => {
    const res = await fetch(`${BASE}/api/v1/networks`);
    const data = await res.json();
    assert.ok(Array.isArray(data.networks));
    assert.ok(data.networks.length > 0);
    assert.ok(data.total > 0);
    for (const entry of data.networks) {
      assert.ok(typeof entry.network === "string");
      assert.ok(typeof entry.count === "number");
      assert.ok(entry.count > 0);
    }
    // Should be sorted by count descending
    for (let i = 1; i < data.networks.length; i++) {
      assert.ok(data.networks[i - 1].count >= data.networks[i].count);
    }
  });

  it("GET /api/v1/tokens returns unique tokens with counts", async () => {
    const res = await fetch(`${BASE}/api/v1/tokens`);
    const data = await res.json();
    assert.ok(Array.isArray(data.tokens));
    assert.ok(data.tokens.length > 0);
    assert.ok(data.total > 0);
    for (const entry of data.tokens) {
      assert.ok(typeof entry.token === "string");
      assert.ok(typeof entry.count === "number");
      assert.ok(entry.count > 0);
    }
  });

  it("GET /api/v1/search returns results", async () => {
    const list = await fetch(`${BASE}/api/v1/transactions?limit=1`);
    const { transactions } = await list.json();
    const hash = transactions[0].txHash;

    const res = await fetch(`${BASE}/api/v1/search?q=${hash.slice(0, 12)}`);
    const data = await res.json();
    assert.ok(data.results.length > 0);
    assert.ok(data.total > 0);
    assert.ok(data.query);
  });

  it("GET /api/v1/search with empty query returns empty", async () => {
    const res = await fetch(`${BASE}/api/v1/search?q=`);
    const data = await res.json();
    assert.deepStrictEqual(data.results, []);
    assert.strictEqual(data.total, 0);
  });

  it("GET / returns HTML with explorer UI", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("T402 Explorer"));
    assert.ok(html.includes("networkFilter"));
    assert.ok(html.includes("tokenFilter"));
    assert.ok(html.includes("pagination"));
  });

  it("responses include CORS headers", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions`);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
  });
});
