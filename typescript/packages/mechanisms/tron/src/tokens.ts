/**
 * TRC20 Token Configuration
 *
 * Registry of supported TRC20 tokens for each TRON network.
 */

import type { TRC20Config, NetworkTRC20Registry } from "./types.js";
import {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  TRON_SHASTA_CAIP2,
  USDT_ADDRESSES,
  DEFAULT_USDT_DECIMALS,
} from "./constants.js";

// =============================================================================
// USDT Token Configurations
// =============================================================================

/** USDT on TRON Mainnet */
const USDT_MAINNET: TRC20Config = {
  contractAddress: USDT_ADDRESSES[TRON_MAINNET_CAIP2],
  symbol: "USDT",
  name: "Tether USD",
  decimals: DEFAULT_USDT_DECIMALS,
};

/** USDT on TRON Nile Testnet */
const USDT_NILE: TRC20Config = {
  contractAddress: USDT_ADDRESSES[TRON_NILE_CAIP2],
  symbol: "USDT",
  name: "Tether USD",
  decimals: DEFAULT_USDT_DECIMALS,
};

/** USDT on TRON Shasta Testnet */
const USDT_SHASTA: TRC20Config = {
  contractAddress: USDT_ADDRESSES[TRON_SHASTA_CAIP2],
  symbol: "USDT",
  name: "Tether USD",
  decimals: DEFAULT_USDT_DECIMALS,
};

// =============================================================================
// Token Registry
// =============================================================================

/**
 * Registry of TRC20 tokens by network
 */
export const TRC20_REGISTRY: Record<string, NetworkTRC20Registry> = {
  [TRON_MAINNET_CAIP2]: {
    network: TRON_MAINNET_CAIP2,
    defaultToken: USDT_MAINNET,
    tokens: {
      USDT: USDT_MAINNET,
    },
  },
  [TRON_NILE_CAIP2]: {
    network: TRON_NILE_CAIP2,
    defaultToken: USDT_NILE,
    tokens: {
      USDT: USDT_NILE,
    },
  },
  [TRON_SHASTA_CAIP2]: {
    network: TRON_SHASTA_CAIP2,
    defaultToken: USDT_SHASTA,
    tokens: {
      USDT: USDT_SHASTA,
    },
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get TRC20 configuration for a specific token on a network
 *
 * @param network - CAIP-2 network identifier
 * @param symbol - Token symbol (e.g., "USDT")
 * @returns Token configuration or undefined if not found
 */
export function getTRC20Config(network: string, symbol: string): TRC20Config | undefined {
  const registry = TRC20_REGISTRY[network];
  if (!registry) return undefined;
  return registry.tokens[symbol];
}

/**
 * Get all TRC20 tokens for a network
 *
 * @param network - CAIP-2 network identifier
 * @returns Array of token configurations
 */
export function getNetworkTokens(network: string): TRC20Config[] {
  const registry = TRC20_REGISTRY[network];
  if (!registry) return [];
  return Object.values(registry.tokens);
}

/**
 * Get the default TRC20 token for a network
 *
 * @param network - CAIP-2 network identifier
 * @returns Default token configuration or undefined
 */
export function getDefaultToken(network: string): TRC20Config | undefined {
  const registry = TRC20_REGISTRY[network];
  return registry?.defaultToken;
}

/**
 * Get token by contract address
 *
 * @param network - CAIP-2 network identifier
 * @param contractAddress - TRC20 contract address
 * @returns Token configuration or undefined
 */
export function getTokenByAddress(network: string, contractAddress: string): TRC20Config | undefined {
  const registry = TRC20_REGISTRY[network];
  if (!registry) return undefined;

  const upperAddress = contractAddress.toUpperCase();
  return Object.values(registry.tokens).find(
    token => token.contractAddress.toUpperCase() === upperAddress,
  );
}

/**
 * Get all networks that support a specific token
 *
 * @param symbol - Token symbol (e.g., "USDT")
 * @returns Array of network identifiers
 */
export function getNetworksForToken(symbol: string): string[] {
  return Object.entries(TRC20_REGISTRY)
    .filter(([_, registry]) => symbol in registry.tokens)
    .map(([network]) => network);
}

/**
 * Get all networks that support USDT
 *
 * @returns Array of network identifiers
 */
export function getUsdtNetworks(): string[] {
  return getNetworksForToken("USDT");
}

/**
 * Check if a network is supported
 *
 * @param network - CAIP-2 network identifier
 * @returns true if network is supported
 */
export function isNetworkSupported(network: string): boolean {
  return network in TRC20_REGISTRY;
}

/**
 * Get all supported networks
 *
 * @returns Array of network identifiers
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(TRC20_REGISTRY);
}
