/**
 * WDK TON Gasless Types
 *
 * Type definitions for gasless Jetton USDT0 payments on TON.
 */

/**
 * Configuration for the TON gasless client
 */
export interface TonGaslessConfig {
  /** WDK wallet instance (from @tetherto/wdk-wallet-ton-gasless) */
  wdkInstance?: unknown
  /** TON API endpoint (default: mainnet) */
  tonEndpoint?: string
  /** Gasless relay configuration */
  relayConfig?: {
    /** Relay service URL */
    url?: string
    /** API key for the relay service */
    apiKey?: string
  }
}

/**
 * Parameters for a gasless payment
 */
export interface TonGaslessPaymentParams {
  /** Recipient TON address (friendly format) */
  to: string
  /** Amount in Jetton units (6 decimals for USDT0) */
  amount: bigint
  /** Token type (default: 'USDT0') */
  token?: 'USDT0' | 'USDT'
  /** Optional memo/comment */
  memo?: string
}

/**
 * Result of a gasless payment
 */
export interface TonGaslessPaymentResult {
  /** Transaction hash/BOC hash */
  txHash: string
  /** Sender address */
  from: string
  /** Recipient address */
  to: string
  /** Whether the transaction was gas-sponsored */
  sponsored: boolean
  /** Token transferred */
  token: string
}
