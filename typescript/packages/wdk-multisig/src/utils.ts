/**
 * WDK Multi-sig Utilities
 *
 * Utility functions for signature handling and validation.
 */

import type { Address, Hex } from "viem";
import { concat, hexToBigInt } from "viem";
import { SIGNATURE_TYPES } from "./constants.js";

/**
 * Combine multiple signatures in Safe's expected format
 *
 * Safe requires signatures to be sorted by owner address (ascending)
 * and concatenated together.
 *
 * @param signatures - Map of owner index to signature
 * @param owners - Array of owner addresses in order
 * @returns Combined signature in Safe format
 */
export function combineSignatures(
  signatures: Map<number, Hex>,
  owners: Address[],
): Hex {
  // Create array of (address, signature) pairs
  const pairs: Array<[Address, Hex]> = [];

  for (const [index, sig] of signatures) {
    const owner = owners[index];
    if (owner) {
      pairs.push([owner, sig]);
    }
  }

  // Sort by address (Safe requirement)
  // Compare addresses as BigInt for proper sorting
  pairs.sort((a, b) => {
    const addrA = hexToBigInt(a[0]);
    const addrB = hexToBigInt(b[0]);
    return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
  });

  // Concatenate signatures
  if (pairs.length === 0) {
    return "0x" as Hex;
  }

  return concat(pairs.map(([, sig]) => sig)) as Hex;
}

/**
 * Format a single signature for Safe
 *
 * Appends the signature type byte to the signature.
 *
 * @param signature - Raw signature (65 bytes)
 * @param type - Signature type (default: EOA)
 * @returns Formatted signature with type byte
 */
export function formatSignatureForSafe(
  signature: Hex,
  type: keyof typeof SIGNATURE_TYPES = "EOA",
): Hex {
  return concat([signature, SIGNATURE_TYPES[type]]) as Hex;
}

/**
 * Generate a unique request ID
 *
 * @returns Unique request ID
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `msig_${timestamp}_${random}`;
}

/**
 * Check if a threshold is valid
 *
 * @param threshold - Threshold value
 * @param ownerCount - Number of owners
 * @returns True if valid
 */
export function isValidThreshold(
  threshold: number,
  ownerCount: number,
): boolean {
  return threshold >= 1 && threshold <= ownerCount;
}

/**
 * Sort addresses in ascending order
 *
 * @param addresses - Array of addresses
 * @returns Sorted array
 */
export function sortAddresses(addresses: Address[]): Address[] {
  return [...addresses].sort((a, b) => {
    const addrA = hexToBigInt(a);
    const addrB = hexToBigInt(b);
    return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
  });
}

/**
 * Get the index of an owner in the sorted owner list
 *
 * @param owner - Owner address
 * @param owners - Array of owner addresses (sorted)
 * @returns Index or -1 if not found
 */
export function getOwnerIndex(owner: Address, owners: Address[]): number {
  const sortedOwners = sortAddresses(owners);
  const lowerOwner = owner.toLowerCase();
  return sortedOwners.findIndex((o) => o.toLowerCase() === lowerOwner);
}

/**
 * Validate that addresses are unique
 *
 * @param addresses - Array of addresses
 * @returns True if all unique
 */
export function areAddressesUnique(addresses: Address[]): boolean {
  const lowerAddresses = addresses.map((a) => a.toLowerCase());
  return new Set(lowerAddresses).size === addresses.length;
}
