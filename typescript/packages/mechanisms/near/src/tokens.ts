/**
 * NEAR Token Registry
 *
 * Defines supported tokens (NEP-141 fungible tokens) for each NEAR network.
 */

import { NEAR_MAINNET_CAIP2, NEAR_TESTNET_CAIP2 } from "./constants.js";

/**
 * Token configuration
 */
export interface TokenConfig {
  /** Contract address/account ID */
  contractId: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Decimal places */
  decimals: number;
  /** Priority for selection (lower = higher priority) */
  priority: number;
}

/**
 * Token registry by network
 */
export const TOKEN_REGISTRY: Record<string, TokenConfig[]> = {
  [NEAR_MAINNET_CAIP2]: [
    {
      // USDC on NEAR (Rainbow Bridge)
      contractId: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priority: 1,
    },
    {
      // USDT on NEAR
      contractId: "usdt.tether-token.near",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      priority: 2,
    },
  ],
  [NEAR_TESTNET_CAIP2]: [
    {
      // Fake USDC on testnet
      contractId: "usdc.fakes.testnet",
      symbol: "USDC",
      name: "USD Coin (Testnet)",
      decimals: 6,
      priority: 1,
    },
  ],
};

/**
 * Get token configuration by symbol
 * @param network - CAIP-2 network identifier
 * @param symbol - Token symbol (e.g., "USDC")
 * @returns Token configuration or undefined
 */
export function getTokenConfig(network: string, symbol: string): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;
  return tokens.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
}

/**
 * Get token configuration by contract ID
 * @param network - CAIP-2 network identifier
 * @param contractId - Token contract account ID
 * @returns Token configuration or undefined
 */
export function getTokenByContract(network: string, contractId: string): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;
  return tokens.find((t) => t.contractId === contractId);
}

/**
 * Get the default token for a network
 * Returns the token with highest priority (lowest priority number)
 * @param network - CAIP-2 network identifier
 * @returns Default token configuration or undefined
 */
export function getDefaultToken(network: string): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens || tokens.length === 0) return undefined;
  return [...tokens].sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Get all tokens for a network
 * @param network - CAIP-2 network identifier
 * @returns Array of token configurations
 */
export function getNetworkTokens(network: string): TokenConfig[] {
  return TOKEN_REGISTRY[network] || [];
}

/**
 * Check if a network is supported
 * @param network - CAIP-2 network identifier
 */
export function isNetworkSupported(network: string): boolean {
  return network in TOKEN_REGISTRY;
}
