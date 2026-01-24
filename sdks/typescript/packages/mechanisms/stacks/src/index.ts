/**
 * @t402/stacks - Stacks mechanism for T402
 *
 * This package provides support for SIP-010 token payments on Stacks (Bitcoin L2)
 * using the exact-direct scheme.
 *
 * @example
 * ```typescript
 * // Client usage
 * import { createExactDirectStacksClient } from '@t402/stacks/exact-direct/client';
 *
 * const client = createExactDirectStacksClient({
 *   signer: myStacksSigner,
 * });
 *
 * // Server usage
 * import { registerExactDirectStacksServer } from '@t402/stacks/exact-direct/server';
 *
 * registerExactDirectStacksServer(server);
 *
 * // Facilitator usage
 * import { createExactDirectStacksFacilitator } from '@t402/stacks/exact-direct/facilitator';
 *
 * const facilitator = createExactDirectStacksFacilitator(signer);
 * ```
 */

// Re-export constants
export {
  STACKS_CAIP2_NAMESPACE,
  STACKS_MAINNET_CAIP2,
  STACKS_TESTNET_CAIP2,
  SCHEME_EXACT_DIRECT,
  DEFAULT_MAINNET_API,
  DEFAULT_TESTNET_API,
  STACKS_NETWORKS,
  getNetworkConfig,
  isStacksNetwork,
  type StacksNetworkConfig,
} from "./constants.js";

// Re-export token registry
export {
  SUSDC_MAINNET,
  SUSDC_TESTNET,
  TOKEN_REGISTRY,
  DEFAULT_TOKENS,
  getTokenConfig,
  getDefaultToken,
  getContractAddress,
  type TokenConfig,
} from "./tokens.js";

// Re-export types
export type {
  ExactDirectStacksPayload,
  StacksTransactionResult,
  StacksContractCall,
  StacksFunctionArg,
  StacksPostCondition,
  StacksEvent,
  ParsedTokenTransfer,
  FacilitatorStacksSigner,
  ClientStacksSigner,
  StacksServerConfig,
  StacksFacilitatorConfig,
} from "./types.js";

// Re-export utilities
export {
  isValidPrincipal,
  isValidTxId,
  comparePrincipals,
  formatAmount,
  parseAmount,
  extractTokenTransfer,
  extractTokenTransferFromPostConditions,
} from "./utils.js";
