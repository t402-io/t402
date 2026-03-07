/**
 * Stellar Token Configuration
 *
 * This module provides Soroban token definitions including:
 * - USDC (Circle USDC on Stellar/Soroban)
 * - Network-specific configurations
 * - Helper functions for token lookups
 */

import { STELLAR_PUBNET_CAIP2, STELLAR_TESTNET_CAIP2 } from './constants.js'

/**
 * Token configuration for a Soroban SEP-41 token
 */
export interface TokenConfig {
  /** Soroban token contract address (C-account) */
  contractAddress: string
  /** Token symbol */
  symbol: string
  /** Token name */
  name: string
  /** Number of decimal places */
  decimals: number
  /** Payment priority (lower = higher priority) */
  priority: number
}

/**
 * Network token registry mapping network -> symbol -> config
 */
export type NetworkTokenRegistry = Record<string, Record<string, TokenConfig>>

/**
 * USDC contract addresses by network
 *
 * USDC on Stellar/Soroban follows the SEP-41 token interface.
 * @see https://stellar.org/protocol/sep-41
 */
export const USDC_ADDRESSES: Record<string, string> = {
  [STELLAR_PUBNET_CAIP2]: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI',
  [STELLAR_TESTNET_CAIP2]: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
}

/**
 * Complete token registry with all supported tokens per network
 */
export const TOKEN_REGISTRY: NetworkTokenRegistry = {
  [STELLAR_PUBNET_CAIP2]: {
    USDC: {
      contractAddress: USDC_ADDRESSES[STELLAR_PUBNET_CAIP2],
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 7,
      priority: 1,
    },
  },
  [STELLAR_TESTNET_CAIP2]: {
    USDC: {
      contractAddress: USDC_ADDRESSES[STELLAR_TESTNET_CAIP2],
      symbol: 'USDC',
      name: 'USD Coin (Testnet)',
      decimals: 7,
      priority: 1,
    },
  },
}

/**
 * Get token configuration for a specific token on a network
 *
 * @param network - Network identifier (CAIP-2 format)
 * @param symbol - Token symbol (e.g., "USDC")
 * @returns Token configuration or undefined
 */
export function getTokenConfig(network: string, symbol: string): TokenConfig | undefined {
  return TOKEN_REGISTRY[network]?.[symbol.toUpperCase()]
}

/**
 * Get all tokens available on a network
 *
 * @param network - Network identifier
 * @returns Array of token configurations sorted by priority
 */
export function getNetworkTokens(network: string): TokenConfig[] {
  const tokens = TOKEN_REGISTRY[network]
  if (!tokens) return []
  return Object.values(tokens).sort((a, b) => a.priority - b.priority)
}

/**
 * Get the default/preferred token for a network
 *
 * @param network - Network identifier
 * @returns Default token configuration or undefined
 */
export function getDefaultToken(network: string): TokenConfig | undefined {
  const tokens = getNetworkTokens(network)
  return tokens[0]
}

/**
 * Get token by contract address on a network
 *
 * @param network - Network identifier
 * @param address - Token contract address (C-account)
 * @returns Token configuration or undefined
 */
export function getTokenByAddress(network: string, address: string): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network]
  if (!tokens) return undefined
  return Object.values(tokens).find(
    (t) => t.contractAddress.toLowerCase() === address.toLowerCase(),
  )
}

/**
 * Get all networks that support a specific token
 *
 * @param symbol - Token symbol
 * @returns Array of network identifiers
 */
export function getNetworksForToken(symbol: string): string[] {
  const networks: string[] = []
  for (const [network, tokens] of Object.entries(TOKEN_REGISTRY)) {
    if (tokens[symbol.toUpperCase()]) {
      networks.push(network)
    }
  }
  return networks
}

/**
 * Get USDC networks on Stellar
 *
 * @returns Array of networks supporting USDC
 */
export function getUsdcNetworks(): string[] {
  return getNetworksForToken('USDC')
}

/**
 * Check if a network is supported
 *
 * @param network - Network identifier to check
 * @returns true if network has configured tokens
 */
export function isNetworkSupported(network: string): boolean {
  return network in TOKEN_REGISTRY
}

/**
 * Get all supported networks
 *
 * @returns Array of all supported network identifiers
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(TOKEN_REGISTRY)
}
