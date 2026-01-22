/**
 * Polkadot Asset Hub Token Registry
 *
 * On Polkadot Asset Hub, tokens are identified by Asset IDs.
 * USDT is Asset ID 1984, created by Tether.
 */

import {
  POLKADOT_ASSET_HUB_CAIP2,
  KUSAMA_ASSET_HUB_CAIP2,
  WESTEND_ASSET_HUB_CAIP2,
} from "./constants.js";

/**
 * Token configuration for Polkadot Asset Hub
 */
export interface TokenConfig {
  /** Asset ID on Asset Hub */
  readonly assetId: number;
  /** Token symbol */
  readonly symbol: string;
  /** Token name */
  readonly name: string;
  /** Decimal places */
  readonly decimals: number;
  /** Issuer (creator of the asset) */
  readonly issuer?: string;
}

/**
 * USDT on Polkadot Asset Hub
 * Asset ID: 1984
 * Decimals: 6
 */
export const USDT_POLKADOT: TokenConfig = {
  assetId: 1984,
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  issuer: "Tether",
};

/**
 * USDT on Kusama Asset Hub
 * Asset ID: 1984 (same as Polkadot)
 */
export const USDT_KUSAMA: TokenConfig = {
  assetId: 1984,
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  issuer: "Tether",
};

/**
 * Test USDT on Westend Asset Hub (testnet)
 */
export const USDT_WESTEND: TokenConfig = {
  assetId: 1984,
  symbol: "USDT",
  name: "Test Tether USD",
  decimals: 6,
};

/**
 * Network-specific token registries
 */
export const TOKEN_REGISTRY: Record<string, Record<string, TokenConfig>> = {
  [POLKADOT_ASSET_HUB_CAIP2]: {
    USDT: USDT_POLKADOT,
  },
  [KUSAMA_ASSET_HUB_CAIP2]: {
    USDT: USDT_KUSAMA,
  },
  [WESTEND_ASSET_HUB_CAIP2]: {
    USDT: USDT_WESTEND,
  },
};

/**
 * Default tokens per network
 */
export const DEFAULT_TOKENS: Record<string, TokenConfig> = {
  [POLKADOT_ASSET_HUB_CAIP2]: USDT_POLKADOT,
  [KUSAMA_ASSET_HUB_CAIP2]: USDT_KUSAMA,
  [WESTEND_ASSET_HUB_CAIP2]: USDT_WESTEND,
};

/**
 * Get token configuration by network and symbol
 */
export function getTokenConfig(
  network: string,
  symbol: string = "USDT",
): TokenConfig | undefined {
  return TOKEN_REGISTRY[network]?.[symbol];
}

/**
 * Get the default token for a network
 */
export function getDefaultToken(network: string): TokenConfig | undefined {
  return DEFAULT_TOKENS[network];
}

/**
 * Get asset ID for a token on a network
 */
export function getAssetId(network: string, symbol: string = "USDT"): number | undefined {
  return getTokenConfig(network, symbol)?.assetId;
}
