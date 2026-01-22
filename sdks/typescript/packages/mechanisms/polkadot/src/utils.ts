/**
 * Polkadot Asset Hub Utility Functions
 */

import type { PolkadotExtrinsicResult, ParsedAssetTransfer } from "./types.js";

/**
 * Validate a Polkadot SS58 address format
 * SS58 addresses are base58-encoded with a checksum
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // SS58 addresses typically start with 1 (Polkadot), or have other prefixes
  // Length is typically 47-48 characters for Polkadot addresses
  // For a simple validation, check base58 characters and length
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{45,50}$/;
  return base58Regex.test(address);
}

/**
 * Validate an extrinsic hash format
 * Extrinsic hashes are 32-byte hex strings prefixed with 0x
 */
export function isValidExtrinsicHash(hash: string): boolean {
  if (!hash || typeof hash !== "string") {
    return false;
  }
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate a block hash format
 */
export function isValidBlockHash(hash: string): boolean {
  return isValidExtrinsicHash(hash); // Same format
}

/**
 * Compare two SS58 addresses (case-sensitive)
 */
export function compareAddresses(addr1: string, addr2: string): boolean {
  return addr1 === addr2;
}

/**
 * Format an amount with decimals for display
 */
export function formatAmount(amount: string, decimals: number): string {
  const amountBigInt = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const wholePart = amountBigInt / divisor;
  const fractionalPart = amountBigInt % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");
  return `${wholePart}.${trimmedFractional}`;
}

/**
 * Parse an amount string to the smallest unit (with decimals applied)
 */
export function parseAmount(amount: string, decimals: number): string {
  const parts = amount.split(".");
  const wholePart = parts[0] || "0";
  const fractionalPart = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return BigInt(wholePart + fractionalPart).toString();
}

/**
 * Extract asset transfer details from an extrinsic result
 */
export function extractAssetTransfer(
  result: PolkadotExtrinsicResult,
): ParsedAssetTransfer | null {
  if (!result.success) {
    return null;
  }

  // Check if this is an assets.transfer or assets.transferKeepAlive call
  if (result.module !== "assets") {
    return null;
  }

  if (result.call !== "transfer" && result.call !== "transferKeepAlive") {
    return null;
  }

  // Extract transfer details from args
  const assetId = result.args.id as number | undefined;
  const to = result.args.target as string | undefined;
  const amount = result.args.amount as string | undefined;

  if (assetId === undefined || !to || !amount) {
    return null;
  }

  return {
    assetId,
    from: result.signer,
    to,
    amount: amount.toString(),
    success: true,
  };
}

/**
 * Extract asset transfer from events (alternative method)
 */
export function extractAssetTransferFromEvents(
  result: PolkadotExtrinsicResult,
): ParsedAssetTransfer | null {
  if (!result.success) {
    return null;
  }

  // Look for assets.Transferred event
  const transferEvent = result.events.find(
    (e) => e.module === "assets" && e.name === "Transferred",
  );

  if (!transferEvent) {
    return null;
  }

  const assetId = transferEvent.data.assetId as number | undefined;
  const from = transferEvent.data.from as string | undefined;
  const to = transferEvent.data.to as string | undefined;
  const amount = transferEvent.data.amount as string | undefined;

  if (assetId === undefined || !from || !to || !amount) {
    return null;
  }

  return {
    assetId,
    from,
    to,
    amount: amount.toString(),
    success: true,
  };
}

/**
 * Build a unique extrinsic identifier from block hash and index
 */
export function buildExtrinsicId(blockHash: string, extrinsicIndex: number): string {
  return `${blockHash}-${extrinsicIndex}`;
}

/**
 * Parse an extrinsic identifier back to components
 */
export function parseExtrinsicId(
  extrinsicId: string,
): { blockHash: string; extrinsicIndex: number } | null {
  const lastDashIndex = extrinsicId.lastIndexOf("-");
  if (lastDashIndex === -1) {
    return null;
  }

  const blockHash = extrinsicId.slice(0, lastDashIndex);
  const extrinsicIndex = parseInt(extrinsicId.slice(lastDashIndex + 1), 10);

  if (!isValidBlockHash(blockHash) || isNaN(extrinsicIndex)) {
    return null;
  }

  return { blockHash, extrinsicIndex };
}
