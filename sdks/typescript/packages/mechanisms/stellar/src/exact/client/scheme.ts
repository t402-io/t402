/**
 * Stellar Client Scheme Implementation
 *
 * Creates payment payloads for Stellar Soroban token transfers using the exact scheme.
 * Builds and signs Soroban transactions for SEP-41 transfer invocations.
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from '@t402/core/types'
import type { ClientStellarSigner } from '../../signer.js'
import type { ExactStellarPayload } from '../../types.js'
import { SCHEME_EXACT, DEFAULT_TIMEOUT_SECONDS } from '../../constants.js'
import { normalizeNetwork, calculateMaxLedger } from '../../utils.js'
import { NETWORK_PASSPHRASES } from '../../constants.js'

/**
 * Configuration for ExactStellarScheme client
 */
export interface ExactStellarSchemeConfig {
  /** Override the default timeout in seconds */
  timeoutSeconds?: number
}

/**
 * Stellar client implementation for the Exact payment scheme.
 *
 * Creates signed Soroban transfer transactions that can be submitted
 * by a facilitator to complete the payment.
 */
export class ExactStellarScheme implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT

  constructor(
    private readonly signer: ClientStellarSigner,
    private readonly config: ExactStellarSchemeConfig = {},
  ) {}

  /**
   * Creates a payment payload for the Exact scheme.
   *
   * The payload contains a signed Soroban transaction that performs
   * a SEP-41 token transfer from the client to the recipient.
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, 't402Version' | 'payload'>> {
    const network = normalizeNetwork(paymentRequirements.network)

    if (!paymentRequirements.asset) {
      throw new Error('Asset (token contract address) is required')
    }
    if (!paymentRequirements.payTo) {
      throw new Error('PayTo address is required')
    }
    if (!paymentRequirements.amount) {
      throw new Error('Amount is required')
    }

    const networkPassphrase = NETWORK_PASSPHRASES[network]
    if (!networkPassphrase) {
      throw new Error(`No network passphrase for network: ${network}`)
    }

    const timeoutSeconds =
      this.config.timeoutSeconds ??
      paymentRequirements.maxTimeoutSeconds ??
      DEFAULT_TIMEOUT_SECONDS

    // Get current ledger to calculate max validity
    const currentLedger = await this.signer.getCurrentLedger()
    const maxLedger = calculateMaxLedger(currentLedger, timeoutSeconds)

    // Build and sign the Soroban transfer transaction
    const signedTransactionXdr = await this.signer.buildAndSignTransfer({
      tokenContract: paymentRequirements.asset,
      from: this.signer.address,
      to: paymentRequirements.payTo,
      amount: paymentRequirements.amount,
      maxLedger,
      networkPassphrase,
    })

    const authorization: ExactStellarPayload['authorization'] = {
      from: this.signer.address,
      to: paymentRequirements.payTo,
      tokenContract: paymentRequirements.asset,
      amount: paymentRequirements.amount,
      maxLedger,
      network,
    }

    const payload: ExactStellarPayload = {
      signedTransactionXdr,
      authorization,
    }

    return {
      t402Version,
      payload,
    }
  }
}
