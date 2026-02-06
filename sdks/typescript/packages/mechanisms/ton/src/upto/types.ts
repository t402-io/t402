/**
 * TON Up-To Payment Scheme Types
 *
 * Defines the payload structure for TON Jetton upto payments in the t402 protocol.
 * Uses an escrow pattern: client transfers maxAmount to the facilitator address,
 * facilitator forwards settleAmount to payTo and refunds the rest.
 *
 * Uses BOC (Bag of Cells) format for message serialization.
 */

/**
 * TON upto authorization metadata
 *
 * Contains all parameters for verifying the signed transfer message.
 */
export type UptoTonAuthorization = {
  /**
   * Sender wallet address (friendly format, bounceable)
   * This is the TON wallet address that will send the Jetton transfer
   */
  from: string

  /**
   * Facilitator holding address that receives the initial transfer
   * The facilitator will forward settleAmount to payTo and refund the rest
   */
  facilitator: string

  /**
   * Jetton master contract address
   * Identifies which Jetton token is being transferred (e.g., USDT)
   */
  jettonMaster: string

  /**
   * Maximum authorized amount in smallest units (as string)
   * The actual settlement amount may be less than this
   */
  maxAmount: string

  /**
   * TON amount attached for gas (in nanoTON, as string)
   * Required to pay for the internal message execution
   */
  tonAmount: string

  /**
   * Unix timestamp (seconds) until which the message is valid
   * Message will be rejected by the network after this time
   */
  validUntil: number

  /**
   * Wallet sequence number at time of signing
   * Prevents replay attacks - each seqno can only be used once
   */
  seqno: number

  /**
   * Query ID for the Jetton transfer (as string for large numbers)
   * Used for message correlation and deduplication
   */
  queryId: string
}

/**
 * TON upto payment payload (V2)
 *
 * Contains a pre-signed transfer message to the facilitator's holding address.
 * The facilitator will broadcast the transfer, then forward settleAmount to payTo
 * and refund (maxAmount - settleAmount) back to the client.
 */
export type UptoTonPayload = {
  /**
   * Base64 encoded signed external message (BOC format)
   * Contains the complete Jetton transfer message ready for broadcast
   * The message transfers maxAmount to the facilitator's holding address
   */
  signedBoc: string

  /**
   * Transfer authorization metadata for verification
   * Provides human-readable and verifiable parameters
   */
  authorization: UptoTonAuthorization

  /**
   * Unique nonce for replay protection (hex string)
   * Separate from the wallet seqno - used by the t402 protocol
   */
  paymentNonce: string
}

/**
 * TON upto-specific extra fields for payment requirements
 *
 * Included in PaymentRequirements.extra to provide upto-specific parameters.
 */
export type UptoTonExtra = {
  /**
   * Facilitator address that will receive the initial transfer
   * Client should send maxAmount to this address
   */
  facilitator?: string

  /**
   * Maximum payment amount authorized
   * The upper bound for the escrow transfer
   */
  maxAmount?: string

  /**
   * Minimum acceptable settlement amount
   * Server may reject if usage is below this threshold
   */
  minAmount?: string

  /**
   * Billing unit (e.g., "token", "request", "second")
   * Describes what is being measured for usage-based billing
   */
  unit?: string

  /**
   * Price per unit in smallest denomination
   * Used with unit to calculate the final settlement amount
   */
  unitPrice?: string
}

/**
 * Type guard for UptoTonPayload
 *
 * Checks if the given data has the correct structure for a TON upto payload.
 * Validates the presence and types of required fields including signedBoc,
 * authorization (with from, facilitator, jettonMaster, maxAmount), and paymentNonce.
 *
 * @param data - The data to check
 * @returns True if the data is a valid UptoTonPayload
 */
export function isUptoTonPayload(data: unknown): data is UptoTonPayload {
  if (typeof data !== 'object' || data === null) return false
  const p = data as Record<string, unknown>

  if (typeof p.signedBoc !== 'string' || p.signedBoc === '') return false
  if (typeof p.paymentNonce !== 'string' || p.paymentNonce === '') return false

  if (typeof p.authorization !== 'object' || p.authorization === null) return false
  const auth = p.authorization as Record<string, unknown>

  return (
    typeof auth.from === 'string' &&
    auth.from !== '' &&
    typeof auth.facilitator === 'string' &&
    auth.facilitator !== '' &&
    typeof auth.jettonMaster === 'string' &&
    typeof auth.maxAmount === 'string' &&
    typeof auth.tonAmount === 'string' &&
    typeof auth.validUntil === 'number' &&
    typeof auth.seqno === 'number' &&
    typeof auth.queryId === 'string'
  )
}
