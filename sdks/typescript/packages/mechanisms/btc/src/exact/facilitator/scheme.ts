/**
 * Bitcoin On-chain Facilitator Scheme Implementation
 *
 * Verifies and settles Bitcoin on-chain payments using the exact scheme.
 * Validates signed PSBTs and broadcasts transactions to the Bitcoin network.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from '@t402/core/types'
import type { BtcOnchainPayload } from '../../types.js'
import { SCHEME_EXACT, DUST_LIMIT, BTC_NETWORKS } from '../../constants.js'
import { validateBitcoinAddress } from '../../utils.js'

/**
 * Facilitator BTC signer interface for verify and settle operations
 */
export interface FacilitatorBtcSigner {
  /**
   * Get all addresses this facilitator can use
   */
  getAddresses(): readonly string[]

  /**
   * Verify a signed PSBT
   * Checks that outputs match expected values and signatures are valid
   *
   * @param params - Verification parameters
   * @returns Verification result
   */
  verifyPsbt(params: {
    signedPsbt: string
    expectedPayTo: string
    expectedAmount: string
  }): Promise<{
    valid: boolean
    reason?: string
    payer?: string
  }>

  /**
   * Finalize and broadcast a signed PSBT
   *
   * @param signedPsbt - Base64-encoded signed PSBT
   * @returns Transaction ID
   */
  broadcastPsbt(signedPsbt: string): Promise<string>

  /**
   * Wait for a transaction to be confirmed
   *
   * @param txId - Transaction ID
   * @param confirmations - Number of confirmations to wait for
   * @returns Confirmation result
   */
  waitForConfirmation(
    txId: string,
    confirmations?: number,
  ): Promise<{
    confirmed: boolean
    txId: string
    blockHash?: string
    confirmations: number
  }>
}

/**
 * Bitcoin facilitator implementation for the Exact payment scheme.
 *
 * Verifies signed PSBTs and broadcasts transactions to settle payments.
 */
export class ExactBtcScheme implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT
  readonly caipFamily = 'bip122:*'

  constructor(private readonly signer: FacilitatorBtcSigner) {}

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * Bitcoin on-chain has no extra data.
   */
  getExtra(_network: string): Record<string, unknown> | undefined {
    return undefined
  }

  /**
   * Get signer addresses used by this facilitator.
   */
  getSigners(_network: string): string[] {
    return [...this.signer.getAddresses()]
  }

  /**
   * Verifies a payment payload.
   *
   * Validates:
   * 1. Scheme and network matching
   * 2. PSBT structure and signatures
   * 3. Output matches (payTo, amount)
   * 4. Amount above dust limit
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const btcPayload = payload.payload as BtcOnchainPayload | undefined

    // Validate payload structure
    if (!btcPayload?.signedPsbt) {
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

    // Verify network is a valid BTC network
    const validNetworks: readonly string[] = BTC_NETWORKS
    if (!validNetworks.includes(requirements.network)) {
      return {
        isValid: false,
        invalidReason: 'unsupported_network',
        payer: undefined,
      }
    }

    // Verify network matches
    if (payload.accepted.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: 'network_mismatch',
        payer: undefined,
      }
    }

    // Validate payTo address
    if (!validateBitcoinAddress(requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: 'invalid_pay_to_address',
        payer: undefined,
      }
    }

    // Validate amount above dust limit
    if (BigInt(requirements.amount) < BigInt(DUST_LIMIT)) {
      return {
        isValid: false,
        invalidReason: 'amount_below_dust_limit',
        payer: undefined,
      }
    }

    // Verify the PSBT
    try {
      const result = await this.signer.verifyPsbt({
        signedPsbt: btcPayload.signedPsbt,
        expectedPayTo: requirements.payTo,
        expectedAmount: requirements.amount,
      })

      if (!result.valid) {
        return {
          isValid: false,
          invalidReason: result.reason || 'psbt_verification_failed',
          payer: result.payer,
        }
      }

      return {
        isValid: true,
        invalidReason: undefined,
        payer: result.payer,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        isValid: false,
        invalidReason: `verification_error: ${errorMessage}`,
        payer: undefined,
      }
    }
  }

  /**
   * Settles a payment by finalizing and broadcasting the PSBT.
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const btcPayload = payload.payload as BtcOnchainPayload | undefined

    if (!btcPayload?.signedPsbt) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: '',
        errorReason: 'invalid_payload_structure',
        payer: undefined,
      }
    }

    // Re-verify before settling
    const verifyResult = await this.verify(payload, requirements)
    if (!verifyResult.isValid) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: '',
        errorReason: verifyResult.invalidReason ?? 'verification_failed',
        payer: verifyResult.payer,
      }
    }

    try {
      // Broadcast the signed transaction
      const txId = await this.signer.broadcastPsbt(btcPayload.signedPsbt)

      // Wait for at least 1 confirmation
      const confirmation = await this.signer.waitForConfirmation(txId, 1)

      if (!confirmation.confirmed) {
        return {
          success: false,
          errorReason: 'transaction_not_confirmed',
          transaction: txId,
          network: payload.accepted.network,
          payer: verifyResult.payer,
        }
      }

      return {
        success: true,
        transaction: txId,
        network: payload.accepted.network,
        payer: verifyResult.payer,
      }
    } catch (error) {
      console.error('Failed to settle Bitcoin transaction:', error)
      return {
        success: false,
        errorReason: 'transaction_failed',
        transaction: '',
        network: payload.accepted.network,
        payer: verifyResult.payer,
      }
    }
  }
}
