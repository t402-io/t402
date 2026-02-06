/**
 * Cosmos Network Constants
 *
 * This module provides constants for Cosmos blockchain integration including:
 * - CAIP-2 network identifiers (Noble chain)
 * - RPC and REST endpoints
 * - Bech32 prefix configuration
 * - USDC denomination and gas parameters
 */

/**
 * CAIP-2 Network Identifiers for Cosmos (Noble)
 */
export const NOBLE_MAINNET_CAIP2 = "cosmos:noble-1";
export const NOBLE_TESTNET_CAIP2 = "cosmos:grand-1";

/**
 * Supported Cosmos networks
 */
export const COSMOS_NETWORKS = [NOBLE_MAINNET_CAIP2, NOBLE_TESTNET_CAIP2] as const;

export type CosmosNetwork = (typeof COSMOS_NETWORKS)[number];

/**
 * Default RPC endpoints
 */
export const NOBLE_MAINNET_RPC = "https://noble-rpc.polkachu.com";
export const NOBLE_TESTNET_RPC = "https://rpc.testnet.noble.strange.love";

/**
 * Default REST endpoints
 */
export const NOBLE_MAINNET_REST = "https://noble-api.polkachu.com";
export const NOBLE_TESTNET_REST = "https://api.testnet.noble.strange.love";

/**
 * Network RPC endpoint mapping
 */
export const NETWORK_RPC_ENDPOINTS: Record<string, string> = {
  [NOBLE_MAINNET_CAIP2]: NOBLE_MAINNET_RPC,
  [NOBLE_TESTNET_CAIP2]: NOBLE_TESTNET_RPC,
};

/**
 * Network REST endpoint mapping
 */
export const NETWORK_REST_ENDPOINTS: Record<string, string> = {
  [NOBLE_MAINNET_CAIP2]: NOBLE_MAINNET_REST,
  [NOBLE_TESTNET_CAIP2]: NOBLE_TESTNET_REST,
};

/**
 * Bech32 prefix for Noble addresses
 */
export const NOBLE_BECH32_PREFIX = "noble";

/**
 * USDC denomination on Noble
 * uusdc = micro-USDC (1 USDC = 1,000,000 uusdc)
 */
export const USDC_DENOM = "uusdc";

/**
 * Default gas parameters
 */
export const DEFAULT_GAS_LIMIT = 200000;
export const DEFAULT_GAS_PRICE = "0.025uusdc";
export const DEFAULT_FEE_AMOUNT = "5000"; // 0.005 USDC

/**
 * Cosmos message type for bank send
 */
export const MSG_TYPE_SEND = "/cosmos.bank.v1beta1.MsgSend";

/**
 * Scheme identifier for exact-direct payments
 */
export const SCHEME_EXACT_DIRECT = "exact-direct";

/**
 * Maximum transaction age to accept (in milliseconds)
 */
export const MAX_TRANSACTION_AGE = 5 * 60 * 1000; // 5 minutes

/**
 * CAIP-2 namespace for Cosmos
 */
export const COSMOS_CAIP2_NAMESPACE = "cosmos";
