/**
 * Permit2 Proxy Types
 *
 * Type definitions for T402 Permit2 proxy scheme with witness-based
 * facilitator binding via proxy contracts.
 */

import { PermitTransferFrom, TokenPermissions } from "../permit2/types";

/**
 * Witness data bound into the payer's EIP-712 signature.
 * Matches the Witness struct in T402BasePermit2Proxy.sol.
 */
export type T402Witness = {
  /** Destination address for the token transfer */
  to: `0x${string}`;
  /** Address authorized to call settle (must match facilitator) */
  facilitator: `0x${string}`;
  /** Earliest timestamp when settlement is permitted (0 = immediate) */
  validAfter: string;
};

/**
 * Permit2 Proxy payment payload (V2)
 */
export type Permit2ProxyPayloadV2 = {
  /** The permit parameters */
  permit: PermitTransferFrom;
  /** Witness data bound into the signature */
  witness: T402Witness;
  /** EIP-712 signature over PermitWitnessTransferFrom with Witness */
  signature: `0x${string}`;
  /** Token owner address */
  owner: `0x${string}`;
};

// Re-export shared types from permit2
export type { PermitTransferFrom, TokenPermissions };
