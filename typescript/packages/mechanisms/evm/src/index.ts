/**
 * @module @t402/evm - t402 Payment Protocol EVM Implementation
 *
 * This module provides the EVM-specific implementation of the t402 payment protocol.
 * Supports USDT0, USDC, and other EIP-3009 compatible tokens.
 *
 * Schemes:
 * - exact: EIP-3009 transferWithAuthorization (gasless, recommended)
 * - exact-legacy: approve + transferFrom (legacy tokens like USDT)
 */

// Export EVM implementation modules
export { ExactEvmScheme } from "./exact/index.js";
export type { ExactEvmSchemeConfig } from "./exact/server/scheme.js";

// Export exact-legacy scheme for legacy tokens
export {
  ExactLegacyEvmClientScheme,
  ExactLegacyEvmServerScheme,
  ExactLegacyEvmFacilitatorScheme,
} from "./exact-legacy/index.js";
export type {
  ExactLegacyEvmServerSchemeConfig,
  ExactLegacyEvmFacilitatorSchemeConfig,
} from "./exact-legacy/index.js";

// Export signer utilities
export { toClientEvmSigner, toFacilitatorEvmSigner } from "./signer.js";
export type { ClientEvmSigner, FacilitatorEvmSigner } from "./signer.js";

// Export token configuration utilities
export {
  // Token addresses
  USDT0_ADDRESSES,
  USDC_ADDRESSES,
  USDT_LEGACY_ADDRESSES,
  // Token registry
  TOKEN_REGISTRY,
  TOKEN_PRIORITY,
  // Utility functions
  getTokenConfig,
  getNetworkTokens,
  getDefaultToken,
  getTokenByAddress,
  supportsEIP3009,
  getNetworksForToken,
  getUsdt0Networks,
  getEIP712Domain,
} from "./tokens.js";

// Export token types
export type { TokenConfig, TokenType, NetworkTokenRegistry } from "./tokens.js";

// Export payload types
export type { ExactEvmPayloadV1, ExactEvmPayloadV2, ExactLegacyPayload } from "./types.js";

// Export constants
export { authorizationTypes, legacyAuthorizationTypes, eip3009ABI, erc20LegacyABI } from "./constants.js";

// Export USDT0 bridge module
export {
  // Bridge client
  Usdt0Bridge,
  createUsdt0Bridge,
  // Bridge constants
  LAYERZERO_ENDPOINT_IDS,
  USDT0_OFT_ADDRESSES,
  LAYERZERO_ENDPOINT_V2,
  getEndpointId,
  getUsdt0OftAddress,
  supportsBridging,
  getBridgeableChains,
  addressToBytes32,
  bytes32ToAddress,
} from "./bridge/index.js";

// Export bridge types
export type {
  BridgeQuoteParams,
  BridgeQuote,
  BridgeExecuteParams,
  BridgeResult,
  BridgeStatus,
  BridgeTransaction,
  BridgeSigner,
} from "./bridge/index.js";
