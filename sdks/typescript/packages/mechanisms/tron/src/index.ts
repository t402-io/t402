/**
 * @t402/tron - TRON blockchain support for t402 protocol
 *
 * This package provides TRC-20 token payment support for the t402 protocol,
 * enabling micropayments on the TRON network.
 *
 * @packageDocumentation
 */

// Constants
export {
  TRON_MAINNET_CAIP2,
  TRON_NILE_CAIP2,
  TRON_SHASTA_CAIP2,
  TRON_NETWORKS,
  SCHEME_EXACT,
  TRC20_TRANSFER_SELECTOR,
  TRC20_APPROVE_SELECTOR,
  TRC20_BALANCE_OF_SELECTOR,
  USDT_ADDRESSES,
  NETWORK_ENDPOINTS,
  DEFAULT_USDT_DECIMALS,
  DEFAULT_TRX_DECIMALS,
  MIN_VALIDITY_BUFFER,
  DEFAULT_VALIDITY_DURATION,
  DEFAULT_FEE_LIMIT,
  MIN_FEE_LIMIT,
  MAX_FEE_LIMIT,
  SUN_PER_TRX,
  TRON_ADDRESS_PREFIX,
  TRON_ADDRESS_LENGTH,
  TRON_ADDRESS_HEX_PREFIX,
} from "./constants.js";

// Types from constants
export type { TronNetwork } from "./constants.js";

// Types
export type {
  TronAuthorization,
  ExactTronPayload,
  ExactTronPayloadV2,
  VerifyMessageResult,
  TransactionConfirmation,
  TRC20Config,
  NetworkTRC20Registry,
} from "./types.js";

// Signer interfaces
export type {
  ClientTronSigner,
  FacilitatorTronSigner,
} from "./signer.js";

// Token registry
export {
  TRC20_REGISTRY,
  getDefaultToken,
  getTRC20Config,
  getTokenByAddress,
  getNetworkTokens,
  getNetworksForToken,
  getUsdtNetworks,
  isNetworkSupported,
  getSupportedNetworks,
} from "./tokens.js";

// Utilities
export {
  normalizeNetwork,
  getEndpoint,
  isTronNetwork,
  validateTronAddress,
  addressesEqual,
  formatAddress,
  convertToSmallestUnits,
  convertFromSmallestUnits,
  generatePaymentReference,
  calculateExpiration,
  isValidHex,
  estimateTransactionFee,
} from "./utils.js";

// Exact scheme exports (for convenience)
export * from "./exact/index.js";
