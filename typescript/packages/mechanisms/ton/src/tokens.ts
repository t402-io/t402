/**
 * TON Jetton Token Configuration
 *
 * This module provides comprehensive Jetton token definitions including:
 * - USDT (Tether USD on TON)
 * - Network-specific configurations
 * - Helper functions for token lookups
 */

import { TON_MAINNET_CAIP2, TON_TESTNET_CAIP2 } from "./constants.js";

/**
 * Jetton token configuration
 */
export interface JettonConfig {
  /** Jetton master contract address (friendly format) */
  masterAddress: string;
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Number of decimal places */
  decimals: number;
  /** Payment priority (lower = higher priority) */
  priority: number;
}

/**
 * Network token registry mapping network -> symbol -> config
 */
export type NetworkJettonRegistry = Record<string, Record<string, JettonConfig>>;

/**
 * USDT Jetton Master Contract Addresses by Network
 *
 * USDT on TON follows the TEP-74 Jetton standard.
 * @see https://docs.tether.to/tether-on-ton
 */
export const USDT_ADDRESSES: Record<string, string> = {
  // TON Mainnet - Official Tether USDT
  [TON_MAINNET_CAIP2]: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  // TON Testnet - Test USDT (may vary)
  [TON_TESTNET_CAIP2]: "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
};

/**
 * Complete Jetton registry with all supported tokens per network
 */
export const JETTON_REGISTRY: NetworkJettonRegistry = {
  // TON Mainnet
  [TON_MAINNET_CAIP2]: {
    USDT: {
      masterAddress: USDT_ADDRESSES[TON_MAINNET_CAIP2],
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      priority: 1,
    },
  },

  // TON Testnet
  [TON_TESTNET_CAIP2]: {
    USDT: {
      masterAddress: USDT_ADDRESSES[TON_TESTNET_CAIP2],
      symbol: "USDT",
      name: "Tether USD (Testnet)",
      decimals: 6,
      priority: 1,
    },
  },
};

/**
 * Get Jetton configuration for a specific token on a network
 *
 * @param network - Network identifier (CAIP-2 format)
 * @param symbol - Token symbol (e.g., "USDT")
 * @returns Jetton configuration or undefined
 */
export function getJettonConfig(network: string, symbol: string): JettonConfig | undefined {
  return JETTON_REGISTRY[network]?.[symbol.toUpperCase()];
}

/**
 * Get all Jettons available on a network
 *
 * @param network - Network identifier
 * @returns Array of Jetton configurations sorted by priority
 */
export function getNetworkJettons(network: string): JettonConfig[] {
  const jettons = JETTON_REGISTRY[network];
  if (!jettons) return [];
  return Object.values(jettons).sort((a, b) => a.priority - b.priority);
}

/**
 * Get the default/preferred Jetton for a network
 * Prefers USDT based on priority
 *
 * @param network - Network identifier
 * @returns Default Jetton configuration or undefined
 */
export function getDefaultJetton(network: string): JettonConfig | undefined {
  const jettons = getNetworkJettons(network);
  return jettons[0]; // Already sorted by priority
}

/**
 * Get Jetton by master contract address on a network
 *
 * @param network - Network identifier
 * @param address - Jetton master contract address
 * @returns Jetton configuration or undefined
 */
export function getJettonByAddress(network: string, address: string): JettonConfig | undefined {
  const jettons = JETTON_REGISTRY[network];
  if (!jettons) return undefined;

  // Normalize address comparison (case-insensitive for base64)
  return Object.values(jettons).find(
    (j) => j.masterAddress.toLowerCase() === address.toLowerCase(),
  );
}

/**
 * Get all networks that support a specific Jetton
 *
 * @param symbol - Token symbol
 * @returns Array of network identifiers
 */
export function getNetworksForJetton(symbol: string): string[] {
  const networks: string[] = [];
  for (const [network, jettons] of Object.entries(JETTON_REGISTRY)) {
    if (jettons[symbol.toUpperCase()]) {
      networks.push(network);
    }
  }
  return networks;
}

/**
 * Get USDT networks on TON
 *
 * @returns Array of networks supporting USDT
 */
export function getUsdtNetworks(): string[] {
  return getNetworksForJetton("USDT");
}

/**
 * Check if a network is supported
 *
 * @param network - Network identifier to check
 * @returns true if network has configured Jettons
 */
export function isNetworkSupported(network: string): boolean {
  return network in JETTON_REGISTRY;
}

/**
 * Get all supported networks
 *
 * @returns Array of all supported network identifiers
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(JETTON_REGISTRY);
}
