/**
 * Cosmos Facilitator Scheme Implementation - Exact Direct
 *
 * Verifies and settles Cosmos (Noble USDC) payments using the exact-direct scheme.
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
import type { FacilitatorCosmosSigner, ExactDirectCosmosPayload, MsgSend } from "../../types.js";
import {
  SCHEME_EXACT_DIRECT,
  COSMOS_CAIP2_NAMESPACE,
  MAX_TRANSACTION_AGE,
  MSG_TYPE_SEND,
} from "../../constants.js";
import { normalizeNetwork, isValidAddress } from "../../utils.js";
import { getDefaultToken } from "../../tokens.js";

/**
 * Configuration for ExactDirectCosmosFacilitator
 */
export interface ExactDirectCosmosFacilitatorConfig {
  /** Maximum age of a transaction to accept (in milliseconds) */
  maxTransactionAge?: number;
  /** Duration to cache used transaction hashes (in milliseconds) */
  usedTxCacheDuration?: number;
}

/**
 * Cosmos facilitator implementation for the Exact-Direct payment scheme.
 * Verifies transaction proofs and confirms payments.
 */
export class ExactDirectCosmosFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = SCHEME_EXACT_DIRECT;
  readonly caipFamily = `${COSMOS_CAIP2_NAMESPACE}:*`;

  private readonly config: Required<ExactDirectCosmosFacilitatorConfig>;
  private usedTxs: Map<string, number> = new Map();

  constructor(
    private readonly signer: FacilitatorCosmosSigner,
    config?: ExactDirectCosmosFacilitatorConfig,
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
      assetDenom: token.denom,
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
    const cosmosPayload = payload.payload as ExactDirectCosmosPayload;
    if (!cosmosPayload.txHash) {
      return {
        isValid: false,
        invalidReason: "missing_tx_hash",
      };
    }
    if (!cosmosPayload.from || !isValidAddress(cosmosPayload.from)) {
      return {
        isValid: false,
        invalidReason: "invalid_from_address",
      };
    }

    // Check for replay attack
    if (this.isTxUsed(cosmosPayload.txHash)) {
      return {
        isValid: false,
        invalidReason: "transaction_already_used",
        payer: cosmosPayload.from,
      };
    }

    try {
      // Query the transaction
      const tx = await this.signer.queryTransaction(network, cosmosPayload.txHash);

      // Check transaction succeeded (code 0 = success)
      if (tx.code !== 0) {
        return {
          isValid: false,
          invalidReason: "transaction_failed",
          payer: cosmosPayload.from,
        };
      }

      // Find the MsgSend in the transaction messages
      const msgSend = this.findMsgSend(tx.tx.body.messages);
      if (!msgSend) {
        return {
          isValid: false,
          invalidReason: "no_msg_send_found",
          payer: cosmosPayload.from,
        };
      }

      // Verify recipient
      if (msgSend.toAddress !== requirements.payTo) {
        return {
          isValid: false,
          invalidReason: "wrong_recipient",
          payer: cosmosPayload.from,
        };
      }

      // Verify sender matches payload
      if (msgSend.fromAddress !== cosmosPayload.from) {
        return {
          isValid: false,
          invalidReason: "sender_mismatch",
          payer: cosmosPayload.from,
        };
      }

      // Determine expected denom
      const expectedDenom = (requirements.extra?.denom as string) || requirements.asset;

      // Verify amount and denomination
      const coin = this.getAmountByDenom(msgSend, expectedDenom);
      if (!coin) {
        return {
          isValid: false,
          invalidReason: "wrong_denomination",
          payer: cosmosPayload.from,
        };
      }

      const txAmount = BigInt(coin.amount);
      const requiredAmount = BigInt(requirements.amount);
      if (txAmount < requiredAmount) {
        return {
          isValid: false,
          invalidReason: "insufficient_amount",
          payer: cosmosPayload.from,
        };
      }

      // Mark transaction as used
      this.markTxUsed(cosmosPayload.txHash);

      return {
        isValid: true,
        payer: cosmosPayload.from,
      };
    } catch {
      return {
        isValid: false,
        invalidReason: "transaction_not_found",
        payer: cosmosPayload.from,
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

    const cosmosPayload = payload.payload as ExactDirectCosmosPayload;

    // For exact-direct, settlement is already complete
    return {
      success: true,
      transaction: cosmosPayload.txHash,
      network: normalizeNetwork(requirements.network),
      payer: cosmosPayload.from,
    };
  }

  /**
   * Find a MsgSend in transaction messages
   */
  private findMsgSend(messages: MsgSend[]): MsgSend | null {
    for (const msg of messages) {
      if (msg["@type"] === MSG_TYPE_SEND || (!msg["@type"] && msg.fromAddress && msg.toAddress)) {
        return msg;
      }
    }
    return null;
  }

  /**
   * Get a specific coin amount from a MsgSend by denomination
   */
  private getAmountByDenom(msg: MsgSend, denom: string): { denom: string; amount: string } | null {
    for (const coin of msg.amount) {
      if (coin.denom === denom) {
        return coin;
      }
    }
    return null;
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
