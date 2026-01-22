/**
 * NEAR Network Constants
 *
 * This module provides constants for NEAR blockchain integration including:
 * - CAIP-2 network identifiers
 * - RPC endpoints
 * - NEP-141 function names
 * - Default gas amounts
 */

/**
 * CAIP-2 Network Identifiers for NEAR
 */
export const NEAR_MAINNET_CAIP2 = "near:mainnet";
export const NEAR_TESTNET_CAIP2 = "near:testnet";

/**
 * Supported NEAR networks
 */
export const NEAR_NETWORKS = [NEAR_MAINNET_CAIP2, NEAR_TESTNET_CAIP2] as const;

export type NearNetwork = (typeof NEAR_NETWORKS)[number];

/**
 * NEAR network IDs (for wallet connection)
 */
export const NEAR_NETWORK_IDS: Record<string, string> = {
  [NEAR_MAINNET_CAIP2]: "mainnet",
  [NEAR_TESTNET_CAIP2]: "testnet",
};

/**
 * Default RPC endpoints
 */
export const NEAR_MAINNET_RPC = "https://rpc.mainnet.near.org";
export const NEAR_TESTNET_RPC = "https://rpc.testnet.near.org";

/**
 * Network RPC endpoint mapping
 */
export const NETWORK_RPC_ENDPOINTS: Record<string, string> = {
  [NEAR_MAINNET_CAIP2]: NEAR_MAINNET_RPC,
  [NEAR_TESTNET_CAIP2]: NEAR_TESTNET_RPC,
};

/**
 * NEP-141 Fungible Token Standard function names
 * @see https://nomicon.io/Standards/Tokens/FungibleToken/Core
 */
export const NEP141_FT_TRANSFER = "ft_transfer";
export const NEP141_FT_BALANCE_OF = "ft_balance_of";
export const NEP141_STORAGE_DEPOSIT = "storage_deposit";
export const NEP141_STORAGE_BALANCE_OF = "storage_balance_of";

/**
 * Default gas amounts for NEP-141 transfers
 * NEAR gas is measured in TGas (1 TGas = 10^12 gas)
 */
export const DEFAULT_FT_TRANSFER_GAS = "30000000000000"; // 30 TGas
export const DEFAULT_STORAGE_DEPOSIT_GAS = "10000000000000"; // 10 TGas

/**
 * Required deposits for NEP-141 operations
 * ft_transfer requires 1 yoctoNEAR attached deposit
 */
export const FT_TRANSFER_DEPOSIT = "1"; // 1 yoctoNEAR
export const DEFAULT_STORAGE_DEPOSIT = "1250000000000000000000"; // 0.00125 NEAR

/**
 * Scheme identifier for exact-direct payments
 */
export const SCHEME_EXACT_DIRECT = "exact-direct";

/**
 * Default timeout for payment validity (in seconds)
 */
export const DEFAULT_VALIDITY_DURATION = 3600; // 1 hour

/**
 * Maximum transaction age to accept (in milliseconds)
 */
export const MAX_TRANSACTION_AGE = 5 * 60 * 1000; // 5 minutes

/**
 * CAIP-2 namespace for NEAR
 */
export const NEAR_CAIP2_NAMESPACE = "near";
