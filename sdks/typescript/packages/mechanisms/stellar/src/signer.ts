/**
 * Stellar Signer Interfaces
 *
 * Defines the signer interfaces for t402 client and facilitator operations.
 * These interfaces abstract away the specific Stellar SDK implementation,
 * allowing integration with various Stellar wallets and signing mechanisms.
 */

import type { VerifyTransactionResult, TransactionConfirmation } from './types.js'

/**
 * Parameters for building and signing a Soroban transfer transaction
 */
export type BuildTransferParams = {
  /** Token contract address (C-account) */
  tokenContract: string
  /** Sender address (G-account) */
  from: string
  /** Recipient address (G-account) */
  to: string
  /** Amount in smallest token units */
  amount: string
  /** Maximum ledger for transaction validity */
  maxLedger: number
  /** Network passphrase for signing */
  networkPassphrase: string
}

/**
 * ClientStellarSigner - Used by t402 clients to sign Soroban transactions
 *
 * This interface represents a Stellar account that can:
 * - Build and sign Soroban token transfer transactions
 * - Query the current ledger sequence
 *
 * Implementations may include:
 * - Stellar Keypair with secret key
 * - Freighter wallet adapter
 * - Hardware wallet integration (Ledger)
 */
export type ClientStellarSigner = {
  /** The account address (G-account) */
  readonly address: string

  /**
   * Build and sign a Soroban transfer transaction
   * Returns the complete signed transaction envelope in XDR format
   *
   * @param params - Transfer parameters
   * @returns Signed transaction XDR (base64 encoded)
   */
  buildAndSignTransfer(params: BuildTransferParams): Promise<string>

  /**
   * Get the current ledger sequence number
   * Used for calculating transaction validity bounds
   *
   * @returns Current ledger sequence number
   */
  getCurrentLedger(): Promise<number>
}

/**
 * Parameters for verifying a signed transaction
 */
export type VerifyTransactionParams = {
  /** The signed transaction XDR (base64) */
  signedTransactionXdr: string
  /** Expected sender address */
  expectedFrom: string
  /** Expected transfer details */
  expectedTransfer: {
    /** Expected token amount (in smallest units) */
    amount: string
    /** Expected destination address */
    destination: string
    /** Token contract address */
    tokenContract: string
  }
}

/**
 * FacilitatorStellarSigner - Used by t402 facilitators to verify and settle payments
 *
 * This interface combines Soroban RPC capabilities with verification:
 * - Verify signed transactions match expected parameters
 * - Submit transactions to the Soroban RPC
 * - Wait for transaction confirmations
 * - Query token balances
 */
export type FacilitatorStellarSigner = {
  /**
   * Get all addresses this facilitator can use
   */
  getAddresses(): readonly string[]

  /**
   * Get the current ledger sequence number
   *
   * @returns Current ledger sequence
   */
  getCurrentLedger(): Promise<number>

  /**
   * Query token balance for an account
   *
   * @param params - Account and token contract addresses
   * @returns Balance in smallest units
   */
  getTokenBalance(params: { accountAddress: string; tokenContract: string }): Promise<string>

  /**
   * Verify a signed transaction matches expected parameters
   *
   * @param params - Verification parameters
   * @returns Verification result
   */
  verifyTransaction(params: VerifyTransactionParams): Promise<VerifyTransactionResult>

  /**
   * Submit a signed transaction to the Soroban RPC
   *
   * @param signedTransactionXdr - Base64 encoded signed transaction XDR
   * @returns Transaction hash
   */
  submitTransaction(signedTransactionXdr: string): Promise<string>

  /**
   * Wait for a transaction to be confirmed
   *
   * @param txHash - Transaction hash to monitor
   * @param timeoutMs - Timeout in milliseconds (optional)
   * @returns Confirmation result
   */
  waitForConfirmation(txHash: string, timeoutMs?: number): Promise<TransactionConfirmation>

  /**
   * Check if an account exists on the network
   *
   * @param address - G-account address to check
   * @returns true if account exists
   */
  accountExists(address: string): Promise<boolean>
}

/**
 * Converts a Stellar signer to a ClientStellarSigner
 * Identity function for type compatibility
 *
 * @param signer - The signer to convert
 * @returns The same signer with ClientStellarSigner type
 */
export function toClientStellarSigner(signer: ClientStellarSigner): ClientStellarSigner {
  return signer
}

/**
 * Creates a FacilitatorStellarSigner from a single-address facilitator
 *
 * @param client - Facilitator client with single address
 * @returns FacilitatorStellarSigner with getAddresses() support
 */
export function toFacilitatorStellarSigner(
  client: Omit<FacilitatorStellarSigner, 'getAddresses'> & { address: string },
): FacilitatorStellarSigner {
  return {
    ...client,
    getAddresses: () => [client.address],
  }
}
