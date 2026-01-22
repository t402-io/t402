/**
 * Aptos Exact-Direct Facilitator Scheme
 *
 * Verifies FA transfer transactions and manages replay protection.
 */

import type {
  SchemeNetworkFacilitator,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  Network,
} from "@t402/core/types";
import { SCHEME_EXACT_DIRECT, APTOS_CAIP2_NAMESPACE } from "../../constants.js";
import type {
  FacilitatorAptosSigner,
  ExactDirectAptosPayload,
} from "../../types.js";
import {
  isValidTxHash,
  compareAddresses,
  parseAssetIdentifier,
  extractTransferDetails,
  isAptosNetwork,
} from "../../utils.js";
import { getDefaultToken } from "../../tokens.js";

/**
 * Configuration for ExactDirectAptosFacilitator
 */
export interface ExactDirectAptosFacilitatorConfig {
  /**
   * Maximum age of transaction in seconds (default: 3600 = 1 hour)
   */
  maxTransactionAge?: number;

  /**
   * Duration to cache used transaction hashes (in milliseconds)
   */
  usedTxCacheDuration?: number;
}

/**
 * Aptos Exact-Direct Facilitator
 *
 * Implements the facilitator-side verification and settlement.
 * For exact-direct, settlement is a no-op since client already executed.
 */
export class ExactDirectAptosFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT_DIRECT;
  readonly caipFamily = `${APTOS_CAIP2_NAMESPACE}:*`;

  private readonly config: Required<ExactDirectAptosFacilitatorConfig>;
  private usedTxs: Map<string, number> = new Map();

  constructor(
    private readonly signer: FacilitatorAptosSigner,
    config?: ExactDirectAptosFacilitatorConfig,
  ) {
    this.config = {
      maxTransactionAge: config?.maxTransactionAge ?? 3600,
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
    if (!isAptosNetwork(payload.accepted.network)) {
      return {
        isValid: false,
        invalidReason: "invalid_network",
      };
    }

    // Extract Aptos-specific payload
    const aptosPayload = payload.payload as ExactDirectAptosPayload;

    // Validate transaction hash format
    if (!isValidTxHash(aptosPayload.txHash)) {
      return {
        isValid: false,
        invalidReason: "invalid_tx_hash_format",
      };
    }

    // Check for replay attack
    if (this.isTxUsed(aptosPayload.txHash)) {
      return {
        isValid: false,
        invalidReason: "transaction_already_used",
        payer: aptosPayload.from,
      };
    }

    try {
      // Query transaction
      const tx = await this.signer.queryTransaction(aptosPayload.txHash);
      if (!tx) {
        return {
          isValid: false,
          invalidReason: "transaction_not_found",
          payer: aptosPayload.from,
        };
      }

      // Verify transaction was successful
      if (!tx.success) {
        return {
          isValid: false,
          invalidReason: `transaction_failed: ${tx.vmStatus}`,
          payer: aptosPayload.from,
        };
      }

      // Check transaction age
      if (this.config.maxTransactionAge > 0) {
        const txTimestamp = parseInt(tx.timestamp, 10) / 1000000; // Convert from microseconds
        const now = Date.now() / 1000;
        const age = now - txTimestamp;
        if (age > this.config.maxTransactionAge) {
          return {
            isValid: false,
            invalidReason: `transaction_too_old: ${Math.round(age)} seconds`,
            payer: aptosPayload.from,
          };
        }
      }

      // Extract transfer details from transaction
      const transferDetails = extractTransferDetails(tx);
      if (!transferDetails) {
        return {
          isValid: false,
          invalidReason: "could_not_extract_transfer_details",
          payer: aptosPayload.from,
        };
      }

      // Parse expected asset
      const expectedAsset = parseAssetIdentifier(requirements.asset);
      if (!expectedAsset) {
        return {
          isValid: false,
          invalidReason: `invalid_asset_in_requirements: ${requirements.asset}`,
          payer: aptosPayload.from,
        };
      }

      // Verify recipient
      if (!compareAddresses(transferDetails.to, requirements.payTo)) {
        return {
          isValid: false,
          invalidReason: `recipient_mismatch: expected ${requirements.payTo}, got ${transferDetails.to}`,
          payer: aptosPayload.from,
        };
      }

      // Verify metadata address (token)
      if (
        !compareAddresses(
          transferDetails.metadataAddress,
          expectedAsset.metadataAddress,
        )
      ) {
        return {
          isValid: false,
          invalidReason: `token_mismatch: expected ${expectedAsset.metadataAddress}, got ${transferDetails.metadataAddress}`,
          payer: aptosPayload.from,
        };
      }

      // Verify amount
      const expectedAmount = BigInt(requirements.amount);
      if (transferDetails.amount < expectedAmount) {
        return {
          isValid: false,
          invalidReason: `insufficient_amount: expected ${expectedAmount}, got ${transferDetails.amount}`,
          payer: aptosPayload.from,
        };
      }

      // Mark transaction as used
      this.markTxUsed(aptosPayload.txHash);

      return {
        isValid: true,
        payer: transferDetails.from,
      };
    } catch (error) {
      return {
        isValid: false,
        invalidReason: `verification_error: ${error instanceof Error ? error.message : String(error)}`,
        payer: aptosPayload.from,
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

    const aptosPayload = payload.payload as ExactDirectAptosPayload;

    // For exact-direct, settlement is already complete
    return {
      success: true,
      transaction: aptosPayload.txHash,
      network: requirements.network,
      payer: aptosPayload.from,
    };
  }

  /**
   * Check if a transaction has been used
   */
  private isTxUsed(txHash: string): boolean {
    return this.usedTxs.has(txHash.toLowerCase());
  }

  /**
   * Mark a transaction as used
   */
  private markTxUsed(txHash: string): void {
    this.usedTxs.set(txHash.toLowerCase(), Date.now());
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

export default ExactDirectAptosFacilitator;
