/**
 * Type definitions for @t402/wdk-protocol
 */

/**
 * Configuration for the T402 protocol module
 */
export interface T402ProtocolConfig {
  /** Facilitator URL for payment verification/settlement (default: https://facilitator.t402.io) */
  facilitator?: string
  /** CAIP-2 networks or chain names to support */
  chains?: string[]
  /** WDK account index to use (default: 0) */
  accountIndex?: number
}

/**
 * Result of a successful payment
 */
export interface PaymentReceipt {
  /** Whether payment was successful */
  success: boolean
  /** The payment network used */
  network: string
  /** The payment scheme used */
  scheme: string
  /** Amount paid */
  amount: string
  /** Address paid to */
  payTo: string
  /** Settlement transaction hash (if settled) */
  transaction?: string
}

/**
 * Result from T402Protocol.fetch()
 */
export interface T402FetchResult {
  /** The HTTP response */
  response: Response
  /** Payment receipt if a 402 was handled */
  receipt?: PaymentReceipt
}
