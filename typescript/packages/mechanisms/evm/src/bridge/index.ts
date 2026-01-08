/**
 * USDT0 Cross-Chain Bridge Module
 *
 * Provides cross-chain USDT0 transfers using LayerZero OFT standard.
 *
 * @example
 * ```typescript
 * import { Usdt0Bridge, getBridgeableChains } from '@t402/evm';
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
 * ```
 */

// Bridge client
export { Usdt0Bridge, createUsdt0Bridge } from "./client.js";

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
} from "./types.js";
