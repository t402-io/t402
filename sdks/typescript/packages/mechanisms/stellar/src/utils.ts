/**
 * Stellar Utility Functions
 *
 * Helper functions for Stellar address handling, network operations,
 * and amount conversions.
 */

import type { Network } from '@t402/core/types'
import {
  STELLAR_PUBNET_CAIP2,
  STELLAR_TESTNET_CAIP2,
  STELLAR_NETWORKS,
  HORIZON_ENDPOINTS,
  SOROBAN_ENDPOINTS,
  LEDGER_TIME_SECONDS,
} from './constants.js'

/**
 * Normalize network identifier to CAIP-2 format
 *
 * @param network - Network identifier (may be legacy format)
 * @returns Normalized CAIP-2 network identifier
 * @throws Error if network is not supported
 */
export function normalizeNetwork(network: Network): Network {
  if (network.startsWith('stellar:')) {
    if (!STELLAR_NETWORKS.includes(network as (typeof STELLAR_NETWORKS)[number])) {
      throw new Error(`Unsupported Stellar network: ${network}`)
    }
    return network as Network
  }

  const mapping: Record<string, Network> = {
    stellar: STELLAR_PUBNET_CAIP2 as Network,
    'stellar-pubnet': STELLAR_PUBNET_CAIP2 as Network,
    pubnet: STELLAR_PUBNET_CAIP2 as Network,
    mainnet: STELLAR_PUBNET_CAIP2 as Network,
    'stellar-testnet': STELLAR_TESTNET_CAIP2 as Network,
    testnet: STELLAR_TESTNET_CAIP2 as Network,
  }

  const caip2 = mapping[network.toLowerCase()]
  if (!caip2) {
    throw new Error(`Unsupported Stellar network: ${network}`)
  }
  return caip2
}

/**
 * Get Horizon API endpoint for a network
 *
 * @param network - Network identifier
 * @returns Horizon endpoint URL
 */
export function getHorizonEndpoint(network: Network): string {
  const caip2 = normalizeNetwork(network)
  const endpoint = HORIZON_ENDPOINTS[caip2]
  if (!endpoint) {
    throw new Error(`No Horizon endpoint configured for network: ${network}`)
  }
  return endpoint
}

/**
 * Get Soroban RPC endpoint for a network
 *
 * @param network - Network identifier
 * @returns Soroban RPC endpoint URL
 */
export function getSorobanEndpoint(network: Network): string {
  const caip2 = normalizeNetwork(network)
  const endpoint = SOROBAN_ENDPOINTS[caip2]
  if (!endpoint) {
    throw new Error(`No Soroban endpoint configured for network: ${network}`)
  }
  return endpoint
}

/**
 * Check if a network identifier is a supported Stellar network
 *
 * @param network - Network identifier to check
 * @returns true if supported
 */
export function isStellarNetwork(network: string): boolean {
  try {
    normalizeNetwork(network as Network)
    return true
  } catch {
    return false
  }
}

/**
 * Validate a Stellar G-account address (public key)
 *
 * @param address - Address to validate
 * @returns true if valid G-account
 */
export function validateGAddress(address: string): boolean {
  return typeof address === 'string' && address.length === 56 && address.startsWith('G')
}

/**
 * Validate a Stellar C-account address (contract)
 * Contract addresses start with 'C' and are typically 56 characters (StrKey encoded)
 *
 * @param address - Address to validate
 * @returns true if valid C-account
 */
export function validateCAddress(address: string): boolean {
  return typeof address === 'string' && address.length >= 50 && address.startsWith('C')
}

/**
 * Validate a Stellar address (G-account or C-account)
 *
 * @param address - Address to validate
 * @returns true if valid Stellar address
 */
export function validateStellarAddress(address: string): boolean {
  return validateGAddress(address) || validateCAddress(address)
}

/**
 * Convert decimal amount to smallest units (stroops)
 * Stellar tokens typically use 7 decimal places
 *
 * @param decimalAmount - Amount in decimal format (e.g., "1.50")
 * @param decimals - Number of decimal places (default: 7)
 * @returns Amount in smallest units as string
 */
export function convertToTokenAmount(decimalAmount: string, decimals: number = 7): string {
  const amount = parseFloat(decimalAmount)
  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${decimalAmount}`)
  }
  const tokenAmount = Math.floor(amount * Math.pow(10, decimals))
  return tokenAmount.toString()
}

/**
 * Convert smallest units to decimal amount
 *
 * @param tokenAmount - Amount in smallest units
 * @param decimals - Number of decimal places (default: 7)
 * @returns Amount in decimal format as string
 */
export function convertFromTokenAmount(tokenAmount: string | bigint, decimals: number = 7): string {
  const amount = typeof tokenAmount === 'string' ? BigInt(tokenAmount) : tokenAmount
  const divisor = BigInt(Math.pow(10, decimals))
  const wholePart = amount / divisor
  const fractionalPart = amount % divisor

  if (fractionalPart === 0n) {
    return wholePart.toString()
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  return `${wholePart}.${fractionalStr}`.replace(/\.?0+$/, '')
}

/**
 * Calculate max ledger from timeout seconds
 * Uses ceiling division to ensure the timeout is fully covered
 *
 * @param currentLedger - Current ledger sequence number
 * @param timeoutSeconds - Desired timeout in seconds
 * @returns Max ledger sequence number
 */
export function calculateMaxLedger(currentLedger: number, timeoutSeconds: number): number {
  return currentLedger + Math.ceil(timeoutSeconds / LEDGER_TIME_SECONDS)
}
