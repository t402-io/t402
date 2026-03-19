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
  });

  it("GET /api/v1/transactions supports cursor-based pagination", async () => {
    const page1 = await fetch(`${BASE}/api/v1/transactions?limit=5`);
    const data1 = await page1.json();
    assert.strictEqual(data1.transactions.length, 5);
    assert.ok(data1.hasMore);
    const page2 = await fetch(`${BASE}/api/v1/transactions?limit=5&cursor=${data1.nextCursor}`);
    const data2 = await page2.json();
    assert.ok(data2.transactions.length > 0);
    const hashes1 = new Set(data1.transactions.map(t => t.txHash));
    for (const tx of data2.transactions) assert.ok(!hashes1.has(tx.txHash));
  });

  it("filters by network", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?network=eip155:8453`);
    const data = await res.json();
    assert.ok(data.transactions.every(t => t.network === "eip155:8453"));
  });

  it("filters by token", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?token=USDC`);
    const data = await res.json();
    assert.ok(data.transactions.length > 0);
    assert.ok(data.transactions.every(t => t.token === "USDC"));
  });

  it("GET /api/v1/transactions/:hash returns single tx", async () => {
    const list = await fetch(`${BASE}/api/v1/transactions?limit=1`);
    const { transactions } = await list.json();
    const res = await fetch(`${BASE}/api/v1/transactions/${transactions[0].txHash}`);
    const tx = await res.json();
    assert.strictEqual(tx.txHash, transactions[0].txHash);
    assert.ok(tx.network && tx.amount && tx.from && tx.to);
  });

  it("returns 404 for unknown hash", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions/0xdeadbeef`);
    assert.strictEqual(res.status, 404);
  });

  it("GET /api/v1/stats returns all fields", async () => {
    const res = await fetch(`${BASE}/api/v1/stats`);
    const data = await res.json();
    assert.ok(data.totalTransactions >= 0);
    assert.ok(typeof data.totalVolume === "string");
    assert.ok(Object.keys(data.byNetwork).length > 0);
    assert.ok(data.period);
  });

  it("GET /api/v1/stats?days= custom period", async () => {
    const res = await fetch(`${BASE}/api/v1/stats?days=30`);
    const data = await res.json();
    assert.strictEqual(data.period, "30d");
  });

  it("GET /api/v1/networks sorted by count", async () => {
    const res = await fetch(`${BASE}/api/v1/networks`);
    const data = await res.json();
    assert.ok(data.networks.length > 0);
    for (let i = 1; i < data.networks.length; i++) assert.ok(data.networks[i-1].count >= data.networks[i].count);
  });

  it("GET /api/v1/tokens returns tokens", async () => {
    const res = await fetch(`${BASE}/api/v1/tokens`);
    const data = await res.json();
    assert.ok(data.tokens.length > 0);
  });

  it("search returns results", async () => {
    const list = await fetch(`${BASE}/api/v1/transactions?limit=1`);
    const { transactions } = await list.json();
    const res = await fetch(`${BASE}/api/v1/search?q=${transactions[0].txHash.slice(0,12)}`);
    const data = await res.json();
    assert.ok(data.results.length > 0);
  });

  it("empty search returns empty", async () => {
    const res = await fetch(`${BASE}/api/v1/search?q=`);
    const data = await res.json();
    assert.deepStrictEqual(data.results, []);
  });

  it("GET / returns HTML", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("T402 Explorer"));
    assert.ok(html.includes("networkFilter"));
    assert.ok(html.includes("pagination"));
  });

  it("CORS headers present", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions`);
    assert.strictEqual(res.headers.get("access-control-allow-origin"), "*");
  });
});

describe("Security", () => {
  it("CSP header restricts sources", async () => {
    const res = await fetch(BASE);
    const csp = res.headers.get("content-security-policy");
    assert.ok(csp);
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("script-src 'self'"));
  });

  it("XSS search escaped in JSON", async () => {
    const xss = "<script>alert(1)</script>";
    const res = await fetch(`${BASE}/api/v1/search?q=${encodeURIComponent(xss)}`);
    const data = await res.json();
    assert.strictEqual(data.query, xss);
    assert.strictEqual(data.total, 0);
  });

  it("HTML has no unescaped script tags", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(!html.includes("<script>alert"));
  });

  it("X-Frame-Options DENY", async () => {
    const res = await fetch(BASE);
    assert.strictEqual(res.headers.get("x-frame-options"), "DENY");
  });

  it("nosniff header", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions`);
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
  });
});

describe("Transaction detail page", () => {
  it("renders HTML for valid hash", async () => {
    const list = await fetch(`${BASE}/api/v1/transactions?limit=1`);
    const { transactions } = await list.json();
    const res = await fetch(`${BASE}/tx/${transactions[0].txHash}`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Transaction Details"));
    assert.ok(html.includes(transactions[0].txHash));
    assert.ok(html.includes("copy-btn"));
    assert.ok(html.includes("status-confirmed"));
    assert.ok(html.includes("/static/style.css"));
  });

  it("returns 404 for unknown hash", async () => {
    const res = await fetch(`${BASE}/tx/0xnonexistent`);
    assert.strictEqual(res.status, 404);
    const html = await res.text();
    assert.ok(html.includes("Not Found"));
  });

  it("no inline handlers in detail page", async () => {
    const list = await fetch(`${BASE}/api/v1/transactions?limit=1`);
    const { transactions } = await list.json();
    const res = await fetch(`${BASE}/tx/${transactions[0].txHash}`);
    const html = await res.text();
    assert.ok(!html.includes("onclick="));
  });
});

describe("Static assets", () => {
  it("serves CSS", async () => {
    const res = await fetch(`${BASE}/static/style.css`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("css"));
  });

  it("serves JS without innerHTML", async () => {
    const res = await fetch(`${BASE}/static/app.js`);
    assert.strictEqual(res.status, 200);
    const js = await res.text();
    assert.ok(js.includes("createElement"));
    assert.ok(!js.includes(".innerHTML ="));
  });
});

describe("Index page safety", () => {
  it("no inline handlers", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(!html.includes("onclick="));
    assert.ok(!html.includes("onchange="));
    assert.ok(!html.includes("onkeyup="));
  });

  it("uses external CSS/JS", async () => {
    const res = await fetch(BASE);
    const html = await res.text();
    assert.ok(html.includes("/static/style.css"));
    assert.ok(html.includes("/static/app.js"));
  });
});

describe("Seed data correctness", () => {
  it("correct address formats per chain", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?limit=100`);
    const data = await res.json();
    for (const tx of data.transactions) {
      if (tx.network.startsWith("eip155:")) { assert.ok(tx.from.startsWith("0x")); assert.ok(tx.to.startsWith("0x")); }
      else if (tx.network.startsWith("ton:")) { assert.ok(tx.from.startsWith("UQ")); assert.ok(tx.to.startsWith("UQ")); }
      else if (tx.network.startsWith("tron:")) { assert.ok(tx.from.startsWith("T")); assert.ok(tx.to.startsWith("T")); }
      else if (tx.network.startsWith("stellar:")) { assert.ok(tx.from.startsWith("G")); assert.ok(tx.to.startsWith("G")); }
      else if (tx.network.startsWith("solana:")) { assert.ok(!tx.from.startsWith("0x")); }
    }
  });

  it("only valid schemes", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?limit=100`);
    const data = await res.json();
    for (const tx of data.transactions) {
      assert.ok(tx.scheme === "exact" || tx.scheme === "exact-legacy");
      if (!tx.network.startsWith("eip155:")) assert.strictEqual(tx.scheme, "exact");
    }
  });

  it("EVM hashes start with 0x", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?limit=100`);
    const data = await res.json();
    for (const tx of data.transactions) {
      if (tx.network.startsWith("eip155:")) assert.ok(tx.txHash.startsWith("0x"));
      else if (tx.network.startsWith("solana:")) assert.ok(!tx.txHash.startsWith("0x"));
    }
  });

  it("amounts in valid range", async () => {
    const res = await fetch(`${BASE}/api/v1/transactions?limit=100`);
    const data = await res.json();
    for (const tx of data.transactions) {
      assert.ok(/^\d+$/.test(tx.amount));
      const h = parseInt(tx.amount) / 1e6;
      assert.ok(h >= 0.01 && h <= 100000);
    }
  });
});

describe("Health details", () => {
  it("includes db status and mode", async () => {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    assert.ok(data.db);
    assert.strictEqual(typeof data.db.sqlite, "boolean");
    assert.strictEqual(typeof data.db.pg, "boolean");
    assert.ok(data.mode);
  });
});
