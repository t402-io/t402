/**
 * Database layer: PG (source of truth) -> SQLite (local cache) -> seed data (fallback).
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let pg = null;
let Database = null;

try { pg = await import("pg"); } catch { /* pg not available */ }
try { Database = require("better-sqlite3"); } catch { /* better-sqlite3 not available */ }

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    network TEXT NOT NULL,
    scheme TEXT NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    asset TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT,
    confirmed_at TEXT,
    gas_used TEXT,
    gas_price TEXT,
    metadata TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_settlements_network ON settlements(network);
  CREATE INDEX IF NOT EXISTS idx_settlements_asset ON settlements(asset);
  CREATE INDEX IF NOT EXISTS idx_settlements_confirmed ON settlements(confirmed_at);
  CREATE INDEX IF NOT EXISTS idx_settlements_tx_hash ON settlements(tx_hash);
`;

const db = { pgPool: null, sqlite: null, lastSync: null };

export async function initDb(pgUrl, sqlitePath) {
  if (pgUrl && pg) {
    const Pool = pg.default?.Pool || pg.Pool;
    db.pgPool = new Pool({ connectionString: pgUrl, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, options: "-c default_transaction_read_only=on" });
    try { const c = await db.pgPool.connect(); c.release(); console.log("PG connected"); }
    catch (err) { console.warn("PG connection failed:", err.message); db.pgPool = null; }
  }
  if (sqlitePath && Database) {
    db.sqlite = new Database(sqlitePath);
    db.sqlite.pragma("journal_mode = WAL");
    db.sqlite.pragma("busy_timeout = 30000");
    db.sqlite.exec(SQLITE_SCHEMA);
    console.log("SQLite initialized at", sqlitePath);
  }
  return db;
}

export async function getTransactions({ network, token, scheme, limit = 20, cursor } = {}) {
  if (!db.sqlite) return { transactions: [], total: 0, hasMore: false, nextCursor: null };
  const conds = []; const params = {};
  if (network) { conds.push("network = $network"); params.network = network; }
  if (token) { conds.push("asset = $token"); params.token = token; }
  if (scheme) { conds.push("scheme = $scheme"); params.scheme = scheme; }
  if (cursor) { conds.push("confirmed_at < (SELECT confirmed_at FROM settlements WHERE tx_hash = $cursor)"); params.cursor = cursor; }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const countConds = conds.filter(c => !c.includes("$cursor"));
  const countParams = { ...params }; delete countParams.cursor;
  const countWhere = countConds.length > 0 ? `WHERE ${countConds.join(" AND ")}` : "";
  const countRow = db.sqlite.prepare(`SELECT COUNT(*) as total FROM settlements ${countWhere}`).get(countParams);
  const rows = db.sqlite.prepare(`SELECT * FROM settlements ${where} ORDER BY confirmed_at DESC LIMIT $limit`).all({ ...params, limit: limit + 1 });
  const page = rows.slice(0, limit);
  return { transactions: page.map(sqliteRowToTx), total: countRow.total, hasMore: rows.length > limit, nextCursor: page.length > 0 ? page[page.length - 1].tx_hash : null };
}

export async function getTransaction(hash) {
  if (!db.sqlite) return null;
  const row = db.sqlite.prepare("SELECT * FROM settlements WHERE tx_hash = ?").get(hash);
  return row ? sqliteRowToTx(row) : null;
}

export async function search(query) {
  if (!db.sqlite) return [];
  const q = `%${query}%`;
  return db.sqlite.prepare("SELECT * FROM settlements WHERE tx_hash LIKE ? OR from_address LIKE ? OR to_address LIKE ? ORDER BY confirmed_at DESC LIMIT 50").all(q, q, q).map(sqliteRowToTx);
}

export async function getStats(days = 7) {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  if (!db.sqlite) return { period: `${days}d`, totalTransactions: 0, totalVolume: "0", uniquePayers: 0, uniqueRecipients: 0, byNetwork: {}, byToken: {}, byScheme: {}, avgTransactionSize: "0" };
  const base = db.sqlite.prepare("SELECT COUNT(*) as total, COUNT(DISTINCT from_address) as payers, COUNT(DISTINCT to_address) as recipients FROM settlements WHERE confirmed_at >= ?").get(cutoff);
  const amounts = db.sqlite.prepare("SELECT amount FROM settlements WHERE confirmed_at >= ?").all(cutoff);
  let totalVolume = 0n;
  for (const r of amounts) totalVolume += BigInt(r.amount);
  const byNetwork = {};
  for (const r of db.sqlite.prepare("SELECT network, COUNT(*) as count FROM settlements WHERE confirmed_at >= ? GROUP BY network ORDER BY count DESC").all(cutoff)) byNetwork[r.network] = r.count;
  const byToken = {};
  for (const r of db.sqlite.prepare("SELECT asset, COUNT(*) as count FROM settlements WHERE confirmed_at >= ? GROUP BY asset ORDER BY count DESC").all(cutoff)) byToken[r.asset] = r.count;
  const byScheme = {};
  for (const r of db.sqlite.prepare("SELECT scheme, COUNT(*) as count FROM settlements WHERE confirmed_at >= ? GROUP BY scheme ORDER BY count DESC").all(cutoff)) byScheme[r.scheme] = r.count;
  return { period: `${days}d`, totalTransactions: base.total, totalVolume: totalVolume.toString(), uniquePayers: base.payers, uniqueRecipients: base.recipients, byNetwork, byToken, byScheme, avgTransactionSize: base.total > 0 ? String(totalVolume / BigInt(base.total)) : "0" };
}

export async function getNetworks() {
  if (!db.sqlite) return [];
  return db.sqlite.prepare("SELECT network, COUNT(*) as count FROM settlements GROUP BY network ORDER BY count DESC").all();
}

export async function getTokens() {
  if (!db.sqlite) return [];
  return db.sqlite.prepare("SELECT asset as token, COUNT(*) as count FROM settlements GROUP BY asset ORDER BY count DESC").all();
}

export function syncToCache(rows) {
  if (!db.sqlite || rows.length === 0) return;
  const insert = db.sqlite.prepare("INSERT OR REPLACE INTO settlements (id, network, scheme, tx_hash, from_address, to_address, amount, asset, status, created_at, confirmed_at, gas_used, gas_price, metadata) VALUES ($id, $network, $scheme, $tx_hash, $from_address, $to_address, $amount, $asset, $status, $created_at, $confirmed_at, $gas_used, $gas_price, $metadata)");
  const tx = db.sqlite.transaction((items) => { for (const r of items) insert.run({ id: r.id, network: r.network, scheme: r.scheme, tx_hash: r.tx_hash, from_address: r.from_address, to_address: r.to_address, amount: r.amount, asset: r.asset, status: r.status || "confirmed", created_at: r.created_at, confirmed_at: r.confirmed_at, gas_used: r.gas_used, gas_price: r.gas_price, metadata: typeof r.metadata === "object" ? JSON.stringify(r.metadata) : r.metadata }); });
  tx(rows);
}

export function insertSeedData(transactions) {
  if (!db.sqlite) return;
  syncToCache(transactions.map(tx => ({ id: tx.id || crypto.randomUUID(), network: tx.network, scheme: tx.scheme, tx_hash: tx.txHash, from_address: tx.from, to_address: tx.to, amount: tx.amount, asset: tx.token, status: tx.status, created_at: tx.settledAt, confirmed_at: tx.settledAt, gas_used: tx.gasUsed || null, gas_price: null, metadata: null })));
}

export async function close() {
  if (db.pgPool) { await db.pgPool.end(); db.pgPool = null; }
  if (db.sqlite) { db.sqlite.close(); db.sqlite = null; }
}

export function getDbStatus() { return { pg: db.pgPool !== null, sqlite: db.sqlite !== null, lastSync: db.lastSync }; }
export function setLastSync(ts) { db.lastSync = ts; }
export function getPgPool() { return db.pgPool; }

function sqliteRowToTx(row) {
  return { id: row.id, txHash: row.tx_hash, network: row.network, scheme: row.scheme, token: row.asset, amount: row.amount, from: row.from_address, to: row.to_address, status: row.status, settledAt: row.confirmed_at || row.created_at, gasUsed: row.gas_used, gasPrice: row.gas_price };
}
