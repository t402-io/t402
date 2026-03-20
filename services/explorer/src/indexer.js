/**
 * Transaction indexer — seed data generation + PG-to-SQLite sync worker.
 *
 * Seed data uses correct address formats and decimal ranges per chain.
 * Sync worker periodically pulls new settlements from PG into SQLite cache.
 */

import { syncToCache, setLastSync, getPgPool } from "./db.js";
import { log } from "./server.js";

function randomHex(len) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function randomEvmAddress() {
  return "0x" + randomHex(40);
}

function randomSolanaAddress() {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  return Array.from({ length: 44 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function randomTonAddress() {
  return "UQ" + Array.from({ length: 46 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]).join("");
}

function randomTronAddress() {
  return "T" + Array.from({ length: 33 }, () => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[Math.floor(Math.random() * 58)]).join("");
}

function randomStellarAddress() {
  return "G" + Array.from({ length: 55 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(Math.random() * 32)]).join("");
}

function randomTxHash(network) {
  if (network.startsWith("solana:")) return randomSolanaAddress();
  if (network.startsWith("ton:")) return randomHex(64);
  if (network.startsWith("tron:")) return randomHex(64);
  if (network.startsWith("stellar:")) return randomHex(64);
  return "0x" + randomHex(64);
}

function randomAddress(network) {
  if (network.startsWith("solana:")) return randomSolanaAddress();
  if (network.startsWith("ton:")) return randomTonAddress();
  if (network.startsWith("tron:")) return randomTronAddress();
  if (network.startsWith("stellar:")) return randomStellarAddress();
  return randomEvmAddress();
}

const NETWORKS = [
  "eip155:8453", "eip155:42161", "eip155:1", "eip155:137", "eip155:10",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "ton:mainnet", "tron:mainnet",
  "stellar:pubnet",
];

const TOKENS = ["USDC", "USDT0", "USDT", "USAT"];

function getScheme(network) {
  if (network.startsWith("eip155:")) {
    return Math.random() < 0.5 ? "exact" : "exact-legacy";
  }
  return "exact";
}

function getDecimals(token, network) {
  if (network.startsWith("stellar:") && token === "USDC") return 7;
  return 6;
}

export function seedTransactions(count = 100) {
  const transactions = [];
  for (let i = 0; i < count; i++) {
    const net = NETWORKS[i % NETWORKS.length];
    const token = TOKENS[i % TOKENS.length];
    const decimals = getDecimals(token, net);
    const ago = Math.floor(Math.random() * 86400 * 30);
    const humanAmount = Math.random() * 9999.99 + 0.01;
    const rawAmount = Math.floor(humanAmount * (10 ** decimals));

    transactions.push({
      id: crypto.randomUUID(),
      txHash: randomTxHash(net),
      network: net,
      scheme: getScheme(net),
      token,
      amount: String(rawAmount),
      from: randomAddress(net),
      to: randomAddress(net),
      status: "confirmed",
      gasUsed: net.startsWith("eip155:") ? String(Math.floor(Math.random() * 200000) + 50000) : "0",
      settledAt: new Date(Date.now() - ago * 1000).toISOString(),
    });
  }
  transactions.sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt));
  return transactions;
}

let syncInterval = null;
let lastSyncTimestamp = null;

export function startSync(intervalMs = 60000) {
  if (syncInterval) return;

  async function doSync() {
    const pool = getPgPool();
    if (!pool) return;

    try {
      const since = lastSyncTimestamp || new Date(Date.now() - 86400_000 * 30).toISOString();
      const result = await pool.query(
        "SELECT * FROM settlements WHERE confirmed_at > $1 ORDER BY confirmed_at ASC LIMIT 1000",
        [since],
      );

      if (result.rows.length > 0) {
        syncToCache(result.rows);
        lastSyncTimestamp = result.rows[result.rows.length - 1].confirmed_at;
        setLastSync(new Date().toISOString());
        log("info", "Synced settlements from PG", { count: result.rows.length });
      }
    } catch (err) {
      log("warn", "PG sync failed", { error: err.message });
    }
  }

  doSync();
  syncInterval = setInterval(doSync, intervalMs);
  log("info", "Sync worker started", { interval_ms: intervalMs });
}

export function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    log("info", "Sync worker stopped");
  }
}
