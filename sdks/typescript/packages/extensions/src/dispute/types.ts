/**
 * Types for the Dispute extension.
 *
 * Disputes: A payer (or its delegate) signs a complaint against a previously
 * issued receipt, requesting a full or partial refund.
 * Resolutions: A designated arbiter signs a verdict resolving the dispute.
 *
 * See specs/extensions/dispute.md for the full protocol.
 */

import type { SignedReceipt } from "../offer-receipt/types";

/** Signature format for disputes and resolutions */
export type DisputeSignatureFormat = "eip712" | "jws";

// ============================================================================
// Reason and Verdict Enums
// ============================================================================

/** Standard dispute reasons. Servers MAY define `x_*`-prefixed values for
 *  non-standard reasons; such values are non-interoperable. */
export type DisputeReason =
  | "not_delivered"
  | "partial_delivery"
  | "quality_issue"
  | "unauthorized"
  | "service_unavailable"
  | "duplicate_charge"
  | "other"
  | `x_${string}`;

export const STANDARD_DISPUTE_REASONS: readonly DisputeReason[] = [
  "not_delivered",
  "partial_delivery",
  "quality_issue",
  "unauthorized",
  "service_unavailable",
  "duplicate_charge",
  "other",
] as const;

/** Arbiter verdict on a dispute. Closed enum. */
export type DisputeVerdict =
  | "upheld_full"
  | "upheld_partial"
  | "denied"
  | "void";

export const DISPUTE_VERDICTS: readonly DisputeVerdict[] = [
  "upheld_full",
  "upheld_partial",
  "denied",
  "void",
] as const;

/** Arbiter scheme declared by the server in the 402 response. */
export type ArbiterScheme = "facilitator" | "contract" | "external" | "none";

export const ARBITER_SCHEMES: readonly ArbiterScheme[] = [
  "facilitator",
  "contract",
  "external",
  "none",
] as const;

// ============================================================================
// Dispute Payload
// ============================================================================

/** Canonical dispute payload fields */
export interface DisputePayload {
  /** Extension version (currently 1) */
  version: number;
  /** EIP-712 hash of the SignedReceipt being disputed */
  receiptHash: string;
  /** Standard or `x_*`-prefixed dispute reason */
  reason: DisputeReason;
  /** Refund requested, in token smallest unit. "0" = on-record only */
  requestedAmount: string;
  /** Unix timestamp after which the dispute envelope is no longer valid */
  validUntil: number;
  /** URIs pointing to dispute evidence (IPFS / Arweave / HTTPS) */
  evidence?: string[];
}

/** A signed dispute (EIP-712 format) */
export interface EIP712Dispute {
  format: "eip712";
  payload: DisputePayload;
  signature: string;
  /** Explicit signer address when signed by a delegate (e.g. ERC-7710)
   *  rather than the payer themselves. */
  signer?: string;
}

/** A signed dispute (JWS format — reserved for future spec) */
export interface JWSDispute {
  format: "jws";
  signature: string;
  signer?: string;
}

/** A signed dispute in either format */
export type SignedDispute = EIP712Dispute | JWSDispute;

// ============================================================================
// Resolution Payload
// ============================================================================

/** Canonical resolution payload fields */
export interface ResolutionPayload {
  /** Extension version (currently 1) */
  version: number;
  /** EIP-712 hash of the SignedDispute being resolved */
  disputeHash: string;
  /** Arbiter verdict */
  verdict: DisputeVerdict;
  /** Actual refund amount granted, in token smallest unit. MUST equal 0
   *  for `denied` or `void`. */
  settledAmount: string;
  /** Address of the arbiter issuing the resolution; MUST match the
   *  arbiter advertised on the receipt's offer. */
  arbiter: string;
  /** Unix timestamp of resolution issuance */
  issuedAt: number;
  /** On-chain refund tx hash (0x + 64 hex), or an off-chain ref like
   *  "offchain://wire/2026-05-28/INV-123". Empty when no refund issued. */
  refundTransaction?: string;
}

/** A signed resolution (EIP-712 format) */
export interface EIP712Resolution {
  format: "eip712";
  payload: ResolutionPayload;
  signature: string;
}

/** A signed resolution (JWS format — reserved for future spec) */
export interface JWSResolution {
  format: "jws";
  signature: string;
}

/** A signed resolution in either format */
export type SignedResolution = EIP712Resolution | JWSResolution;

// ============================================================================
// Extension Wire Format
// ============================================================================

/** Server-declared dispute terms in the 402 response. */
export interface DisputeTermsInfo {
  /** Address authorized to issue SignedResolution */
  arbiter: string;
  /** Arbiter scheme. */
  arbiterScheme: ArbiterScheme;
  /** Max seconds after receipt.issuedAt during which dispute can be filed. */
  disputeWindow: number;
  /** Reasons the server accepts. Subset of DisputeReason. */
  supportedReasons: DisputeReason[];
  /** URI schemes acceptable in evidence[]. Default: ipfs/arweave/https. */
  evidenceUriSchemes?: string[];
}

/** Extension data in the 402 response (PaymentRequired) */
export interface DisputeRequirementsExtension {
  info: DisputeTermsInfo;
}

/** Extension data in a dispute submission body */
export interface DisputeSubmissionExtension {
  info: {
    submission: SignedDispute;
  };
}

/** Extension data in a resolution response body */
export interface ResolutionResponseExtension {
  info: {
    resolution: SignedResolution;
  };
}

// ============================================================================
// Signer Interfaces
// ============================================================================

/** Signer for creating EIP-712 disputes and resolutions */
export interface EIP712DisputeSigner {
  /** Sign a dispute payload, returning the EIP-712 signature. */
  signDispute(payload: DisputePayload): Promise<string>;
  /** Sign a resolution payload, returning the EIP-712 signature. */
  signResolution(payload: ResolutionPayload): Promise<string>;
  /** Get the signer's address for verification. */
  getAddress(): string;
}

/** Verifier for checking EIP-712 dispute and resolution signatures */
export interface EIP712DisputeVerifier {
  /** Recover signer address from a dispute signature. */
  recoverDisputeSigner(
    payload: DisputePayload,
    signature: string,
  ): Promise<string>;
  /** Recover signer address from a resolution signature. */
  recoverResolutionSigner(
    payload: ResolutionPayload,
    signature: string,
  ): Promise<string>;
}

// ============================================================================
// Verification Result
// ============================================================================

/** Result of validating a dispute against server-declared terms + receipt. */
export interface DisputeValidation {
  valid: boolean;
  /** Error code if invalid; one of the codes in DISPUTE_VALIDATION_ERRORS. */
  error?: DisputeValidationError;
  /** Human-readable detail of the error (debug only). */
  detail?: string;
}

/** Closed enum of dispute validation error codes. */
export type DisputeValidationError =
  | "dispute_invalid_signature"
  | "dispute_unknown_receipt"
  | "dispute_out_of_window"
  | "dispute_invalid_reason"
  | "dispute_amount_exceeds_receipt"
  | "dispute_evidence_uri_unsupported"
  | "dispute_expired"
  | "dispute_unsupported_format";

/** Result of validating a resolution against the corresponding dispute. */
export interface ResolutionValidation {
  valid: boolean;
  error?: ResolutionValidationError;
  detail?: string;
}

/** Closed enum of resolution validation error codes. */
export type ResolutionValidationError =
  | "resolution_invalid_signature"
  | "resolution_arbiter_mismatch"
  | "resolution_unknown_dispute"
  | "resolution_verdict_amount_inconsistent"
  | "resolution_unsupported_format";

// ============================================================================
// Receipt binding helper
// ============================================================================

/** Wrapper that pairs a SignedReceipt with the dispute against it. */
export interface DisputeWithReceipt {
  dispute: SignedDispute;
  receipt: SignedReceipt;
}
