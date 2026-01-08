/**
 * Chain configuration and token addresses for T402 WDK
 */

import type { Address } from "viem";
import type { NormalizedChainConfig, EvmChainConfig } from "./types.js";

/**
 * Default chain configurations
 */
export const DEFAULT_CHAINS: Record<string, Omit<NormalizedChainConfig, "provider">> = {
  ethereum: {
    chainId: 1,
    network: "eip155:1",
    name: "ethereum",
  },
  arbitrum: {
    chainId: 42161,
    network: "eip155:42161",
    name: "arbitrum",
  },
  base: {
    chainId: 8453,
    network: "eip155:8453",
    name: "base",
  },
  ink: {
    chainId: 57073,
    network: "eip155:57073",
    name: "ink",
  },
  berachain: {
    chainId: 80094,
    network: "eip155:80094",
    name: "berachain",
  },
  unichain: {
    chainId: 130,
    network: "eip155:130",
    name: "unichain",
  },
  polygon: {
    chainId: 137,
    network: "eip155:137",
    name: "polygon",
  },
};

/**
 * Default RPC endpoints (public endpoints, may have rate limits)
 */
export const DEFAULT_RPC_ENDPOINTS: Record<string, string> = {
  ethereum: "https://eth.drpc.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  base: "https://mainnet.base.org",
  ink: "https://rpc-gel.inkonchain.com",
  polygon: "https://polygon-rpc.com",
};

/**
 * USDT0 token addresses by chain
 * USDT0 is Tether's omnichain token with EIP-3009 support
 */
export const USDT0_ADDRESSES: Record<string, Address> = {
  ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  ink: "0x0200C29006150606B650577BBE7B6248F58470c1",
  berachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  unichain: "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
};

/**
 * USDC token addresses by chain
 */
export const USDC_ADDRESSES: Record<string, Address> = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

/**
 * Legacy USDT addresses (no EIP-3009 support)
 */
export const USDT_LEGACY_ADDRESSES: Record<string, Address> = {
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

/**
 * All supported tokens per chain with metadata
 */
export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  /** Whether token supports EIP-3009 (gasless transfers) */
  supportsEIP3009: boolean;
}

export const CHAIN_TOKENS: Record<string, TokenInfo[]> = {
  ethereum: [
    {
      address: USDT0_ADDRESSES.ethereum,
      symbol: "USDT0",
      name: "TetherToken",
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDC_ADDRESSES.ethereum,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDT_LEGACY_ADDRESSES.ethereum,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      supportsEIP3009: false,
    },
  ],
  arbitrum: [
    {
      address: USDT0_ADDRESSES.arbitrum,
      symbol: "USDT0",
      name: "TetherToken",
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDC_ADDRESSES.arbitrum,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  base: [
    {
      address: USDC_ADDRESSES.base,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  ink: [
    {
      address: USDT0_ADDRESSES.ink,
      symbol: "USDT0",
      name: "TetherToken",
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  berachain: [
    {
      address: USDT0_ADDRESSES.berachain,
      symbol: "USDT0",
      name: "TetherToken",
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  unichain: [
    {
      address: USDT0_ADDRESSES.unichain,
      symbol: "USDT0",
      name: "TetherToken",
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  polygon: [
    {
      address: USDC_ADDRESSES.polygon,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDT_LEGACY_ADDRESSES.polygon,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      supportsEIP3009: false,
    },
  ],
};

/**
 * Normalize chain configuration from string or object
 */
export function normalizeChainConfig(
  chainName: string,
  config: string | EvmChainConfig,
): NormalizedChainConfig {
  const defaultConfig = DEFAULT_CHAINS[chainName];

  if (typeof config === "string") {
    // String is RPC URL
    return {
      provider: config,
      chainId: defaultConfig?.chainId ?? 1,
      network: defaultConfig?.network ?? `eip155:1`,
      name: chainName,
    };
  }

  // Full config object
  return {
    provider: config.provider,
    chainId: config.chainId ?? defaultConfig?.chainId ?? 1,
    network: config.network ?? defaultConfig?.network ?? `eip155:${config.chainId}`,
    name: chainName,
  };
}

/**
 * Get CAIP-2 network ID from chain name
 */
export function getNetworkFromChain(chain: string): string {
  return DEFAULT_CHAINS[chain]?.network ?? `eip155:1`;
}

/**
 * Get chain name from CAIP-2 network ID
 */
export function getChainFromNetwork(network: string): string | undefined {
  for (const [chain, config] of Object.entries(DEFAULT_CHAINS)) {
    if (config.network === network) {
      return chain;
    }
  }
  return undefined;
}

/**
 * Get chain ID from chain name
 */
export function getChainId(chain: string): number {
  return DEFAULT_CHAINS[chain]?.chainId ?? 1;
}

/**
 * Get all chains that support USDT0
 */
export function getUsdt0Chains(): string[] {
  return Object.keys(USDT0_ADDRESSES);
}

/**
 * Get preferred token for a chain (USDT0 > USDC > USDT)
 */
export function getPreferredToken(chain: string): TokenInfo | undefined {
  const tokens = CHAIN_TOKENS[chain];
  if (!tokens || tokens.length === 0) return undefined;

  // Priority: USDT0 > USDC > others
  return (
    tokens.find((t) => t.symbol === "USDT0") ??
    tokens.find((t) => t.symbol === "USDC") ??
    tokens[0]
  );
}
