/**
 * Dispute extension — reference implementation.
 *
 * See specs/extensions/dispute.md for the protocol specification.
 *
 * t402 is the first HTTP-native stablecoin payment protocol with a
 * standardized dispute primitive. The four-step chain that gives t402
 * payments enforceable buyer-side recourse is:
 *
 *   Offer  ->  Receipt  ->  Dispute  ->  Resolution
 *
 * This module provides client / server / facilitator helpers for the
 * Dispute and Resolution envelopes; receipts come from the
 * offer-receipt extension.
 */

// Types
export type {
  DisputeSignatureFormat,
  DisputeReason,
  DisputeVerdict,
  ArbiterScheme,
  DisputePayload,
  EIP712Dispute,
  JWSDispute,
  SignedDispute,
  ResolutionPayload,
  EIP712Resolution,
  JWSResolution,
  SignedResolution,
  DisputeTermsInfo,
  DisputeRequirementsExtension,
  DisputeSubmissionExtension,
  ResolutionResponseExtension,
  EIP712DisputeSigner,
  EIP712DisputeVerifier,
  DisputeValidation,
  DisputeValidationError,
  ResolutionValidation,
  ResolutionValidationError,
  DisputeWithReceipt,
} from "./types";

export {
  STANDARD_DISPUTE_REASONS,
  DISPUTE_VERDICTS,
  ARBITER_SCHEMES,
} from "./types";

// EIP-712 constants
export {
  DISPUTE_DOMAIN,
  RESOLUTION_DOMAIN,
  DISPUTE_TYPES,
  RESOLUTION_TYPES,
  DISPUTE_PRIMARY_TYPE,
  RESOLUTION_PRIMARY_TYPE,
  normalizeDisputeForSigning,
  normalizeResolutionForSigning,
} from "./eip712";

// Signing and verification
export {
  createSignedDispute,
  createSignedResolution,
  verifyDispute,
  verifyResolution,
  isDisputeExpired,
  isVerdictAmountConsistent,
} from "./signing";

// Client helpers
export {
  DEFAULT_DISPUTE_VALIDITY_SECONDS,
  extractDisputeTerms,
  isStandardReason,
  buildDisputePayload,
  buildAndSignDispute,
  packageDisputeSubmission,
  buildDisputeSubmissionBody,
} from "./client";

// Server helpers
export {
  DEFAULT_EVIDENCE_URI_SCHEMES,
  DISPUTE_EXTENSION_KEY,
  buildDisputeRequirements,
  parseDisputeSubmission,
  validateDispute,
  validateResolution,
  isReasonSupported,
  isEvidenceUriAllowed,
  isReasonWellFormed,
  packageResolutionResponse,
} from "./server";

// Facilitator (arbiter-side) helpers
export {
  createDisputeFacilitatorHandler,
  buildFacilitatorResolution,
} from "./facilitator";
export type {
  DisputeFacilitatorHandler,
  FacilitatorResolveInput,
} from "./facilitator";
