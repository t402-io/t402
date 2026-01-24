/**
 * Stacks Exact-Direct Facilitator Scheme
 *
 * Verifies that a Stacks SIP-010 token transfer was executed correctly
 * by querying the Hiro API.
 */

import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@t402/core/types";
import { STACKS_CAIP2_NAMESPACE, SCHEME_EXACT_DIRECT, getNetworkConfig } from "../../constants.js";
import { getDefaultToken } from "../../tokens.js";
import type {
  ExactDirectStacksPayload,
  FacilitatorStacksSigner,
  StacksFacilitatorConfig,
} from "../../types.js";
import {
  comparePrincipals,
  extractTokenTransfer,
  extractTokenTransferFromPostConditions,
  isValidTxId,
  isValidPrincipal,
} from "../../utils.js";

// Default configuration
const DEFAULT_MAX_TRANSACTION_AGE = 3600; // 1 hour
const DEFAULT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

/**
 * Exact-direct facilitator scheme for Stacks
 */
export class ExactDirectStacksFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT_DIRECT;
  readonly caipFamily = `${STACKS_CAIP2_NAMESPACE}:*`;

  private readonly signer: FacilitatorStacksSigner;
  private readonly config: Required<StacksFacilitatorConfig>;
  private readonly usedTransactions = new Map<string, number>();

  constructor(
    signer: FacilitatorStacksSigner,
    config: StacksFacilitatorConfig = {},
  ) {
    this.signer = signer;
    this.config = {
      maxTransactionAge: config.maxTransactionAge ?? DEFAULT_MAX_TRANSACTION_AGE,
      usedTxCacheDuration:
        config.usedTxCacheDuration ?? DEFAULT_CACHE_DURATION,
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
      contractAddress: token?.contractAddress,
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
    const stacksPayload = payload.payload as unknown as ExactDirectStacksPayload;

    // Validate required fields
    if (!stacksPayload.txId) {
      return {
        isValid: false,
        invalidReason: "missing_tx_id",
      };
    }

    // Validate tx ID format
    if (!isValidTxId(stacksPayload.txId)) {
      return {
        isValid: false,
        invalidReason: "invalid_tx_id_format",
      };
    }

    // Validate from address
    if (!stacksPayload.from) {
      return {
        isValid: false,
        invalidReason: "missing_from_address",
      };
    }

    if (!isValidPrincipal(stacksPayload.from)) {
      return {
        isValid: false,
        invalidReason: "invalid_from_address",
        payer: stacksPayload.from,
      };
    }

    // Check for replay attack
    if (this.isTransactionUsed(stacksPayload.txId)) {
      return {
        isValid: false,
        invalidReason: "transaction_already_used",
        payer: stacksPayload.from,
      };
    }

    // Query transaction
    const txResult = await this.signer.queryTransaction(stacksPayload.txId);

    if (!txResult) {
      return {
        isValid: false,
        invalidReason: "transaction_not_found",
        payer: stacksPayload.from,
      };
    }

    // Verify transaction was successful
    if (txResult.txStatus !== "success") {
      return {
        isValid: false,
        invalidReason: `transaction_failed: status=${txResult.txStatus}`,
        payer: stacksPayload.from,
      };
    }

    // Check transaction age
    if (this.config.maxTransactionAge > 0) {
      const txTime = txResult.burnBlockTime * 1000; // Convert to milliseconds
      const age = (Date.now() - txTime) / 1000;
      if (age > this.config.maxTransactionAge) {
        return {
          isValid: false,
          invalidReason: `transaction_too_old: ${Math.round(age)} seconds`,
          payer: stacksPayload.from,
        };
      }
    }

    // Extract transfer details
    const expectedContract = (requirements.extra?.contractAddress as string) ??
      stacksPayload.contractAddress;

    const transfer =
      extractTokenTransfer(txResult, expectedContract) ||
      extractTokenTransferFromPostConditions(txResult, expectedContract);

    if (!transfer) {
      return {
        isValid: false,
        invalidReason: "not_token_transfer",
        payer: stacksPayload.from,
      };
    }

    // Verify contract address
    if (expectedContract && !comparePrincipals(transfer.contractAddress, expectedContract)) {
      return {
        isValid: false,
        invalidReason: `contract_mismatch: expected ${expectedContract}, got ${transfer.contractAddress}`,
        payer: stacksPayload.from,
      };
    }

    // Verify recipient
    if (!comparePrincipals(transfer.to, requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: `recipient_mismatch: expected ${requirements.payTo}, got ${transfer.to}`,
        payer: stacksPayload.from,
      };
    }

    // Verify amount
    const txAmount = BigInt(transfer.amount);
    const requiredAmount = BigInt(requirements.amount);
    if (txAmount < requiredAmount) {
      return {
        isValid: false,
        invalidReason: `insufficient_amount: expected ${requirements.amount}, got ${transfer.amount}`,
        payer: stacksPayload.from,
      };
    }

    // Mark transaction as used
    this.markTransactionUsed(stacksPayload.txId);

    return {
      isValid: true,
      payer: stacksPayload.from,
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

    const stacksPayload = payload.payload as unknown as ExactDirectStacksPayload;

    // For exact-direct, settlement is already complete
    return {
      success: true,
      transaction: stacksPayload.txId,
      network: requirements.network,
      payer: verifyResult.payer,
    };
  }

  /**
   * Check if a transaction has been used
   */
  private isTransactionUsed(txId: string): boolean {
    return this.usedTransactions.has(txId);
  }

  /**
   * Mark a transaction as used
   */
  private markTransactionUsed(txId: string): void {
    this.usedTransactions.set(txId, Date.now());
  }

  /**
   * Start the cleanup interval for used transactions cache
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.config.usedTxCacheDuration;
      for (const [txId, timestamp] of this.usedTransactions) {
        if (timestamp < cutoff) {
          this.usedTransactions.delete(txId);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

/**
 * Create an exact-direct facilitator for Stacks
 */
export function createExactDirectStacksFacilitator(
  signer: FacilitatorStacksSigner,
  config: StacksFacilitatorConfig = {},
): ExactDirectStacksFacilitator {
  return new ExactDirectStacksFacilitator(signer, config);
}
