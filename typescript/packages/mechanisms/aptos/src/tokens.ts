/**
 * Aptos Token Registry
 *
 * Token addresses for supported stablecoins on Aptos networks.
 * All tokens use the Fungible Asset (FA) standard.
 */

import {
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  APTOS_DEVNET_CAIP2,
} from "./constants.js";

/**
 * Token configuration for Aptos fungible assets
 */
export interface TokenConfig {
  /** Fungible Asset metadata address */
  metadataAddress: string;
  /** Token symbol (e.g., "USDT", "USDC") */
  symbol: string;
  /** Token name */
  name: string;
  /** Decimal places */
  decimals: number;
}

/**
 * Token registry mapping network -> tokens
 */
export const TOKEN_REGISTRY: Record<string, TokenConfig[]> = {
  [APTOS_MAINNET_CAIP2]: [
    {
      metadataAddress:
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
    {
      metadataAddress:
        "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
  ],
  [APTOS_TESTNET_CAIP2]: [
    {
      // Testnet USDT (may differ from mainnet)
      metadataAddress:
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
  ],
  [APTOS_DEVNET_CAIP2]: [],
};

/**
 * Get token configuration for a specific network and symbol
 */
export function getTokenConfig(
  network: string,
  symbol: string,
): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;
  return tokens.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase(),
  );
}

/**
 * Get all supported tokens for a network
 */
export function getSupportedTokens(network: string): TokenConfig[] {
  return TOKEN_REGISTRY[network] || [];
}

/**
 * Check if a token is supported on a network
 */
export function isTokenSupported(network: string, symbol: string): boolean {
  return getTokenConfig(network, symbol) !== undefined;
}

/**
 * Get token by metadata address
 */
export function getTokenByAddress(
  network: string,
  metadataAddress: string,
): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;
  const normalizedAddress = metadataAddress.toLowerCase();
  return tokens.find(
    (t) => t.metadataAddress.toLowerCase() === normalizedAddress,
  );
}

/**
 * Default token symbol for payments (USDT)
 */
export const DEFAULT_TOKEN_SYMBOL = "USDT";

/**
 * Get the default token for a network
 */
export function getDefaultToken(network: string): TokenConfig | undefined {
  return getTokenConfig(network, DEFAULT_TOKEN_SYMBOL);
}
