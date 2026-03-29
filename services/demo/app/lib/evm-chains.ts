/**
 * Shared EVM chain data — single source of truth for RPC endpoints,
 * native currencies, chain names, and CAIP-2 utilities.
 *
 * Consumers: useEvmPayment, useEvmChainSync, DexSwap, CrossChainBridge
 */

// ---------------------------------------------------------------------------
// RPC endpoints (public, no API key required)
// ---------------------------------------------------------------------------

export const EVM_CHAIN_RPC: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://mainnet.optimism.io",
  14: "https://flare-api.flare.network/ext/C/rpc",
  30: "https://public-node.rsk.co",
  56: "https://bsc-rpc.publicnode.com",
  130: "https://mainnet.unichain.org",
  137: "https://polygon-bor-rpc.publicnode.com",
  143: "https://rpc.monad.xyz",
  196: "https://rpc.xlayer.tech",
  250: "https://rpc.ftm.tools",
  295: "https://mainnet.hashio.io/api",
  4217: "https://rpc.tempo.xyz",
  988: "https://rpc.stable.io",
  999: "https://rpc.hyperliquid.xyz/evm",
  1030: "https://evm.confluxrpc.com",
  1329: "https://evm-rpc.sei-apis.com",
  2818: "https://rpc.morphl2.io",
  4326: "https://rpc.megaeth.com",
  5000: "https://rpc.mantle.xyz",
  8217: "https://public-en.node.kaia.io",
  8453: "https://mainnet.base.org",
  9745: "https://rpc.plasma.to",
  42161: "https://arb1.arbitrum.io/rpc",
  42220: "https://forno.celo.org",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  57073: "https://rpc-gel.inkonchain.com",
  80094: "https://rpc.berachain.com",
  84532: "https://base-sepolia.publicnode.com",
  21000000: "https://rpc.corn.xyz",
};

// ---------------------------------------------------------------------------
// Native currencies (non-ETH chains)
// ---------------------------------------------------------------------------

export const EVM_NATIVE_CURRENCY: Record<number, { name: string; symbol: string; decimals: number }> = {
  14: { name: "FLR", symbol: "FLR", decimals: 18 },
  30: { name: "RBTC", symbol: "RBTC", decimals: 18 },
  56: { name: "BNB", symbol: "BNB", decimals: 18 },
  137: { name: "MATIC", symbol: "POL", decimals: 18 },
  143: { name: "MON", symbol: "MON", decimals: 18 },
  250: { name: "FTM", symbol: "FTM", decimals: 18 },
  5000: { name: "MNT", symbol: "MNT", decimals: 18 },
  8217: { name: "KAIA", symbol: "KAIA", decimals: 18 },
  42220: { name: "CELO", symbol: "CELO", decimals: 18 },
  43114: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  80094: { name: "BERA", symbol: "BERA", decimals: 18 },
};

// ---------------------------------------------------------------------------
// Chain names (human-readable)
// ---------------------------------------------------------------------------

export const EVM_CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  14: "Flare",
  30: "Rootstock",
  56: "BNB Chain",
  130: "Unichain",
  137: "Polygon",
  143: "Monad",
  196: "XLayer",
  250: "Fantom",
  295: "Hedera",
  4217: "Tempo",
  988: "Stable",
  999: "HyperEVM",
  1030: "Conflux eSpace",
  1329: "Sei",
  2818: "Morph",
  4326: "MegaETH",
  5000: "Mantle",
  8217: "Kaia",
  8453: "Base",
  9745: "Plasma",
  42161: "Arbitrum",
  42220: "Celo",
  43114: "Avalanche",
  57073: "Ink",
  80094: "Berachain",
  84532: "Base Sepolia",
  21000000: "Corn",
};

// ---------------------------------------------------------------------------
// CAIP-2 utilities
// ---------------------------------------------------------------------------

/** Extract EVM chain ID from CAIP-2 network string (e.g. "eip155:42161" → 42161) */
export function chainIdFromCaip2(network: string | null): number | null {
  if (!network || !network.startsWith("eip155:")) return null;
  const id = parseInt(network.split(":")[1], 10);
  return isNaN(id) ? null : id;
}

/** Build CAIP-2 string from chain ID (e.g. 42161 → "eip155:42161") */
export function caip2FromChainId(chainId: number): string {
  return `eip155:${chainId}`;
}

/** Get human-readable chain name from chain ID */
export function getEvmChainName(chainId: number | undefined): string | undefined {
  if (chainId === undefined) return undefined;
  return EVM_CHAIN_NAMES[chainId];
}
