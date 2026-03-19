import { describe, it, before } from "node:test";
import assert from "node:assert";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, rmSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_DIR = join(__dirname, "..", "test-store-data");
const TEST_DB_PATH = join(TEST_DB_DIR, "test.db");

// Clean up before tests
if (existsSync(TEST_DB_DIR)) rmSync(TEST_DB_DIR, { recursive: true });
mkdirSync(TEST_DB_DIR, { recursive: true });

describe("Store — SQLite direct", () => {
  let db;

  before(() => {
    db = new Database(TEST_DB_PATH);
    db.pragma("journal_mode = WAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'other',
        price_amount TEXT NOT NULL,
        price_token TEXT NOT NULL,
        price_network TEXT NOT NULL,
        methods TEXT NOT NULL DEFAULT '["GET"]',
        tags TEXT NOT NULL DEFAULT '[]',
        owner TEXT NOT NULL DEFAULT 'unknown',
        verified INTEGER NOT NULL DEFAULT 0,
        verification TEXT,
        discovery TEXT,
        registered_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
      CREATE INDEX IF NOT EXISTS idx_services_verified ON services(verified);
      CREATE INDEX IF NOT EXISTS idx_services_network ON services(price_network);
    `);
  });

  const insertStmt = () =>
    db.prepare(`
    INSERT INTO services (id, url, name, description, category, price_amount, price_token, price_network, methods, tags, owner, verified, verification, discovery, registered_at, updated_at)
    VALUES (@id, @url, @name, @description, @category, @price_amount, @price_token, @price_network, @methods, @tags, @owner, @verified, @verification, @discovery, @registered_at, @updated_at)
  `);

  it("inserts and retrieves a service", () => {
    const stmt = insertStmt();
    const now = new Date().toISOString();
    stmt.run({
      id: "svc-test-001",
      url: "https://test.example.com/api",
      name: "Test Service",
      description: "A test service",
      category: "test",
      price_amount: "1000",
      price_token: "USDC",
      price_network: "eip155:8453",
      methods: '["GET"]',
      tags: '["test","unit"]',
      owner: "0x1234",
      verified: 1,
      verification: null,
      discovery: null,
      registered_at: now,
      updated_at: now,
    });

    const row = db.prepare("SELECT * FROM services WHERE id = ?").get("svc-test-001");
    assert.strictEqual(row.name, "Test Service");
    assert.strictEqual(row.price_token, "USDC");
    assert.deepStrictEqual(JSON.parse(row.methods), ["GET"]);
    assert.deepStrictEqual(JSON.parse(row.tags), ["test", "unit"]);
    assert.strictEqual(row.verified, 1);
  });

  it("enforces URL uniqueness", () => {
    const stmt = insertStmt();
    const now = new Date().toISOString();
    assert.throws(
      () =>
        stmt.run({
          id: "svc-test-002",
          url: "https://test.example.com/api", // duplicate
          name: "Duplicate",
          description: "",
          category: "test",
          price_amount: "1000",
          price_token: "USDC",
          price_network: "eip155:8453",
          methods: "[]",
          tags: "[]",
          owner: "unknown",
          verified: 0,
          verification: null,
          discovery: null,
          registered_at: now,
          updated_at: now,
        }),
      /UNIQUE constraint failed/,
    );
  });

  it("updates a service", () => {
    db.prepare("UPDATE services SET name = ?, updated_at = ? WHERE id = ?").run(
      "Updated Name",
      new Date().toISOString(),
      "svc-test-001",
    );
    const row = db.prepare("SELECT name FROM services WHERE id = ?").get("svc-test-001");
    assert.strictEqual(row.name, "Updated Name");
  });

  it("deletes a service", () => {
    db.prepare("DELETE FROM services WHERE id = ?").run("svc-test-001");
    const row = db.prepare("SELECT * FROM services WHERE id = ?").get("svc-test-001");
    assert.strictEqual(row, undefined);
  });

  it("counts services correctly", () => {
    const stmt = insertStmt();
    const now = new Date().toISOString();
    for (let i = 1; i <= 5; i++) {
      stmt.run({
        id: `svc-count-${i}`,
        url: `https://count-${i}.example.com`,
        name: `Count ${i}`,
        description: "",
        category: i <= 3 ? "ai" : "data",
        price_amount: "1000",
        price_token: "USDC",
        price_network: "eip155:8453",
        methods: "[]",
        tags: "[]",
        owner: "unknown",
        verified: i <= 3 ? 1 : 0,
        verification: null,
        discovery: null,
        registered_at: now,
        updated_at: now,
      });
    }

    const total = db.prepare("SELECT COUNT(*) as count FROM services").get();
    assert.strictEqual(total.count, 5);

    const verified = db.prepare("SELECT COUNT(*) as count FROM services WHERE verified = 1").get();
    assert.strictEqual(verified.count, 3);
  });

  it("queries by category using index", () => {
    const rows = db.prepare("SELECT * FROM services WHERE category = ?").all("ai");
    assert.strictEqual(rows.length, 3);
    assert.ok(rows.every((r) => r.category === "ai"));
  });

  it("queries stale services", () => {
    // Set one service to an old date
    const oldDate = new Date(Date.now() - 48 * 3600_000).toISOString();
    db.prepare("UPDATE services SET updated_at = ? WHERE id = ?").run(oldDate, "svc-count-1");

    const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
    const stale = db
      .prepare("SELECT * FROM services WHERE updated_at < ? ORDER BY updated_at ASC LIMIT ?")
      .all(cutoff, 10);
    assert.ok(stale.length >= 1);
    assert.ok(stale.some((r) => r.id === "svc-count-1"));
  });

  it("stores and retrieves JSON fields correctly", () => {
    const stmt = insertStmt();
    const verification = { reachable: true, returns402: true, statusCode: 402, latencyMs: 42 };
    const discovery = { version: 2, input: { type: "http", method: "GET" }, output: null };
    const now = new Date().toISOString();

    stmt.run({
      id: "svc-json-test",
      url: "https://json-test.example.com",
      name: "JSON Test",
      description: "",
      category: "test",
      price_amount: "1000",
      price_token: "USDC",
      price_network: "eip155:8453",
      methods: '["GET","POST"]',
      tags: '["tag1","tag2","tag3"]',
      owner: "unknown",
      verified: 1,
      verification: JSON.stringify(verification),
      discovery: JSON.stringify(discovery),
      registered_at: now,
      updated_at: now,
    });

    const row = db.prepare("SELECT * FROM services WHERE id = ?").get("svc-json-test");
    assert.deepStrictEqual(JSON.parse(row.verification), verification);
    assert.deepStrictEqual(JSON.parse(row.discovery), discovery);
    assert.deepStrictEqual(JSON.parse(row.methods), ["GET", "POST"]);
    assert.deepStrictEqual(JSON.parse(row.tags), ["tag1", "tag2", "tag3"]);
  });

  it("handles WAL mode", () => {
    const mode = db.pragma("journal_mode", { simple: true });
    assert.strictEqual(mode, "wal");
  });
});

// Clean up
process.on("exit", () => {
  try {
    rmSync(TEST_DB_DIR, { recursive: true });
  } catch {}
});
