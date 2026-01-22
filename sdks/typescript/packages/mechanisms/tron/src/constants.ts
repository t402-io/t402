/**
 * TRON Network Constants
 *
 * Network identifiers, endpoints, and configuration for TRON blockchain.
 */

// =============================================================================
// Network Identifiers (CAIP-2 Format)
// =============================================================================

/** TRON Mainnet CAIP-2 identifier */
export const TRON_MAINNET_CAIP2 = "tron:mainnet";

/** TRON Nile Testnet CAIP-2 identifier */
export const TRON_NILE_CAIP2 = "tron:nile";

/** TRON Shasta Testnet CAIP-2 identifier */
export const TRON_SHASTA_CAIP2 = "tron:shasta";

/** All supported TRON networks */
export const TRON_NETWORKS = [TRON_MAINNET_CAIP2, TRON_NILE_CAIP2, TRON_SHASTA_CAIP2] as const;

/** TRON network type */
export type TronNetwork = (typeof TRON_NETWORKS)[number];

// =============================================================================
// RPC Endpoints
// =============================================================================

/** TRON Mainnet API endpoint (TronGrid) */
export const TRON_MAINNET_ENDPOINT = "https://api.trongrid.io";

/** TRON Nile Testnet API endpoint */
export const TRON_NILE_ENDPOINT = "https://api.nileex.io";

/** TRON Shasta Testnet API endpoint */
export const TRON_SHASTA_ENDPOINT = "https://api.shasta.trongrid.io";

/** Network to endpoint mapping */
export const NETWORK_ENDPOINTS: Record<string, string> = {
  [TRON_MAINNET_CAIP2]: TRON_MAINNET_ENDPOINT,
  [TRON_NILE_CAIP2]: TRON_NILE_ENDPOINT,
  [TRON_SHASTA_CAIP2]: TRON_SHASTA_ENDPOINT,
};

// =============================================================================
// TRC20 Contract Operations
// =============================================================================

/** TRC20 transfer function selector (transfer(address,uint256)) */
export const TRC20_TRANSFER_SELECTOR = "a9059cbb";

/** TRC20 approve function selector (approve(address,uint256)) */
export const TRC20_APPROVE_SELECTOR = "095ea7b3";

/** TRC20 balanceOf function selector (balanceOf(address)) */
export const TRC20_BALANCE_OF_SELECTOR = "70a08231";

// =============================================================================
// Gas and Fee Constants
// =============================================================================

/** Default fee limit for TRC20 transfers (in SUN, 1 TRX = 1,000,000 SUN) */
export const DEFAULT_FEE_LIMIT = 100_000_000; // 100 TRX

/** Minimum fee limit for TRC20 transfers */
export const MIN_FEE_LIMIT = 10_000_000; // 10 TRX

/** Maximum fee limit for TRC20 transfers */
export const MAX_FEE_LIMIT = 1_000_000_000; // 1000 TRX

/** SUN per TRX (1 TRX = 1,000,000 SUN) */
export const SUN_PER_TRX = 1_000_000;

// =============================================================================
// Scheme Constants
// =============================================================================

/** Payment scheme identifier */
export const SCHEME_EXACT = "exact";

/** Default transaction validity duration in seconds (1 hour) */
export const DEFAULT_VALIDITY_DURATION = 3600;

/** Minimum validity buffer for verification (30 seconds) */
export const MIN_VALIDITY_BUFFER = 30;

// =============================================================================
// Address Constants
// =============================================================================

/** TRON address prefix (base58check) */
export const TRON_ADDRESS_PREFIX = "T";

/** TRON address length (base58check format) */
export const TRON_ADDRESS_LENGTH = 34;

/** TRON address hex prefix (0x41 in decimal = 65) */
export const TRON_ADDRESS_HEX_PREFIX = 0x41;

// =============================================================================
// USDT Contract Addresses
// =============================================================================

/** USDT TRC20 contract addresses by network */
export const USDT_ADDRESSES: Record<string, string> = {
  [TRON_MAINNET_CAIP2]: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  [TRON_NILE_CAIP2]: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
  [TRON_SHASTA_CAIP2]: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs",
};

// =============================================================================
// Token Decimals
// =============================================================================

/** Default decimals for USDT */
export const DEFAULT_USDT_DECIMALS = 6;

/** Default decimals for TRX */
export const DEFAULT_TRX_DECIMALS = 6;
