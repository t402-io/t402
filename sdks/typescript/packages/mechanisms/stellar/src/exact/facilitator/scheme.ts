/**
 * Stellar Facilitator Scheme Implementation
 *
 * Verifies and settles Stellar Soroban token payments using the exact scheme.
 * Validates signed transactions and submits them to the Soroban RPC.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from '@t402/core/types'
import type { FacilitatorStellarSigner } from '../../signer.js'
import type { ExactStellarPayload } from '../../types.js'
import { SCHEME_EXACT } from '../../constants.js'
import { normalizeNetwork } from '../../utils.js'

/**
 * Configuration options for ExactStellarScheme facilitator
 */
export interface ExactStellarSchemeConfig {
  /** Whether this facilitator can sponsor fees for transactions */
  canSponsorFees?: boolean
}

/**
 * Stellar facilitator implementation for the Exact payment scheme.
 *
 * Verifies signed Soroban transactions and submits them
 * to the network to complete payments.
 */
export class ExactStellarScheme implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT
  readonly caipFamily = 'stellar:*'
  private config: ExactStellarSchemeConfig
  /** Set of payload hashes already processed — replay protection */
  private processedTxs = new Set<string>()

  constructor(
    private readonly signer: FacilitatorStellarSigner,
    config: ExactStellarSchemeConfig = {},
  ) {
    this.config = config
  }

  /** Compute a deterministic hash for replay detection */
  private payloadHash(xdr: string, from: string, to: string, amount: string): string {
    // Simple deterministic key — crypto.subtle not needed for uniqueness
    return `${xdr}:${from}:${to}:${amount}`
  }

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   *
   * @param network - The network identifier
   * @returns Extra data object or undefined
   */
  getExtra(network: string): Record<string, unknown> | undefined {
    void network

    if (this.config.canSponsorFees) {
      const addresses = this.signer.getAddresses()
      if (addresses.length > 0) {
        return {
          feeSponsor: addresses[0],
        }
      }
    }

    return undefined
  }

  /**
   * Get signer addresses used by this facilitator.
   *
   * @param network - The network identifier
   * @returns Array of facilitator addresses
   */
  getSigners(network: string): string[] {
    void network
    return [...this.signer.getAddresses()]
  }

  /**
   * Verifies a payment payload.
   *
   * Performs comprehensive validation:
   * 1. Scheme and network matching
   * 2. XDR format validation
   * 3. Transaction structure verification
   * 4. Ledger expiry check
   * 5. Balance verification
   * 6. Amount and recipient validation
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Promise resolving to verification response
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const stellarPayload = payload.payload as ExactStellarPayload | undefined

    // Validate payload structure
    if (!stellarPayload?.authorization?.from || !stellarPayload?.signedTransactionXdr) {
      return {
        isValid: false,
        invalidReason: 'invalid_payload_structure',
        payer: '',
      }
    }

    const authorization = stellarPayload.authorization

    // Step 0: Replay protection
    const ph = this.payloadHash(
      stellarPayload.signedTransactionXdr,
      authorization.from,
      authorization.to,
      authorization.amount,
    )
    if (this.processedTxs.has(ph)) {
      return {
        isValid: false,
        invalidReason: 'replay_detected',
        payer: authorization.from,
      }
    }

    // Step 1: Verify scheme matches
    if (payload.accepted.scheme !== SCHEME_EXACT || requirements.scheme !== SCHEME_EXACT) {
      return {
        isValid: false,
        invalidReason: 'unsupported_scheme',
        payer: authorization.from,
      }
    }

    // Step 2: Verify network matches
    try {
      const payloadNetwork = normalizeNetwork(payload.accepted.network)
      const requirementsNetwork = normalizeNetwork(requirements.network)

      if (payloadNetwork !== requirementsNetwork) {
        return {
          isValid: false,
          invalidReason: 'network_mismatch',
          payer: authorization.from,
        }
      }
    } catch {
      return {
        isValid: false,
        invalidReason: 'invalid_network',
        payer: authorization.from,
      }
    }

    // Step 3: Verify the transaction structure and parameters
    const verifyResult = await this.signer.verifyTransaction({
      signedTransactionXdr: stellarPayload.signedTransactionXdr,
      expectedFrom: authorization.from,
      expectedTransfer: {
        amount: requirements.amount,
        destination: requirements.payTo,
        tokenContract: requirements.asset,
      },
    })

    if (!verifyResult.valid) {
      return {
        isValid: false,
        invalidReason: verifyResult.reason || 'transaction_verification_failed',
        payer: authorization.from,
      }
    }

    // Step 4: Check maxLedger is in the future (with buffer)
    try {
      const currentLedger = await this.signer.getCurrentLedger()
      if (authorization.maxLedger <= currentLedger + 2) {
        return {
          isValid: false,
          invalidReason: 'authorization_expired',
          payer: authorization.from,
        }
      }
    } catch (_error) {
      return {
        isValid: false,
        invalidReason: 'ledger_expiry_check_failed',
        payer: authorization.from,
      }
    }

    // Step 5: Verify token balance
    try {
      const balance = await this.signer.getTokenBalance({
        accountAddress: authorization.from,
        tokenContract: requirements.asset,
      })

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: 'insufficient_token_balance',
          payer: authorization.from,
        }
      }
    } catch (_error) {
      return {
        isValid: false,
        invalidReason: 'balance_check_failed',
        payer: authorization.from,
      }
    }

    // Step 6: Verify amount is sufficient
    if (BigInt(authorization.amount) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: 'insufficient_amount',
        payer: authorization.from,
      }
    }

    // Step 7: Verify recipient matches
    if (authorization.to !== requirements.payTo) {
      return {
        isValid: false,
        invalidReason: 'recipient_mismatch',
        payer: authorization.from,
      }
    }

    // Step 8: Verify token contract matches
    if (authorization.tokenContract !== requirements.asset) {
      return {
        isValid: false,
        invalidReason: 'asset_mismatch',
        payer: authorization.from,
      }
    }

    // Step 9: Check account exists
    try {
      const exists = await this.signer.accountExists(authorization.from)
      if (!exists) {
        return {
          isValid: false,
          invalidReason: 'account_not_found',
          payer: authorization.from,
        }
      }
    } catch (_error) {
      return {
        isValid: false,
        invalidReason: 'account_existence_check_failed',
        payer: authorization.from,
      }
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: authorization.from,
    }
  }

  /**
   * Settles a payment by submitting the signed transaction.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const stellarPayload = payload.payload as ExactStellarPayload | undefined

    if (!stellarPayload?.authorization?.from || !stellarPayload?.signedTransactionXdr) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: '',
        errorReason: 'invalid_payload_structure',
        payer: '',
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
        payer: stellarPayload.authorization.from,
      }
    }

    // Mark as processed for replay protection
    const settleHash = this.payloadHash(
      stellarPayload.signedTransactionXdr,
      stellarPayload.authorization.from,
      stellarPayload.authorization.to,
      stellarPayload.authorization.amount,
    )
    this.processedTxs.add(settleHash)

    try {
      // Submit the signed transaction
      const txHash = await this.signer.submitTransaction(
        stellarPayload.signedTransactionXdr,
      )

      // Wait for confirmation
      const confirmation = await this.signer.waitForConfirmation(txHash, 60000)

      if (!confirmation.success) {
        return {
          success: false,
          errorReason: confirmation.error || 'transaction_not_confirmed',
          transaction: txHash,
          network: payload.accepted.network,
          payer: stellarPayload.authorization.from,
        }
      }

      return {
        success: true,
        transaction: confirmation.hash || txHash,
        network: payload.accepted.network,
        payer: stellarPayload.authorization.from,
      }
    } catch (_error) {
      console.error('Failed to settle Stellar transaction:', _error)
      return {
        success: false,
        errorReason: 'transaction_failed',
        transaction: '',
        network: payload.accepted.network,
        payer: stellarPayload.authorization.from,
      }
    }
  }
}
