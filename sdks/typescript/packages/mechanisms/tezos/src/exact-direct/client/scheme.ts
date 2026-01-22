/**
 * Tezos Exact-Direct Client Scheme
 *
 * The client executes the FA2 transfer directly and provides
 * the operation hash as proof of payment.
 */

import type {
  SchemeNetworkClient,
  PaymentPayload,
  PaymentRequirements,
} from "@t402/core/types";
import { SCHEME_EXACT_DIRECT, TEZOS_CAIP2_NAMESPACE } from "../../constants.js";
import type { TezosSigner, ExactDirectTezosPayload } from "../../types.js";
import { isValidTezosAddress } from "../../types.js";
import { getTokenBySymbol } from "../../tokens.js";
import { compareAddresses } from "../../utils.js";

/**
 * Configuration for ExactDirectTezosClient
 */
export interface ExactDirectTezosClientConfig {
  /**
   * Whether to verify the operation was successful before returning
   * @default true
   */
  verifyOperation?: boolean;
}

/**
 * Tezos Exact-Direct Client
 *
 * Implements the client-side payment flow where the client:
 * 1. Receives payment requirements
 * 2. Executes the FA2 transfer operation
 * 3. Returns operation hash as proof
 */
export class ExactDirectTezosClient implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT_DIRECT;

  constructor(
    private readonly signer: TezosSigner,
    config: ExactDirectTezosClientConfig = {},
  ) {
    // Config reserved for future use
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

    // Parse asset to get contract address and token ID
    const assetInfo = this.parseAssetIdentifier(paymentRequirements.asset);
    if (!assetInfo) {
      throw new Error(`Invalid asset identifier: ${paymentRequirements.asset}`);
    }

    // Get amount
    const amount = BigInt(paymentRequirements.amount);

    // Check balance
    const balance = await this.signer.getBalance(
      assetInfo.contractAddress,
      assetInfo.tokenId,
    );
    if (balance < amount) {
      throw new Error(
        `Insufficient balance: have ${balance}, need ${amount}`,
      );
    }

    // Execute transfer
    const opHash = await this.signer.transfer(
      assetInfo.contractAddress,
      assetInfo.tokenId,
      paymentRequirements.payTo,
      amount,
    );

    // Create payload
    const payload: ExactDirectTezosPayload = {
      opHash,
      from,
      to: paymentRequirements.payTo,
      amount: paymentRequirements.amount,
      contractAddress: assetInfo.contractAddress,
      tokenId: assetInfo.tokenId,
    };

    return {
      t402Version,
      payload,
    };
  }

  /**
   * Parse CAIP-19 asset identifier for Tezos FA2
   * Format: tezos:{chainRef}/fa2:{contractAddress}/{tokenId}
   */
  private parseAssetIdentifier(
    asset: string,
  ): { contractAddress: string; tokenId: number } | null {
    // Try parsing CAIP-19 format
    const caipMatch = asset.match(/^tezos:[^/]+\/fa2:([^/]+)\/(\d+)$/);
    if (caipMatch) {
      return {
        contractAddress: caipMatch[1],
        tokenId: parseInt(caipMatch[2], 10),
      };
    }

    // Try simple format: contractAddress/tokenId or just contractAddress (default tokenId 0)
    const simpleMatch = asset.match(/^(KT1[a-zA-Z0-9]+)(?:\/(\d+))?$/);
    if (simpleMatch) {
      return {
        contractAddress: simpleMatch[1],
        tokenId: simpleMatch[2] ? parseInt(simpleMatch[2], 10) : 0,
      };
    }

    return null;
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
    if (!requirements.network.startsWith(`${TEZOS_CAIP2_NAMESPACE}:`)) {
      throw new Error(`Invalid network: ${requirements.network}`);
    }

    // Check payTo address
    if (!isValidTezosAddress(requirements.payTo)) {
      throw new Error(`Invalid payTo address: ${requirements.payTo}`);
    }

    // Check amount
    const amount = BigInt(requirements.amount);
    if (amount <= 0n) {
      throw new Error(`Invalid amount: ${requirements.amount}`);
    }

    // Check asset
    const assetInfo = this.parseAssetIdentifier(requirements.asset);
    if (!assetInfo) {
      throw new Error(`Invalid asset: ${requirements.asset}`);
    }

    // Verify token is supported (warn for unknown tokens)
    const tokenConfig = getTokenBySymbol(requirements.network, "USDt");
    if (tokenConfig && !compareAddresses(tokenConfig.contractAddress, assetInfo.contractAddress)) {
      console.warn(
        `Using non-standard token: ${assetInfo.contractAddress}`,
      );
    }
  }
}

export default ExactDirectTezosClient;
