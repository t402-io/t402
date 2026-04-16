/**
 * Explorer database layer — SQLite-backed transaction cache.
 *
 * Accepts a db instance from the caller via initExplorerDb(db).
 */

import { getDecimals } from "../utils.js";
import { log } from "../middleware.js";

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

export function initExplorerDb(sqliteDb) {
  const state = { sqlite: sqliteDb, lastSync: null };

  if (sqliteDb) {
    sqliteDb.exec(SQLITE_SCHEMA);
    log("info", "Explorer SQLite initialized");
  }

  // ── Query functions ─────────────────────────────────────────────────

  async function getTransactions({ network, token, scheme, limit = 20, cursor, dateFrom, dateTo, amountMin, amountMax, status, sortBy, sortDir } = {}) {
    if (!state.sqlite) return { transactions: [], total: 0, hasMore: false, nextCursor: null };
    let cursorTime = null;
    if (cursor) {
      const cursorRow = state.sqlite.prepare('SELECT COALESCE(confirmed_at, created_at) as ts FROM settlements WHERE tx_hash = ?').get(cursor);
      if (cursorRow) cursorTime = cursorRow.ts;
    }
    const conds = []; const params = {};
    if (network) { conds.push("network = $network"); params.network = network; }
    if (token) { conds.push("asset = $token"); params.token = token; }
    if (scheme) { conds.push("scheme = $scheme"); params.scheme = scheme; }
    if (status) { conds.push("status = $status"); params.status = status; }
    if (dateFrom) { conds.push("COALESCE(confirmed_at, created_at) >= $dateFrom"); params.dateFrom = dateFrom; }
    if (dateTo) { conds.push("COALESCE(confirmed_at, created_at) <= $dateTo"); params.dateTo = dateTo; }
    if (amountMin != null && amountMin !== "") { conds.push("CAST(amount AS INTEGER) >= $amountMin"); params.amountMin = parseInt(amountMin, 10); }
    if (amountMax != null && amountMax !== "") { conds.push("CAST(amount AS INTEGER) <= $amountMax"); params.amountMax = parseInt(amountMax, 10); }
    if (cursorTime) { conds.push("COALESCE(confirmed_at, created_at) < $cursorTime"); params.cursorTime = cursorTime; }
    const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
    const countConds = conds.filter(c => !c.includes("$cursorTime"));
    const countParams = { ...params }; delete countParams.cursorTime;
    const countWhere = countConds.length > 0 ? `WHERE ${countConds.join(" AND ")}` : "";
    const countRow = state.sqlite.prepare(`SELECT COUNT(*) as total FROM settlements ${countWhere}`).get(countParams);
    const allowedSort = ["confirmed_at", "amount", "network"];
    const sortField = allowedSort.includes(sortBy) ? (sortBy === "confirmed_at" ? "COALESCE(confirmed_at, created_at)" : sortBy) : "COALESCE(confirmed_at, created_at)";
    const sortDirection = sortDir === "ASC" ? "ASC" : "DESC";
    const rows = state.sqlite.prepare(`SELECT * FROM settlements ${where} ORDER BY ${sortField} ${sortDirection} LIMIT $limit`).all({ ...params, limit: limit + 1 });
    const page = rows.slice(0, limit);
    return { transactions: page.map(sqliteRowToTx), total: countRow.total, hasMore: rows.length > limit, nextCursor: page.length > 0 ? page[page.length - 1].tx_hash : null };
  }

  async function getTransaction(hash) {
    if (!state.sqlite) return null;
    const row = state.sqlite.prepare("SELECT * FROM settlements WHERE tx_hash = ?").get(hash);
    return row ? sqliteRowToTx(row) : null;
  }

  async function search(query) {
    if (!state.sqlite) return [];
    if (query.length < 4) return [];
    const prefix = `${query}%`;
    const txResults = state.sqlite.prepare("SELECT * FROM settlements WHERE tx_hash LIKE ? ORDER BY COALESCE(confirmed_at, created_at) DESC LIMIT 50").all(prefix).map(sqliteRowToTx);
    if (txResults.length > 0) return txResults;
    const q = `%${query}%`;
    return state.sqlite.prepare("SELECT * FROM settlements WHERE from_address LIKE ? OR to_address LIKE ? ORDER BY COALESCE(confirmed_at, created_at) DESC LIMIT 50").all(q, q).map(sqliteRowToTx);
  }

  async function getStats(days = 7) {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    if (!state.sqlite) return { period: `${days}d`, totalTransactions: 0, totalVolume: "0", uniquePayers: 0, uniqueRecipients: 0, byNetwork: {}, byToken: {}, byScheme: {}, avgTransactionSize: "0" };
    const base = state.sqlite.prepare("SELECT COUNT(*) as total, COUNT(DISTINCT from_address) as payers, COUNT(DISTINCT to_address) as recipients FROM settlements WHERE COALESCE(confirmed_at, created_at) >= ?").get(cutoff);
    const grouped = state.sqlite.prepare("SELECT network, asset as token, scheme, COUNT(*) as count, SUM(CAST(amount AS INTEGER)) as volume FROM settlements WHERE COALESCE(confirmed_at, created_at) >= ? AND asset != 'UNKNOWN' GROUP BY network, asset, scheme").all(cutoff);
    let totalVolume = 0n;
    const byNetwork = {};
    const byToken = {};
    const byScheme = {};
    for (const r of grouped) {
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

  async function getTransactionsByAddress(address, limit = 20, cursor) {
    if (!state.sqlite) return { transactions: [], total: 0, hasMore: false, nextCursor: null };
    const params = { address };
    let cursorClause = "";
    if (cursor) {
      const cursorRow = state.sqlite.prepare('SELECT COALESCE(confirmed_at, created_at) as ts FROM settlements WHERE tx_hash = ?').get(cursor);
      if (cursorRow) {
        cursorClause = " AND COALESCE(confirmed_at, created_at) < $cursorTime";
        params.cursorTime = cursorRow.ts;
      }
    }
    const countRow = state.sqlite.prepare("SELECT COUNT(*) as total FROM settlements WHERE from_address = $address OR to_address = $address").get({ address });
    const rows = state.sqlite.prepare(`SELECT * FROM settlements WHERE (from_address = $address OR to_address = $address)${cursorClause} ORDER BY COALESCE(confirmed_at, created_at) DESC LIMIT $limit`).all({ ...params, limit: limit + 1 });
    const page = rows.slice(0, limit);
    let totalVolume = 0n;
    for (const r of page) {
      let vol = BigInt(r.amount);
      const decimals = getDecimals(r.asset, r.network);
      if (decimals > 6) vol = vol / BigInt(10 ** (decimals - 6));
      totalVolume += vol;
    }
    return { transactions: page.map(sqliteRowToTx), total: countRow.total, totalVolume: totalVolume.toString(), hasMore: rows.length > limit, nextCursor: page.length > 0 ? page[page.length - 1].tx_hash : null };
  }

  async function getNetworks() {
    if (!state.sqlite) return [];
    return state.sqlite.prepare("SELECT network, COUNT(*) as count FROM settlements GROUP BY network ORDER BY count DESC").all();
  }

  async function getTokens() {
    if (!state.sqlite) return [];
    return state.sqlite.prepare("SELECT asset as token, COUNT(*) as count FROM settlements WHERE asset != 'UNKNOWN' GROUP BY asset ORDER BY count DESC").all();
  }

  async function getNetworkStats(network) {
    if (!state.sqlite) return null;
    const total = state.sqlite.prepare("SELECT COUNT(*) as count FROM settlements WHERE network = ?").get(network);
    if (!total || total.count === 0) return null;
    const amounts = state.sqlite.prepare("SELECT amount, asset as token FROM settlements WHERE network = ?").all(network);
    let totalVolume = 0n;
    for (const r of amounts) {
      let vol = BigInt(r.amount);
      const decimals = getDecimals(r.token, network);
      if (decimals > 6) vol = vol / BigInt(10 ** (decimals - 6));
      totalVolume += vol;
    }
    const tokens = state.sqlite.prepare("SELECT asset as token, COUNT(*) as count FROM settlements WHERE network = ? AND asset != 'UNKNOWN' GROUP BY asset ORDER BY count DESC").all(network);
    const schemes = state.sqlite.prepare("SELECT scheme, COUNT(*) as count FROM settlements WHERE network = ? GROUP BY scheme ORDER BY count DESC").all(network);
    const uniquePayers = state.sqlite.prepare("SELECT COUNT(DISTINCT from_address) as count FROM settlements WHERE network = ?").get(network);
    const uniqueRecipients = state.sqlite.prepare("SELECT COUNT(DISTINCT to_address) as count FROM settlements WHERE network = ?").get(network);
    return { totalTransactions: total.count, totalVolume: totalVolume.toString(), tokens, schemes, uniquePayers: uniquePayers.count, uniqueRecipients: uniqueRecipients.count, avgTransactionSize: total.count > 0 ? String(totalVolume / BigInt(total.count)) : "0" };
  }

  async function getTokenStats(tokenSymbol) {
    if (!state.sqlite) return null;
    const total = state.sqlite.prepare("SELECT COUNT(*) as count FROM settlements WHERE asset = ?").get(tokenSymbol);
    if (!total || total.count === 0) return null;
    const amounts = state.sqlite.prepare("SELECT amount, network FROM settlements WHERE asset = ?").all(tokenSymbol);
    let totalVolume = 0n;
    for (const r of amounts) {
      let vol = BigInt(r.amount);
      const decimals = getDecimals(tokenSymbol, r.network);
      if (decimals > 6) vol = vol / BigInt(10 ** (decimals - 6));
      totalVolume += vol;
    }
    const networks = state.sqlite.prepare("SELECT network, COUNT(*) as count FROM settlements WHERE asset = ? GROUP BY network ORDER BY count DESC").all(tokenSymbol);
    const schemes = state.sqlite.prepare("SELECT scheme, COUNT(*) as count FROM settlements WHERE asset = ? GROUP BY scheme ORDER BY count DESC").all(tokenSymbol);
    const uniquePayers = state.sqlite.prepare("SELECT COUNT(DISTINCT from_address) as count FROM settlements WHERE asset = ?").get(tokenSymbol);
    const uniqueRecipients = state.sqlite.prepare("SELECT COUNT(DISTINCT to_address) as count FROM settlements WHERE asset = ?").get(tokenSymbol);
    return { totalTransactions: total.count, totalVolume: totalVolume.toString(), networks, schemes, uniquePayers: uniquePayers.count, uniqueRecipients: uniqueRecipients.count, avgTransactionSize: total.count > 0 ? String(totalVolume / BigInt(total.count)) : "0" };
  }

  async function getAllTransactionsForExport({ network, token } = {}) {
    if (!state.sqlite) return [];
    const conds = []; const params = {};
    if (network) { conds.push("network = $network"); params.network = network; }
    if (token) { conds.push("asset = $token"); params.token = token; }
    const where = conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "";
    return state.sqlite.prepare(`SELECT * FROM settlements ${where} ORDER BY confirmed_at DESC LIMIT 10000`).all(params);
  }

  function clearCache() {
    if (!state.sqlite) return;
    state.sqlite.prepare("DELETE FROM settlements").run();
  }

  function syncToCache(rows) {
    if (!state.sqlite || rows.length === 0) return;
    const insert = state.sqlite.prepare("INSERT OR REPLACE INTO settlements (id, network, scheme, tx_hash, from_address, to_address, amount, asset, status, created_at, confirmed_at, gas_used, gas_price, metadata) VALUES ($id, $network, $scheme, $tx_hash, $from_address, $to_address, $amount, $asset, $status, $created_at, $confirmed_at, $gas_used, $gas_price, $metadata)");
    const toStr = (v) => v instanceof Date ? v.toISOString() : (v ?? null);
    const tx = state.sqlite.transaction((items) => {
      for (const r of items) insert.run({
        id: String(r.id),
        network: String(r.network || ''),
        scheme: String(r.scheme || 'exact'),
        tx_hash: String(r.tx_hash || ''),
        from_address: String(r.from_address || ''),
        to_address: String(r.to_address || ''),
        amount: String(r.amount || '0'),
        asset: String(r.asset || ''),
        status: String(r.status || 'confirmed'),
        created_at: toStr(r.created_at),
        confirmed_at: toStr(r.confirmed_at),
        gas_used: r.gas_used ? String(r.gas_used) : null,
        gas_price: r.gas_price ? String(r.gas_price) : null,
        metadata: typeof r.metadata === "object" && r.metadata !== null ? JSON.stringify(r.metadata) : (r.metadata ?? null),
      });
    });
    tx(rows);
  }

  function insertSeedData(transactions) {
    if (!state.sqlite) return;
    syncToCache(transactions.map(tx => ({
      id: tx.id || crypto.randomUUID(),
      network: tx.network,
      scheme: tx.scheme,
      tx_hash: tx.txHash,
      from_address: tx.from,
      to_address: tx.to,
      amount: tx.amount,
      asset: tx.token,
      status: tx.status,
      created_at: tx.settledAt,
      confirmed_at: tx.settledAt,
      gas_used: tx.gasUsed || null,
      gas_price: null,
      metadata: null,
    })));
  }

  function getDbStatus() {
    return { facilitator: !!process.env.FACILITATOR_URL, sqlite: state.sqlite !== null, lastSync: state.lastSync };
  }

  function setLastSync(ts) {
    state.lastSync = ts;
  }

  async function close() {
    // db is shared; don't close it here
  }

  return {
    getTransactions,
    getTransaction,
    search,
    getStats,
    getTransactionsByAddress,
    getNetworks,
    getTokens,
    getNetworkStats,
    getTokenStats,
    getAllTransactionsForExport,
    clearCache,
    syncToCache,
    insertSeedData,
    getDbStatus,
    setLastSync,
    close,
  };
}

function sqliteRowToTx(row) {
  let meta = null;
  try { if (row.metadata) meta = JSON.parse(row.metadata); } catch { /* ignore */ }
  return {
    id: row.id,
    txHash: row.tx_hash,
    network: row.network,
    scheme: row.scheme,
    token: row.asset,
    amount: row.amount,
    from: row.from_address,
    to: row.to_address,
    status: row.status,
    settledAt: row.confirmed_at || row.created_at,
    gasUsed: row.gas_used,
    gasPrice: row.gas_price,
    description: meta?.description || meta?.displayName || null,
    source: meta?.source || meta?.referer || null,
    resourceUrl: meta?.resourceUrl || null,
  };
}
