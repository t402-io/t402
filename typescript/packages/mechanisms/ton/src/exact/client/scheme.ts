/**
 * TON Client Scheme Implementation
 *
 * Creates payment payloads for TON Jetton transfers using the exact scheme.
 * Builds and signs external messages for Jetton wallet interactions.
 */

import { Address, SendMode } from "@ton/core";
import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@t402/core/types";
import type { ClientTonSigner } from "../../signer.js";
import type { ExactTonPayloadV2 } from "../../types.js";
import { SCHEME_EXACT, DEFAULT_JETTON_TRANSFER_TON, DEFAULT_FORWARD_TON } from "../../constants.js";
import {
  generateQueryId,
  buildJettonTransferBody,
  normalizeNetwork,
  parseTonAddress,
} from "../../utils.js";

/**
 * Configuration for ExactTonScheme client
 */
export interface ExactTonSchemeConfig {
  /** Override the TON amount attached for gas (in nanoTON) */
  gasAmount?: bigint;
  /** Override the forward TON amount (in nanoTON) */
  forwardAmount?: bigint;
}

/**
 * TON client implementation for the Exact payment scheme.
 *
 * Creates signed Jetton transfer messages that can be broadcast
 * by a facilitator to complete the payment.
 */
export class ExactTonScheme implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT;

  /**
   * Creates a new ExactTonScheme instance.
   *
   * @param signer - The TON signer for client operations
   * @param getJettonWalletAddress - Function to derive Jetton wallet address
   * @param config - Optional configuration overrides
   */
  constructor(
    private readonly signer: ClientTonSigner,
    private readonly getJettonWalletAddress: (
      ownerAddress: string,
      jettonMasterAddress: string,
    ) => Promise<string>,
    private readonly config: ExactTonSchemeConfig = {},
  ) {}

  /**
   * Creates a payment payload for the Exact scheme.
   *
   * The payload contains a pre-signed external message that performs
   * a Jetton transfer from the client to the recipient.
   *
   * @param t402Version - The t402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    // Normalize and validate network
    const network = normalizeNetwork(paymentRequirements.network);

    // Validate required fields
    if (!paymentRequirements.asset) {
      throw new Error("Asset (Jetton master address) is required");
    }
    if (!paymentRequirements.payTo) {
      throw new Error("PayTo address is required");
    }
    if (!paymentRequirements.amount) {
      throw new Error("Amount is required");
    }

    // Parse addresses
    const jettonMasterAddress = paymentRequirements.asset;
    const destinationAddress = parseTonAddress(paymentRequirements.payTo);

    // Get client's Jetton wallet address
    const senderJettonWalletAddress = await this.getJettonWalletAddress(
      this.signer.address.toString(),
      jettonMasterAddress,
    );
    const senderJettonWallet = Address.parse(senderJettonWalletAddress);

    // Get current seqno for replay protection
    const seqno = await this.signer.getSeqno();

    // Calculate validity period
    const now = Math.floor(Date.now() / 1000);
    const validUntil = now + paymentRequirements.maxTimeoutSeconds;

    // Generate unique query ID
    const queryId = generateQueryId();

    // Parse amount
    const jettonAmount = BigInt(paymentRequirements.amount);

    // Build Jetton transfer body
    const jettonTransferBody = buildJettonTransferBody({
      queryId,
      amount: jettonAmount,
      destination: destinationAddress,
      responseDestination: this.signer.address,
      forwardAmount: this.config.forwardAmount ?? DEFAULT_FORWARD_TON,
    });

    // Gas amount for the transfer
    const tonAmount = this.config.gasAmount ?? DEFAULT_JETTON_TRANSFER_TON;

    // Sign the message
    const signedMessage = await this.signer.signMessage({
      to: senderJettonWallet,
      value: tonAmount,
      body: jettonTransferBody,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      timeout: paymentRequirements.maxTimeoutSeconds,
    });

    // Encode to base64
    const signedBoc = signedMessage.toBoc().toString("base64");

    // Build authorization metadata
    const authorization: ExactTonPayloadV2["authorization"] = {
      from: this.signer.address.toString({ bounceable: true }),
      to: paymentRequirements.payTo,
      jettonMaster: jettonMasterAddress,
      jettonAmount: jettonAmount.toString(),
      tonAmount: tonAmount.toString(),
      validUntil,
      seqno,
      queryId: queryId.toString(),
    };

    // Create payload
    const payload: ExactTonPayloadV2 = {
      signedBoc,
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
