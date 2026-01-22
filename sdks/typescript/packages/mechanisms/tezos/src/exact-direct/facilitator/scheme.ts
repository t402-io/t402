/**
 * Tezos Exact-Direct Facilitator Scheme
 *
 * Verifies FA2 transfer operations and manages replay protection.
 */

import type {
  SchemeNetworkFacilitator,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  Network,
} from "@t402/core/types";
import { SCHEME_EXACT_DIRECT, TEZOS_CAIP2_NAMESPACE } from "../../constants.js";
import type {
  FacilitatorTezosSigner,
  ExactDirectTezosPayload,
} from "../../types.js";
import { isValidOperationHash, isTezosNetwork } from "../../types.js";
import {
  compareAddresses,
  extractFA2TransferDetails,
} from "../../utils.js";
import { getDefaultToken } from "../../tokens.js";

/**
 * Configuration for ExactDirectTezosFacilitator
 */
export interface ExactDirectTezosFacilitatorConfig {
  /**
   * Maximum age of operation in seconds (default: 3600 = 1 hour)
   */
  maxOperationAge?: number;

  /**
   * Duration to cache used operation hashes (in milliseconds)
   */
  usedOpCacheDuration?: number;
}

/**
 * Tezos Exact-Direct Facilitator
 *
 * Implements the facilitator-side verification and settlement.
 * For exact-direct, settlement is a no-op since client already executed.
 */
export class ExactDirectTezosFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT_DIRECT;
  readonly caipFamily = `${TEZOS_CAIP2_NAMESPACE}:*`;

  private readonly config: Required<ExactDirectTezosFacilitatorConfig>;
  private usedOps: Map<string, number> = new Map();

  constructor(
    private readonly signer: FacilitatorTezosSigner,
    config?: ExactDirectTezosFacilitatorConfig,
  ) {
    this.config = {
      maxOperationAge: config?.maxOperationAge ?? 3600,
      usedOpCacheDuration: config?.usedOpCacheDuration ?? 24 * 60 * 60 * 1000, // 24 hours
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
   * Get facilitator signer addresses for a network
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
    // Validate scheme
    if (payload.accepted.scheme !== SCHEME_EXACT_DIRECT) {
      return {
        isValid: false,
        invalidReason: "invalid_scheme",
      };
    }

    // Validate network
    if (!isTezosNetwork(payload.accepted.network)) {
      return {
        isValid: false,
        invalidReason: "invalid_network",
      };
    }

    // Extract Tezos-specific payload
    const tezosPayload = payload.payload as ExactDirectTezosPayload;

    // Validate operation hash format
    if (!isValidOperationHash(tezosPayload.opHash)) {
      return {
        isValid: false,
        invalidReason: "invalid_operation_hash_format",
      };
    }

    // Check for replay attack
    if (this.isOpUsed(tezosPayload.opHash)) {
      return {
        isValid: false,
        invalidReason: "operation_already_used",
        payer: tezosPayload.from,
      };
    }

    try {
      // Query operation
      const op = await this.signer.queryOperation(tezosPayload.opHash);
      if (!op) {
        return {
          isValid: false,
          invalidReason: "operation_not_found",
          payer: tezosPayload.from,
        };
      }

      // Verify operation was successful
      if (op.status !== "applied") {
        return {
          isValid: false,
          invalidReason: `operation_not_applied: status is ${op.status}`,
          payer: tezosPayload.from,
        };
      }

      // Check operation age
      if (this.config.maxOperationAge > 0) {
        const opTimestamp = new Date(op.timestamp).getTime() / 1000;
        const now = Date.now() / 1000;
        const age = now - opTimestamp;
        if (age > this.config.maxOperationAge) {
          return {
            isValid: false,
            invalidReason: `operation_too_old: ${Math.round(age)} seconds`,
            payer: tezosPayload.from,
          };
        }
      }

      // Verify it's a transfer to the correct contract
      if (op.target?.address !== tezosPayload.contractAddress) {
        return {
          isValid: false,
          invalidReason: `contract_mismatch: expected ${tezosPayload.contractAddress}, got ${op.target?.address}`,
          payer: tezosPayload.from,
        };
      }

      // Verify entrypoint
      if (op.entrypoint !== "transfer") {
        return {
          isValid: false,
          invalidReason: `entrypoint_mismatch: expected transfer, got ${op.entrypoint}`,
          payer: tezosPayload.from,
        };
      }

      // Extract transfer details from parameter
      const transferDetails = extractFA2TransferDetails(op.parameter);
      if (!transferDetails) {
        return {
          isValid: false,
          invalidReason: "could_not_extract_transfer_details",
          payer: tezosPayload.from,
        };
      }

      // Verify sender
      if (!compareAddresses(transferDetails.from, op.sender.address)) {
        return {
          isValid: false,
          invalidReason: `sender_mismatch: parameter says ${transferDetails.from}, but sender is ${op.sender.address}`,
          payer: tezosPayload.from,
        };
      }

      // Verify recipient
      if (!compareAddresses(transferDetails.to, requirements.payTo)) {
        return {
          isValid: false,
          invalidReason: `recipient_mismatch: expected ${requirements.payTo}, got ${transferDetails.to}`,
          payer: tezosPayload.from,
        };
      }

      // Verify token ID
      if (transferDetails.tokenId !== tezosPayload.tokenId) {
        return {
          isValid: false,
          invalidReason: `token_id_mismatch: expected ${tezosPayload.tokenId}, got ${transferDetails.tokenId}`,
          payer: tezosPayload.from,
        };
      }

      // Verify amount
      const expectedAmount = BigInt(requirements.amount);
      const actualAmount = BigInt(transferDetails.amount);
      if (actualAmount < expectedAmount) {
        return {
          isValid: false,
          invalidReason: `insufficient_amount: expected ${expectedAmount}, got ${actualAmount}`,
          payer: tezosPayload.from,
        };
      }

      // Mark operation as used
      this.markOpUsed(tezosPayload.opHash);

      return {
        isValid: true,
        payer: transferDetails.from,
      };
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `verification_error: ${error instanceof Error ? error.message : String(error)}`,
        payer: tezosPayload.from,
      };
    }
  }

  /**
   * Settle a payment (no-op for exact-direct since client already executed)
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
        network: requirements.network,
      };
    }

    const tezosPayload = payload.payload as ExactDirectTezosPayload;

    // For exact-direct, settlement is already complete
    return {
      success: true,
      transaction: tezosPayload.opHash,
      network: requirements.network,
      payer: tezosPayload.from,
    };
  }

  /**
   * Check if an operation has been used
   */
  private isOpUsed(opHash: string): boolean {
    return this.usedOps.has(opHash);
  }

  /**
   * Mark an operation as used
   */
  private markOpUsed(opHash: string): void {
    this.usedOps.set(opHash, Date.now());
  }

  /**
   * Start the cleanup interval for used operations
   */
  private startCleanupInterval(): void {
    setInterval(
      () => {
        const cutoff = Date.now() - this.config.usedOpCacheDuration;
        for (const [opHash, usedAt] of this.usedOps.entries()) {
          if (usedAt < cutoff) {
            this.usedOps.delete(opHash);
          }
        }
      },
      60 * 60 * 1000,
    ); // Cleanup every hour
  }
}

export default ExactDirectTezosFacilitator;
