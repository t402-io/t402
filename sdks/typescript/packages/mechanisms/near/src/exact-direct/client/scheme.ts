/**
 * NEAR Client Scheme Implementation - Exact Direct
 *
 * Creates payment payloads for NEAR NEP-141 transfers using the exact-direct scheme.
 * In this scheme, the client executes the ft_transfer directly and provides
 * the transaction hash as proof of payment.
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import type { ClientNearSigner, ExactDirectNearPayload } from "../../types.js";
import {
  SCHEME_EXACT_DIRECT,
  DEFAULT_FT_TRANSFER_GAS,
  FT_TRANSFER_DEPOSIT,
} from "../../constants.js";
import { normalizeNetwork, isValidAccountId } from "../../utils.js";

/**
 * Configuration for ExactDirectNearClient
 */
export interface ExactDirectNearClientConfig {
  /** Override the gas amount for ft_transfer */
  gasAmount?: string;
  /** Optional memo to include in the transfer */
  memo?: string;
}

/**
 * NEAR client implementation for the Exact-Direct payment scheme.
 *
 * Executes NEP-141 ft_transfer and returns the transaction hash as proof.
 */
export class ExactDirectNearClient implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT_DIRECT;

  /**
   * Creates a new ExactDirectNearScheme instance.
   *
   * @param signer - The NEAR signer for client operations
   * @param config - Optional configuration overrides
   */
  constructor(
    private readonly signer: ClientNearSigner,
    private readonly config: ExactDirectNearClientConfig = {},
  ) {}

  /**
   * Creates a payment payload by executing the transfer.
   *
   * Unlike other schemes where the client creates a signed message for
   * the facilitator to execute, the exact-direct scheme has the client
   * execute the transfer directly. The transaction hash is then used
   * as proof of payment.
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload with transaction hash
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    // Normalize and validate network
    normalizeNetwork(paymentRequirements.network);

    // Validate required fields
    if (!paymentRequirements.asset) {
      throw new Error("Asset (token contract address) is required");
    }
    if (!paymentRequirements.payTo) {
      throw new Error("PayTo address is required");
    }
    if (!paymentRequirements.amount) {
      throw new Error("Amount is required");
    }

    // Validate addresses
    if (!isValidAccountId(paymentRequirements.payTo)) {
      throw new Error(`Invalid recipient account ID: ${paymentRequirements.payTo}`);
    }
    if (!isValidAccountId(this.signer.accountId)) {
      throw new Error(`Invalid sender account ID: ${this.signer.accountId}`);
    }

    const tokenContract = paymentRequirements.asset;
    const recipient = paymentRequirements.payTo;
    const amount = paymentRequirements.amount;

    // Build ft_transfer arguments
    const ftTransferArgs: Record<string, unknown> = {
      receiver_id: recipient,
      amount: amount,
    };

    if (this.config.memo) {
      ftTransferArgs.memo = this.config.memo;
    }

    // Execute the transfer
    const txHash = await this.signer.signAndSendTransaction(
      tokenContract,
      "ft_transfer",
      ftTransferArgs,
      this.config.gasAmount || DEFAULT_FT_TRANSFER_GAS,
      FT_TRANSFER_DEPOSIT,
    );

    // Build the payload
    const payload: ExactDirectNearPayload = {
      txHash,
      from: this.signer.accountId,
      to: recipient,
      amount: amount,
    };

    return {
      t402Version,
      payload,
    };
  }
}
