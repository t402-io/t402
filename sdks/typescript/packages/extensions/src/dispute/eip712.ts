/**
 * EIP-712 type definitions for Dispute and Resolution signing.
 *
 * The chainId is fixed at 1 (Ethereum mainnet) for all signatures, as
 * EIP-712 serves as an off-chain envelope independent of actual payment
 * networks. This mirrors the offer-receipt extension precedent.
 */

import type { DisputePayload, ResolutionPayload } from "./types";

/** EIP-712 domain for dispute signing */
export const DISPUTE_DOMAIN = {
  name: "T402Dispute",
  version: "1",
  chainId: 1,
} as const;

/** EIP-712 domain for resolution signing.
 *  Uses the same name space as DISPUTE_DOMAIN — a dispute and its
 *  resolution are envelopes of the same protocol. */
export const RESOLUTION_DOMAIN = {
  name: "T402Dispute",
  version: "1",
  chainId: 1,
} as const;

/** EIP-712 typed data types for Dispute. `reason` is `string` (not enum)
 *  in the typed data to allow `x_*` namespace extension without spec rev;
 *  validators MUST parse it against the enum at deserialize time. */
export const DISPUTE_TYPES = {
  Dispute: [
    { name: "version", type: "uint256" },
    { name: "receiptHash", type: "bytes32" },
    { name: "reason", type: "string" },
    { name: "requestedAmount", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "evidence", type: "string[]" },
  ],
} as const;

/** EIP-712 typed data types for Resolution. Same note about `verdict`
 *  being string rather than enum applies. */
export const RESOLUTION_TYPES = {
  Resolution: [
    { name: "version", type: "uint256" },
    { name: "disputeHash", type: "bytes32" },
    { name: "verdict", type: "string" },
    { name: "settledAmount", type: "uint256" },
    { name: "arbiter", type: "address" },
    { name: "issuedAt", type: "uint256" },
    { name: "refundTransaction", type: "string" },
  ],
} as const;

/** Primary type name for disputes */
export const DISPUTE_PRIMARY_TYPE = "Dispute" as const;

/** Primary type name for resolutions */
export const RESOLUTION_PRIMARY_TYPE = "Resolution" as const;

/** Normalize a DisputePayload for EIP-712 signing. Optional `evidence`
 *  becomes an empty array; `requestedAmount` stays as a string (the
 *  signer/verifier coerces to uint256 per the type table).
 *
 * @param payload The dispute payload to normalize.
 */
export function normalizeDisputeForSigning(
  payload: DisputePayload,
): Record<string, unknown> {
  return {
    version: payload.version,
    receiptHash: payload.receiptHash,
    reason: payload.reason,
    requestedAmount: payload.requestedAmount,
    validUntil: payload.validUntil,
    evidence: payload.evidence ?? [],
  };
}

/** Normalize a ResolutionPayload for EIP-712 signing. Optional
 *  `refundTransaction` becomes "" when absent (matches offer-receipt's
 *  pattern of normalizing optional strings to empty).
 *
 * @param payload The resolution payload to normalize.
 */
export function normalizeResolutionForSigning(
  payload: ResolutionPayload,
): Record<string, unknown> {
  return {
    version: payload.version,
    disputeHash: payload.disputeHash,
    verdict: payload.verdict,
    settledAmount: payload.settledAmount,
    arbiter: payload.arbiter,
    issuedAt: payload.issuedAt,
    refundTransaction: payload.refundTransaction ?? "",
  };
}
