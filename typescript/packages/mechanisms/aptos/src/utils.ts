/**
 * Aptos Utility Functions
 */

import type { Network } from "@t402/core/types";
import {
  APTOS_CAIP2_NAMESPACE,
  APTOS_MAINNET_CAIP2,
  APTOS_TESTNET_CAIP2,
  APTOS_DEVNET_CAIP2,
  DEFAULT_MAINNET_RPC,
  DEFAULT_TESTNET_RPC,
  DEFAULT_DEVNET_RPC,
  FA_TRANSFER_FUNCTION,
} from "./constants.js";
import type {
  AptosTransactionResult,
  AptosTransactionEvent,
  ParsedFATransfer,
} from "./types.js";

/**
 * Validate Aptos address format
 * Aptos addresses are 64 hex characters (32 bytes) with 0x prefix
 */
export function isValidAptosAddress(address: string): boolean {
  if (!address) return false;
  // Must start with 0x
  if (!address.startsWith("0x")) return false;
  // Remove 0x prefix and check hex
  const hex = address.slice(2);
  // Aptos addresses can be 1-64 hex chars (leading zeros may be omitted)
  if (hex.length === 0 || hex.length > 64) return false;
  return /^[0-9a-fA-F]+$/.test(hex);
}

/**
 * Normalize Aptos address to full 64-character format
 */
export function normalizeAptosAddress(address: string): string {
  if (!address.startsWith("0x")) {
    throw new Error("Aptos address must start with 0x");
  }
  const hex = address.slice(2).toLowerCase();
  // Pad to 64 characters
  return "0x" + hex.padStart(64, "0");
}

/**
 * Compare two Aptos addresses (case-insensitive, handles short addresses)
 */
export function compareAddresses(addr1: string, addr2: string): boolean {
  try {
    return normalizeAptosAddress(addr1) === normalizeAptosAddress(addr2);
  } catch {
    return false;
  }
}

/**
 * Validate transaction hash format
 */
export function isValidTxHash(txHash: string): boolean {
  if (!txHash) return false;
  if (!txHash.startsWith("0x")) return false;
  const hex = txHash.slice(2);
  // Transaction hash is 64 hex characters (32 bytes)
  if (hex.length !== 64) return false;
  return /^[0-9a-fA-F]+$/.test(hex);
}

/**
 * Get default RPC URL for a network
 */
export function getDefaultRpcUrl(network: Network): string {
  switch (network) {
    case APTOS_MAINNET_CAIP2:
      return DEFAULT_MAINNET_RPC;
    case APTOS_TESTNET_CAIP2:
      return DEFAULT_TESTNET_RPC;
    case APTOS_DEVNET_CAIP2:
      return DEFAULT_DEVNET_RPC;
    default:
      throw new Error(`Unknown Aptos network: ${network}`);
  }
}

/**
 * Check if a network identifier is for Aptos
 */
export function isAptosNetwork(network: Network): boolean {
  return network.startsWith(`${APTOS_CAIP2_NAMESPACE}:`);
}

/**
 * Parse CAIP-19 asset identifier for Aptos
 * Format: aptos:1/fa:0x...
 */
export function parseAssetIdentifier(asset: string): {
  network: Network;
  metadataAddress: string;
} | null {
  const parts = asset.split("/");
  if (parts.length !== 2) return null;

  const network = parts[0] as Network;
  if (!isAptosNetwork(network)) return null;

  const [assetType, address] = parts[1].split(":");
  if (assetType !== "fa" || !address) return null;

  if (!isValidAptosAddress(address)) return null;

  return { network, metadataAddress: address };
}

/**
 * Create CAIP-19 asset identifier for Aptos FA
 */
export function createAssetIdentifier(
  network: Network,
  metadataAddress: string,
): string {
  return `${network}/fa:${metadataAddress}`;
}

/**
 * Parse fungible asset transfer from transaction events
 */
export function parseFATransferFromEvents(
  events: AptosTransactionEvent[],
): ParsedFATransfer | null {
  // Look for Withdraw and Deposit events
  const withdrawEvent = events.find(
    (e) =>
      e.type === "0x1::fungible_asset::Withdraw" ||
      e.type.includes("::fungible_asset::Withdraw"),
  );
  const depositEvent = events.find(
    (e) =>
      e.type === "0x1::fungible_asset::Deposit" ||
      e.type.includes("::fungible_asset::Deposit"),
  );

  if (!withdrawEvent || !depositEvent) {
    return null;
  }

  // Extract data from events
  const withdrawData = withdrawEvent.data as {
    store?: string;
    amount?: string;
  };
  const depositData = depositEvent.data as {
    store?: string;
    amount?: string;
  };

  if (!withdrawData.amount || !depositData.store) {
    return null;
  }

  // The from address is the account that owns the withdraw store
  // The to address is the account that owns the deposit store
  // For simplicity, we'll extract from the event guid
  const from = withdrawEvent.guid.accountAddress;
  const to = depositEvent.guid.accountAddress;
  const amount = BigInt(withdrawData.amount);

  // Metadata address would need to be extracted from state changes
  // For now, return with empty metadata (to be filled by caller)
  return {
    from,
    to,
    amount,
    metadataAddress: "", // Will be filled from transaction details
  };
}

/**
 * Check if transaction is a FA transfer
 */
export function isFATransferTransaction(tx: AptosTransactionResult): boolean {
  if (!tx.payload) return false;
  if (tx.payload.type !== "entry_function_payload") return false;
  return (
    tx.payload.function === FA_TRANSFER_FUNCTION ||
    tx.payload.function?.includes("primary_fungible_store::transfer") ||
    false
  );
}

/**
 * Extract transfer details from transaction
 */
export function extractTransferDetails(
  tx: AptosTransactionResult,
): ParsedFATransfer | null {
  if (!tx.success) return null;
  if (!tx.payload || tx.payload.type !== "entry_function_payload") return null;

  const args = tx.payload.arguments;
  if (!args || args.length < 3) return null;

  // Arguments for primary_fungible_store::transfer:
  // [0] - metadata object address
  // [1] - recipient address
  // [2] - amount

  const metadataAddress = args[0] as string;
  const to = args[1] as string;
  const amount = BigInt(args[2] as string);

  return {
    from: tx.sender,
    to,
    amount,
    metadataAddress,
  };
}

/**
 * Format amount with decimals for display
 */
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0");
  return `${wholePart}.${paddedFractional}`;
}

/**
 * Parse amount string to bigint
 */
export function parseAmount(amount: string, decimals: number): bigint {
  const [whole, fractional = ""] = amount.split(".");
  const paddedFractional = fractional.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole + paddedFractional);
}
