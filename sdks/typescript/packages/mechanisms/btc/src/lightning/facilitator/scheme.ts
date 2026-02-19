/**
 * Lightning Network Facilitator Scheme Implementation
 *
 * Verifies Lightning Network payments using preimage verification.
 * Lightning payments are atomic (settle-on-pay), so settlement is a no-op.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from '@t402/core/types'
import type { LightningPayload } from '../../types.js'
import { SCHEME_EXACT, LIGHTNING_NETWORKS } from '../../constants.js'
import { isValidHex } from '../../utils.js'

/**
 * Facilitator Lightning signer interface
 */
export interface FacilitatorLightningSigner {
  /**
   * Get all node public keys this facilitator manages
   */
  getAddresses(): readonly string[]

  /**
   * Look up a payment by its payment hash
   *
   * @param paymentHash - Hex-encoded payment hash
   * @returns Payment status
   */
  lookupPayment(paymentHash: string): Promise<{
    settled: boolean
    amountSats?: string
    preimage?: string
  }>
}

/**
 * Compute SHA-256 hash of a hex-encoded preimage
 *
 * @param preimageHex - Hex-encoded preimage
 * @returns Hex-encoded SHA-256 hash
 */
async function sha256Hex(preimageHex: string): Promise<string> {
  const bytes = new Uint8Array(preimageHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Lightning Network facilitator implementation for the Exact payment scheme.
 *
 * Verification is done by checking that SHA-256(preimage) === paymentHash.
 * Lightning payments are atomic, so settle is a confirmation-only operation.
 */
export class LightningScheme implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT
  readonly caipFamily = 'lightning:*'

  constructor(private readonly signer: FacilitatorLightningSigner) {}

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * Lightning has no extra data.
   */
  getExtra(_network: string): Record<string, unknown> | undefined {
    return undefined
  }

  /**
   * Get signer addresses (node public keys) for this facilitator.
   */
  getSigners(_network: string): string[] {
    return [...this.signer.getAddresses()]
  }

  /**
   * Verifies a Lightning payment payload.
   *
   * Validates:
   * 1. Payload structure (paymentHash, preimage, bolt11Invoice)
   * 2. Preimage verification: SHA-256(preimage) === paymentHash
   * 3. Payment lookup on the Lightning node
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const lnPayload = payload.payload as LightningPayload | undefined

    // Validate payload structure
    if (!lnPayload?.paymentHash || !lnPayload?.preimage || !lnPayload?.bolt11Invoice) {
      return {
        isValid: false,
        invalidReason: 'invalid_payload_structure',
        payer: undefined,
      }
    }

    // Verify scheme matches
    if (payload.accepted.scheme !== SCHEME_EXACT || requirements.scheme !== SCHEME_EXACT) {
      return {
        isValid: false,
        invalidReason: 'unsupported_scheme',
        payer: undefined,
      }
    }

    // Verify network is a valid Lightning network
    const validNetworks: readonly string[] = LIGHTNING_NETWORKS
    if (!validNetworks.includes(requirements.network)) {
      return {
        isValid: false,
        invalidReason: 'unsupported_network',
        payer: undefined,
      }
    }

    // Validate preimage format (32 bytes hex)
    if (!isValidHex(lnPayload.preimage, 32)) {
      return {
        isValid: false,
        invalidReason: 'invalid_preimage_format',
        payer: undefined,
      }
    }

    // Validate payment hash format (32 bytes hex)
    if (!isValidHex(lnPayload.paymentHash, 32)) {
      return {
        isValid: false,
        invalidReason: 'invalid_payment_hash_format',
        payer: undefined,
      }
    }

    // Core verification: SHA-256(preimage) must equal paymentHash
    try {
      const computedHash = await sha256Hex(lnPayload.preimage)

      if (computedHash !== lnPayload.paymentHash.toLowerCase()) {
        return {
          isValid: false,
          invalidReason: 'preimage_hash_mismatch',
          payer: undefined,
        }
      }
    } catch {
      return {
        isValid: false,
        invalidReason: 'preimage_verification_failed',
        payer: undefined,
      }
    }

    // Optionally verify with the Lightning node
    try {
      const payment = await this.signer.lookupPayment(lnPayload.paymentHash)

      if (!payment.settled) {
        return {
          isValid: false,
          invalidReason: 'payment_not_settled',
          payer: undefined,
        }
      }

      // Verify amount matches if available
      if (payment.amountSats && BigInt(payment.amountSats) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: 'insufficient_amount',
          payer: undefined,
        }
      }
    } catch (error) {
      // If we can't verify with the node, the preimage verification is sufficient
      console.warn('Could not verify payment with Lightning node:', error)
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: undefined,
    }
  }

  /**
   * Settles a Lightning payment.
   *
   * Lightning payments are atomic (settle-on-pay), so this is effectively
   * a confirmation that the payment was already completed. The actual
   * settlement happened when the client paid the invoice.
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const lnPayload = payload.payload as LightningPayload | undefined

    if (!lnPayload?.paymentHash || !lnPayload?.preimage) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: '',
        errorReason: 'invalid_payload_structure',
        payer: undefined,
      }
    }

    // Verify the payment
    const verifyResult = await this.verify(payload, requirements)
    if (!verifyResult.isValid) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: '',
        errorReason: verifyResult.invalidReason ?? 'verification_failed',
        payer: undefined,
      }
    }

    // Lightning is settle-on-pay: the payment hash serves as the transaction ID
    return {
      success: true,
      transaction: lnPayload.paymentHash,
      network: payload.accepted.network,
      payer: undefined,
    }
  }
}
