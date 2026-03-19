/**
 * Transaction indexer — in production, connects to facilitator logs or chain RPCs.
 * Currently uses in-memory store with generated data.
 */

const transactions = [];
let txId = 1;

const NETWORKS = [
  "eip155:8453", "eip155:42161", "eip155:1", "eip155:137", "eip155:10",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "ton:mainnet", "tron:mainnet",
  "stellar:pubnet", "spark:mainnet",
];
const TOKENS = ["USDC", "USDT0", "USDT", "USAT"];
const SCHEMES = ["exact", "exact-legacy", "exact-direct"];

function randomHex(len) {
  return "0x" + Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

// Seed data
export function seedTransactions(count = 100) {
  for (let i = 0; i < count; i++) {
    const net = NETWORKS[i % NETWORKS.length];
    const ago = Math.floor(Math.random() * 86400 * 30);
    transactions.push({
      id: txId++,
      txHash: randomHex(64),
      network: net,
      scheme: net.startsWith("eip155") ? SCHEMES[i % 2] : "exact",
      token: TOKENS[i % TOKENS.length],
      amount: String(Math.floor(Math.random() * 1000000) + 1000),
      from: randomHex(40),
      to: randomHex(40),
      status: "confirmed",
      blockNumber: Math.floor(Math.random() * 10000000) + 1000000,
      gasUsed: net.startsWith("eip155") ? String(Math.floor(Math.random() * 200000) + 50000) : "0",
      settledAt: new Date(Date.now() - ago * 1000).toISOString(),
    });
  }
  transactions.sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt));
}

export function getTransactions({ network, token, scheme, limit = 20, offset = 0, cursor } = {}) {
  let results = [...transactions];
  if (network) results = results.filter((t) => t.network === network);
  if (token) results = results.filter((t) => t.token === token);
  if (scheme) results = results.filter((t) => t.scheme === scheme);
  if (cursor) {
    const idx = results.findIndex((t) => t.txHash === cursor);
    if (idx >= 0) results = results.slice(idx + 1);
  }

  const page = results.slice(offset, offset + limit);
  return {
    transactions: page,
    total: results.length,
    hasMore: offset + limit < results.length,
    nextCursor: page.length > 0 ? page[page.length - 1].txHash : null,
  };
}

export function getTransaction(hash) {
  return transactions.find((t) => t.txHash === hash);
}

export function search(query) {
  const q = query.toLowerCase();
  return transactions.filter(
    (t) => t.txHash.includes(q) || t.from.includes(q) || t.to.includes(q),
  ).slice(0, 50);
}

export function getStats(days = 7) {
  const cutoff = Date.now() - days * 86400_000;
  const recent = transactions.filter((t) => new Date(t.settledAt).getTime() > cutoff);
  const byNetwork = {}, byToken = {}, byScheme = {};
  let totalVolume = 0n;

  for (const tx of recent) {
    byNetwork[tx.network] = (byNetwork[tx.network] || 0) + 1;
    byToken[tx.token] = (byToken[tx.token] || 0) + 1;
    byScheme[tx.scheme] = (byScheme[tx.scheme] || 0) + 1;
    totalVolume += BigInt(tx.amount);
  }

  return {
    period: `${days}d`,
    totalTransactions: recent.length,
    totalVolume: totalVolume.toString(),
    uniquePayers: new Set(recent.map((t) => t.from)).size,
    uniqueRecipients: new Set(recent.map((t) => t.to)).size,
    byNetwork,
    byToken,
    byScheme,
    avgTransactionSize: recent.length > 0 ? String(totalVolume / BigInt(recent.length)) : "0",
  };
}
