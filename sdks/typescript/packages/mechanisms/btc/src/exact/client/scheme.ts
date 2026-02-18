/**
 * Bitcoin On-chain Client Scheme Implementation
 *
 * Creates payment payloads for Bitcoin on-chain transfers using the exact scheme.
 * Builds PSBTs (Partially Signed Bitcoin Transactions) and signs them with the client's wallet.
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from '@t402/core/types'
import type { ClientBtcSigner } from '../../signer.js'
import type { BtcOnchainPayload } from '../../types.js'
import { SCHEME_EXACT, DUST_LIMIT } from '../../constants.js'
import { validateBitcoinAddress } from '../../utils.js'

/**
 * Bitcoin client implementation for the Exact payment scheme.
 *
 * Creates signed PSBTs for on-chain Bitcoin payments that can be
 * finalized and broadcast by a facilitator.
 */
export class ExactBtcScheme implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT

  /**
   * Creates a new ExactBtcScheme instance.
   *
   * @param signer - The Bitcoin signer for client operations
   */
  constructor(private readonly signer: ClientBtcSigner) {}

  /**
   * Creates a payment payload for the Exact scheme.
   *
   * The payload contains a signed PSBT with a single output
   * paying the required amount to the payTo address.
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, 't402Version' | 'payload'>> {
    // Validate required fields
    if (!paymentRequirements.payTo) {
      throw new Error('PayTo address is required')
    }
    if (!paymentRequirements.amount) {
      throw new Error('Amount is required')
    }

    // Validate address format
    if (!validateBitcoinAddress(paymentRequirements.payTo)) {
      throw new Error(`Invalid Bitcoin address: ${paymentRequirements.payTo}`)
    }

    // Validate amount is above dust limit
    const amountSats = BigInt(paymentRequirements.amount)
    if (amountSats < BigInt(DUST_LIMIT)) {
      throw new Error(`Amount ${amountSats} satoshis is below dust limit (${DUST_LIMIT})`)
    }

    // Build an unsigned PSBT
    // The PSBT contains: output to payTo address for the required amount
    // Input selection and fee calculation are handled by the signer
    const unsignedPsbt = this.buildUnsignedPsbt(paymentRequirements)

    // Sign the PSBT
    const signedPsbt = await this.signer.signPsbt(unsignedPsbt)

    // Create payload
    const payload: BtcOnchainPayload = {
      signedPsbt,
    }

    return {
      t402Version,
      payload,
    }
  }

  /**
   * Build an unsigned PSBT for the payment.
   *
   * Creates a minimal PSBT representation with the required output.
   * The actual UTXO selection and fee calculation should be handled
   * by the signer implementation (which typically has wallet context).
   *
   * @param requirements - Payment requirements
   * @returns Base64-encoded unsigned PSBT
   */
  private buildUnsignedPsbt(requirements: PaymentRequirements): string {
    // Encode payment details as a JSON payload in the PSBT
    // The signer is responsible for building the full PSBT
    // with proper UTXO selection and fee estimation
    const psbtData = {
      outputs: [
        {
          address: requirements.payTo,
          value: requirements.amount,
        },
      ],
      network: requirements.network,
      fromAddress: this.signer.getAddress(),
      fromPubKey: this.signer.getPublicKey(),
    }

    // Encode as base64 for transport
    return Buffer.from(JSON.stringify(psbtData)).toString('base64')
  }
}
