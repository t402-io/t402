/**
 * Stellar Payment Payload Types
 *
 * Defines the payload structure for Stellar Soroban payments in the t402 protocol.
 * Uses XDR (External Data Representation) format for transaction serialization.
 */

/**
 * Stellar payment payload for the exact scheme
 * Contains a signed Soroban transaction for SEP-41 token transfer
 */
export type ExactStellarPayload = {
  /**
   * Base64 encoded signed transaction envelope (XDR format)
   * Contains the complete Soroban transfer transaction ready for submission
   */
  signedTransactionXdr: string

  /**
   * Transfer authorization metadata
   * Provides human-readable and verifiable parameters
   */
  authorization: {
    /**
     * Sender account address (G-account, 56 chars, starts with G)
     */
    from: string

    /**
     * Recipient account address (G-account, 56 chars, starts with G)
     */
    to: string

    /**
     * Token contract address (C-account, 56 chars, starts with C)
     * Identifies which Soroban token (SEP-41) is being transferred
     */
    tokenContract: string

    /**
     * Token amount in smallest units (e.g., 10000000 for 1.0 USDC with 7 decimals)
     */
    amount: string

    /**
     * Maximum ledger sequence number for transaction validity
     * Transaction will be rejected after this ledger closes
     */
    maxLedger: number

    /**
     * CAIP-2 network identifier
     */
    network: string
  }
}

/**
 * Result of transaction verification
 */
export type VerifyTransactionResult = {
  /** Whether the transaction is valid */
  valid: boolean
  /** Reason for invalidity (if applicable) */
  reason?: string
  /** Extracted transfer parameters */
  transfer?: {
    from: string
    to: string
    amount: string
    tokenContract: string
  }
}

/**
 * Transaction status for tracking payment lifecycle
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed'

/**
 * Transaction confirmation result from Soroban RPC
 */
export type TransactionConfirmation = {
  /** Whether the transaction was confirmed */
  success: boolean
  /** Transaction lifecycle status */
  status?: TransactionStatus
  /** Transaction hash */
  hash?: string
  /** Ledger number where transaction was included */
  ledger?: number
  /** Error message if failed */
  error?: string
}
