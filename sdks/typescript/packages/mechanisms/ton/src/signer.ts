/**
 * TON Signer Interfaces
 *
 * Defines the signer interfaces for t402 client and facilitator operations.
 * These interfaces abstract away the specific wallet implementation,
 * allowing integration with various TON wallets and signing mechanisms.
 */

import type { Address, Cell, SendMode } from '@ton/core'
import type { VerifyMessageResult, TransactionConfirmation, TransactionStatus } from './types.js'

/**
 * Parameters for signing a TON internal message
 */
export type SignMessageParams = {
  /** Destination address (typically Jetton wallet contract) */
  to: Address
  /** Amount of TON to attach (for gas) in nanoTON */
  value: bigint
  /** Message body (Jetton transfer cell) */
  body: Cell
  /** Send mode flags (optional, defaults to PAY_GAS_SEPARATELY) */
  sendMode?: SendMode
  /** Bounce flag (optional, defaults to true) */
  bounce?: boolean
  /** Message validity timeout in seconds (optional) */
  timeout?: number
}

/**
 * ClientTonSigner - Used by t402 clients to sign Jetton transfer messages
 *
 * This interface represents a TON wallet that can:
 * - Sign internal messages for Jetton transfers
 * - Query its own seqno (sequence number)
 *
 * Implementations may include:
 * - WalletContractV4 with private key
 * - TonConnect wallet adapter
 * - Hardware wallet integration
 */
export type ClientTonSigner = {
  /** The wallet address */
  readonly address: Address

  /**
   * Sign an internal message for Jetton transfer
   * Returns the complete signed external message ready for broadcast
   *
   * @param params - Message parameters
   * @returns Signed external message as Cell (BOC)
   */
  signMessage(params: SignMessageParams): Promise<Cell>

  /**
   * Get current seqno for the wallet
   * Used for replay protection
   *
   * @returns Current sequence number
   */
  getSeqno(): Promise<number>
}

/**
 * Parameters for verifying a signed message
 */
export type VerifyMessageParams = {
  /** The signed BOC from client (base64) */
  signedBoc: string
  /** Expected sender address */
  expectedFrom: string
  /** Expected Jetton transfer details */
  expectedTransfer: {
    /** Expected Jetton amount */
    jettonAmount: bigint
    /** Expected destination address */
    destination: string
    /** Jetton master address */
    jettonMaster: string
  }
}

/**
 * Parameters for waiting on transaction confirmation
 */
export type WaitForTransactionParams = {
  /** Address to monitor */
  address: string
  /** Expected seqno after transaction */
  seqno: number
  /** Timeout in milliseconds (optional) */
  timeout?: number
}

/**
 * FacilitatorTonSigner - Used by t402 facilitators to verify and settle payments
 *
 * This interface combines RPC capabilities with signing abilities:
 * - Query Jetton balances and wallet addresses
 * - Verify signed messages
 * - Broadcast transactions
 * - Wait for confirmations
 */
export type FacilitatorTonSigner = {
  /**
   * Get all addresses this facilitator can use for signing
   * Enables dynamic address selection for load balancing
   */
  getAddresses(): readonly string[]

  /**
   * Query Jetton balance for an owner
   *
   * @param params - Owner and Jetton master addresses
   * @returns Balance in smallest units
   */
  getJettonBalance(params: { ownerAddress: string; jettonMasterAddress: string }): Promise<bigint>

  /**
   * Get Jetton wallet address for an owner
   * Derives the associated Jetton wallet contract address
   *
   * @param params - Owner and Jetton master addresses
   * @returns Jetton wallet address
   */
  getJettonWalletAddress(params: {
    ownerAddress: string
    jettonMasterAddress: string
  }): Promise<string>

  /**
   * Verify a signed message matches expected parameters
   * Validates the BOC structure and transfer details
   *
   * @param params - Verification parameters
   * @returns Verification result
   */
  verifyMessage(params: VerifyMessageParams): Promise<VerifyMessageResult>

  /**
   * Send a pre-signed external message to the network
   *
   * @param signedBoc - Base64 encoded signed BOC
   * @returns Transaction hash or identifier
   */
  sendExternalMessage(signedBoc: string): Promise<string>

  /**
   * Wait for transaction confirmation
   *
   * @param params - Transaction monitoring parameters
   * @returns Confirmation result
   */
  waitForTransaction(params: WaitForTransactionParams): Promise<TransactionConfirmation>

  /**
   * Get current seqno for an address
   *
   * @param address - Wallet address to query
   * @returns Current seqno
   */
  getSeqno(address: string): Promise<number>

  /**
   * Check if a wallet is deployed (active)
   *
   * @param address - Address to check
   * @returns true if deployed
   */
  isDeployed(address: string): Promise<boolean>
}

/**
 * Optional interface for transaction status checking.
 *
 * Signers implementing this interface enable post-confirmation failure detection:
 * after seqno-based confirmation succeeds, the facilitator can verify that the
 * Jetton transfer within the transaction actually completed (not just that
 * the external message was processed).
 *
 * This adopts the transaction status tracking pattern from TON Connect v0.0.9.
 *
 * @see https://github.com/ton-connect/kit (TEP-46 transaction status)
 */
export type TransactionStatusChecker = {
  /**
   * Get the status of a transaction by its hash.
   * Used for post-confirmation failure detection.
   *
   * @param params - Transaction identifier
   * @returns Transaction status
   */
  getTransactionStatus(params: { hash: string; network?: string }): Promise<TransactionStatus>
}

/**
 * Type guard to check if a signer implements TransactionStatusChecker
 */
export function hasTransactionStatusChecker(
  signer: FacilitatorTonSigner,
): signer is FacilitatorTonSigner & TransactionStatusChecker {
  return 'getTransactionStatus' in signer && typeof (signer as any).getTransactionStatus === 'function'
}

/**
 * Converts a TON wallet to a ClientTonSigner
 * Identity function for type compatibility
 *
 * @param signer - The signer to convert
 * @returns The same signer with ClientTonSigner type
 */
export function toClientTonSigner(signer: ClientTonSigner): ClientTonSigner {
  return signer
}

/**
 * Creates a FacilitatorTonSigner from a single-address facilitator
 * Wraps the single address in a getAddresses() function for compatibility
 *
 * @param client - Facilitator client with single address
 * @returns FacilitatorTonSigner with getAddresses() support
 */
export function toFacilitatorTonSigner(
  client: Omit<FacilitatorTonSigner, 'getAddresses'> & { address: string },
): FacilitatorTonSigner {
  return {
    ...client,
    getAddresses: () => [client.address],
  }
}
