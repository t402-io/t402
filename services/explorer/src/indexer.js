/**
 * Transaction indexer — seed data generation + Facilitator API sync worker.
 *
 * Seed data uses correct address formats and decimal ranges per chain.
 * Sync worker periodically pulls new settlements from Facilitator API into SQLite cache.
 */

import { syncToCache, setLastSync } from "./db.js";
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
  // BSC USDT and USDC are 18 decimals
  if (network === "eip155:56") return 18;
  // Celo USDT is 18 decimals
  if (network === "eip155:42220") return 18;
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

export function startSync(facilitatorUrl, facilitatorApiKey, intervalMs = 60000) {
  if (syncInterval) return;
  if (!facilitatorUrl) { log("warn", "No FACILITATOR_URL, sync disabled"); return; }

  async function doSync() {
    try {
      const since = lastSyncTimestamp || new Date(Date.now() - 86400000 * 90).toISOString();
      let offset = 0;
      let totalSynced = 0;
      let newestCreatedAt = null;

      // Paginate through all records since last sync
      while (true) {
        const url = `${facilitatorUrl}/v1/settlements?since=${encodeURIComponent(since)}&limit=1000&offset=${offset}`;
        const headers = { "Accept": "application/json" };
        if (facilitatorApiKey) headers["X-API-Key"] = facilitatorApiKey;

        const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
        if (!res.ok) {
          log("warn", "Facilitator API error", { status: res.status, url });
          break;
        }

        const data = await res.json();
        const settlements = data.settlements || [];
        if (settlements.length === 0) break;

        // Map Facilitator camelCase → SQLite snake_case
        const mapped = settlements.map(s => ({
          id: s.id,
          network: s.network || "",
          scheme: s.scheme || "exact",
          tx_hash: s.txHash || "",
          from_address: s.fromAddress || "",
          to_address: s.toAddress || "",
          amount: s.amount || "0",
          asset: resolveTokenSymbol(s.asset),
          status: s.status || "confirmed",
          created_at: s.createdAt,
          confirmed_at: s.confirmedAt,
          gas_used: s.gasUsed != null ? String(s.gasUsed) : null,
          gas_price: s.gasPrice != null ? String(s.gasPrice) : null,
          metadata: s.metadata,
        }));

        syncToCache(mapped);
        totalSynced += mapped.length;

        // Track the newest createdAt across all pages (results are DESC ordered)
        // First item on first page is the newest overall
        for (const s of settlements) {
          if (s.createdAt && (!newestCreatedAt || s.createdAt > newestCreatedAt)) {
            newestCreatedAt = s.createdAt;
          }
        }

        // If fewer than limit returned, we're done
        if (settlements.length < 1000) break;
        offset += settlements.length;
      }

      // Update lastSyncTimestamp to the newest record so next sync only fetches newer
      if (newestCreatedAt) lastSyncTimestamp = newestCreatedAt;

      if (totalSynced > 0) {
        setLastSync(new Date().toISOString());
        log("info", "Synced settlements from Facilitator", { count: totalSynced });
      }
    } catch (err) {
      log("warn", "Facilitator sync failed", { error: err.message });
    }
  }

  doSync();
  syncInterval = setInterval(doSync, intervalMs);
  log("info", "Sync worker started", { interval_ms: intervalMs, url: facilitatorUrl });
}

export function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    log("info", "Sync worker stopped");
  }
}
