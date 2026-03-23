/**
 * Unified network metadata — single source of truth.
 *
 * Used by both synthetic data generators (data.js) and
 * the live PostgreSQL data source (datasource.js).
 */

export const NETWORK_META = {
  "eip155:1": { label: "Ethereum", token: "USDC", decimals: 6 },
  "eip155:8453": { label: "Base", token: "USDC", decimals: 6 },
  "eip155:42161": { label: "Arbitrum", token: "USDT0", decimals: 6 },
  "eip155:137": { label: "Polygon", token: "USDC", decimals: 6 },
  "eip155:10": { label: "Optimism", token: "USDC", decimals: 6 },
  "eip155:56": { label: "BNB Chain", token: "USDT", decimals: 18 },
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": { label: "Solana", token: "USDC", decimals: 6 },
  "ton:mainnet": { label: "TON", token: "USDT", decimals: 6 },
  "stellar:pubnet": { label: "Stellar", token: "USDC", decimals: 7 },
  "tron:mainnet": { label: "TRON", token: "USDT", decimals: 6 },
};

/** Array form for iteration (used by synthetic data generators). */
export const NETWORKS = Object.entries(NETWORK_META).map(([caip2, meta]) => ({ caip2, ...meta }));

/** Block explorer transaction URL prefixes keyed by CAIP-2 network ID. */
export const EXPLORER_URLS = {
  "eip155:1": "https://etherscan.io/tx/",
  "eip155:8453": "https://basescan.org/tx/",
  "eip155:42161": "https://arbiscan.io/tx/",
  "eip155:137": "https://polygonscan.com/tx/",
  "eip155:10": "https://optimistic.etherscan.io/tx/",
  "eip155:56": "https://bscscan.com/tx/",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "https://solscan.io/tx/",
  "ton:mainnet": "https://tonviewer.com/transaction/",
  "stellar:pubnet": "https://stellarchain.io/tx/",
  "tron:mainnet": "https://tronscan.org/#/transaction/",
};

/** Lookup with fallback for unknown networks. */
export function networkMeta(caip2) {
  return NETWORK_META[caip2] || { label: caip2, token: "USDT", decimals: 6 };
}
