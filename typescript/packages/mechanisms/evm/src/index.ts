/**
 * @module @t402/evm - t402 Payment Protocol EVM Implementation
 *
 * This module provides the EVM-specific implementation of the t402 payment protocol.
 * Supports USDT0, USDC, and other EIP-3009 compatible tokens.
 *
 * Schemes:
 * - exact: EIP-3009 transferWithAuthorization (gasless, recommended)
 * - exact-legacy: approve + transferFrom (legacy tokens like USDT)
 * - upto: EIP-2612 permit for usage-based billing (DRAFT)
 *
 * For types-only usage without viem, use @t402/evm-core instead.
 */

// Re-export everything from @t402/evm-core
// This allows users to get all types from @t402/evm while @t402/evm-core
// provides the same types without bundling viem
export * from "@t402/evm-core";

// Export EVM implementation modules (viem-dependent)
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

// Export Up-To scheme (DRAFT)
export { UptoEvmScheme, createUptoEvmScheme } from "./upto/index.js";

// Export USDT0 bridge module
export {
  // Bridge client
  Usdt0Bridge,
  createUsdt0Bridge,
  // LayerZero Scan client
  LayerZeroScanClient,
  createLayerZeroScanClient,
  LAYERZERO_SCAN_BASE_URL,
  // Cross-chain payment router
  CrossChainPaymentRouter,
  createCrossChainPaymentRouter,
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
  TransactionReceipt,
  TransactionLog,
  // LayerZero Scan types
  LayerZeroMessage,
  LayerZeroMessageStatus,
  WaitForDeliveryOptions,
  // Cross-chain payment types
  CrossChainPaymentParams,
  CrossChainPaymentResult,
} from "./bridge/index.js";

// Export ERC-4337 Account Abstraction module
export {
  // Builder
  UserOpBuilder,
  createUserOpBuilder,
  // Bundler
  BundlerClient,
  BundlerError,
  createBundlerClient,
  // Paymaster
  PaymasterClient,
  createPaymasterClient,
  encodePaymasterAndData,
  decodePaymasterAndData,
  // T402 Integration
  GaslessT402Client,
  createGaslessT402Client,
  // Constants
  ENTRYPOINT_V07_ADDRESS,
  ENTRYPOINT_V06_ADDRESS,
  DEFAULT_GAS_LIMITS,
  ENTRYPOINT_V07_ABI,
  ACCOUNT_ABI,
  BUNDLER_METHODS,
  PaymasterType,
  packAccountGasLimits,
  unpackAccountGasLimits,
  packGasFees,
  unpackGasFees,
} from "./erc4337/index.js";

// Export ERC-4337 types
export type {
  UserOperation,
  PackedUserOperation,
  PaymasterData,
  GasEstimate,
  UserOperationReceipt,
  UserOperationResult,
  BundlerConfig,
  PaymasterConfig,
  SmartAccountSigner,
  UserOpBuilderConfig,
  TransactionIntent,
  UserOpBuilderOptions,
  PaymasterResponse,
  SponsorRequest,
  GaslessPaymentParams,
  GaslessClientConfig,
} from "./erc4337/index.js";
