/**
 * USDT0 Cross-Chain Bridge Module
 *
 * Provides cross-chain USDT0 transfers using LayerZero OFT standard,
 * with message tracking via LayerZero Scan API.
 *
 * @example
 * ```typescript
 * import {
 *   Usdt0Bridge,
 *   LayerZeroScanClient,
 *   CrossChainPaymentRouter,
 *   getBridgeableChains,
 * } from '@t402/evm';
 *
 * // Check supported chains
 * console.log(getBridgeableChains()); // ['ethereum', 'arbitrum', 'ink', ...]
 *
 * // Create bridge client
 * const bridge = new Usdt0Bridge(signer, 'arbitrum');
 *
 * // Get quote
 * const quote = await bridge.quote({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n,
 *   recipient: '0x...',
 * });
 *
 * console.log(`Fee: ${quote.nativeFee} wei`);
 *
 * // Execute bridge
 * const result = await bridge.send({
 *   fromChain: 'arbitrum',
 *   toChain: 'ethereum',
 *   amount: 100_000000n,
 *   recipient: '0x...',
 * });
 *
 * console.log(`Bridge tx: ${result.txHash}`);
 * console.log(`Message GUID: ${result.messageGuid}`);
 *
 * // Track message delivery
 * const scanClient = new LayerZeroScanClient();
 * const message = await scanClient.waitForDelivery(result.messageGuid, {
 *   onStatusChange: (status) => console.log(`Status: ${status}`),
 * });
 * console.log(`Delivered! Dest TX: ${message.dstTxHash}`);
 * ```
 */

// Bridge client
export { Usdt0Bridge, createUsdt0Bridge } from "./client.js";

// LayerZero Scan client
export {
  LayerZeroScanClient,
  createLayerZeroScanClient,
  LAYERZERO_SCAN_BASE_URL,
} from "./scan.js";

// Cross-chain payment router
export {
  CrossChainPaymentRouter,
  createCrossChainPaymentRouter,
} from "./router.js";

// Constants
export {
  LAYERZERO_ENDPOINT_IDS,
  USDT0_OFT_ADDRESSES,
  LAYERZERO_ENDPOINT_V2,
  NETWORK_TO_CHAIN,
  CHAIN_TO_NETWORK,
  getEndpointId,
  getEndpointIdFromNetwork,
  getUsdt0OftAddress,
  supportsBridging,
  getBridgeableChains,
  addressToBytes32,
  bytes32ToAddress,
} from "./constants.js";

// Types
export type {
  // Bridge types
  BridgeQuoteParams,
  BridgeQuote,
  BridgeExecuteParams,
  BridgeResult,
  BridgeStatus,
  BridgeTransaction,
  BridgeSigner,
  SendParam,
  MessagingFee,
  OftReceipt,
  MessageReceipt,
  TransactionLog,
  TransactionReceipt,
  // LayerZero Scan types
  LayerZeroMessage,
  LayerZeroMessageStatus,
  WaitForDeliveryOptions,
  // Cross-chain payment types
  CrossChainPaymentParams,
  CrossChainPaymentResult,
} from "./types.js";
