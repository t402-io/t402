/**
 * Aptos Exact-Direct Client Scheme
 *
 * The client executes the FA transfer directly and provides
 * the transaction hash as proof of payment.
 */

import type {
  SchemeNetworkClient,
  PaymentPayload,
  PaymentRequirements,
} from "@t402/core/types";
import { SCHEME_EXACT_DIRECT, APTOS_CAIP2_NAMESPACE } from "../../constants.js";
import type { ClientAptosSigner, ExactDirectAptosPayload } from "../../types.js";
import { getTokenConfig } from "../../tokens.js";
import {
  isValidAptosAddress,
  parseAssetIdentifier,
  compareAddresses,
} from "../../utils.js";

/**
 * Configuration for ExactDirectAptosClient
 */
export interface ExactDirectAptosClientConfig {
  /**
   * Whether to verify the transfer was successful before returning
   * @default true
   */
  verifyTransfer?: boolean;
}

/**
 * Aptos Exact-Direct Client
 *
 * Implements the client-side payment flow where the client:
 * 1. Receives payment requirements
 * 2. Executes the FA transfer transaction
 * 3. Returns transaction hash as proof
 */
export class ExactDirectAptosClient implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT_DIRECT;

  constructor(
    private readonly signer: ClientAptosSigner,
    config: ExactDirectAptosClientConfig = {},
  ) {
    // Config reserved for future use (e.g., verifyTransfer option)
    void config;
  }

  /**
   * Create a payment payload by executing the transfer
   */
  async createPaymentPayload(
    t402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    // Validate requirements
    this.validateRequirements(paymentRequirements);

    // Get sender address
    const from = await this.signer.getAddress();

    // Parse asset to get metadata address
    const assetInfo = parseAssetIdentifier(paymentRequirements.asset);
    if (!assetInfo) {
      throw new Error(`Invalid asset identifier: ${paymentRequirements.asset}`);
    }

    // Get amount
    const amount = BigInt(paymentRequirements.amount);

    // Check balance
    const balance = await this.signer.getBalance(assetInfo.metadataAddress);
    if (balance < amount) {
      throw new Error(
        `Insufficient balance: have ${balance}, need ${amount}`,
      );
    }

    // Execute transfer
    const txHash = await this.signer.transfer(
      paymentRequirements.payTo,
      assetInfo.metadataAddress,
      amount,
    );

    // Create payload
    const payload: ExactDirectAptosPayload = {
      txHash,
      from,
      to: paymentRequirements.payTo,
      amount: paymentRequirements.amount,
      metadataAddress: assetInfo.metadataAddress,
    };

    return {
      t402Version,
      payload,
    };
  }

  /**
   * Validate payment requirements
   */
  private validateRequirements(requirements: PaymentRequirements): void {
    // Check scheme
    if (requirements.scheme !== SCHEME_EXACT_DIRECT) {
      throw new Error(
        `Invalid scheme: expected ${SCHEME_EXACT_DIRECT}, got ${requirements.scheme}`,
      );
    }

    // Check network
    if (!requirements.network.startsWith(`${APTOS_CAIP2_NAMESPACE}:`)) {
      throw new Error(`Invalid network: ${requirements.network}`);
    }

    // Check payTo address
    if (!isValidAptosAddress(requirements.payTo)) {
      throw new Error(`Invalid payTo address: ${requirements.payTo}`);
    }

    // Check amount
    const amount = BigInt(requirements.amount);
    if (amount <= 0n) {
      throw new Error(`Invalid amount: ${requirements.amount}`);
    }

    // Check asset
    const assetInfo = parseAssetIdentifier(requirements.asset);
    if (!assetInfo) {
      throw new Error(`Invalid asset: ${requirements.asset}`);
    }

    // Verify token is supported
    const tokenConfig = getTokenConfig(requirements.network, "USDT");
    if (tokenConfig && !compareAddresses(tokenConfig.metadataAddress, assetInfo.metadataAddress)) {
      // Allow any valid FA, but log warning for unknown tokens
      console.warn(
        `Using non-standard token: ${assetInfo.metadataAddress}`,
      );
    }
  }
}

export default ExactDirectAptosClient;
