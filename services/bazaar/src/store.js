/**
 * SQLite-backed service store with in-memory fallback.
 *
 * Uses better-sqlite3 for synchronous, fast access.
 * Falls back to in-memory Map if SQLite is unavailable (e.g., read-only FS without volume).
 */

import Database from "better-sqlite3";
import { logger } from "./middleware.js";

const DB_PATH = process.env.BAZAAR_DB_PATH || "/app/data/bazaar.db";

let db;
let useMemory = false;
const memoryStore = new Map();

// ── Initialize ────────────────────────────────────────────────────────
try {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

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
      owner TEXT NOT NULL DEFAULT 'unknown',
      tags TEXT NOT NULL DEFAULT '[]',
      verified INTEGER NOT NULL DEFAULT 0,
      verification TEXT,
      discovery TEXT,
      registered_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      api_key_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
    CREATE INDEX IF NOT EXISTS idx_services_verified ON services(verified);
    CREATE INDEX IF NOT EXISTS idx_services_network ON services(price_network);
  `);

  logger.info("database initialized", { path: DB_PATH, engine: "sqlite" });
} catch (e) {
  logger.warn("SQLite unavailable, using in-memory store", { error: e.message, path: DB_PATH });
  useMemory = true;
}

// ── Prepared statements ───────────────────────────────────────────────
let stmts;
if (!useMemory) {
  stmts = {
    insert: db.prepare(`
      INSERT INTO services (id, url, name, description, category, price_amount, price_token, price_network, methods, tags, owner, verified, verification, discovery, registered_at, updated_at, api_key_hash)
      VALUES (@id, @url, @name, @description, @category, @price_amount, @price_token, @price_network, @methods, @tags, @owner, @verified, @verification, @discovery, @registered_at, @updated_at, @api_key_hash)
    `),
    getById: db.prepare("SELECT * FROM services WHERE id = ?"),
    getByUrl: db.prepare("SELECT * FROM services WHERE url = ?"),
    getAll: db.prepare("SELECT * FROM services ORDER BY verified DESC, registered_at DESC"),
    update: db.prepare(`
      UPDATE services SET url=@url, name=@name, description=@description, category=@category,
        price_amount=@price_amount, price_token=@price_token, price_network=@price_network,
        methods=@methods, tags=@tags, owner=@owner, verified=@verified, verification=@verification,
        discovery=@discovery, updated_at=@updated_at
      WHERE id=@id
    `),
    delete: db.prepare("DELETE FROM services WHERE id = ?"),
    count: db.prepare("SELECT COUNT(*) as count FROM services"),
    countVerified: db.prepare("SELECT COUNT(*) as count FROM services WHERE verified = 1"),
    getUnverified: db.prepare("SELECT * FROM services WHERE verified = 0 ORDER BY updated_at ASC LIMIT ?"),
    getStale: db.prepare("SELECT * FROM services WHERE updated_at < ? ORDER BY updated_at ASC LIMIT ?"),
  };
}

// ── Row conversion ────────────────────────────────────────────────────
function rowToService(row) {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    description: row.description,
    category: row.category,
    price: {
      amount: row.price_amount,
      token: row.price_token,
      network: row.price_network,
    },
    methods: JSON.parse(row.methods),
    tags: JSON.parse(row.tags || "[]"),
    owner: row.owner,
    verified: row.verified === 1,
    verification: row.verification ? JSON.parse(row.verification) : undefined,
    discovery: row.discovery ? JSON.parse(row.discovery) : undefined,
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}

function serviceToRow(svc) {
  return {
    id: svc.id,
    url: svc.url,
    name: svc.name,
    description: svc.description,
    category: svc.category,
    price_amount: svc.price.amount,
    price_token: svc.price.token,
    price_network: svc.price.network,
    methods: JSON.stringify(svc.methods),
    tags: JSON.stringify(svc.tags || []),
    owner: svc.owner,
    verified: svc.verified ? 1 : 0,
    verification: svc.verification ? JSON.stringify(svc.verification) : null,
    discovery: svc.discovery ? JSON.stringify(svc.discovery) : null,
    registered_at: svc.registeredAt,
    updated_at: svc.updatedAt,
  };
}

// ── Store API ─────────────────────────────────────────────────────────
export const store = {
  get(id) {
    if (useMemory) return memoryStore.get(id) || null;
    const row = stmts.getById.get(id);
    return row ? rowToService(row) : null;
  },

  getByUrl(url) {
    if (useMemory) {
      for (const svc of memoryStore.values()) {
        if (svc.url === url) return svc;
      }
      return null;
    }
    const row = stmts.getByUrl.get(url);
    return row ? rowToService(row) : null;
  },

  getAll() {
    if (useMemory) return Array.from(memoryStore.values());
    return stmts.getAll.all().map(rowToService);
  },

  set(id, service) {
    if (useMemory) {
      memoryStore.set(id, service);
      return;
    }
    const row = serviceToRow(service);
    const existing = stmts.getById.get(id);
    if (existing) {
      stmts.update.run(row);
    } else {
      stmts.insert.run(row);
    }
  },

  delete(id) {
    if (useMemory) return memoryStore.delete(id);
    stmts.delete.run(id);
    return true;
  },

  size() {
    if (useMemory) return memoryStore.size;
    return stmts.count.get().count;
  },

  countVerified() {
    if (useMemory) {
      let n = 0;
      for (const svc of memoryStore.values()) if (svc.verified) n++;
      return n;
    }
    return stmts.countVerified.get().count;
  },

  /** Get services needing re-verification (stale > threshold) */
  getStale(olderThan, limit = 10) {
    if (useMemory) {
      return Array.from(memoryStore.values())
        .filter((s) => s.updatedAt < olderThan)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .slice(0, limit);
    }
    return stmts.getStale.all(olderThan, limit).map(rowToService);
  },

  isMemory() {
    return useMemory;
  },

  close() {
    if (db) db.close();
  },
};

// ── Seed data ─────────────────────────────────────────────────────────
const seeds = [
  {
    url: "https://api.weather402.com/forecast",
    name: "Weather Forecast API",
    description: "Global weather data with hourly resolution, 7-day forecast",
    category: "data",
    price: { amount: "1000", token: "USDC", network: "eip155:8453" },
    methods: ["GET"],
    tags: ["weather", "forecast", "geolocation"],
    owner: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
  },
  {
    url: "https://api.llm402.com/v1/chat/completions",
    name: "LLM Inference API",
    description: "Pay-per-request access to GPT-4, Claude, and open models",
    category: "ai",
    price: { amount: "5000", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    tags: ["llm", "chat", "inference", "openai"],
    owner: "0x1234567890abcdef1234567890abcdef12345678",
  },
  {
    url: "https://api.market402.com/report",
    name: "DeFi Market Intelligence",
    description: "Weekly DeFi market analysis with trading signals and risk metrics",
    category: "reports",
    price: { amount: "50000", token: "USDT0", network: "eip155:42161" },
    methods: ["GET"],
    tags: ["defi", "market", "trading", "analytics"],
    owner: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  },
  {
    url: "https://api.image402.com/generate",
    name: "Image Generation API",
    description: "High-res image generation via Stable Diffusion XL and Flux",
    category: "ai",
    price: { amount: "2000", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    tags: ["image", "generation", "stable-diffusion", "flux"],
    owner: "0x5678567856785678567856785678567856785678",
  },
  {
    url: "https://api.translate402.com/v1/translate",
    name: "Translation API",
    description: "Neural machine translation for 100+ languages",
    category: "ai",
    price: { amount: "500", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    tags: ["translation", "nlp", "language"],
    owner: "0x9876987698769876987698769876987698769876",
  },
  {
    url: "https://api.code402.com/review",
    name: "AI Code Review",
    description: "Automated code review with security analysis and suggestions",
    category: "developer-tools",
    price: { amount: "10000", token: "USDC", network: "eip155:8453" },
    methods: ["POST"],
    tags: ["code-review", "security", "linting", "developer"],
    owner: "0xfedcfedcfedcfedcfedcfedcfedcfedcfedcfedc",
  },
  {
    url: "https://api.data402.com/blockchain/analytics",
    name: "Blockchain Analytics API",
    description: "On-chain data: wallet profiling, transaction clustering, risk scoring",
    category: "data",
    price: { amount: "15000", token: "USDC", network: "eip155:8453" },
    methods: ["GET", "POST"],
    tags: ["blockchain", "analytics", "wallet", "risk"],
    owner: "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
  },
  {
    url: "https://api.compute402.com/gpu/run",
    name: "GPU Compute Service",
    description: "On-demand GPU compute for ML inference (A100, H100)",
    category: "compute",
    price: { amount: "100000", token: "USDT0", network: "eip155:42161" },
    methods: ["POST"],
    tags: ["gpu", "compute", "ml", "inference"],
    owner: "0xbbbb2222cccc3333dddd4444eeee5555ffff6666",
  },
];

let nextId = 1;

export function seedStore() {
  // Only seed if store is empty
  if (store.size() > 0) {
    logger.info("store already seeded", { services: store.size() });
    return;
  }

  const now = new Date().toISOString();
  for (const seed of seeds) {
    const id = `svc-${String(nextId++).padStart(3, "0")}`;
    store.set(id, {
      id,
      ...seed,
      verified: true,
      registeredAt: now,
      updatedAt: now,
    });
  }
  logger.info("store seeded", { services: store.size() });
}

export function getNextId() {
  // Find the max numeric ID in store
  const all = store.getAll();
  let max = 0;
  for (const svc of all) {
    const num = parseInt(svc.id.replace("svc-", ""));
    if (num > max) max = num;
  }
  nextId = max + 1;
  const id = `svc-${String(nextId).padStart(3, "0")}`;
  nextId++;
  return id;
}
