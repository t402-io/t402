/**
 * @t402/polkadot - Polkadot Asset Hub mechanism for T402
 *
 * This package provides support for USDT payments on Polkadot Asset Hub
 * using the exact-direct scheme.
 *
 * @example
 * ```typescript
 * // Client usage
 * import { createExactDirectPolkadotClient } from '@t402/polkadot/exact-direct/client';
 *
 * const client = createExactDirectPolkadotClient({
 *   signer: myPolkadotSigner,
 * });
 *
 * // Server usage
 * import { registerExactDirectPolkadotServer } from '@t402/polkadot/exact-direct/server';
 *
 * registerExactDirectPolkadotServer(server);
 *
 * // Facilitator usage
 * import { createExactDirectPolkadotFacilitator } from '@t402/polkadot/exact-direct/facilitator';
 *
 * const facilitator = createExactDirectPolkadotFacilitator(signer);
 * ```
 */

// Re-export constants
export {
  POLKADOT_CAIP2_NAMESPACE,
  POLKADOT_ASSET_HUB_CAIP2,
  KUSAMA_ASSET_HUB_CAIP2,
  WESTEND_ASSET_HUB_CAIP2,
  SCHEME_EXACT_DIRECT,
  DEFAULT_POLKADOT_INDEXER,
  DEFAULT_KUSAMA_INDEXER,
  DEFAULT_WESTEND_INDEXER,
  DEFAULT_POLKADOT_RPC,
  DEFAULT_KUSAMA_RPC,
  DEFAULT_WESTEND_RPC,
  POLKADOT_NETWORKS,
  getNetworkConfig,
  isPolkadotNetwork,
  type PolkadotNetworkConfig,
} from "./constants.js";

// Re-export token registry
export {
  USDT_POLKADOT,
  USDT_KUSAMA,
  USDT_WESTEND,
  TOKEN_REGISTRY,
  DEFAULT_TOKENS,
  getTokenConfig,
  getDefaultToken,
  getAssetId,
  type TokenConfig,
} from "./tokens.js";

// Re-export types
export type {
  ExactDirectPolkadotPayload,
  PolkadotExtrinsicResult,
  PolkadotEvent,
  ParsedAssetTransfer,
  FacilitatorPolkadotSigner,
  ClientPolkadotSigner,
  PolkadotServerConfig,
  PolkadotFacilitatorConfig,
} from "./types.js";

// Re-export utilities
export {
  isValidAddress,
  isValidExtrinsicHash,
  isValidBlockHash,
  compareAddresses,
  formatAmount,
  parseAmount,
  extractAssetTransfer,
  extractAssetTransferFromEvents,
  buildExtrinsicId,
  parseExtrinsicId,
} from "./utils.js";
