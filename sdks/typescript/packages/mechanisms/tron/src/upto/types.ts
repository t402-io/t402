/**
 * TRON Up-To Payment Types
 *
 * Type definitions for TRON TRC-20 upto (approve + transferFrom) payment payloads.
 * The upto scheme allows clients to authorize payments up to a maximum amount,
 * with the actual settlement amount determined at settlement time.
 */

/**
 * Authorization metadata for a TRON TRC-20 approve transaction.
 *
 * Contains all information needed to verify the approval without
 * parsing the signed transaction.
 */
export type UptoTronAuthorization = {
  /** Token owner address (T-prefix base58check) */
  owner: string

  /** Approved spender address - facilitator (T-prefix base58check) */
  spender: string

  /** TRC-20 contract address (T-prefix base58check) */
  contractAddress: string

  /** Maximum approved amount in smallest units (as string for large numbers) */
  maxAmount: string

  /** Transaction expiration timestamp (milliseconds since epoch) */
  expiration: number

  /** Reference block bytes (hex string) */
  refBlockBytes: string

  /** Reference block hash (hex string) */
  refBlockHash: string

  /** Transaction timestamp (milliseconds since epoch) */
  timestamp: number
}

/**
 * TRON upto payment payload.
 *
 * Contains the signed approve transaction ready for broadcast
 * along with authorization metadata for verification.
 */
export type UptoTronPayload = {
  /** Hex-encoded signed approve transaction */
  signedTransaction: string

  /** Approve transaction authorization metadata */
  authorization: UptoTronAuthorization

  /** Unique nonce for replay protection (hex string) */
  paymentNonce: string
}

/**
 * Extra fields for TRON upto payment requirements.
 *
 * Included in the PaymentRequirements.extra field to communicate
 * upto-specific parameters to the client.
 */
export type UptoTronExtra = {
  /** Maximum payment amount authorized */
  maxAmount?: string

  /** Minimum acceptable settlement amount */
  minAmount?: string

  /** Billing unit (e.g., "token", "request", "second") */
  unit?: string

  /** Price per unit in smallest denomination */
  unitPrice?: string

  /** Facilitator address that will be approved as spender */
  spenderAddress?: string
}

/**
 * Type guard to check if unknown data is an UptoTronPayload.
 *
 * Validates the presence and types of all required fields including
 * nested authorization fields.
 *
 * @param data - Unknown data to check
 * @returns True if data matches the UptoTronPayload structure
 */
export function isUptoTronPayload(data: unknown): data is UptoTronPayload {
  if (!data || typeof data !== 'object') {
    return false
  }

  const obj = data as Record<string, unknown>

  // Check top-level fields
  if (typeof obj.signedTransaction !== 'string' || !obj.signedTransaction) {
    return false
  }

  if (typeof obj.paymentNonce !== 'string' || !obj.paymentNonce) {
    return false
  }

  // Check authorization structure
  const auth = obj.authorization
  if (!auth || typeof auth !== 'object') {
    return false
  }

  const authObj = auth as Record<string, unknown>

  if (typeof authObj.owner !== 'string' || !authObj.owner) {
    return false
  }

  if (typeof authObj.spender !== 'string' || !authObj.spender) {
    return false
  }

  if (typeof authObj.contractAddress !== 'string' || !authObj.contractAddress) {
    return false
  }

  if (typeof authObj.maxAmount !== 'string' || !authObj.maxAmount) {
    return false
  }

  if (typeof authObj.expiration !== 'number') {
    return false
  }

  if (typeof authObj.refBlockBytes !== 'string') {
    return false
  }

  if (typeof authObj.refBlockHash !== 'string') {
    return false
  }

  if (typeof authObj.timestamp !== 'number') {
    return false
  }

  return true
}

/**
 * Type guard to check if unknown data is an UptoTronExtra.
 *
 * @param data - Unknown data to check
 * @returns True if data matches the UptoTronExtra structure
 */
export function isUptoTronExtra(data: unknown): data is UptoTronExtra {
  if (!data || typeof data !== 'object') {
    return false
  }

  const obj = data as Record<string, unknown>

  // All fields are optional, but if present they must be strings
  const stringFields = ['maxAmount', 'minAmount', 'unit', 'unitPrice', 'spenderAddress'] as const
  for (const field of stringFields) {
    if (field in obj && typeof obj[field] !== 'string') {
      return false
    }
  }

  return true
}
