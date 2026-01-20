import type { PaymentRequirements } from "@t402/core/types";
import * as allChains from "viem/chains";

// Chain configuration constants

// EVM Chain IDs (CAIP-2 format: eip155:chainId)
// Only chains we explicitly reference in code
export const EVM_CHAIN_IDS = {
  BASE_MAINNET: "8453",
  BASE_SEPOLIA: "84532",
} as const;

// Solana Network References (CAIP-2 format: solana:genesisHash)
export const SOLANA_NETWORK_REFS = {
  MAINNET: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  DEVNET: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
} as const;

// TON Network References (CAIP-2 format: ton:network)
export const TON_NETWORK_REFS = {
  MAINNET: "mainnet",
  TESTNET: "testnet",
} as const;

// TRON Network References (CAIP-2 format: tron:network)
export const TRON_NETWORK_REFS = {
  MAINNET: "mainnet",
  NILE: "nile",
  SHASTA: "shasta",
} as const;

/**
 * Normalizes the payment requirements into an array.
 *
 * @param paymentRequirements - A single requirement or a list of requirements.
 * @returns An array of payment requirements.
 */
export function normalizePaymentRequirements(
  paymentRequirements: PaymentRequirements | PaymentRequirements[],
): PaymentRequirements[] {
  if (Array.isArray(paymentRequirements)) {
    return paymentRequirements;
  }
  return [paymentRequirements];
}

/**
 * Returns the preferred networks to attempt first when selecting a payment requirement.
 *
 * @param testnet - Whether the paywall is operating in testnet mode.
 * @returns Ordered list of preferred networks (CAIP-2 format).
 */
export function getPreferredNetworks(testnet: boolean): string[] {
  if (testnet) {
    return [`eip155:${EVM_CHAIN_IDS.BASE_SEPOLIA}`, `solana:${SOLANA_NETWORK_REFS.DEVNET}`];
  }
  return [`eip155:${EVM_CHAIN_IDS.BASE_MAINNET}`, `solana:${SOLANA_NETWORK_REFS.MAINNET}`];
}

/**
 * Selects the most appropriate payment requirement for the user.
 *
 * @param paymentRequirements - All available payment requirements.
 * @param testnet - Whether the paywall is operating in testnet mode.
 * @returns The selected payment requirement.
 */
export function choosePaymentRequirement(
  paymentRequirements: PaymentRequirements | PaymentRequirements[],
  testnet: boolean,
): PaymentRequirements {
  const normalized = normalizePaymentRequirements(paymentRequirements);
  const preferredNetworks = getPreferredNetworks(testnet);

  // Try to find a requirement matching preferred networks
  for (const preferredNetwork of preferredNetworks) {
    const match = normalized.find(req => req.network === preferredNetwork);
    if (match) {
      return match;
    }
  }

  // Fall back to first requirement
  return normalized[0];
}

/**
 * Determines if the provided network is an EVM network.
 *
 * @param network - The network to check (CAIP-2 format: eip155:chainId).
 * @returns True if the network is EVM based.
 */
export function isEvmNetwork(network: string): boolean {
  return network.startsWith("eip155:");
}

/**
 * Determines if the provided network is an SVM network.
 *
 * @param network - The network to check (CAIP-2 format: solana:reference).
 * @returns True if the network is SVM based.
 */
export function isSvmNetwork(network: string): boolean {
  return network.startsWith("solana:");
}

/**
 * Determines if the provided network is a TON network.
 *
 * @param network - The network to check (CAIP-2 format: ton:network).
 * @returns True if the network is TON based.
 */
export function isTonNetwork(network: string): boolean {
  return network.startsWith("ton:");
}

/**
 * Determines if the provided network is a TRON network.
 *
 * @param network - The network to check (CAIP-2 format: tron:network).
 * @returns True if the network is TRON based.
 */
export function isTronNetwork(network: string): boolean {
  return network.startsWith("tron:");
}

/**
 * Provides a human-readable display name for a network.
 * Uses viem/chains for EVM chain metadata (based on ethereum-lists/chains).
 * See: https://github.com/ethereum-lists/chains
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns A display name suitable for UI use.
 */
export function getNetworkDisplayName(network: string): string {
  if (network.startsWith("eip155:")) {
    const chainId = parseInt(network.split(":")[1]);

    // Find matching chain in viem's chain definitions
    const chain = Object.values(allChains).find(c => c.id === chainId);

    if (chain) {
      return chain.name;
    }

    return `Chain ${chainId}`;
  }

  if (network.startsWith("solana:")) {
    const ref = network.split(":")[1];
    return ref === SOLANA_NETWORK_REFS.DEVNET ? "Solana Devnet" : "Solana Mainnet";
  }

  if (network.startsWith("ton:")) {
    const ref = network.split(":")[1];
    return ref === TON_NETWORK_REFS.TESTNET ? "TON Testnet" : "TON Mainnet";
  }

  if (network.startsWith("tron:")) {
    const ref = network.split(":")[1];
    if (ref === TRON_NETWORK_REFS.NILE) return "TRON Nile Testnet";
    if (ref === TRON_NETWORK_REFS.SHASTA) return "TRON Shasta Testnet";
    return "TRON Mainnet";
  }

  return network;
}

/**
 * Indicates whether the provided network is a testnet.
 * Uses viem's testnet property for EVM chains.
 *
 * @param network - The network to evaluate (CAIP-2 format).
 * @returns True if the network is a recognized testnet.
 */
export function isTestnetNetwork(network: string): boolean {
  if (network.startsWith("eip155:")) {
    const chainId = parseInt(network.split(":")[1]);
    const chain = Object.values(allChains).find(c => c.id === chainId);
    return chain?.testnet ?? false;
  }

  if (network.startsWith("solana:")) {
    const ref = network.split(":")[1];
    return ref === SOLANA_NETWORK_REFS.DEVNET;
  }

  if (network.startsWith("ton:")) {
    const ref = network.split(":")[1];
    return ref === TON_NETWORK_REFS.TESTNET;
  }

  if (network.startsWith("tron:")) {
    const ref = network.split(":")[1];
    return ref === TRON_NETWORK_REFS.NILE || ref === TRON_NETWORK_REFS.SHASTA;
  }

  return false;
}

/**
 * Returns an SVG icon element for the given network.
 * Icons are inline SVG strings for zero external dependencies.
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns SVG element as a string.
 */
export function getNetworkIcon(network: string): string {
  if (network.startsWith("eip155:")) {
    const chainId = parseInt(network.split(":")[1]);

    // Base
    if (chainId === 8453 || chainId === 84532) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0052FF"/><path d="M12 6.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm0 8.5a3 3 0 110-6 3 3 0 010 6z" fill="white"/></svg>`;
    }

    // Arbitrum
    if (chainId === 42161 || chainId === 421614) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#213147"/><path d="M15.5 8l-3.5 6-3.5-6h-2l4.5 8h2l4.5-8h-2z" fill="#28A0F0"/><path d="M8.5 8l3.5 6 3.5-6" stroke="#fff" stroke-width="1.5"/></svg>`;
    }

    // Optimism
    if (chainId === 10 || chainId === 11155420) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#FF0420"/><path d="M8 12a4 4 0 108 0 4 4 0 00-8 0z" fill="white"/></svg>`;
    }

    // Default Ethereum icon
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#627EEA"/><path d="M12 4v6.5l5.5 2.5L12 4z" fill="white" fill-opacity="0.6"/><path d="M12 4L6.5 13l5.5-2.5V4z" fill="white"/><path d="M12 16.5v4L17.5 14 12 16.5z" fill="white" fill-opacity="0.6"/><path d="M12 20.5v-4L6.5 14l5.5 6.5z" fill="white"/></svg>`;
  }

  if (network.startsWith("solana:")) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="url(#solana-gradient)"/><defs><linearGradient id="solana-gradient" x1="4" y1="4" x2="20" y2="20"><stop stop-color="#00FFA3"/><stop offset="1" stop-color="#DC1FFF"/></linearGradient></defs><path d="M7 15.5h8l2-2H7l-2 2h2zm0-3h10l-2-2H7l2 2h-2zm10-3H7l2 2h10l-2-2z" fill="white"/></svg>`;
  }

  if (network.startsWith("ton:")) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0088CC"/><path d="M12 6l-5 10h3l2-4 2 4h3l-5-10z" fill="white"/></svg>`;
  }

  if (network.startsWith("tron:")) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#FF0013"/><path d="M8 8l4 8 4-8H8z" fill="white"/></svg>`;
  }

  // Default icon
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#6B7280"/><path d="M12 7v10M7 12h10" stroke="white" stroke-width="2"/></svg>`;
}
