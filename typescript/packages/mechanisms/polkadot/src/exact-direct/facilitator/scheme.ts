/**
 * Polkadot Exact-Direct Facilitator Scheme
 *
 * Verifies that a Polkadot asset transfer was executed correctly
 * by querying the Subscan indexer.
 */

import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import { POLKADOT_CAIP2_NAMESPACE, SCHEME_EXACT_DIRECT, getNetworkConfig } from "../../constants.js";
import { getDefaultToken } from "../../tokens.js";
import type {
  ExactDirectPolkadotPayload,
  FacilitatorPolkadotSigner,
  PolkadotFacilitatorConfig,
} from "../../types.js";
import {
  buildExtrinsicId,
  compareAddresses,
  extractAssetTransfer,
  extractAssetTransferFromEvents,
  isValidBlockHash,
  isValidExtrinsicHash,
} from "../../utils.js";

// Default configuration
const DEFAULT_MAX_EXTRINSIC_AGE = 3600; // 1 hour
const DEFAULT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

/**
 * Exact-direct facilitator scheme for Polkadot Asset Hub
 */
export class ExactDirectPolkadotFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT_DIRECT;
  readonly caipFamily = `${POLKADOT_CAIP2_NAMESPACE}:*`;

  private readonly signer: FacilitatorPolkadotSigner;
  private readonly config: Required<PolkadotFacilitatorConfig>;
  private readonly usedExtrinsics = new Map<string, number>();

  constructor(
    signer: FacilitatorPolkadotSigner,
    config: PolkadotFacilitatorConfig = {},
  ) {
    this.signer = signer;
    this.config = {
      maxExtrinsicAge: config.maxExtrinsicAge ?? DEFAULT_MAX_EXTRINSIC_AGE,
      usedExtrinsicCacheDuration:
        config.usedExtrinsicCacheDuration ?? DEFAULT_CACHE_DURATION,
    };

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get extra data for payment requirements
   */
  getExtra(network: Network): Record<string, unknown> | undefined {
    const config = getNetworkConfig(network);
    if (!config) return undefined;

    const token = getDefaultToken(network);
    return {
      assetId: token?.assetId,
      assetSymbol: token?.symbol,
      assetDecimals: token?.decimals,
      networkName: config.name,
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
    const network = requirements.network;

    // Validate scheme
    if (payload.accepted.scheme !== SCHEME_EXACT_DIRECT) {
      return {
        isValid: false,
        invalidReason: `invalid_scheme: expected ${SCHEME_EXACT_DIRECT}, got ${payload.accepted.scheme}`,
      };
    }

    // Validate network
    if (payload.accepted.network !== network) {
      return {
        isValid: false,
        invalidReason: `network_mismatch: expected ${network}, got ${payload.accepted.network}`,
      };
    }

    // Parse payload
    const polkadotPayload = payload.payload as unknown as ExactDirectPolkadotPayload;

    // Validate required fields
    if (!polkadotPayload.extrinsicHash && !polkadotPayload.blockHash) {
      return {
        isValid: false,
        invalidReason: "missing_extrinsic_identifier: need extrinsicHash or blockHash",
      };
    }

    // Validate extrinsic hash format if provided
    if (polkadotPayload.extrinsicHash && !isValidExtrinsicHash(polkadotPayload.extrinsicHash)) {
      return {
        isValid: false,
        invalidReason: "invalid_extrinsic_hash_format",
      };
    }

    // Validate block hash format if provided
    if (polkadotPayload.blockHash && !isValidBlockHash(polkadotPayload.blockHash)) {
      return {
        isValid: false,
        invalidReason: "invalid_block_hash_format",
      };
    }

    if (!polkadotPayload.from) {
      return {
        isValid: false,
        invalidReason: "missing_from_address",
      };
    }

    // Build unique identifier for replay protection
    const extrinsicId = polkadotPayload.extrinsicHash ||
      buildExtrinsicId(polkadotPayload.blockHash, polkadotPayload.extrinsicIndex);

    // Check for replay attack
    if (this.isExtrinsicUsed(extrinsicId)) {
      return {
        isValid: false,
        invalidReason: "extrinsic_already_used",
        payer: polkadotPayload.from,
      };
    }

    // Query extrinsic
    const extrinsicResult = await this.signer.queryExtrinsic(
      polkadotPayload.extrinsicHash,
      polkadotPayload.blockHash,
      polkadotPayload.extrinsicIndex,
    );

    if (!extrinsicResult) {
      return {
        isValid: false,
        invalidReason: "extrinsic_not_found",
        payer: polkadotPayload.from,
      };
    }

    // Verify extrinsic was successful
    if (!extrinsicResult.success) {
      return {
        isValid: false,
        invalidReason: "extrinsic_failed",
        payer: polkadotPayload.from,
      };
    }

    // Check extrinsic age
    if (this.config.maxExtrinsicAge > 0) {
      const extrinsicTime = new Date(extrinsicResult.timestamp).getTime();
      const age = (Date.now() - extrinsicTime) / 1000;
      if (age > this.config.maxExtrinsicAge) {
        return {
          isValid: false,
          invalidReason: `extrinsic_too_old: ${Math.round(age)} seconds`,
          payer: polkadotPayload.from,
        };
      }
    }

    // Extract transfer details
    const transfer =
      extractAssetTransfer(extrinsicResult) ||
      extractAssetTransferFromEvents(extrinsicResult);

    if (!transfer) {
      return {
        isValid: false,
        invalidReason: "not_asset_transfer",
        payer: polkadotPayload.from,
      };
    }

    // Verify asset ID
    const expectedAssetId = (requirements.extra?.assetId as number) ?? polkadotPayload.assetId;
    if (transfer.assetId !== expectedAssetId) {
      return {
        isValid: false,
        invalidReason: `asset_mismatch: expected ${expectedAssetId}, got ${transfer.assetId}`,
        payer: polkadotPayload.from,
      };
    }

    // Verify recipient
    if (!compareAddresses(transfer.to, requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: `recipient_mismatch: expected ${requirements.payTo}, got ${transfer.to}`,
        payer: polkadotPayload.from,
      };
    }

    // Verify amount
    const txAmount = BigInt(transfer.amount);
    const requiredAmount = BigInt(requirements.amount);
    if (txAmount < requiredAmount) {
      return {
        isValid: false,
        invalidReason: `insufficient_amount: expected ${requirements.amount}, got ${transfer.amount}`,
        payer: polkadotPayload.from,
      };
    }

    // Mark extrinsic as used
    this.markExtrinsicUsed(extrinsicId);

    return {
      isValid: true,
      payer: polkadotPayload.from,
    };
  }

  /**
   * Settle a payment (for exact-direct, the transfer is already complete)
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

    const polkadotPayload = payload.payload as unknown as ExactDirectPolkadotPayload;

    // For exact-direct, settlement is already complete
    return {
      success: true,
      transaction: polkadotPayload.extrinsicHash ||
        buildExtrinsicId(polkadotPayload.blockHash, polkadotPayload.extrinsicIndex),
      network: requirements.network,
      payer: verifyResult.payer,
    };
  }

  /**
   * Check if an extrinsic has been used
   */
  private isExtrinsicUsed(extrinsicId: string): boolean {
    return this.usedExtrinsics.has(extrinsicId);
  }

  /**
   * Mark an extrinsic as used
   */
  private markExtrinsicUsed(extrinsicId: string): void {
    this.usedExtrinsics.set(extrinsicId, Date.now());
  }

  /**
   * Start the cleanup interval for used extrinsics cache
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.config.usedExtrinsicCacheDuration;
      for (const [extrinsicId, timestamp] of this.usedExtrinsics) {
        if (timestamp < cutoff) {
          this.usedExtrinsics.delete(extrinsicId);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

/**
 * Create an exact-direct facilitator for Polkadot
 */
export function createExactDirectPolkadotFacilitator(
  signer: FacilitatorPolkadotSigner,
  config: PolkadotFacilitatorConfig = {},
): ExactDirectPolkadotFacilitator {
  return new ExactDirectPolkadotFacilitator(signer, config);
}
