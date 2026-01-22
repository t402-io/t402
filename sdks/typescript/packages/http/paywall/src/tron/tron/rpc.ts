import { TRON_NETWORKS, TRON_RPC_ENDPOINTS, type TronNetwork } from "./types";

/**
 * Gets the RPC endpoint for a TRON network
 *
 * @param network - TRON network identifier (CAIP-2 format)
 * @returns RPC endpoint URL
 */
export function getTronEndpoint(network: string): string {
  if (network === TRON_NETWORKS.MAINNET) {
    return TRON_RPC_ENDPOINTS[TRON_NETWORKS.MAINNET];
  }
  if (network === TRON_NETWORKS.NILE) {
    return TRON_RPC_ENDPOINTS[TRON_NETWORKS.NILE];
  }
  return TRON_RPC_ENDPOINTS[TRON_NETWORKS.SHASTA];
}

/**
 * Determines if the network is TRON mainnet
 *
 * @param network - Network identifier
 * @returns True if mainnet
 */
export function isTronMainnet(network: string): boolean {
  return network === TRON_NETWORKS.MAINNET;
}

/**
 * Gets the target TRON network for a given CAIP-2 network string
 *
 * @param network - CAIP-2 network string
 * @returns Normalized TRON network
 */
export function getTargetTronNetwork(network: string): TronNetwork {
  if (network === TRON_NETWORKS.MAINNET) {
    return TRON_NETWORKS.MAINNET;
  }
  if (network === TRON_NETWORKS.NILE) {
    return TRON_NETWORKS.NILE;
  }
  return TRON_NETWORKS.NILE; // Default to Nile testnet
}

/**
 * Check if TronLink is installed
 *
 * @returns True if TronLink is available
 */
export function isTronLinkInstalled(): boolean {
  return typeof window !== "undefined" && !!window.tronWeb;
}

/**
 * Check if TronLink is connected
 *
 * @returns True if connected with an address
 */
export function isTronLinkConnected(): boolean {
  return (
    isTronLinkInstalled() &&
    !!window.tronWeb?.defaultAddress?.base58 &&
    window.tronWeb.defaultAddress.base58 !== ""
  );
}

/**
 * Get connected TronLink address
 *
 * @returns Address in base58 format or null
 */
export function getTronLinkAddress(): string | null {
  if (!isTronLinkConnected()) {
    return null;
  }
  return window.tronWeb?.defaultAddress?.base58 || null;
}
