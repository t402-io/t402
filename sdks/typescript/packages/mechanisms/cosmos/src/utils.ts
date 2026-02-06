/**
 * Cosmos Utility Functions
 *
 * Helper functions for Cosmos address validation, network normalization,
 * and amount conversion.
 */

import {
  COSMOS_CAIP2_NAMESPACE,
  NOBLE_BECH32_PREFIX,
  NETWORK_RPC_ENDPOINTS,
  NETWORK_REST_ENDPOINTS,
  type CosmosNetwork,
} from "./constants.js";

/**
 * Normalize a network identifier to CAIP-2 format
 * @param network - Network identifier (e.g., "noble-1", "cosmos:noble-1")
 * @returns CAIP-2 formatted network identifier
 */
export function normalizeNetwork(network: string): CosmosNetwork {
  // Already in CAIP-2 format
  if (network.startsWith(`${COSMOS_CAIP2_NAMESPACE}:`)) {
    return network as CosmosNetwork;
  }
  // Convert shorthand to CAIP-2
  return `${COSMOS_CAIP2_NAMESPACE}:${network}` as CosmosNetwork;
}

/**
 * Extract network ID from CAIP-2 identifier
 * @param network - CAIP-2 network identifier
 * @returns Network ID (e.g., "noble-1")
 */
export function extractNetworkId(network: string): string {
  if (network.includes(":")) {
    return network.split(":")[1];
  }
  return network;
}

/**
 * Validate a Cosmos bech32 address with Noble prefix
 * Checks that the address starts with the "noble" prefix followed by "1"
 * @param address - Address to validate
 * @returns Whether the address is valid
 */
export function isValidAddress(address: string): boolean {
  if (!address || address.length < 10) {
    return false;
  }
  return address.startsWith(`${NOBLE_BECH32_PREFIX}1`);
}

/**
 * Get RPC endpoint for a network
 * @param network - CAIP-2 network identifier
 * @returns RPC endpoint URL
 */
export function getRpcEndpoint(network: string): string {
  const normalizedNetwork = normalizeNetwork(network);
  return NETWORK_RPC_ENDPOINTS[normalizedNetwork] || NETWORK_RPC_ENDPOINTS["cosmos:noble-1"];
}

/**
 * Get REST endpoint for a network
 * @param network - CAIP-2 network identifier
 * @returns REST endpoint URL
 */
export function getRestEndpoint(network: string): string {
  const normalizedNetwork = normalizeNetwork(network);
  return NETWORK_REST_ENDPOINTS[normalizedNetwork] || NETWORK_REST_ENDPOINTS["cosmos:noble-1"];
}

/**
 * Convert decimal amount to token units (atomic units)
 * @param decimalAmount - Amount with decimals (e.g., "1.50")
 * @param decimals - Token decimals
 * @returns Amount in smallest units
 */
export function toAtomicUnits(decimalAmount: string | number, decimals: number): bigint {
  const amount = typeof decimalAmount === "string" ? parseFloat(decimalAmount) : decimalAmount;
  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${decimalAmount}`);
  }
  const multiplier = 10 ** decimals;
  return BigInt(Math.floor(amount * multiplier));
}

/**
 * Format amount for display (with decimals)
 * @param amount - Amount in smallest units
 * @param decimals - Number of decimal places
 * @returns Formatted amount string
 */
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  const decimal = remainder.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${decimal}`;
}

/**
 * Get the list of supported networks
 * @returns Array of CAIP-2 network identifiers
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(NETWORK_RPC_ENDPOINTS);
}
