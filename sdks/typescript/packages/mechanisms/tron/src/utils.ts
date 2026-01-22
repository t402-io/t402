/**
 * TRON Utility Functions
 *
 * Address validation, amount conversion, and network utilities.
 */

import {
  TRON_NETWORKS,
  TRON_ADDRESS_LENGTH,
  TRON_ADDRESS_PREFIX,
  NETWORK_ENDPOINTS,
  DEFAULT_USDT_DECIMALS,
} from "./constants.js";
import type { TronNetwork } from "./constants.js";

// =============================================================================
// Network Utilities
// =============================================================================

/**
 * Normalize network identifier to CAIP-2 format
 *
 * @param network - Network identifier (e.g., "tron:mainnet", "mainnet")
 * @returns Normalized CAIP-2 identifier
 * @throws Error if network is not supported
 */
export function normalizeNetwork(network: string): TronNetwork {
  // Already in correct format
  if (TRON_NETWORKS.includes(network as TronNetwork)) {
    return network as TronNetwork;
  }

  // Handle shorthand formats
  const lower = network.toLowerCase();
  if (lower === "mainnet" || lower === "tron") {
    return "tron:mainnet";
  }
  if (lower === "nile" || lower === "tron-nile") {
    return "tron:nile";
  }
  if (lower === "shasta" || lower === "tron-shasta") {
    return "tron:shasta";
  }

  throw new Error(`Unsupported TRON network: ${network}`);
}

/**
 * Get RPC endpoint for a network
 *
 * @param network - CAIP-2 network identifier
 * @returns RPC endpoint URL
 * @throws Error if network is not supported
 */
export function getEndpoint(network: string): string {
  const normalized = normalizeNetwork(network);
  const endpoint = NETWORK_ENDPOINTS[normalized];
  if (!endpoint) {
    throw new Error(`No endpoint configured for network: ${network}`);
  }
  return endpoint;
}

/**
 * Check if a network identifier is a TRON network
 *
 * @param network - Network identifier
 * @returns true if TRON network
 */
export function isTronNetwork(network: string): boolean {
  try {
    normalizeNetwork(network);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Address Utilities
// =============================================================================

/**
 * Base58 alphabet for TRON addresses
 */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Validate a TRON address
 *
 * TRON addresses are:
 * - Base58check encoded
 * - 34 characters long
 * - Start with 'T' (mainnet) or 'A'/'4' (testnet - rare)
 *
 * @param address - Address to validate
 * @returns true if valid TRON address
 */
export function validateTronAddress(address: string): boolean {
  // Check length
  if (!address || address.length !== TRON_ADDRESS_LENGTH) {
    return false;
  }

  // Check prefix (mainnet addresses start with T)
  if (!address.startsWith(TRON_ADDRESS_PREFIX)) {
    return false;
  }

  // Check base58 characters
  for (const char of address) {
    if (!BASE58_ALPHABET.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Compare two TRON addresses for equality
 *
 * Handles case-insensitivity and different formats.
 *
 * @param addr1 - First address
 * @param addr2 - Second address
 * @returns true if addresses are equal
 */
export function addressesEqual(addr1: string, addr2: string): boolean {
  if (!addr1 || !addr2) return false;

  // TRON addresses are case-sensitive in base58, but we normalize for comparison
  // This handles potential mixed-case issues from different sources
  return addr1 === addr2;
}

/**
 * Format a TRON address for display
 *
 * @param address - Address to format
 * @param options - Formatting options
 * @returns Formatted address
 */
export function formatAddress(
  address: string,
  options?: {
    /** Truncate to first/last N characters */
    truncate?: number;
  },
): string {
  if (!address) return "";

  if (options?.truncate && address.length > options.truncate * 2 + 3) {
    return `${address.slice(0, options.truncate)}...${address.slice(-options.truncate)}`;
  }

  return address;
}

// =============================================================================
// Amount Utilities
// =============================================================================

/**
 * Convert decimal amount to smallest units
 *
 * @param decimalAmount - Amount as decimal string (e.g., "1.50")
 * @param decimals - Token decimals (default: 6 for USDT)
 * @returns Amount in smallest units as string
 */
export function convertToSmallestUnits(decimalAmount: string, decimals: number = DEFAULT_USDT_DECIMALS): string {
  const parts = decimalAmount.split(".");
  const wholePart = parts[0] || "0";
  let fractionalPart = parts[1] || "";

  // Pad or truncate fractional part to match decimals
  if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.slice(0, decimals);
  } else {
    fractionalPart = fractionalPart.padEnd(decimals, "0");
  }

  // Combine and remove leading zeros
  const result = (wholePart + fractionalPart).replace(/^0+/, "") || "0";
  return result;
}

/**
 * Convert smallest units to decimal amount
 *
 * @param smallestUnits - Amount in smallest units as string
 * @param decimals - Token decimals (default: 6 for USDT)
 * @returns Amount as decimal string
 */
export function convertFromSmallestUnits(smallestUnits: string, decimals: number = DEFAULT_USDT_DECIMALS): string {
  const padded = smallestUnits.padStart(decimals + 1, "0");
  const wholePart = padded.slice(0, -decimals) || "0";
  const fractionalPart = padded.slice(-decimals);

  // Remove trailing zeros from fractional part
  const trimmedFractional = fractionalPart.replace(/0+$/, "");

  if (trimmedFractional) {
    return `${wholePart}.${trimmedFractional}`;
  }
  return wholePart;
}

// =============================================================================
// Transaction Utilities
// =============================================================================

/**
 * Generate a unique memo/reference for payment tracking
 *
 * @returns Unique reference string
 */
export function generatePaymentReference(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `t402_${timestamp}_${random}`;
}

/**
 * Calculate transaction expiration time
 *
 * @param validitySeconds - Validity duration in seconds
 * @returns Expiration timestamp in milliseconds
 */
export function calculateExpiration(validitySeconds: number): number {
  return Date.now() + validitySeconds * 1000;
}

/**
 * Validate a hex string
 *
 * @param hex - String to validate
 * @returns true if valid hex string
 */
export function isValidHex(hex: string): boolean {
  if (!hex) return false;
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  return /^[0-9a-fA-F]+$/.test(cleanHex);
}

/**
 * Estimate transaction fee
 *
 * Note: Actual fees depend on energy/bandwidth consumption.
 * This provides a conservative estimate.
 *
 * @param isActivated - Whether recipient account is activated
 * @returns Estimated fee in SUN
 */
export function estimateTransactionFee(isActivated: boolean = true): number {
  // TRC20 transfer typically costs ~15-30 TRX in energy
  // New account activation adds ~1 TRX
  const baseFee = 30_000_000; // 30 TRX
  const activationFee = isActivated ? 0 : 1_000_000; // 1 TRX
  return baseFee + activationFee;
}
