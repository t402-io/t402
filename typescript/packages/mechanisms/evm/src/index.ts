/**
 * @module @t402/evm - t402 Payment Protocol EVM Implementation
 *
 * This module provides the EVM-specific implementation of the t402 payment protocol.
 * Supports USDT0, USDC, and other EIP-3009 compatible tokens.
 */

// Export EVM implementation modules
export { ExactEvmScheme } from "./exact";
export type { ExactEvmSchemeConfig } from "./exact/server/scheme.js";
export { toClientEvmSigner, toFacilitatorEvmSigner } from "./signer";
export type { ClientEvmSigner, FacilitatorEvmSigner } from "./signer";

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
