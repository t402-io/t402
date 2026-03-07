/**
 * Stellar Network Constants
 *
 * This module provides constants for Stellar blockchain integration including:
 * - CAIP-2 network identifiers
 * - Soroban RPC endpoints
 * - Network passphrases
 * - Default timeout and ledger timing
 */

/**
 * CAIP-2 Network Identifiers for Stellar
 */
export const STELLAR_PUBNET_CAIP2 = 'stellar:pubnet'
export const STELLAR_TESTNET_CAIP2 = 'stellar:testnet'

/**
 * Supported Stellar networks
 */
export const STELLAR_NETWORKS = [STELLAR_PUBNET_CAIP2, STELLAR_TESTNET_CAIP2] as const

export type StellarNetwork = (typeof STELLAR_NETWORKS)[number]

/**
 * Stellar network passphrases (used for transaction signing)
 */
export const STELLAR_PUBNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015'
export const STELLAR_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015'

/**
 * Network passphrase mapping
 */
export const NETWORK_PASSPHRASES: Record<string, string> = {
  [STELLAR_PUBNET_CAIP2]: STELLAR_PUBNET_PASSPHRASE,
  [STELLAR_TESTNET_CAIP2]: STELLAR_TESTNET_PASSPHRASE,
}

/**
 * Horizon API endpoints
 */
export const STELLAR_PUBNET_HORIZON = 'https://horizon.stellar.org'
export const STELLAR_TESTNET_HORIZON = 'https://horizon-testnet.stellar.org'

/**
 * Soroban RPC endpoints
 */
export const STELLAR_PUBNET_SOROBAN = 'https://soroban-rpc.mainnet.stellar.gateway.fm'
export const STELLAR_TESTNET_SOROBAN = 'https://soroban-testnet.stellar.org'

/**
 * Horizon endpoint mapping
 */
export const HORIZON_ENDPOINTS: Record<string, string> = {
  [STELLAR_PUBNET_CAIP2]: STELLAR_PUBNET_HORIZON,
  [STELLAR_TESTNET_CAIP2]: STELLAR_TESTNET_HORIZON,
}

/**
 * Soroban RPC endpoint mapping
 */
export const SOROBAN_ENDPOINTS: Record<string, string> = {
  [STELLAR_PUBNET_CAIP2]: STELLAR_PUBNET_SOROBAN,
  [STELLAR_TESTNET_CAIP2]: STELLAR_TESTNET_SOROBAN,
}

/**
 * Scheme identifier for exact payments
 */
export const SCHEME_EXACT = 'exact'

/**
 * Default timeout for payment validity (in seconds)
 */
export const DEFAULT_TIMEOUT_SECONDS = 60

/**
 * Approximate seconds per Stellar ledger close
 */
export const LEDGER_TIME_SECONDS = 5

/**
 * Stellar address length constants
 * G-accounts: public keys (56 characters, start with G)
 * C-accounts: contract addresses (56 characters, start with C)
 */
export const STELLAR_G_ADDRESS_LENGTH = 56
export const STELLAR_C_ADDRESS_LENGTH = 56
