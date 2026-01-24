/**
 * Stacks Exact-Direct Client Scheme
 *
 * In the exact-direct scheme, the client executes the SIP-010 token transfer
 * directly and provides the transaction ID as proof of payment.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@t402/core/types";
import type { ClientStacksSigner, ExactDirectStacksPayload } from "../../types.js";
import { SCHEME_EXACT_DIRECT, STACKS_CAIP2_NAMESPACE } from "../../constants.js";
import { getContractAddress } from "../../tokens.js";
import { isValidPrincipal } from "../../utils.js";

/**
 * Configuration for the exact-direct client
 */
export interface ExactDirectStacksClientConfig {
  /** Signer for executing transactions */
  signer: ClientStacksSigner;
}

/**
 * Exact-direct client scheme for Stacks
 */
export class ExactDirectStacksClient implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT_DIRECT;
  private readonly signer: ClientStacksSigner;

  constructor(config: ExactDirectStacksClientConfig) {
    this.signer = config.signer;
  }

  /**
   * Create a payment payload by executing the transfer
   */
  async createPaymentPayload(
    t402Version: number,
    requirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    // Validate requirements
    this.validateRequirements(requirements);

    const { network, amount, payTo, extra } = requirements;

    // Get contract address from extra or use default sUSDC
    const symbol = (extra?.assetSymbol as string) || "sUSDC";
    const contractAddress =
      (extra?.contractAddress as string) ?? getContractAddress(network, symbol);

    if (!contractAddress) {
      throw new Error(`Unknown asset ${symbol} on network ${network}`);
    }

    // Get sender address
    const from = await this.signer.getAddress();

    // Execute the transfer
    const { txId } = await this.signer.transferToken(contractAddress, payTo, amount);

    // Build the payload
    const stacksPayload: ExactDirectStacksPayload = {
      txId,
      from,
      to: payTo,
      amount,
      contractAddress,
    };

    return {
      t402Version,
      payload: stacksPayload,
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
    if (!requirements.network.startsWith(`${STACKS_CAIP2_NAMESPACE}:`)) {
      throw new Error(`Invalid network: ${requirements.network}`);
    }

    // Check payTo address
    if (!isValidPrincipal(requirements.payTo)) {
      throw new Error(`Invalid payTo address: ${requirements.payTo}`);
    }

    // Check amount
    const amount = BigInt(requirements.amount);
    if (amount <= 0n) {
      throw new Error(`Invalid amount: ${requirements.amount}`);
    }
  }
}

/**
 * Create an exact-direct client for Stacks
 */
export function createExactDirectStacksClient(
  config: ExactDirectStacksClientConfig,
): ExactDirectStacksClient {
  return new ExactDirectStacksClient(config);
}
