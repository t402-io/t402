/**
 * TON Network Constants
 *
 * This module provides constants for TON blockchain integration including:
 * - CAIP-2 network identifiers
 * - RPC endpoints
 * - Jetton transfer operation codes
 * - Default gas amounts
 */

/**
 * CAIP-2 Network Identifiers for TON
 * Using simple identifiers for mainnet/testnet
 */
export const TON_MAINNET_CAIP2 = "ton:mainnet";
export const TON_TESTNET_CAIP2 = "ton:testnet";

/**
 * Supported TON networks
 */
export const TON_NETWORKS = [TON_MAINNET_CAIP2, TON_TESTNET_CAIP2] as const;

export type TonNetwork = (typeof TON_NETWORKS)[number];

/**
 * Default RPC endpoints (TonCenter API v2)
 */
export const TON_MAINNET_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
export const TON_TESTNET_ENDPOINT = "https://testnet.toncenter.com/api/v2/jsonRPC";

/**
 * TON API v4 endpoints (for @ton/ton TonClient4)
 */
export const TON_MAINNET_V4_ENDPOINT = "https://mainnet-v4.tonhubapi.com";
export const TON_TESTNET_V4_ENDPOINT = "https://testnet-v4.tonhubapi.com";

/**
 * Network endpoint mapping
 */
export const NETWORK_ENDPOINTS: Record<string, string> = {
  [TON_MAINNET_CAIP2]: TON_MAINNET_ENDPOINT,
  [TON_TESTNET_CAIP2]: TON_TESTNET_ENDPOINT,
};

export const NETWORK_V4_ENDPOINTS: Record<string, string> = {
  [TON_MAINNET_CAIP2]: TON_MAINNET_V4_ENDPOINT,
  [TON_TESTNET_CAIP2]: TON_TESTNET_V4_ENDPOINT,
};

/**
 * Jetton Transfer Operation Codes (TEP-74)
 * @see https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
 */
export const JETTON_TRANSFER_OP = 0x0f8a7ea5; // transfer
export const JETTON_INTERNAL_TRANSFER_OP = 0x178d4519; // internal_transfer
export const JETTON_TRANSFER_NOTIFICATION_OP = 0x7362d09c; // transfer_notification
export const JETTON_BURN_OP = 0x595f07bc; // burn

/**
 * Default gas amounts for Jetton transfers
 * TON requires attaching TON for gas to internal messages
 */
export const DEFAULT_JETTON_TRANSFER_TON = 100_000_000n; // 0.1 TON for gas
export const DEFAULT_FORWARD_TON = 1n; // Minimal forward amount (notification)
export const MIN_JETTON_TRANSFER_TON = 50_000_000n; // 0.05 TON minimum

/**
 * Maximum gas amounts to prevent excessive fees
 */
export const MAX_JETTON_TRANSFER_TON = 500_000_000n; // 0.5 TON maximum

/**
 * Scheme identifier for exact payments
 */
export const SCHEME_EXACT = "exact";

/**
 * Default timeout for payment validity (in seconds)
 */
export const DEFAULT_VALIDITY_DURATION = 3600; // 1 hour

/**
 * Address format constants
 */
export const TON_ADDRESS_LENGTH = 48; // Friendly format length (base64url)
export const TON_RAW_ADDRESS_LENGTH = 66; // Raw format: workchain:hash (0:64hex)
