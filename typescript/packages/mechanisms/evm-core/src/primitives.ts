/**
 * EVM Primitive Types
 *
 * These type aliases are compatible with viem's types but don't require viem as a dependency.
 * When used with viem, these types are structurally identical and fully interoperable.
 */

/**
 * Ethereum address (20 bytes, checksummed or lowercase)
 * Compatible with viem's Address type
 */
export type Address = `0x${string}`;

/**
 * Hexadecimal string
 * Compatible with viem's Hex type
 */
export type Hex = `0x${string}`;

/**
 * Bytes32 value (32 bytes as hex)
 */
export type Bytes32 = `0x${string}`;

/**
 * Convert a Uint8Array to a hex string
 * Standalone implementation - no viem dependency
 */
export function bytesToHex(bytes: Uint8Array): Hex {
  let hex = "0x";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex as Hex;
}

/**
 * Convert a hex string to Uint8Array
 * Standalone implementation - no viem dependency
 */
export function hexToBytes(hex: Hex): Uint8Array {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
