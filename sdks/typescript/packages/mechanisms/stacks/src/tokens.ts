/**
 * Stacks Token Registry
 *
 * On Stacks, tokens are SIP-010 fungible tokens identified by
 * their contract address (principal.contract-name).
 */

import {
  STACKS_MAINNET_CAIP2,
  STACKS_TESTNET_CAIP2,
} from "./constants.js";

/**
 * Token configuration for Stacks SIP-010 tokens
 */
export interface TokenConfig {
  /** Contract address (principal.contract-name) */
  readonly contractAddress: string;
  /** Token symbol */
  readonly symbol: string;
  /** Token name */
  readonly name: string;
  /** Decimal places */
  readonly decimals: number;
  /** Token issuer */
  readonly issuer?: string;
}

/**
 * sUSDC on Stacks Mainnet
 * Contract: SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc
 * Decimals: 6
 */
export const SUSDC_MAINNET: TokenConfig = {
  contractAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
  symbol: "sUSDC",
  name: "Stacks USDC",
  decimals: 6,
  issuer: "Stacks",
};

/**
 * sUSDC on Stacks Testnet
 * Contract: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc
 * Decimals: 6
 */
export const SUSDC_TESTNET: TokenConfig = {
  contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
  symbol: "sUSDC",
  name: "Test Stacks USDC",
  decimals: 6,
};

/**
 * Network-specific token registries
 */
export const TOKEN_REGISTRY: Record<string, Record<string, TokenConfig>> = {
  [STACKS_MAINNET_CAIP2]: {
    sUSDC: SUSDC_MAINNET,
  },
  [STACKS_TESTNET_CAIP2]: {
    sUSDC: SUSDC_TESTNET,
  },
};

/**
 * Default tokens per network
 */
export const DEFAULT_TOKENS: Record<string, TokenConfig> = {
  [STACKS_MAINNET_CAIP2]: SUSDC_MAINNET,
  [STACKS_TESTNET_CAIP2]: SUSDC_TESTNET,
};

/**
 * Get token configuration by network and symbol
 */
export function getTokenConfig(
  network: string,
  symbol: string = "sUSDC",
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
 * Get contract address for a token on a network
 */
export function getContractAddress(network: string, symbol: string = "sUSDC"): string | undefined {
  return getTokenConfig(network, symbol)?.contractAddress;
}
