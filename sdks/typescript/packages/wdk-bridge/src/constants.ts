/**
 * WDK Bridge Constants
 *
 * Chain configurations and USDT0 addresses for bridging.
 */

import type { Address } from "viem";

/**
 * Supported chains for USDT0 bridging
 */
export const BRIDGE_CHAINS = [
  "ethereum",
  "arbitrum",
  "ink",
  "berachain",
  "unichain",
] as const;

export type BridgeChain = (typeof BRIDGE_CHAINS)[number];

/**
 * Chain IDs for bridgeable networks
 */
export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  ink: 57073,
  berachain: 80084,
  unichain: 130,
} as const;

/**
 * USDT0 OFT addresses by chain
 */
export const USDT0_ADDRESSES: Record<string, Address> = {
  ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  ink: "0x0200C29006150606B650577BBE7B6248F58470c1",
  berachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  unichain: "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
} as const;

/**
 * LayerZero endpoint IDs by chain
 */
export const LAYERZERO_ENDPOINT_IDS: Record<string, number> = {
  ethereum: 30101,
  arbitrum: 30110,
  ink: 30291,
  berachain: 30362,
  unichain: 30320,
} as const;

/**
 * Estimated bridge times by route (in seconds)
 * Based on LayerZero DVN confirmation times
 */
export const ESTIMATED_BRIDGE_TIMES: Record<string, Record<string, number>> = {
  ethereum: {
    arbitrum: 180,  // ~3 minutes
    ink: 300,       // ~5 minutes
    berachain: 300,
    unichain: 300,
  },
  arbitrum: {
    ethereum: 900,  // ~15 minutes (L2 -> L1 is slower)
    ink: 300,
    berachain: 300,
    unichain: 300,
  },
  ink: {
    ethereum: 300,
    arbitrum: 300,
    berachain: 300,
    unichain: 300,
  },
  berachain: {
    ethereum: 300,
    arbitrum: 300,
    ink: 300,
    unichain: 300,
  },
  unichain: {
    ethereum: 300,
    arbitrum: 300,
    ink: 300,
    berachain: 300,
  },
} as const;

/**
 * Default estimated bridge time if route not specified
 */
export const DEFAULT_BRIDGE_TIME = 300; // 5 minutes

/**
 * Minimum USDT0 amount for bridging (to cover fees)
 */
export const MIN_BRIDGE_AMOUNT = 1_000000n; // 1 USDT0

/**
 * Default slippage tolerance
 */
export const DEFAULT_SLIPPAGE = 0.5; // 0.5%

/**
 * Check if a chain supports USDT0 bridging
 */
export function supportsBridging(chain: string): boolean {
  return chain.toLowerCase() in USDT0_ADDRESSES;
}

/**
 * Get USDT0 address for a chain
 */
export function getUsdt0Address(chain: string): Address | undefined {
  return USDT0_ADDRESSES[chain.toLowerCase()];
}

/**
 * Get chain ID for a chain name
 */
export function getChainId(chain: string): number | undefined {
  return CHAIN_IDS[chain.toLowerCase()];
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): string | undefined {
  const entry = Object.entries(CHAIN_IDS).find(([, id]) => id === chainId);
  return entry?.[0];
}

/**
 * Get estimated bridge time for a route
 */
export function getEstimatedBridgeTime(fromChain: string, toChain: string): number {
  const from = fromChain.toLowerCase();
  const to = toChain.toLowerCase();
  return ESTIMATED_BRIDGE_TIMES[from]?.[to] ?? DEFAULT_BRIDGE_TIME;
}

/**
 * Get all bridgeable chains
 */
export function getBridgeableChains(): string[] {
  return [...BRIDGE_CHAINS];
}

/**
 * Get possible destination chains from a source chain
 */
export function getDestinationChains(fromChain: string): string[] {
  if (!supportsBridging(fromChain)) {
    return [];
  }
  return BRIDGE_CHAINS.filter((chain) => chain !== fromChain.toLowerCase());
}
