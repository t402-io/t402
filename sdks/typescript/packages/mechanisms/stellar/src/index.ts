/**
 * @module @t402/stellar - t402 Payment Protocol Stellar Implementation
 *
 * This module provides the Stellar-specific implementation of the t402 payment protocol.
 * Supports USDC and other SEP-41 compatible Soroban tokens.
 *
 * Schemes:
 * - exact: Signed Soroban transactions (pre-signed by client)
 */

// Export Stellar exact scheme (client)
export { ExactStellarScheme } from './exact/index.js'

// Export register functions for easy integration
export { registerExactStellarScheme as registerExactStellarClientScheme } from './exact/client/index.js'
export type { StellarClientConfig } from './exact/client/index.js'
export { registerExactStellarScheme as registerExactStellarServerScheme } from './exact/server/index.js'
export type { StellarResourceServerConfig } from './exact/server/index.js'
export { registerExactStellarScheme as registerExactStellarFacilitatorScheme } from './exact/facilitator/index.js'
export type { StellarFacilitatorConfig } from './exact/facilitator/index.js'

// Export signer utilities
export { toClientStellarSigner, toFacilitatorStellarSigner } from './signer.js'
export type {
  ClientStellarSigner,
  FacilitatorStellarSigner,
  BuildTransferParams,
  VerifyTransactionParams,
} from './signer.js'

// Export token configuration utilities
export {
  USDC_ADDRESSES,
  TOKEN_REGISTRY,
  getTokenConfig,
  getNetworkTokens,
  getDefaultToken,
  getTokenByAddress,
  getNetworksForToken,
  getUsdcNetworks,
  isNetworkSupported,
  getSupportedNetworks,
} from './tokens.js'

// Export token types
export type { TokenConfig, NetworkTokenRegistry } from './tokens.js'

// Export payload types
export type {
  ExactStellarPayload,
  VerifyTransactionResult,
  TransactionConfirmation,
  TransactionStatus,
} from './types.js'

// Export constants
export {
  // Network identifiers
  STELLAR_PUBNET_CAIP2,
  STELLAR_TESTNET_CAIP2,
  STELLAR_NETWORKS,
  // Passphrases
  STELLAR_PUBNET_PASSPHRASE,
  STELLAR_TESTNET_PASSPHRASE,
  NETWORK_PASSPHRASES,
  // Endpoints
  STELLAR_PUBNET_HORIZON,
  STELLAR_TESTNET_HORIZON,
  STELLAR_PUBNET_SOROBAN,
  STELLAR_TESTNET_SOROBAN,
  HORIZON_ENDPOINTS,
  SOROBAN_ENDPOINTS,
  // Scheme
  SCHEME_EXACT,
  // Defaults
  DEFAULT_TIMEOUT_SECONDS,
  LEDGER_TIME_SECONDS,
} from './constants.js'

export type { StellarNetwork } from './constants.js'

// Export utility functions
export {
  normalizeNetwork,
  getHorizonEndpoint,
  getSorobanEndpoint,
  isStellarNetwork,
  validateGAddress,
  validateCAddress,
  validateStellarAddress,
  convertToTokenAmount,
  convertFromTokenAmount,
  calculateMaxLedger,
} from './utils.js'
