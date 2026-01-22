/**
 * Polkadot Exact-Direct Client Scheme
 *
 * In the exact-direct scheme, the client executes the asset transfer directly
 * and provides the extrinsic hash as proof of payment.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@t402/core/types";
import type { ClientPolkadotSigner, ExactDirectPolkadotPayload } from "../../types.js";
import { SCHEME_EXACT_DIRECT, POLKADOT_CAIP2_NAMESPACE } from "../../constants.js";
import { getAssetId } from "../../tokens.js";
import { isValidAddress } from "../../utils.js";

/**
 * Configuration for the exact-direct client
 */
export interface ExactDirectPolkadotClientConfig {
  /** Signer for executing transactions */
  signer: ClientPolkadotSigner;
}

/**
 * Exact-direct client scheme for Polkadot Asset Hub
 */
export class ExactDirectPolkadotClient implements SchemeNetworkClient {
  readonly scheme = SCHEME_EXACT_DIRECT;
  private readonly signer: ClientPolkadotSigner;

  constructor(config: ExactDirectPolkadotClientConfig) {
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

    // Get asset ID from extra or use default USDT
    const symbol = (extra?.assetSymbol as string) || "USDT";
    const assetId = (extra?.assetId as number) ?? getAssetId(network, symbol);

    if (assetId === undefined) {
      throw new Error(`Unknown asset ${symbol} on network ${network}`);
    }

    // Get sender address
    const from = await this.signer.getAddress();

    // Execute the transfer
    const { extrinsicHash, blockHash, extrinsicIndex } =
      await this.signer.transferAsset(assetId, payTo, amount);

    // Build the payload
    const polkadotPayload: ExactDirectPolkadotPayload = {
      extrinsicHash,
      blockHash,
      extrinsicIndex,
      from,
      to: payTo,
      amount,
      assetId,
    };

    return {
      t402Version,
      payload: polkadotPayload,
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
    if (!requirements.network.startsWith(`${POLKADOT_CAIP2_NAMESPACE}:`)) {
      throw new Error(`Invalid network: ${requirements.network}`);
    }

    // Check payTo address
    if (!isValidAddress(requirements.payTo)) {
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
 * Create an exact-direct client for Polkadot
 */
export function createExactDirectPolkadotClient(
  config: ExactDirectPolkadotClientConfig,
): ExactDirectPolkadotClient {
  return new ExactDirectPolkadotClient(config);
}
