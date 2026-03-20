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

// Map contract addresses to token symbols for display
const TOKEN_ADDRESS_MAP = {
  // USDT
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT", // Ethereum
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT", // Arbitrum
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "USDT", // Polygon
  "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": "USDT", // Optimism
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": "USDT", // Base
  "0x55d398326f99059ff775485246999027b3197955": "USDT", // BSC
  "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": "USDT", // Avalanche
  // USDC
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC", // Ethereum
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC", // Arbitrum
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC", // Polygon
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC", // Optimism
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC", // Base
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": "USDC", // Avalanche
  // USAT
  "0x07041776f5007aca2a54844f50503a18a72a8b68": "USAT", // Ethereum
  // USDT0
  "0x01bff41798a0bcf287b996046ca68b395dbc1071": "USDT0", // Optimism
  "0x0200c29006150606b650577bbe7b6248f58470c1": "USDT0", // Ink
  "0x779ded0c9e1022225f8e0630b35a9b54be713736": "USDT0", // Berachain/Mantle/Rootstock/XLayer
  "0x588ce4f028d8e7b53b687865d6a67b3a54c75518": "USDT0", // Unichain
  // Non-EVM
  "eqcxe6mutqjkfngfarotkot1lzbdiix1kcixrv7nw2id_sds": "USDT", // TON
  "tr7nhqjekqxgtci8q8zy4pl8otszgjlj6t": "USDT", // TRON
  "epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v": "USDC", // Solana
  "es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb": "USDT", // Solana
};

export function resolveTokenSymbol(asset) {
  if (!asset) return "UNKNOWN";
  // Already a symbol
  if (asset.length <= 5 && /^[A-Z0-9]+$/.test(asset)) return asset;
  // Try address lookup (case-insensitive)
  return TOKEN_ADDRESS_MAP[asset.toLowerCase()] || asset;
}

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
      const since = lastSyncTimestamp || new Date(Date.now() - 86400000 * 30).toISOString();
      // Query Scan2Pay crypto_orders (real payments) instead of facilitator settlements
      const result = await pool.query(
        `SELECT
          id,
          selected_network AS network,
          CASE
            WHEN selected_network LIKE 'eip155:%' THEN 'exact'
            ELSE 'exact'
          END AS scheme,
          tx_hash,
          COALESCE(payer, '') AS from_address,
          COALESCE(pay_to_evm, pay_to_solana, pay_to_ton, pay_to_tron, '') AS to_address,
          COALESCE(crypto_amount, amount) AS amount,
          COALESCE(selected_asset, '') AS asset,
          'confirmed' AS status,
          created_at,
          paid_at AS confirmed_at,
          NULL::text AS gas_used,
          NULL::text AS gas_price,
          NULL::text AS metadata
        FROM crypto_orders
        WHERE status = 'paid' AND tx_hash IS NOT NULL AND paid_at > $1
        ORDER BY paid_at ASC
        LIMIT 1000`,
        [since],
      );

      if (result.rows.length > 0) {
        // Resolve contract addresses to token symbols
        const mapped = result.rows.map(r => ({ ...r, asset: resolveTokenSymbol(r.asset) }));
        syncToCache(mapped);
        lastSyncTimestamp = result.rows[result.rows.length - 1].confirmed_at;
        setLastSync(new Date().toISOString());
        log("info", "Synced orders from PG", { count: result.rows.length });
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
