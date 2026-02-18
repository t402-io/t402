/**
 * Lightning Network Client Scheme Implementation
 *
 * Creates payment payloads for Lightning Network payments.
 * Pays BOLT11 invoices and returns preimage as proof of payment.
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from '@t402/core/types'
import type { ClientLightningSigner } from '../../signer.js'
import type { LightningPayload } from '../../types.js'
import { SCHEME_EXACT } from '../../constants.js'
import { validateBolt11Invoice } from '../../utils.js'

/**
 * Lightning Network client implementation for the Exact payment scheme.
 *
 * Pays BOLT11 invoices using a Lightning node and returns the
 * payment preimage as proof of payment.
 *
 * Note: The scheme is 'exact' because Lightning payments are always
 * for the exact invoice amount.
 */
export class LightningScheme implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT

  /**
   * Creates a new LightningScheme instance.
   *
   * @param signer - The Lightning signer for client operations
   */
  constructor(private readonly signer: ClientLightningSigner) {}

  /**
   * Creates a payment payload for the Lightning scheme.
   *
   * 1. Extracts the BOLT11 invoice from requirements.extra.bolt11Invoice
   * 2. Pays the invoice using the Lightning signer
   * 3. Returns the preimage and payment hash as proof of payment
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, 't402Version' | 'payload'>> {
    // Extract BOLT11 invoice from requirements
    const bolt11Invoice = paymentRequirements.extra?.bolt11Invoice as string | undefined

    if (!bolt11Invoice) {
      throw new Error('BOLT11 invoice is required in requirements.extra.bolt11Invoice')
    }

    // Validate invoice format
    if (!validateBolt11Invoice(bolt11Invoice)) {
      throw new Error(`Invalid BOLT11 invoice format: ${bolt11Invoice.slice(0, 20)}...`)
    }

    // Pay the invoice
    const { preimage, paymentHash } = await this.signer.payInvoice(bolt11Invoice)

    // Create payload with proof of payment
    const payload: LightningPayload = {
      paymentHash,
      preimage,
      bolt11Invoice,
    }

    return {
      t402Version,
      payload,
    }
  }
}
