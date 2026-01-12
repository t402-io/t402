import type { PaymentRequirements } from "@t402/core/types";

// Chain configuration constants

/** EVM Chain IDs (CAIP-2 format: eip155:chainId) */
export const EVM_CHAIN_IDS = {
  ETHEREUM_MAINNET: "1",
  BASE_MAINNET: "8453",
  BASE_SEPOLIA: "84532",
  ARBITRUM_MAINNET: "42161",
  ARBITRUM_SEPOLIA: "421614",
} as const;

/** Solana Network References (CAIP-2 format: solana:genesisHash) */
export const SOLANA_NETWORK_REFS = {
  MAINNET: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  DEVNET: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
} as const;

/** TON Network References (CAIP-2 format: ton:workchain) */
export const TON_NETWORK_REFS = {
  MAINNET: "-239",
  TESTNET: "-3",
} as const;

/** TRON Network References */
export const TRON_NETWORK_REFS = {
  MAINNET: "mainnet",
  NILE: "nile",
  SHASTA: "shasta",
} as const;

/**
 * Normalizes payment requirements into an array.
 *
 * @param paymentRequirements - A single requirement or array of requirements.
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
 * Returns preferred networks for payment selection.
 *
 * @param testnet - Whether to prefer testnet networks.
 * @returns Ordered list of preferred networks (CAIP-2 format).
 */
export function getPreferredNetworks(testnet: boolean): string[] {
  if (testnet) {
    return [
      `eip155:${EVM_CHAIN_IDS.BASE_SEPOLIA}`,
      `eip155:${EVM_CHAIN_IDS.ARBITRUM_SEPOLIA}`,
      `solana:${SOLANA_NETWORK_REFS.DEVNET}`,
    ];
  }
  return [
    `eip155:${EVM_CHAIN_IDS.BASE_MAINNET}`,
    `eip155:${EVM_CHAIN_IDS.ARBITRUM_MAINNET}`,
    `solana:${SOLANA_NETWORK_REFS.MAINNET}`,
  ];
}

/**
 * Selects the most appropriate payment requirement.
 *
 * @param paymentRequirements - Available payment requirements.
 * @param testnet - Whether to prefer testnet networks.
 * @returns The selected payment requirement.
 */
export function choosePaymentRequirement(
  paymentRequirements: PaymentRequirements | PaymentRequirements[],
  testnet: boolean,
): PaymentRequirements {
  const normalized = normalizePaymentRequirements(paymentRequirements);
  const preferredNetworks = getPreferredNetworks(testnet);

  for (const preferredNetwork of preferredNetworks) {
    const match = normalized.find(req => req.network === preferredNetwork);
    if (match) {
      return match;
    }
  }

  return normalized[0];
}

/**
 * Determines if the network is EVM-based.
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns True if the network is EVM-based.
 */
export function isEvmNetwork(network: string): boolean {
  return network.startsWith("eip155:");
}

/**
 * Determines if the network is Solana-based.
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns True if the network is Solana-based.
 */
export function isSvmNetwork(network: string): boolean {
  return network.startsWith("solana:");
}

/**
 * Determines if the network is TON-based.
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns True if the network is TON-based.
 */
export function isTonNetwork(network: string): boolean {
  return network.startsWith("ton:");
}

/**
 * Determines if the network is TRON-based.
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns True if the network is TRON-based.
 */
export function isTronNetwork(network: string): boolean {
  return network.startsWith("tron:");
}

/** Known EVM chain names */
const EVM_CHAIN_NAMES: Record<string, string> = {
  "1": "Ethereum",
  "10": "Optimism",
  "137": "Polygon",
  "8453": "Base",
  "42161": "Arbitrum One",
  "84532": "Base Sepolia",
  "421614": "Arbitrum Sepolia",
  "11155111": "Sepolia",
};

/**
 * Gets a human-readable display name for a network.
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns A display name suitable for UI use.
 */
export function getNetworkDisplayName(network: string): string {
  if (network.startsWith("eip155:")) {
    const chainId = network.split(":")[1];
    return EVM_CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
  }

  if (network.startsWith("solana:")) {
    const ref = network.split(":")[1];
    return ref === SOLANA_NETWORK_REFS.DEVNET ? "Solana Devnet" : "Solana";
  }

  if (network.startsWith("ton:")) {
    const ref = network.split(":")[1];
    return ref === TON_NETWORK_REFS.TESTNET ? "TON Testnet" : "TON";
  }

  if (network.startsWith("tron:")) {
    const ref = network.split(":")[1];
    if (ref === TRON_NETWORK_REFS.NILE) return "TRON Nile";
    if (ref === TRON_NETWORK_REFS.SHASTA) return "TRON Shasta";
    return "TRON";
  }

  return network;
}

/** Known testnet chain IDs */
const TESTNET_CHAIN_IDS = new Set(["84532", "421614", "11155111", "80001", "97"]);

/**
 * Determines if the network is a testnet.
 *
 * @param network - The network identifier (CAIP-2 format).
 * @returns True if the network is a testnet.
 */
export function isTestnetNetwork(network: string): boolean {
  if (network.startsWith("eip155:")) {
    const chainId = network.split(":")[1];
    return TESTNET_CHAIN_IDS.has(chainId);
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
 * Truncates an address for display.
 *
 * @param address - The full address.
 * @param startChars - Number of characters to show at start (default: 6).
 * @param endChars - Number of characters to show at end (default: 4).
 * @returns The truncated address.
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Formats a token amount for display.
 *
 * @param amount - The amount as a string (in smallest unit).
 * @param decimals - The token decimals (default: 6 for USDT).
 * @param maxDecimals - Maximum decimal places to show (default: 2).
 * @returns The formatted amount.
 */
export function formatTokenAmount(amount: string, decimals = 6, maxDecimals = 2): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmed = fractionalStr.slice(0, maxDecimals).replace(/0+$/, "");

  if (trimmed === "") {
    return integerPart.toString();
  }

  return `${integerPart}.${trimmed}`;
}

/**
 * Gets the asset display name.
 *
 * @param asset - The asset identifier (e.g., "usdt", "usdt0").
 * @returns A display name suitable for UI use.
 */
export function getAssetDisplayName(asset: string): string {
  const assetLower = asset.toLowerCase();

  switch (assetLower) {
    case "usdt":
      return "USDT";
    case "usdt0":
      return "USDT0";
    case "usdc":
      return "USDC";
    default:
      return asset.toUpperCase();
  }
}
