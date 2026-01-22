/**
 * Aptos Network Constants
 */

// CAIP-2 namespace for Aptos
export const APTOS_CAIP2_NAMESPACE = "aptos";

// Standard Aptos network identifiers (CAIP-2 format)
export const APTOS_MAINNET_CAIP2 = "aptos:1";
export const APTOS_TESTNET_CAIP2 = "aptos:2";
export const APTOS_DEVNET_CAIP2 = "aptos:149";

// All supported Aptos networks
export const APTOS_NETWORKS = [
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  APTOS_DEVNET_CAIP2,
] as const;

export type AptosNetwork = (typeof APTOS_NETWORKS)[number];

// Chain IDs
export const APTOS_MAINNET_CHAIN_ID = 1;
export const APTOS_TESTNET_CHAIN_ID = 2;
export const APTOS_DEVNET_CHAIN_ID = 149;

// RPC endpoints
export const DEFAULT_MAINNET_RPC = "https://fullnode.mainnet.aptoslabs.com/v1";
export const DEFAULT_TESTNET_RPC = "https://fullnode.testnet.aptoslabs.com/v1";
export const DEFAULT_DEVNET_RPC = "https://fullnode.devnet.aptoslabs.com/v1";

// Scheme identifier
export const SCHEME_EXACT_DIRECT = "exact-direct";

// Fungible Asset module addresses
export const PRIMARY_FUNGIBLE_STORE_MODULE = "0x1::primary_fungible_store";
export const FUNGIBLE_ASSET_MODULE = "0x1::fungible_asset";
export const APTOS_ACCOUNT_MODULE = "0x1::aptos_account";

// Transfer function
export const FA_TRANSFER_FUNCTION = `${PRIMARY_FUNGIBLE_STORE_MODULE}::transfer`;

// Default gas configuration
export const DEFAULT_MAX_GAS_AMOUNT = 100000n;
export const DEFAULT_GAS_UNIT_PRICE = 100n;

// Transaction expiration (in seconds)
export const DEFAULT_TX_EXPIRATION_SECONDS = 600; // 10 minutes
