/**
 * Unified network metadata — single source of truth.
 *
 * Used by both synthetic data generators (data.js) and
 * the live PostgreSQL data source (datasource.js).
 */

export const NETWORK_META = {
  "eip155:1": { label: "Ethereum", token: "USDT", decimals: 6 },
  "eip155:8453": { label: "Base", token: "USDC", decimals: 6 },
  "eip155:42161": { label: "Arbitrum", token: "USDT", decimals: 6 },
  "eip155:137": { label: "Polygon", token: "USDT", decimals: 6 },
  "eip155:10": { label: "Optimism", token: "USDT", decimals: 6 },
  "eip155:56": { label: "BNB Chain", token: "USDT", decimals: 6 },
  "eip155:8217": { label: "Kaia", token: "USDT", decimals: 6 },
  "eip155:43114": { label: "Avalanche", token: "USDT", decimals: 6 },
  "eip155:250": { label: "Fantom", token: "USDT", decimals: 6 },
  "eip155:42220": { label: "Celo", token: "USDT", decimals: 6 },
  "eip155:1101": { label: "Polygon zkEVM", token: "USDT", decimals: 6 },
  "eip155:324": { label: "zkSync Era", token: "USDT", decimals: 6 },
  "eip155:59144": { label: "Linea", token: "USDT", decimals: 6 },
  "eip155:534352": { label: "Scroll", token: "USDT", decimals: 6 },
  "eip155:5000": { label: "Mantle", token: "USDT", decimals: 6 },
  "eip155:80094": { label: "Berachain", token: "USDT", decimals: 6 },
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
  "eip155:8217": "https://kaiascan.io/tx/",
  "eip155:43114": "https://snowscan.xyz/tx/",
  "eip155:250": "https://ftmscan.com/tx/",
  "eip155:42220": "https://celoscan.io/tx/",
  "eip155:1101": "https://zkevm.polygonscan.com/tx/",
  "eip155:324": "https://era.zksync.network/tx/",
  "eip155:59144": "https://lineascan.build/tx/",
  "eip155:534352": "https://scrollscan.com/tx/",
  "eip155:5000": "https://mantlescan.xyz/tx/",
  "eip155:80094": "https://berascan.com/tx/",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "https://solscan.io/tx/",
  "ton:mainnet": "https://tonviewer.com/transaction/",
  "stellar:pubnet": "https://stellarchain.io/tx/",
  "tron:mainnet": "https://tronscan.org/#/transaction/",
};

/** Known token contract addresses → human-readable symbol. */
const TOKEN_SYMBOLS = {
  // Ethereum
  "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
  "0x07041776f5007ACa2A54844F50503a18A72A8b68": "USAT",
  // Arbitrum
  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9": "USDT",
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": "USDC",
  // Base
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": "USDC",
  // Polygon
  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F": "USDT",
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359": "USDC",
  // BNB Chain
  "0x55d398326f99059fF775485246999027B3197955": "USDT",
  // Optimism
  "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58": "USDT",
  "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85": "USDC",
  // TRON
  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t": "USDT",
};

/** Resolve a token field to a human-readable symbol. */
export function resolveTokenSymbol(raw) {
  if (!raw) return "USDT";
  // Already a short symbol
  if (raw.length <= 10 && !raw.startsWith("0x") && !raw.startsWith("T")) return raw;
  // Case-insensitive lookup (DB may store mixed case)
  const lower = raw.toLowerCase();
  for (const [addr, sym] of Object.entries(TOKEN_SYMBOLS)) {
    if (addr.toLowerCase() === lower) return sym;
  }
  // TRON addresses (base58, not lowered)
  if (TOKEN_SYMBOLS[raw]) return TOKEN_SYMBOLS[raw];
  return raw;
}

/** Lookup with fallback for unknown networks. */
export function networkMeta(caip2) {
  return NETWORK_META[caip2] || { label: caip2, token: "USDT", decimals: 6 };
}
