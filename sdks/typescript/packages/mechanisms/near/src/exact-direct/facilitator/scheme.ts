/**
 * NEAR Facilitator Scheme Implementation - Exact Direct
 *
 * Verifies and settles NEAR NEP-141 payments using the exact-direct scheme.
 * The facilitator verifies that the client's transaction was successful
 * and matches the payment requirements.
 */

import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import type { FacilitatorNearSigner, ExactDirectNearPayload, FtTransferArgs } from "../../types.js";
import { SCHEME_EXACT_DIRECT, NEAR_CAIP2_NAMESPACE, MAX_TRANSACTION_AGE } from "../../constants.js";
import {
  normalizeNetwork,
  isTransactionSuccessful,
  parseFtTransferArgs,
  isValidAccountId,
} from "../../utils.js";
import { getDefaultToken } from "../../tokens.js";

/**
 * Configuration for ExactDirectNearFacilitator
 */
export interface ExactDirectNearFacilitatorConfig {
  /** Maximum age of a transaction to accept (in milliseconds) */
  maxTransactionAge?: number;
  /** Duration to cache used transaction hashes (in milliseconds) */
  usedTxCacheDuration?: number;
}

/**
 * NEAR facilitator implementation for the Exact-Direct payment scheme.
 * Verifies transaction proofs and confirms payments.
 */
export class ExactDirectNearFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT_DIRECT;
  readonly caipFamily = `${NEAR_CAIP2_NAMESPACE}:*`;

  private readonly config: Required<ExactDirectNearFacilitatorConfig>;
  private usedTxs: Map<string, number> = new Map();

  constructor(
    private readonly signer: FacilitatorNearSigner,
    config?: ExactDirectNearFacilitatorConfig,
  ) {
    this.config = {
      maxTransactionAge: config?.maxTransactionAge ?? MAX_TRANSACTION_AGE,
      usedTxCacheDuration: config?.usedTxCacheDuration ?? 24 * 60 * 60 * 1000, // 24 hours
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get extra data for a supported kind
   */
  getExtra(network: Network): Record<string, unknown> | undefined {
    const token = getDefaultToken(network);
    if (!token) {
      return undefined;
    }
    return {
      assetSymbol: token.symbol,
      assetDecimals: token.decimals,
    };
  }

  /**
   * Get signer addresses for a network
   */
  getSigners(network: Network): string[] {
    return this.signer.getAddresses(network);
  }

  /**
   * Verify a payment payload
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const network = normalizeNetwork(requirements.network);

    // Validate scheme
    if (payload.accepted.scheme !== SCHEME_EXACT_DIRECT) {
      return {
        isValid: false,
        invalidReason: "invalid_scheme",
      };
    }

    // Validate network
    if (normalizeNetwork(payload.accepted.network) !== network) {
      return {
        isValid: false,
        invalidReason: "network_mismatch",
      };
    }

    // Parse payload
    const nearPayload = payload.payload as ExactDirectNearPayload;
    if (!nearPayload.txHash) {
      return {
        isValid: false,
        invalidReason: "missing_tx_hash",
      };
    }
    if (!nearPayload.from || !isValidAccountId(nearPayload.from)) {
      return {
        isValid: false,
        invalidReason: "invalid_from_address",
      };
    }

    // Check for replay attack
    if (this.isTxUsed(nearPayload.txHash)) {
      return {
        isValid: false,
        invalidReason: "transaction_already_used",
        payer: nearPayload.from,
      };
    }

    try {
      // Query the transaction
      const tx = await this.signer.queryTransaction(nearPayload.txHash, nearPayload.from);

      // Check transaction succeeded
      if (!isTransactionSuccessful(tx.status)) {
        return {
          isValid: false,
          invalidReason: "transaction_failed",
          payer: nearPayload.from,
        };
      }

      // Verify the transaction was to the correct token contract
      if (tx.transaction.receiver_id !== requirements.asset) {
        return {
          isValid: false,
          invalidReason: "wrong_token_contract",
          payer: nearPayload.from,
        };
      }

      // Find and verify ft_transfer action
      let ftTransferArgs: FtTransferArgs | null = null;
      for (const action of tx.transaction.actions) {
        if (action.FunctionCall?.method_name === "ft_transfer") {
          ftTransferArgs = parseFtTransferArgs(action.FunctionCall.args);
          break;
        }
      }

      if (!ftTransferArgs) {
        return {
          isValid: false,
          invalidReason: "no_ft_transfer_action",
          payer: nearPayload.from,
        };
      }

      // Verify recipient
      if (ftTransferArgs.receiver_id !== requirements.payTo) {
        return {
          isValid: false,
          invalidReason: "wrong_recipient",
          payer: nearPayload.from,
        };
      }

      // Verify amount
      const txAmount = BigInt(ftTransferArgs.amount);
      const requiredAmount = BigInt(requirements.amount);
      if (txAmount < requiredAmount) {
        return {
          isValid: false,
          invalidReason: "insufficient_amount",
          payer: nearPayload.from,
        };
      }

      // Mark transaction as used
      this.markTxUsed(nearPayload.txHash);

      return {
        isValid: true,
        payer: nearPayload.from,
      };
    } catch {
      return {
        isValid: false,
        invalidReason: "transaction_not_found",
        payer: nearPayload.from,
      };
    }
  }

  /**
   * Settle a payment - for exact-direct, the transfer is already complete
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    // Verify first
    const verifyResult = await this.verify(payload, requirements);
    if (!verifyResult.isValid) {
      return {
        success: false,
        errorReason: verifyResult.invalidReason || "verification_failed",
        payer: verifyResult.payer,
        transaction: "",
        network: normalizeNetwork(requirements.network),
      };
    }

    const nearPayload = payload.payload as ExactDirectNearPayload;

    // For exact-direct, settlement is already complete
    return {
      success: true,
      transaction: nearPayload.txHash,
      network: normalizeNetwork(requirements.network),
      payer: nearPayload.from,
    };
  }

  /**
   * Check if a transaction has been used
   */
  private isTxUsed(txHash: string): boolean {
    return this.usedTxs.has(txHash);
  }

  /**
   * Mark a transaction as used
   */
  private markTxUsed(txHash: string): void {
    this.usedTxs.set(txHash, Date.now());
  }

  /**
   * Start the cleanup interval for used transactions
   */
  private startCleanupInterval(): void {
    setInterval(
      () => {
        const cutoff = Date.now() - this.config.usedTxCacheDuration;
        for (const [txHash, usedAt] of this.usedTxs.entries()) {
          if (usedAt < cutoff) {
            this.usedTxs.delete(txHash);
          }
        }
      },
      60 * 60 * 1000,
    ); // Cleanup every hour
  }
}
