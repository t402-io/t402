/**
 * Cosmos Client Scheme Implementation - Exact Direct
 *
 * Creates payment payloads for Cosmos MsgSend transfers using the exact-direct scheme.
 * In this scheme, the client executes the bank send directly and provides
 * the transaction hash as proof of payment.
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import type { ClientCosmosSigner, ExactDirectCosmosPayload } from "../../types.js";
import { SCHEME_EXACT_DIRECT, USDC_DENOM } from "../../constants.js";
import { normalizeNetwork, isValidAddress } from "../../utils.js";

/**
 * Configuration for ExactDirectCosmosClient
 */
export interface ExactDirectCosmosClientConfig {
  /** Override the default denomination */
  denom?: string;
}

/**
 * Cosmos client implementation for the Exact-Direct payment scheme.
 *
 * Executes a Cosmos MsgSend and returns the transaction hash as proof.
 */
export class ExactDirectCosmosClient implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT_DIRECT;

  /**
   * Creates a new ExactDirectCosmosClient instance.
   *
   * @param signer - The Cosmos signer for client operations
   * @param config - Optional configuration overrides
   */
  constructor(
    private readonly signer: ClientCosmosSigner,
    private readonly config: ExactDirectCosmosClientConfig = {},
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
    const network = normalizeNetwork(paymentRequirements.network);

    // Validate required fields
    if (!paymentRequirements.payTo) {
      throw new Error("PayTo address is required");
    }
    if (!paymentRequirements.amount) {
      throw new Error("Amount is required");
    }

    // Validate addresses
    if (!isValidAddress(paymentRequirements.payTo)) {
      throw new Error(`Invalid recipient address: ${paymentRequirements.payTo}`);
    }
    if (!isValidAddress(this.signer.address)) {
      throw new Error(`Invalid sender address: ${this.signer.address}`);
    }

    const recipient = paymentRequirements.payTo;
    const amount = paymentRequirements.amount;

    // Determine denomination from extra field, config, or default
    const denom = (paymentRequirements.extra?.denom as string) || this.config.denom || USDC_DENOM;

    // Execute the transfer
    const txHash = await this.signer.sendTokens(network, recipient, amount, denom);

    // Build the payload
    const payload: ExactDirectCosmosPayload = {
      txHash,
      from: this.signer.address,
      to: recipient,
      amount: amount,
      denom,
    };

    return {
      t402Version,
      payload,
    };
  }
}
