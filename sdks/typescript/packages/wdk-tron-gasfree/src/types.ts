/**
 * WDK TRON Gas-Free Types
 *
 * Type definitions for gas-free TRC20 USDT payments on TRON.
 */

/**
 * Configuration for the WDK TRON gas-free client
 */
export interface WdkTronGasfreeConfig {
  /** WDK wallet instance (from @tetherto/wdk-wallet-tron-gasfree) */
  wdkInstance?: unknown
  /** TRON node URL (default: mainnet) */
  tronNodeUrl?: string
  /** Gas-free relay configuration */
  relayConfig?: {
    /** Relay service URL */
    url?: string
    /** API key for the relay service */
    apiKey?: string
  }
}

/**
 * Parameters for a gas-free payment
 */
export interface GasfreePaymentParams {
  /** Recipient TRON address (base58) */
  to: string
  /** Amount in smallest units (sun for TRC20, 6 decimals for USDT) */
  amount: bigint
  /** Token type (default: 'USDT') */
  token?: 'USDT' | 'USDT0'
  /** Optional memo/note */
  memo?: string
}

/**
 * Result of a gas-free payment
 */
export interface GasfreePaymentResult {
  /** Transaction ID */
  txId: string
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Whether the transaction was gas-sponsored */
  sponsored: boolean
}
