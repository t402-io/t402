/**
 * Server-side helpers for the Dispute extension.
 *
 * Provides utilities for: declaring dispute terms in the 402 response,
 * parsing a dispute submission, and validating it against server-declared
 * terms + the original receipt.
 */

import type {
  ArbiterScheme,
  DisputePayload,
  DisputeReason,
  DisputeRequirementsExtension,
  DisputeSubmissionExtension,
  DisputeTermsInfo,
  DisputeValidation,
  EIP712DisputeVerifier,
  ResolutionPayload,
  ResolutionResponseExtension,
  ResolutionValidation,
  SignedDispute,
  SignedResolution,
} from "./types";
import { ARBITER_SCHEMES, STANDARD_DISPUTE_REASONS } from "./types";
import {
  isDisputeExpired,
  isVerdictAmountConsistent,
  verifyDispute,
  verifyResolution,
} from "./signing";

/** Default acceptable evidence URI schemes (spec §Extension Data). */
export const DEFAULT_EVIDENCE_URI_SCHEMES = ["ipfs", "arweave", "https"];

/** Extension key — must match specs/extensions/dispute.md §Overview. */
export const DISPUTE_EXTENSION_KEY = "dispute" as const;

/**
 * Build the `dispute` extension block for a 402 PaymentRequired response.
 *
 * @param params Server-declared dispute terms.
 */
export function buildDisputeRequirements(
  params: DisputeTermsInfo,
): DisputeRequirementsExtension {
  if (!ARBITER_SCHEMES.includes(params.arbiterScheme)) {
    throw new Error(
      `buildDisputeRequirements: unsupported arbiterScheme ` +
        `"${params.arbiterScheme}"; expected one of ` +
        ARBITER_SCHEMES.join(", "),
    );
  }
  if (params.disputeWindow <= 0) {
    throw new Error(
      `buildDisputeRequirements: disputeWindow must be positive ` +
        `(got ${params.disputeWindow})`,
    );
  }
  if (params.supportedReasons.length === 0) {
    throw new Error(
      "buildDisputeRequirements: supportedReasons must not be empty",
    );
  }
  return {
    info: {
      arbiter: params.arbiter,
      arbiterScheme: params.arbiterScheme,
      disputeWindow: params.disputeWindow,
      supportedReasons: params.supportedReasons,
      ...(params.evidenceUriSchemes !== undefined
        ? { evidenceUriSchemes: params.evidenceUriSchemes }
        : {}),
    },
  };
}

/**
 * Parse a dispute submission body (`POST /v2/dispute`) into a SignedDispute.
 *
 * @param body The submission body as a parsed JSON object.
 * @returns The SignedDispute, or undefined if the body is malformed.
 */
export function parseDisputeSubmission(
  body: unknown,
): SignedDispute | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const extensions = (body as { extensions?: unknown }).extensions;
  if (typeof extensions !== "object" || extensions === null) return undefined;
  const dispute = (extensions as { dispute?: unknown }).dispute as
    | DisputeSubmissionExtension
    | undefined;
  if (!dispute?.info?.submission) return undefined;
  return dispute.info.submission;
}

/**
 * Full validation pipeline for an incoming dispute. Combines signature
 * verification with the business rules from specs/extensions/dispute.md
 * §Verification.
 *
 * @param params Validation inputs.
 * @param params.verifier EIP-712 signature verifier.
 * @param params.dispute The signed dispute to validate.
 * @param params.receipt Receipt details — `issuedAt` from the receipt
 *   payload, and the receipt's hash for binding check.
 * @param params.receipt.issuedAt Receipt issuance unix-seconds.
 * @param params.receipt.hash EIP-712 hash of the SignedReceipt.
 * @param params.receipt.amount Settled receipt amount, in token smallest
 *   unit. Used to check `requestedAmount <= receipt.amount`.
 * @param params.terms Server-declared dispute terms from the original 402.
 * @param params.now Current time in unix-seconds. Defaults to Date.now()/1000.
 */
export async function validateDispute(params: {
  verifier: EIP712DisputeVerifier;
  dispute: SignedDispute;
  receipt: {
    issuedAt: number;
    hash: string;
    amount: string;
  };
  terms: DisputeTermsInfo;
  now?: number;
}): Promise<DisputeValidation> {
  const { verifier, dispute, receipt, terms } = params;
  const now = params.now ?? Math.floor(Date.now() / 1000);

  if (dispute.format !== "eip712") {
    return {
      valid: false,
      error: "dispute_unsupported_format",
      detail: `Format "${dispute.format}" not yet supported`,
    };
  }

  // (1) Signature.
  const verify = await verifyDispute(verifier, dispute);
  if (!verify.valid) {
    return {
      valid: false,
      error: "dispute_invalid_signature",
    };
  }

  const { payload } = dispute;

  // (2) Envelope expiry.
  if (isDisputeExpired(dispute, now)) {
    return {
      valid: false,
      error: "dispute_expired",
      detail: `validUntil=${payload.validUntil}, now=${now}`,
    };
  }

  // (3) Receipt binding.
  if (
    payload.receiptHash.toLowerCase() !== receipt.hash.toLowerCase()
  ) {
    return {
      valid: false,
      error: "dispute_unknown_receipt",
      detail:
        `dispute.receiptHash=${payload.receiptHash} ` +
        `vs receipt.hash=${receipt.hash}`,
    };
  }

  // (4) Dispute window.
  const windowEnd = receipt.issuedAt + terms.disputeWindow;
  if (now < receipt.issuedAt || now > windowEnd) {
    return {
      valid: false,
      error: "dispute_out_of_window",
      detail:
        `window=[${receipt.issuedAt},${windowEnd}], now=${now}`,
    };
  }

  // (5) Reason allowed.
  if (!isReasonSupported(payload.reason, terms.supportedReasons)) {
    return {
      valid: false,
      error: "dispute_invalid_reason",
      detail: `reason "${payload.reason}" not in supportedReasons`,
    };
  }

  // (6) Amount bounded.
  if (BigInt(payload.requestedAmount) > BigInt(receipt.amount)) {
    return {
      valid: false,
      error: "dispute_amount_exceeds_receipt",
      detail:
        `requestedAmount=${payload.requestedAmount} ` +
        `> receipt.amount=${receipt.amount}`,
    };
  }

  // (7) Evidence URI schemes.
  const allowedSchemes =
    terms.evidenceUriSchemes ?? DEFAULT_EVIDENCE_URI_SCHEMES;
  if (payload.evidence) {
    for (const uri of payload.evidence) {
      if (!isEvidenceUriAllowed(uri, allowedSchemes)) {
        return {
          valid: false,
          error: "dispute_evidence_uri_unsupported",
          detail: `URI "${uri}" not in allowed schemes`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate a SignedResolution against the original dispute it resolves.
 *
 * @param params Validation inputs.
 * @param params.verifier EIP-712 verifier.
 * @param params.resolution The signed resolution to validate.
 * @param params.dispute The original SignedDispute being resolved (for
 *   verdict↔amount consistency).
 * @param params.disputeHash EIP-712 hash of the original signed dispute.
 * @param params.expectedArbiter The arbiter address from the receipt's
 *   offer (or the server's 402 dispute terms).
 */
export async function validateResolution(params: {
  verifier: EIP712DisputeVerifier;
  resolution: SignedResolution;
  dispute: SignedDispute;
  disputeHash: string;
  expectedArbiter: string;
}): Promise<ResolutionValidation> {
  const { verifier, resolution, dispute, disputeHash, expectedArbiter } =
    params;

  if (resolution.format !== "eip712") {
    return {
      valid: false,
      error: "resolution_unsupported_format",
    };
  }

  // (1) Signature + arbiter check.
  const verify = await verifyResolution(
    verifier,
    resolution,
    expectedArbiter,
  );
  if (!verify.valid) {
    return {
      valid: false,
      error: "resolution_invalid_signature",
    };
  }

  const { payload } = resolution;

  // (2) Resolution must reference the dispute we have.
  if (
    payload.disputeHash.toLowerCase() !== disputeHash.toLowerCase()
  ) {
    return {
      valid: false,
      error: "resolution_unknown_dispute",
    };
  }

  // (3) The payload-declared arbiter address must agree with our
  //     expected arbiter (the on-the-wire field, not just the
  //     signature recovery).
  if (payload.arbiter.toLowerCase() !== expectedArbiter.toLowerCase()) {
    return {
      valid: false,
      error: "resolution_arbiter_mismatch",
    };
  }

  // (4) Verdict ↔ settledAmount consistency.
  if (dispute.format !== "eip712") {
    return {
      valid: false,
      error: "resolution_unsupported_format",
      detail: "dispute is not eip712 format",
    };
  }
  if (
    !isVerdictAmountConsistent(resolution, dispute.payload.requestedAmount)
  ) {
    return {
      valid: false,
      error: "resolution_verdict_amount_inconsistent",
      detail:
        `verdict=${payload.verdict}, settled=${payload.settledAmount}, ` +
        `requested=${dispute.payload.requestedAmount}`,
    };
  }

  return { valid: true };
}

/**
 * Check whether a reason is in the server's accepted list. Supports
 * `x_*`-prefixed custom values per spec.
 *
 * @param reason The reason claimed in the dispute.
 * @param supported The list of reasons the server accepts.
 */
export function isReasonSupported(
  reason: string,
  supported: DisputeReason[],
): boolean {
  return (supported as readonly string[]).includes(reason);
}

/**
 * Check whether an evidence URI uses a permitted scheme.
 *
 * @param uri The evidence URI to check.
 * @param allowedSchemes The allowed schemes for evidence URIs.
 */
export function isEvidenceUriAllowed(
  uri: string,
  allowedSchemes: string[],
): boolean {
  const colonIdx = uri.indexOf(":");
  if (colonIdx <= 0) return false;
  const scheme = uri.slice(0, colonIdx);
  return allowedSchemes.includes(scheme);
}

/**
 * Validate that the reason being declared by the server is either
 * standard or `x_*`-prefixed. Catches typos before the 402 ships.
 *
 * @param reason The dispute reason to check.
 */
export function isReasonWellFormed(reason: string): boolean {
  return (
    (STANDARD_DISPUTE_REASONS as readonly string[]).includes(reason) ||
    reason.startsWith("x_")
  );
}

/**
 * Package a SignedResolution as the wire-format response extension.
 *
 * @param signed The signed resolution to package.
 */
export function packageResolutionResponse(
  signed: SignedResolution,
): ResolutionResponseExtension {
  return {
    info: {
      resolution: signed,
    },
  };
}

/** Re-exports for symmetry with offer-receipt's server module. */
export type { ArbiterScheme, DisputePayload, ResolutionPayload };
