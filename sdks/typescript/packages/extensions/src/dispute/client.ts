/**
 * Client-side helpers for the Dispute extension.
 *
 * Provides utilities for: building a dispute payload from a receipt,
 * extracting dispute terms from a 402 response, and packaging a signed
 * dispute for submission.
 */

import type {
  DisputePayload,
  DisputeReason,
  DisputeRequirementsExtension,
  DisputeSubmissionExtension,
  DisputeTermsInfo,
  EIP712DisputeSigner,
  SignedDispute,
} from "./types";
import { createSignedDispute } from "./signing";
import { STANDARD_DISPUTE_REASONS } from "./types";

/** Default dispute envelope lifetime: 24 hours. */
export const DEFAULT_DISPUTE_VALIDITY_SECONDS = 24 * 60 * 60;

/**
 * Extract dispute terms from a 402 PaymentRequired response.
 *
 * @param extensions The `extensions` block from the 402 response body.
 * @returns The DisputeTermsInfo if present, otherwise undefined.
 */
export function extractDisputeTerms(
  extensions?: Record<string, unknown>,
): DisputeTermsInfo | undefined {
  const ext = extensions?.dispute as DisputeRequirementsExtension | undefined;
  return ext?.info;
}

/**
 * Check whether a reason is a "standard" closed-enum reason, as opposed
 * to an `x_*`-prefixed extension.
 *
 * @param reason The reason to check.
 */
export function isStandardReason(reason: string): reason is DisputeReason {
  return (STANDARD_DISPUTE_REASONS as readonly string[]).includes(reason);
}

/**
 * Build a dispute payload from a receipt hash and dispute details.
 *
 * @param params Dispute construction parameters.
 * @param params.receiptHash EIP-712 hash of the SignedReceipt being disputed.
 * @param params.reason The dispute reason.
 * @param params.requestedAmount Refund requested in token smallest unit.
 * @param params.evidence Optional URIs pointing to dispute evidence.
 * @param params.validUntil Optional unix-seconds expiration. Defaults to
 *   now + DEFAULT_DISPUTE_VALIDITY_SECONDS.
 * @param params.version Optional extension version, defaults to 1.
 */
export function buildDisputePayload(params: {
  receiptHash: string;
  reason: DisputeReason;
  requestedAmount: string;
  evidence?: string[];
  validUntil?: number;
  version?: number;
}): DisputePayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    version: params.version ?? 1,
    receiptHash: params.receiptHash,
    reason: params.reason,
    requestedAmount: params.requestedAmount,
    validUntil: params.validUntil ?? now + DEFAULT_DISPUTE_VALIDITY_SECONDS,
    ...(params.evidence !== undefined ? { evidence: params.evidence } : {}),
  };
}

/**
 * One-call helper: build a dispute payload and sign it.
 *
 * @param signer The EIP-712 dispute signer (typically the payer).
 * @param params Dispute construction parameters (see buildDisputePayload).
 * @param signerAddress Optional delegate signer address.
 */
export async function buildAndSignDispute(
  signer: EIP712DisputeSigner,
  params: {
    receiptHash: string;
    reason: DisputeReason;
    requestedAmount: string;
    evidence?: string[];
    validUntil?: number;
    version?: number;
  },
  signerAddress?: string,
): Promise<SignedDispute> {
  const payload = buildDisputePayload(params);
  return createSignedDispute(signer, payload, signerAddress);
}

/**
 * Package a SignedDispute as the wire-format submission extension.
 *
 * @param signed The signed dispute to package.
 */
export function packageDisputeSubmission(
  signed: SignedDispute,
): DisputeSubmissionExtension {
  return {
    info: {
      submission: signed,
    },
  };
}

/**
 * Build the full submission body for `POST /v2/dispute`.
 *
 * @param signed The signed dispute to submit.
 */
export function buildDisputeSubmissionBody(
  signed: SignedDispute,
): { extensions: { dispute: DisputeSubmissionExtension } } {
  return {
    extensions: {
      dispute: packageDisputeSubmission(signed),
    },
  };
}
