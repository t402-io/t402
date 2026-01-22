/**
 * Tezos token registry
 */

import { TEZOS_MAINNET_CAIP2, TEZOS_GHOSTNET_CAIP2 } from "./constants.js";

/**
 * Token configuration for Tezos FA2 tokens
 */
export interface TokenConfig {
  /** FA2 contract address (KT1...) */
  contractAddress: string;
  /** Token ID within the FA2 contract */
  tokenId: number;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Token decimals */
  decimals: number;
}

/**
 * USDT on Tezos Mainnet
 */
export const USDT_MAINNET: TokenConfig = {
  contractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
  tokenId: 0,
  symbol: "USDt",
  name: "Tether USD",
  decimals: 6,
};

/**
 * Token registry by network
 */
export const TOKEN_REGISTRY: Record<string, TokenConfig[]> = {
  [TEZOS_MAINNET_CAIP2]: [USDT_MAINNET],
  [TEZOS_GHOSTNET_CAIP2]: [],
};

/**
 * Default token for each network
 */
export const DEFAULT_TOKENS: Record<string, TokenConfig | undefined> = {
  [TEZOS_MAINNET_CAIP2]: USDT_MAINNET,
  [TEZOS_GHOSTNET_CAIP2]: undefined,
};

/**
 * Get token by symbol for a network
 */
export function getTokenBySymbol(
  network: string,
  symbol: string,
): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;
  return tokens.find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}

/**
 * Get token by contract address and token ID
 */
export function getTokenByContract(
  network: string,
  contractAddress: string,
  tokenId: number,
): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;
  return tokens.find(
    (t) =>
      t.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
      t.tokenId === tokenId,
  );
}

/**
 * Get default token for a network
 */
export function getDefaultToken(network: string): TokenConfig | undefined {
  return DEFAULT_TOKENS[network];
}
