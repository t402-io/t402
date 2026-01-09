/**
 * TRON Exact Payment Scheme - Facilitator Implementation
 *
 * Verifies and settles TRC20 token transfer payments.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import type { FacilitatorTronSigner } from "../../signer.js";
import type { ExactTronPayload } from "../../types.js";
import { SCHEME_EXACT, MIN_VALIDITY_BUFFER } from "../../constants.js";
import { normalizeNetwork, validateTronAddress, addressesEqual } from "../../utils.js";

/**
 * Configuration for ExactTronScheme (facilitator)
 */
export type ExactTronSchemeConfig = {
  /** Whether this facilitator can sponsor gas */
  canSponsorGas?: boolean;
};

/**
 * Facilitator-side implementation of the TRON exact payment scheme
 *
 * This scheme verifies and settles pre-signed TRC20 transfer transactions.
 */
export class ExactTronScheme implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT;
  readonly caipFamily = "tron:*";
  private readonly signer: FacilitatorTronSigner;
  private readonly config: ExactTronSchemeConfig;

  constructor(signer: FacilitatorTronSigner, config?: ExactTronSchemeConfig) {
    this.signer = signer;
    this.config = config ?? {};
  }

  /**
   * Get extra data to include in payment requirements
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
   * Get facilitator addresses that can receive payments
   */
  getSigners(network: string): string[] {
    void network;
    return [...this.signer.getAddresses()];
  }

  /**
   * Verify a payment payload
   *
   * Performs comprehensive validation:
   * 1. Scheme matching
   * 2. Network matching
   * 3. Payload structure validation
   * 4. Transaction signature verification
   * 5. Authorization expiry check
   * 6. Balance verification
   * 7. Amount sufficiency
   * 8. Recipient matching
   * 9. Contract address matching
   * 10. Account activation check
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const tronPayload = payload.payload as ExactTronPayload;
    const authorization = tronPayload.authorization;

    // Step 1: Validate scheme
    if (payload.accepted.scheme !== SCHEME_EXACT || requirements.scheme !== SCHEME_EXACT) {
      return {
        isValid: false,
        invalidReason: "unsupported_scheme",
        payer: authorization.from,
      };
    }

    // Step 2: Validate network
    let payloadNetwork: string;
    try {
      payloadNetwork = normalizeNetwork(String(payload.accepted.network));
      const requirementsNetwork = normalizeNetwork(String(requirements.network));

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

    // Step 3: Validate payload structure
    if (!tronPayload || !tronPayload.signedTransaction || !authorization) {
      return {
        isValid: false,
        invalidReason: "invalid_payload_structure",
        payer: authorization?.from || "",
      };
    }

    // Step 4: Validate addresses
    if (!validateTronAddress(authorization.from)) {
      return {
        isValid: false,
        invalidReason: "invalid_sender_address",
        payer: authorization.from,
      };
    }
    if (!validateTronAddress(authorization.to)) {
      return {
        isValid: false,
        invalidReason: "invalid_recipient_address",
        payer: authorization.from,
      };
    }
    if (!validateTronAddress(authorization.contractAddress)) {
      return {
        isValid: false,
        invalidReason: "invalid_contract_address",
        payer: authorization.from,
      };
    }

    // Step 5: Verify transaction signature
    const verifyResult = await this.signer.verifyTransaction({
      signedTransaction: tronPayload.signedTransaction,
      expectedFrom: authorization.from,
      expectedTransfer: {
        to: authorization.to,
        contractAddress: authorization.contractAddress,
        amount: authorization.amount,
      },
      network: payloadNetwork,
    });

    if (!verifyResult.valid) {
      return {
        isValid: false,
        invalidReason: verifyResult.reason || "transaction_verification_failed",
        payer: authorization.from,
      };
    }

    // Step 6: Check expiration (with buffer)
    const now = Date.now();
    const expirationWithBuffer = authorization.expiration - MIN_VALIDITY_BUFFER * 1000;

    if (now >= expirationWithBuffer) {
      return {
        isValid: false,
        invalidReason: "authorization_expired",
        payer: authorization.from,
      };
    }

    // Step 7: Verify balance
    try {
      const balance = await this.signer.getBalance({
        ownerAddress: authorization.from,
        contractAddress: authorization.contractAddress,
        network: payloadNetwork,
      });

      if (BigInt(balance) < BigInt(requirements.amount)) {
        return {
          isValid: false,
          invalidReason: "insufficient_balance",
          payer: authorization.from,
        };
      }
    } catch (error) {
      console.warn("Could not verify balance:", error);
    }

    // Step 8: Verify amount sufficiency
    if (BigInt(authorization.amount) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: "insufficient_amount",
        payer: authorization.from,
      };
    }

    // Step 9: Verify recipient
    if (!addressesEqual(authorization.to, requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: "recipient_mismatch",
        payer: authorization.from,
      };
    }

    // Step 10: Verify contract address
    if (!addressesEqual(authorization.contractAddress, requirements.asset)) {
      return {
        isValid: false,
        invalidReason: "asset_mismatch",
        payer: authorization.from,
      };
    }

    // Step 11: Verify sender account is activated
    try {
      const isActivated = await this.signer.isActivated(authorization.from, payloadNetwork);
      if (!isActivated) {
        return {
          isValid: false,
          invalidReason: "account_not_activated",
          payer: authorization.from,
        };
      }
    } catch (error) {
      console.warn("Could not verify account activation:", error);
    }

    // All checks passed
    return {
      isValid: true,
      invalidReason: undefined,
      payer: authorization.from,
    };
  }

  /**
   * Settle a verified payment
   *
   * Broadcasts the transaction and waits for confirmation.
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    const tronPayload = payload.payload as ExactTronPayload;

    // Re-verify before settling
    const verifyResult = await this.verify(payload, requirements);
    if (!verifyResult.isValid) {
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: verifyResult.invalidReason ?? "verification_failed",
        payer: tronPayload.authorization.from,
      };
    }

    try {
      const network = normalizeNetwork(String(payload.accepted.network));

      // Broadcast the transaction
      const txId = await this.signer.broadcastTransaction(
        tronPayload.signedTransaction,
        network,
      );

      // Wait for confirmation
      const confirmation = await this.signer.waitForTransaction({
        txId,
        network,
        timeout: 60000, // 60 seconds
      });

      if (!confirmation.success) {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: txId,
          errorReason: confirmation.error || "transaction_not_confirmed",
          payer: tronPayload.authorization.from,
        };
      }

      return {
        success: true,
        transaction: confirmation.txId || txId,
        network: payload.accepted.network,
        payer: tronPayload.authorization.from,
      };
    } catch (error) {
      console.error("Failed to settle TRON transaction:", error);
      return {
        success: false,
        network: payload.accepted.network,
        transaction: "",
        errorReason: "transaction_failed",
        payer: tronPayload.authorization.from,
      };
    }
  }
}
