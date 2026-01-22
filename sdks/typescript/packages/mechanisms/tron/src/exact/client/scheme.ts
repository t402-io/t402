/**
 * TRON Exact Payment Scheme - Client Implementation
 *
 * Creates payment payloads for TRC20 token transfers.
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import type { ClientTronSigner } from "../../signer.js";
import type { ExactTronPayload, TronAuthorization } from "../../types.js";
import { SCHEME_EXACT, DEFAULT_FEE_LIMIT } from "../../constants.js";
import { normalizeNetwork, validateTronAddress } from "../../utils.js";

/**
 * Configuration for ExactTronScheme
 */
export type ExactTronSchemeConfig = {
  /** Fee limit for transactions in SUN (default: 100 TRX) */
  feeLimit?: number;
};

/**
 * Client-side implementation of the TRON exact payment scheme
 *
 * This scheme creates pre-signed TRC20 transfer transactions
 * that can be verified and broadcast by the facilitator.
 */
export class ExactTronScheme implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT;
  private readonly signer: ClientTronSigner;
  private readonly config: ExactTronSchemeConfig;

  constructor(signer: ClientTronSigner, config?: ExactTronSchemeConfig) {
    this.signer = signer;
    this.config = config ?? {};
  }

  /**
   * Creates a payment payload for a TRC20 transfer
   *
   * @param t402Version - Protocol version (must be 2)
   * @param requirements - Payment requirements from server
   * @returns Payment payload with signed transaction
   */
  async createPaymentPayload(
    t402Version: number,
    requirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    // Normalize and validate network
    const network = normalizeNetwork(String(requirements.network));

    // Validate required fields
    if (!requirements.asset) {
      throw new Error("Asset (TRC20 contract address) is required");
    }
    if (!requirements.payTo) {
      throw new Error("PayTo address is required");
    }
    if (!requirements.amount) {
      throw new Error("Amount is required");
    }

    // Validate addresses
    if (!validateTronAddress(requirements.asset)) {
      throw new Error(`Invalid TRC20 contract address: ${requirements.asset}`);
    }
    if (!validateTronAddress(requirements.payTo)) {
      throw new Error(`Invalid payTo address: ${requirements.payTo}`);
    }
    if (!validateTronAddress(this.signer.address)) {
      throw new Error(`Invalid signer address: ${this.signer.address}`);
    }

    // Get block info for transaction
    const blockInfo = await this.signer.getBlockInfo();

    // Calculate expiration
    const expiration = blockInfo.expiration;

    // Get fee limit
    const feeLimit = this.config.feeLimit ?? DEFAULT_FEE_LIMIT;

    // Sign the transaction
    const signedTransaction = await this.signer.signTransaction({
      contractAddress: requirements.asset,
      to: requirements.payTo,
      amount: requirements.amount,
      feeLimit,
      expiration,
    });

    // Build authorization metadata
    const authorization: TronAuthorization = {
      from: this.signer.address,
      to: requirements.payTo,
      contractAddress: requirements.asset,
      amount: requirements.amount,
      expiration,
      refBlockBytes: blockInfo.refBlockBytes,
      refBlockHash: blockInfo.refBlockHash,
      timestamp: Date.now(),
    };

    // Create the payload
    const payload: ExactTronPayload = {
      signedTransaction,
      authorization,
    };

    // Mark network as used
    void network;

    return {
      t402Version,
      payload,
    };
  }
}
