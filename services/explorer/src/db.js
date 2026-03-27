/**
 * Database layer: Facilitator API (source of truth) -> SQLite (local cache) -> seed data (fallback).
 */

import { log } from "./server.js";
import { getDecimals } from "./utils.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let Database = null;

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
  CREATE INDEX IF NOT EXISTS idx_settlements_from_address ON settlements(from_address);
  CREATE INDEX IF NOT EXISTS idx_settlements_to_address ON settlements(to_address);
`;

const db = { sqlite: null, lastSync: null };

export async function initDb(sqlitePath) {
  if (sqlitePath && Database) {
    db.sqlite = new Database(sqlitePath);
    db.sqlite.pragma("journal_mode = WAL");
    db.sqlite.pragma("busy_timeout = 30000");
    db.sqlite.exec(SQLITE_SCHEMA);
    log("info", "SQLite initialized", { path: sqlitePath });
  }
  return db;
}

export async function getTransactions({ network, token, scheme, limit = 20, cursor, dateFrom, dateTo, amountMin, amountMax, status, sortBy, sortDir } = {}) {
  if (!db.sqlite) return { transactions: [], total: 0, hasMore: false, nextCursor: null };
  let cursorTime = null;
  if (cursor) {
    const cursorRow = db.sqlite.prepare('SELECT confirmed_at FROM settlements WHERE tx_hash = ?').get(cursor);
    if (cursorRow) cursorTime = cursorRow.confirmed_at;
  }
  const conds = []; const params = {};
  if (network) { conds.push("network = $network"); params.network = network; }
  if (token) { conds.push("asset = $token"); params.token = token; }
  if (scheme) { conds.push("scheme = $scheme"); params.scheme = scheme; }
  if (status) { conds.push("status = $status"); params.status = status; }
  if (dateFrom) { conds.push("confirmed_at >= $dateFrom"); params.dateFrom = dateFrom; }
  if (dateTo) { conds.push("confirmed_at <= $dateTo"); params.dateTo = dateTo; }
  if (amountMin != null && amountMin !== "") { conds.push("CAST(amount AS INTEGER) >= $amountMin"); params.amountMin = parseInt(amountMin, 10); }
  if (amountMax != null && amountMax !== "") { conds.push("CAST(amount AS INTEGER) <= $amountMax"); params.amountMax = parseInt(amountMax, 10); }
  if (cursorTime) { conds.push("confirmed_at < $cursorTime"); params.cursorTime = cursorTime; }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  const countConds = conds.filter(c => !c.includes("$cursorTime"));
  const countParams = { ...params }; delete countParams.cursorTime;
  const countWhere = countConds.length > 0 ? `WHERE ${countConds.join(" AND ")}` : "";
  const countRow = db.sqlite.prepare(`SELECT COUNT(*) as total FROM settlements ${countWhere}`).get(countParams);
  const allowedSort = ["confirmed_at", "amount", "network"];
  const sortField = allowedSort.includes(sortBy) ? sortBy : "confirmed_at";
  const sortDirection = sortDir === "ASC" ? "ASC" : "DESC";
  const rows = db.sqlite.prepare(`SELECT * FROM settlements ${where} ORDER BY ${sortField} ${sortDirection} LIMIT $limit`).all({ ...params, limit: limit + 1 });
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
  if (query.length < 4) return [];
  const looksLikeTxHash = query.startsWith("0x") || query.length >= 32;
  if (looksLikeTxHash) {
    const prefix = `${query}%`;
    return db.sqlite.prepare("SELECT * FROM settlements WHERE tx_hash LIKE ? ORDER BY confirmed_at DESC LIMIT 50").all(prefix).map(sqliteRowToTx);
  }
  const q = `%${query}%`;
  return db.sqlite.prepare("SELECT * FROM settlements WHERE from_address LIKE ? OR to_address LIKE ? ORDER BY confirmed_at DESC LIMIT 50").all(q, q).map(sqliteRowToTx);
}

export async function getStats(days = 7) {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  if (!db.sqlite) return { period: `${days}d`, totalTransactions: 0, totalVolume: "0", uniquePayers: 0, uniqueRecipients: 0, byNetwork: {}, byToken: {}, byScheme: {}, avgTransactionSize: "0" };
  const base = db.sqlite.prepare("SELECT COUNT(*) as total, COUNT(DISTINCT from_address) as payers, COUNT(DISTINCT to_address) as recipients FROM settlements WHERE confirmed_at >= ?").get(cutoff);
  const grouped = db.sqlite.prepare("SELECT network, asset as token, scheme, COUNT(*) as count, SUM(CAST(amount AS INTEGER)) as volume FROM settlements WHERE confirmed_at >= ? AND asset != 'UNKNOWN' GROUP BY network, asset, scheme").all(cutoff);
  let totalVolume = 0n;
  const byNetwork = {};
  const byToken = {};
  const byScheme = {};
  for (const r of grouped) {
    // Normalize volume to 6-decimal base (USD stablecoin standard)
    let vol = BigInt(r.volume || 0);
    const decimals = getDecimals(r.token, r.network);
    if (decimals > 6) vol = vol / BigInt(10 ** (decimals - 6));
    totalVolume += vol;
    byNetwork[r.network] = (byNetwork[r.network] || 0) + r.count;
    if (r.token !== "UNKNOWN") byToken[r.token] = (byToken[r.token] || 0) + r.count;
    byScheme[r.scheme] = (byScheme[r.scheme] || 0) + r.count;
  }
  return { period: `${days}d`, totalTransactions: base.total, totalVolume: totalVolume.toString(), uniquePayers: base.payers, uniqueRecipients: base.recipients, byNetwork, byToken, byScheme, avgTransactionSize: base.total > 0 ? String(totalVolume / BigInt(base.total)) : "0" };
}

export async function getTransactionsByAddress(address, limit = 20, cursor) {
  if (!db.sqlite) return { transactions: [], total: 0, hasMore: false, nextCursor: null };
  const params = { address };
  let cursorClause = "";
  if (cursor) {
    const cursorRow = db.sqlite.prepare('SELECT confirmed_at FROM settlements WHERE tx_hash = ?').get(cursor);
    if (cursorRow) {
      cursorClause = " AND confirmed_at < $cursorTime";
      params.cursorTime = cursorRow.confirmed_at;
    }
  }
  const countRow = db.sqlite.prepare("SELECT COUNT(*) as total FROM settlements WHERE from_address = $address OR to_address = $address").get({ address });
  const rows = db.sqlite.prepare(`SELECT * FROM settlements WHERE (from_address = $address OR to_address = $address)${cursorClause} ORDER BY confirmed_at DESC LIMIT $limit`).all({ ...params, limit: limit + 1 });
  const page = rows.slice(0, limit);
  let totalVolume = 0n;
  for (const r of page) totalVolume += BigInt(r.amount);
  return { transactions: page.map(sqliteRowToTx), total: countRow.total, totalVolume: totalVolume.toString(), hasMore: rows.length > limit, nextCursor: page.length > 0 ? page[page.length - 1].tx_hash : null };
}

export async function getNetworks() {
  if (!db.sqlite) return [];
  return db.sqlite.prepare("SELECT network, COUNT(*) as count FROM settlements GROUP BY network ORDER BY count DESC").all();
}

export async function getTokens() {
  if (!db.sqlite) return [];
  return db.sqlite.prepare("SELECT asset as token, COUNT(*) as count FROM settlements WHERE asset != 'UNKNOWN' GROUP BY asset ORDER BY count DESC").all();
}

export async function getNetworkStats(network) {
  if (!db.sqlite) return null;
  const total = db.sqlite.prepare("SELECT COUNT(*) as count FROM settlements WHERE network = ?").get(network);
  if (!total || total.count === 0) return null;
  const amounts = db.sqlite.prepare("SELECT amount FROM settlements WHERE network = ?").all(network);
  let totalVolume = 0n;
  for (const r of amounts) totalVolume += BigInt(r.amount);
  const tokens = db.sqlite.prepare("SELECT asset as token, COUNT(*) as count FROM settlements WHERE network = ? AND asset != 'UNKNOWN' GROUP BY asset ORDER BY count DESC").all(network);
  const schemes = db.sqlite.prepare("SELECT scheme, COUNT(*) as count FROM settlements WHERE network = ? GROUP BY scheme ORDER BY count DESC").all(network);
  const uniquePayers = db.sqlite.prepare("SELECT COUNT(DISTINCT from_address) as count FROM settlements WHERE network = ?").get(network);
  const uniqueRecipients = db.sqlite.prepare("SELECT COUNT(DISTINCT to_address) as count FROM settlements WHERE network = ?").get(network);
  return { totalTransactions: total.count, totalVolume: totalVolume.toString(), tokens, schemes, uniquePayers: uniquePayers.count, uniqueRecipients: uniqueRecipients.count, avgTransactionSize: total.count > 0 ? String(totalVolume / BigInt(total.count)) : "0" };
}

export async function getTokenStats(tokenSymbol) {
  if (!db.sqlite) return null;
  const total = db.sqlite.prepare("SELECT COUNT(*) as count FROM settlements WHERE asset = ?").get(tokenSymbol);
  if (!total || total.count === 0) return null;
  const amounts = db.sqlite.prepare("SELECT amount FROM settlements WHERE asset = ?").all(tokenSymbol);
  let totalVolume = 0n;
  for (const r of amounts) totalVolume += BigInt(r.amount);
  const networks = db.sqlite.prepare("SELECT network, COUNT(*) as count FROM settlements WHERE asset = ? GROUP BY network ORDER BY count DESC").all(tokenSymbol);
  const schemes = db.sqlite.prepare("SELECT scheme, COUNT(*) as count FROM settlements WHERE asset = ? GROUP BY scheme ORDER BY count DESC").all(tokenSymbol);
  const uniquePayers = db.sqlite.prepare("SELECT COUNT(DISTINCT from_address) as count FROM settlements WHERE asset = ?").get(tokenSymbol);
  const uniqueRecipients = db.sqlite.prepare("SELECT COUNT(DISTINCT to_address) as count FROM settlements WHERE asset = ?").get(tokenSymbol);
  return { totalTransactions: total.count, totalVolume: totalVolume.toString(), networks, schemes, uniquePayers: uniquePayers.count, uniqueRecipients: uniqueRecipients.count, avgTransactionSize: total.count > 0 ? String(totalVolume / BigInt(total.count)) : "0" };
}

export async function getAllTransactionsForExport({ network, token } = {}) {
  if (!db.sqlite) return [];
  const conds = []; const params = {};
  if (network) { conds.push("network = $network"); params.network = network; }
  if (token) { conds.push("asset = $token"); params.token = token; }
  const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
  return db.sqlite.prepare(`SELECT * FROM settlements ${where} ORDER BY confirmed_at DESC LIMIT 10000`).all(params);
}

export function clearCache() {
  if (!db.sqlite) return;
  db.sqlite.prepare("DELETE FROM settlements").run();
}

export function syncToCache(rows) {
  if (!db.sqlite || rows.length === 0) return;
  const insert = db.sqlite.prepare("INSERT OR REPLACE INTO settlements (id, network, scheme, tx_hash, from_address, to_address, amount, asset, status, created_at, confirmed_at, gas_used, gas_price, metadata) VALUES ($id, $network, $scheme, $tx_hash, $from_address, $to_address, $amount, $asset, $status, $created_at, $confirmed_at, $gas_used, $gas_price, $metadata)");
  const toStr = (v) => v instanceof Date ? v.toISOString() : (v ?? null);
  const tx = db.sqlite.transaction((items) => { for (const r of items) insert.run({ id: String(r.id), network: String(r.network || ''), scheme: String(r.scheme || 'exact'), tx_hash: String(r.tx_hash || ''), from_address: String(r.from_address || ''), to_address: String(r.to_address || ''), amount: String(r.amount || '0'), asset: String(r.asset || ''), status: String(r.status || 'confirmed'), created_at: toStr(r.created_at), confirmed_at: toStr(r.confirmed_at), gas_used: r.gas_used ? String(r.gas_used) : null, gas_price: r.gas_price ? String(r.gas_price) : null, metadata: typeof r.metadata === "object" && r.metadata !== null ? JSON.stringify(r.metadata) : (r.metadata ?? null) }); });
  tx(rows);
}

export function insertSeedData(transactions) {
  if (!db.sqlite) return;
  syncToCache(transactions.map(tx => ({ id: tx.id || crypto.randomUUID(), network: tx.network, scheme: tx.scheme, tx_hash: tx.txHash, from_address: tx.from, to_address: tx.to, amount: tx.amount, asset: tx.token, status: tx.status, created_at: tx.settledAt, confirmed_at: tx.settledAt, gas_used: tx.gasUsed || null, gas_price: null, metadata: null })));
}

export async function close() {
  if (db.sqlite) { db.sqlite.close(); db.sqlite = null; }
}

export function getDbStatus() { return { facilitator: !!process.env.FACILITATOR_URL, sqlite: db.sqlite !== null, lastSync: db.lastSync }; }
export function setLastSync(ts) { db.lastSync = ts; }

function sqliteRowToTx(row) {
  return { id: row.id, txHash: row.tx_hash, network: row.network, scheme: row.scheme, token: row.asset, amount: row.amount, from: row.from_address, to: row.to_address, status: row.status, settledAt: row.confirmed_at || row.created_at, gasUsed: row.gas_used, gasPrice: row.gas_price };
}
