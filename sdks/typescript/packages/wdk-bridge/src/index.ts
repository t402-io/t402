/**
 * @t402/wdk-bridge
 *
 * Cross-chain USDT0 bridging with automatic source chain selection
 * for Tether WDK accounts using LayerZero OFT.
 *
 * @example
 * ```typescript
 * import { WdkBridgeClient } from '@t402/wdk-bridge';
 *
 * const bridge = new WdkBridgeClient({
 *   accounts: {
 *     ethereum: ethereumAccount,
 *     arbitrum: arbitrumAccount,
 *   },
 *   defaultStrategy: 'cheapest',
 * });
 *
 * // Get multi-chain balance summary
 * const summary = await bridge.getBalances();
 * console.log('Total USDT0:', summary.totalUsdt0);
 *
 * // Auto-bridge with best route selection
 * const result = await bridge.autoBridge({
 *   toChain: 'ethereum',
 *   amount: 100_000000n, // 100 USDT0
 *   recipient: '0x...',
 * });
 *
 * // Wait for delivery confirmation
 * const delivery = await result.waitForDelivery({
 *   onStatusChange: (status) => console.log('Status:', status),
 * });
 * ```
 *
 * @packageDocumentation
 */

// Client
export { WdkBridgeClient, createWdkBridgeClient } from "./client.js";

// Signer
export { WdkBridgeSigner, createWdkBridgeSigner } from "./signer.js";

// Constants
export {
  BRIDGE_CHAINS,
  type BridgeChain,
  CHAIN_IDS,
  USDT0_ADDRESSES,
  LAYERZERO_ENDPOINT_IDS,
  ESTIMATED_BRIDGE_TIMES,
  DEFAULT_BRIDGE_TIME,
  MIN_BRIDGE_AMOUNT,
  DEFAULT_SLIPPAGE,
  supportsBridging,
  getUsdt0Address,
  getChainId,
  getChainName,
  getEstimatedBridgeTime,
  getBridgeableChains,
  getDestinationChains,
} from "./constants.js";

// Types
export type {
  WdkAccount,
  ChainBalance,
  BridgeRoute,
  AutoBridgeParams,
  WdkBridgeResult,
  WaitOptions,
  DeliveryResult,
  BridgeDeliveryStatus,
  RouteStrategy,
  WdkBridgeClientConfig,
  BalanceSummary,
} from "./types.js";

// Re-export LayerZero Scan client from @t402/evm for convenience
export { LayerZeroScanClient, createLayerZeroScanClient } from "@t402/evm";
