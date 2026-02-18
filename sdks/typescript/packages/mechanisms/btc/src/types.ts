/**
 * Bitcoin & Lightning Network Payment Payload Types
 *
 * Defines the payload structures for BTC on-chain and Lightning payments
 * in the t402 protocol.
 */

/**
 * Bitcoin on-chain payment payload for the exact scheme (V2)
 * Contains a signed PSBT (Partially Signed Bitcoin Transaction)
 */
export type BtcOnchainPayload = {
  /**
   * Base64-encoded signed PSBT
   * Contains the complete transaction ready for finalization and broadcast
   */
  signedPsbt: string

  /**
   * Optional transaction ID (available after broadcast)
   */
  txId?: string
}

/**
 * Lightning Network payment payload
 * Contains proof of payment via preimage
 */
export type LightningPayload = {
  /**
   * SHA-256 payment hash (hex-encoded)
   * Identifies the payment on the Lightning Network
   */
  paymentHash: string

  /**
   * Payment preimage (hex-encoded)
   * Proof that the payment was completed (SHA-256(preimage) === paymentHash)
   */
  preimage: string

  /**
   * BOLT11 invoice string that was paid
   */
  bolt11Invoice: string
}
