/**
 * Tezos utility functions
 */

import {
  NETWORK_CONFIGS,
  TEZOS_CAIP2_NAMESPACE,
  SUPPORTED_NETWORKS,
} from "./constants.js";

/**
 * Get network configuration
 */
export function getNetworkConfig(network: string) {
  return NETWORK_CONFIGS[network];
}

/**
 * Check if a network is supported
 */
export function isSupportedNetwork(network: string): boolean {
  return (SUPPORTED_NETWORKS as readonly string[]).includes(network);
}

/**
 * Parse a CAIP-2 network identifier to extract the chain reference
 */
export function parseNetworkId(network: string): {
  namespace: string;
  reference: string;
} | null {
  const parts = network.split(":");
  if (parts.length !== 2) return null;
  return {
    namespace: parts[0],
    reference: parts[1],
  };
}

/**
 * Build a CAIP-2 network identifier
 */
export function buildNetworkId(reference: string): string {
  return `${TEZOS_CAIP2_NAMESPACE}:${reference}`;
}

/**
 * Get indexer URL for a network
 */
export function getIndexerUrl(network: string): string | undefined {
  return NETWORK_CONFIGS[network]?.indexerUrl;
}

/**
 * Get RPC URL for a network
 */
export function getRpcUrl(network: string): string | undefined {
  return NETWORK_CONFIGS[network]?.rpcUrl;
}

/**
 * Compare two Tezos addresses (case-insensitive for base58)
 */
export function compareAddresses(addr1: string, addr2: string): boolean {
  if (!addr1 || !addr2) return false;
  return addr1 === addr2;
}

/**
 * Format amount with decimals
 */
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${wholePart}.${fractionalStr}`;
}

/**
 * Parse amount string to bigint
 */
export function parseAmount(amount: string, decimals: number): bigint {
  const [whole, fractional = ""] = amount.split(".");
  const paddedFractional = fractional.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFractional);
}

/**
 * Extract FA2 transfer details from operation parameter
 */
export function extractFA2TransferDetails(
  parameter: unknown,
): {
  from: string;
  to: string;
  tokenId: number;
  amount: string;
} | null {
  if (!parameter || !Array.isArray(parameter)) return null;

  // FA2 transfer parameter is an array of { from_: string, txs: [...] }
  const firstTransfer = parameter[0];
  if (!firstTransfer || typeof firstTransfer !== "object") return null;

  const transfer = firstTransfer as Record<string, unknown>;
  const from = transfer.from_ as string;
  const txs = transfer.txs as Array<{
    to_: string;
    token_id: number | string;
    amount: number | string;
  }>;

  if (!from || !Array.isArray(txs) || txs.length === 0) return null;

  const firstTx = txs[0];
  if (!firstTx) return null;

  return {
    from,
    to: firstTx.to_,
    tokenId:
      typeof firstTx.token_id === "string"
        ? parseInt(firstTx.token_id, 10)
        : firstTx.token_id,
    amount: String(firstTx.amount),
  };
}
