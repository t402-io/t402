/**
 * Cross-Chain Payment Router
 *
 * Enables payments on a destination chain using funds from a source chain.
 * Uses USDT0 bridge via LayerZero for cross-chain transfers.
 *
 * @example
 * ```typescript
 * import { CrossChainPaymentRouter } from '@t402/evm';
 *
 * const router = new CrossChainPaymentRouter(signer, 'arbitrum');
 *
 * // Route payment from Arbitrum to Ethereum
 * const result = await router.routePayment({
 *   sourceChain: 'arbitrum',
 *   destinationChain: 'ethereum',
 *   amount: 100_000000n, // 100 USDT0
 *   payTo: recipientAddress,
 *   payer: userAddress,
 * });
 *
 * // Track delivery
 * const message = await router.trackMessage(result.messageGuid);
 * ```
 */

import { Usdt0Bridge } from "./client.js";
import { LayerZeroScanClient } from "./scan.js";
import { getBridgeableChains, supportsBridging } from "./constants.js";
import type {
  BridgeSigner,
  CrossChainPaymentParams,
  CrossChainPaymentResult,
  LayerZeroMessage,
  WaitForDeliveryOptions,
} from "./types.js";

/**
 * Cross-Chain Payment Router
 *
 * Routes payments across chains using USDT0 bridge.
 * Handles fee estimation, bridge execution, and delivery tracking.
 */
export class CrossChainPaymentRouter {
  private readonly bridge: Usdt0Bridge;
  private readonly scanClient: LayerZeroScanClient;
  private readonly sourceChain: string;

  /**
   * Create a cross-chain payment router
   *
   * @param signer - Wallet signer for bridge operations
   * @param sourceChain - Chain where user's funds are located
   */
  constructor(signer: BridgeSigner, sourceChain: string) {
    this.bridge = new Usdt0Bridge(signer, sourceChain);
    this.scanClient = new LayerZeroScanClient();
    this.sourceChain = sourceChain;
  }

  /**
   * Route payment across chains
   *
   * This method:
   * 1. Bridges USDT0 from source chain to destination chain
   * 2. Sends funds to the payer's address on destination chain
   * 3. Returns tracking info for monitoring delivery
   *
   * After delivery, the payer can use the bridged funds to pay on the destination chain.
   *
   * @param params - Payment routing parameters
   * @returns Result with transaction hash and tracking info
   */
  async routePayment(
    params: CrossChainPaymentParams,
  ): Promise<CrossChainPaymentResult> {
    // Validate parameters
    this.validateParams(params);

    // Execute bridge transaction
    const result = await this.bridge.send({
      fromChain: params.sourceChain,
      toChain: params.destinationChain,
      amount: params.amount,
      recipient: params.payer,
      slippageTolerance: params.slippageTolerance,
    });

    return {
      bridgeTxHash: result.txHash,
      messageGuid: result.messageGuid,
      amountBridged: result.amountSent,
      estimatedReceiveAmount: result.amountToReceive,
      sourceChain: params.sourceChain,
      destinationChain: params.destinationChain,
      estimatedDeliveryTime: result.estimatedTime,
    };
  }

  /**
   * Get estimated fees for routing a payment
   *
   * @param params - Payment parameters
   * @returns Quote with native fee and estimated receive amount
   */
  async estimateFees(params: CrossChainPaymentParams): Promise<{
    nativeFee: bigint;
    estimatedReceiveAmount: bigint;
    estimatedTime: number;
  }> {
    const quote = await this.bridge.quote({
      fromChain: params.sourceChain,
      toChain: params.destinationChain,
      amount: params.amount,
      recipient: params.payer,
    });

    return {
      nativeFee: quote.nativeFee,
      estimatedReceiveAmount: quote.minAmountToReceive,
      estimatedTime: quote.estimatedTime,
    };
  }

  /**
   * Track message delivery status
   *
   * @param messageGuid - LayerZero message GUID from routePayment result
   * @returns Current message status
   */
  async trackMessage(messageGuid: string): Promise<LayerZeroMessage> {
    return this.scanClient.getMessage(messageGuid);
  }

  /**
   * Wait for payment to be delivered on destination chain
   *
   * @param messageGuid - LayerZero message GUID from routePayment result
   * @param options - Wait options (timeout, poll interval, callbacks)
   * @returns Final message state when delivered
   */
  async waitForDelivery(
    messageGuid: string,
    options?: WaitForDeliveryOptions,
  ): Promise<LayerZeroMessage> {
    return this.scanClient.waitForDelivery(messageGuid, options);
  }

  /**
   * Check if routing between two chains is supported
   *
   * @param sourceChain - Source chain name
   * @param destinationChain - Destination chain name
   * @returns True if routing is supported
   */
  canRoute(sourceChain: string, destinationChain: string): boolean {
    return (
      sourceChain !== destinationChain &&
      supportsBridging(sourceChain) &&
      supportsBridging(destinationChain)
    );
  }

  /**
   * Get all supported destination chains from source chain
   */
  getSupportedDestinations(): string[] {
    return this.bridge.getSupportedDestinations();
  }

  /**
   * Get all bridgeable chains
   */
  static getBridgeableChains(): string[] {
    return getBridgeableChains();
  }

  /**
   * Validate routing parameters
   */
  private validateParams(params: CrossChainPaymentParams): void {
    if (params.sourceChain !== this.sourceChain) {
      throw new Error(
        `Source chain mismatch: router initialized for "${this.sourceChain}" but got "${params.sourceChain}"`,
      );
    }

    if (!this.canRoute(params.sourceChain, params.destinationChain)) {
      throw new Error(
        `Cannot route payment from "${params.sourceChain}" to "${params.destinationChain}". ` +
          `Supported chains: ${getBridgeableChains().join(", ")}`,
      );
    }

    if (params.amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
  }
}

/**
 * Create a cross-chain payment router
 *
 * @param signer - Wallet signer
 * @param sourceChain - Chain where funds are located
 */
export function createCrossChainPaymentRouter(
  signer: BridgeSigner,
  sourceChain: string,
): CrossChainPaymentRouter {
  return new CrossChainPaymentRouter(signer, sourceChain);
}
