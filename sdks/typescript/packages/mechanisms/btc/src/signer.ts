/**
 * Bitcoin & Lightning Signer Interfaces
 *
 * Defines the signer interfaces for t402 client operations.
 * These interfaces abstract the signing implementation,
 * allowing integration with various Bitcoin wallets and Lightning nodes.
 */

/**
 * ClientBtcSigner - Used by t402 clients to sign Bitcoin transactions
 *
 * Implementations may include:
 * - bitcoinjs-lib with private key
 * - Hardware wallet (Ledger, Trezor)
 * - Browser extension wallet
 */
export interface ClientBtcSigner {
  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   *
   * @param psbt - Base64-encoded unsigned PSBT
   * @returns Base64-encoded signed PSBT
   */
  signPsbt(psbt: string): Promise<string>

  /**
   * Get the signer's Bitcoin address
   *
   * @returns Bitcoin address string
   */
  getAddress(): string

  /**
   * Get the signer's public key (hex-encoded)
   *
   * @returns Public key as hex string
   */
  getPublicKey(): string
}

/**
 * ClientLightningSigner - Used by t402 clients to pay Lightning invoices
 *
 * Implementations may include:
 * - LND node client
 * - CLN (Core Lightning) client
 * - WebLN browser extension
 */
export interface ClientLightningSigner {
  /**
   * Pay a BOLT11 Lightning invoice
   *
   * @param bolt11 - BOLT11 invoice string
   * @returns Payment result with preimage and payment hash
   */
  payInvoice(bolt11: string): Promise<{
    preimage: string
    paymentHash: string
  }>

  /**
   * Get the Lightning node's public key
   *
   * @returns Node public key as hex string
   */
  getNodePubKey(): string
}
