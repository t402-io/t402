/**
 * TON Facilitator Scheme Implementation
 *
 * Verifies and settles TON Jetton payments using the exact scheme.
 * Validates signed messages and broadcasts transactions to the network.
 */

import { Cell } from "@ton/core";
import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import type { FacilitatorTonSigner } from "../../signer.js";
import type { ExactTonPayloadV2 } from "../../types.js";
import { SCHEME_EXACT } from "../../constants.js";
import { addressesEqual, normalizeNetwork } from "../../utils.js";

/**
 * Configuration options for ExactTonScheme facilitator
 */
export interface ExactTonSchemeConfig {
  /** Whether this facilitator can sponsor gas for transactions */
  canSponsorGas?: boolean;
}

/**
 * TON facilitator implementation for the Exact payment scheme.
 *
 * Verifies signed Jetton transfer messages and broadcasts them
 * to the TON network to complete payments.
 */
export class ExactTonScheme implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT;
  readonly caipFamily = "ton:*";
  private config: ExactTonSchemeConfig;

  /**
   * Creates a new ExactTonScheme facilitator instance.
   *
   * @param signer - The TON signer for facilitator operations
   * @param config - Optional configuration
   */
  constructor(
    private readonly signer: FacilitatorTonSigner,
    config: ExactTonSchemeConfig = {},
  ) {
    this.config = config;
  }

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * For TON, optionally returns gas sponsor address if configured.
   *
   * @param network - The network identifier
   * @returns Extra data object or undefined
   */
  getExtra(network: string): Record<string, unknown> | undefined {
    void network;

    if (this.config.canSponsorGas) {
      const addresses = this.signer.getAddresses();
      if (addresses.length > 0) {
        return {
          gasSponsor: addresses[0],
        };
      }
    }

    return undefined;
  }

  /**
   * Get signer addresses used by this facilitator.
   * Returns all addresses this facilitator can use for operations.
   *
   * @param network - The network identifier
   * @returns Array of facilitator addresses
   */
  getSigners(network: string): string[] {
    void network;
    return [...this.signer.getAddresses()];
  }

  /**
   * Verifies a payment payload.
   *
   * Performs comprehensive validation:
   * 1. Scheme and network matching
   * 2. BOC format validation
   * 3. Message structure verification
   * 4. Authorization expiry check
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
    const tonPayload = payload.payload as ExactTonPayloadV2;
    const authorization = tonPayload.authorization;

    // Step 1: Verify scheme matches
    if (payload.accepted.scheme !== SCHEME_EXACT || requirements.scheme !== SCHEME_EXACT) {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: authorization.from,
      };
    }

    // Step 2: Verify network matches
    try {
      const payloadNetwork = normalizeNetwork(payload.accepted.network);
      const requirementsNetwork = normalizeNetwork(requirements.network);

      if (payloadNetwork !== requirementsNetwork) {
        return {
          isValid: false,
          invalidReason: "network_mismatch",
          payer: authorization.from,
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: "invalid_network",
        payer: authorization.from,
      };
    }

    // Step 3: Parse and validate the signed BOC
    try {
      Cell.fromBase64(tonPayload.signedBoc);
    } catch {
      return {
        isValid: false,
        invalidReason: "invalid_boc_format",
        payer: authorization.from,
      };
    }

    // Step 4: Verify the message structure and parameters
    const verifyResult = await this.signer.verifyMessage({
      signedBoc: tonPayload.signedBoc,
      expectedFrom: authorization.from,
      expectedTransfer: {
        jettonAmount: BigInt(authorization.jettonAmount),
        destination: requirements.payTo,
        jettonMaster: requirements.asset,
      },
    });

    if (!verifyResult.valid) {
      return {
        isValid: false,
        invalidReason: verifyResult.reason || "message_verification_failed",
        payer: authorization.from,
      };
    }

    // Step 5: Check validUntil is in the future (with 30 second buffer)
    const now = Math.floor(Date.now() / 1000);
    if (authorization.validUntil < now + 30) {
      return {
        isValid: false,
        invalidReason: "authorization_expired",
        payer: authorization.from,
      };
    }

    // Step 6: Verify Jetton balance
    try {
      const balance = await this.signer.getJettonBalance({
        ownerAddress: authorization.from,
        jettonMasterAddress: requirements.asset,
      });

      if (balance < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_jetton_balance",
          payer: authorization.from,
        };
      }
    } catch (error) {
      // If we can't check balance, log warning but continue
      console.warn("Could not verify Jetton balance:", error);
    }

    // Step 7: Verify amount is sufficient
    if (BigInt(authorization.jettonAmount) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_amount",
        payer: authorization.from,
      };
    }

    // Step 8: Verify recipient matches
    if (!addressesEqual(authorization.to, requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "recipient_mismatch",
        payer: authorization.from,
      };
    }

    // Step 9: Verify Jetton master matches
    if (!addressesEqual(authorization.jettonMaster, requirements.asset)) {
      return {
        isValid: false,
        invalidReason: "asset_mismatch",
        payer: authorization.from,
      };
    }

    // Step 10: Check seqno hasn't been used (replay protection)
    try {
      const currentSeqno = await this.signer.getSeqno(authorization.from);
      if (authorization.seqno < currentSeqno) {
        return {
          isValid: false,
          invalidReason: "seqno_already_used",
          payer: authorization.from,
        };
      }
      if (authorization.seqno > currentSeqno) {
        return {
          isValid: false,
          invalidReason: "seqno_too_high",
          payer: authorization.from,
        };
      }
    } catch (error) {
      console.warn("Could not verify seqno:", error);
    }

    // Step 11: Verify wallet is deployed
    try {
      const isDeployed = await this.signer.isDeployed(authorization.from);
      if (!isDeployed) {
        return {
          isValid: false,
          invalidReason: "wallet_not_deployed",
          payer: authorization.from,
        };
      }
    } catch (error) {
      console.warn("Could not verify wallet deployment:", error);
    }

    return {
      isValid: true,
      invalidReason: undefined,
      payer: authorization.from,
    };
  }

  /**
   * Settles a payment by broadcasting the signed message.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const tonPayload = payload.payload as ExactTonPayloadV2;

    // Re-verify before settling
    const verifyResult = await this.verify(payload, requirements);
    if (!verifyResult.isValid) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: verifyResult.invalidReason ?? "verification_failed",
        payer: tonPayload.authorization.from,
      };
    }

    try {
      // Send the pre-signed external message
      const txHash = await this.signer.sendExternalMessage(tonPayload.signedBoc);

      // Wait for confirmation
      const confirmation = await this.signer.waitForTransaction({
        address: tonPayload.authorization.from,
        seqno: tonPayload.authorization.seqno + 1, // Wait for next seqno
        timeout: 60000, // 60 second timeout
      });

      if (!confirmation.success) {
        return {
          success: false,
          errorReason: confirmation.error || "transaction_not_confirmed",
          transaction: txHash,
          network: payload.accepted.network,
          payer: tonPayload.authorization.from,
        };
      }

      return {
        success: true,
        transaction: confirmation.hash || txHash,
        network: payload.accepted.network,
        payer: tonPayload.authorization.from,
      };
    } catch (error) {
      console.error("Failed to settle TON transaction:", error);
      return {
        success: false,
        errorReason: "transaction_failed",
        transaction: "",
        network: payload.accepted.network,
        payer: tonPayload.authorization.from,
      };
    }
  }
}
