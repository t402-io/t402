/**
 * @module @t402/ton - t402 Payment Protocol TON Implementation
 *
 * This module provides the TON-specific implementation of the t402 payment protocol.
 * Supports USDT and other TEP-74 compatible Jettons.
 *
 * Schemes:
 * - exact: Signed Jetton transfer messages (pre-signed by client)
 */

// Export TON exact scheme (client)
export { ExactTonScheme } from "./exact/index.js";

// Export register functions for easy integration
export { registerExactTonScheme as registerExactTonClientScheme } from "./exact/client/index.js";
export type { TonClientConfig } from "./exact/client/index.js";
export { registerExactTonScheme as registerExactTonServerScheme } from "./exact/server/index.js";
export type { TonResourceServerConfig } from "./exact/server/index.js";
export { registerExactTonScheme as registerExactTonFacilitatorScheme } from "./exact/facilitator/index.js";
export type { TonFacilitatorConfig } from "./exact/facilitator/index.js";

// Export signer utilities
export { toClientTonSigner, toFacilitatorTonSigner } from "./signer.js";
export type {
  ClientTonSigner,
  FacilitatorTonSigner,
  SignMessageParams,
  VerifyMessageParams,
  WaitForTransactionParams,
} from "./signer.js";

// Export Jetton token configuration utilities
export {
  // Token addresses
  USDT_ADDRESSES,
  // Token registry
  JETTON_REGISTRY,
  // Utility functions
  getJettonConfig,
  getNetworkJettons,
  getDefaultJetton,
  getJettonByAddress,
  getNetworksForJetton,
  getUsdtNetworks,
  isNetworkSupported,
  getSupportedNetworks,
} from "./tokens.js";

// Export token types
export type { JettonConfig, NetworkJettonRegistry } from "./tokens.js";

// Export payload types
export type {
  ExactTonPayloadV2,
  ExactTonPayload,
  VerifyMessageResult,
  TransactionConfirmation,
} from "./types.js";

// Export constants
export {
  // Network identifiers
  TON_MAINNET_CAIP2,
  TON_TESTNET_CAIP2,
  TON_NETWORKS,
  // Endpoints
  TON_MAINNET_ENDPOINT,
  TON_TESTNET_ENDPOINT,
  TON_MAINNET_V4_ENDPOINT,
  TON_TESTNET_V4_ENDPOINT,
  NETWORK_ENDPOINTS,
  NETWORK_V4_ENDPOINTS,
  // Jetton ops
  JETTON_TRANSFER_OP,
  JETTON_INTERNAL_TRANSFER_OP,
  JETTON_TRANSFER_NOTIFICATION_OP,
  JETTON_BURN_OP,
  // Gas amounts
  DEFAULT_JETTON_TRANSFER_TON,
  DEFAULT_FORWARD_TON,
  MIN_JETTON_TRANSFER_TON,
  MAX_JETTON_TRANSFER_TON,
  // Scheme
  SCHEME_EXACT,
  // Defaults
  DEFAULT_VALIDITY_DURATION,
} from "./constants.js";

export type { TonNetwork } from "./constants.js";

// Export utility functions
export {
  normalizeNetwork,
  getEndpoint,
  isTonNetwork,
  validateTonAddress,
  parseTonAddress,
  addressesEqual,
  formatAddress,
  convertToJettonAmount,
  convertFromJettonAmount,
  generateQueryId,
  buildJettonTransferBody,
  parseJettonTransferBody,
  estimateJettonTransferGas,
} from "./utils.js";
