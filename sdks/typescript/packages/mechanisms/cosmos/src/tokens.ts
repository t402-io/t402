/**
 * Cosmos Token Registry
 *
 * Defines supported tokens for each Cosmos network (currently Noble USDC).
 */

import { NOBLE_MAINNET_CAIP2, NOBLE_TESTNET_CAIP2, USDC_DENOM } from "./constants.js";
import type { TokenConfig } from "./types.js";

/**
 * Token registry by network
 */
export const TOKEN_REGISTRY: Record<string, TokenConfig[]> = {
  [NOBLE_MAINNET_CAIP2]: [
    {
      denom: USDC_DENOM,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      priority: 1,
    },
  ],
  [NOBLE_TESTNET_CAIP2]: [
    {
      denom: USDC_DENOM,
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
 * Get token configuration by denomination
 * @param network - CAIP-2 network identifier
 * @param denom - Token denomination (e.g., "uusdc")
 * @returns Token configuration or undefined
 */
export function getTokenByDenom(network: string, denom: string): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;
  return tokens.find((t) => t.denom === denom);
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
