/**
 * Facilitator-side helpers for the Dispute extension.
 *
 * Provides the integration glue for facilitators that serve as the
 * `facilitator` arbiterScheme (the t402 facilitator acts as arbiter for
 * disputes). For `contract` or `external` arbiterSchemes, the resolution
 * is signed elsewhere and the facilitator only proxies / verifies.
 */

import type {
  DisputeVerdict,
  EIP712DisputeSigner,
  ResolutionPayload,
  SignedDispute,
  SignedResolution,
} from "./types";
import { createSignedResolution } from "./signing";

/** Inputs to the facilitator-as-arbiter resolution builder. */
export interface FacilitatorResolveInput {
  /** EIP-712 hash of the SignedDispute being resolved. */
  disputeHash: string;
  /** Arbiter verdict (one of upheld_full/upheld_partial/denied/void). */
  verdict: DisputeVerdict;
  /** Settled refund amount; MUST be 0 for denied/void. */
  settledAmount: string;
  /** On-chain or off-chain refund reference, optional. */
  refundTransaction?: string;
  /** Resolution version, defaults to 1. */
  version?: number;
  /** Issued-at unix-seconds; defaults to current time. */
  issuedAt?: number;
}

/**
 * Facilitator handler that produces a SignedResolution from a verdict
 * decision. The facilitator's signing key is the arbiter address; that
 * address MUST match what the merchant advertised in the 402 dispute
 * terms (`arbiter` field).
 */
export interface DisputeFacilitatorHandler {
  /** Resolve a verified dispute by signing a resolution payload. */
  resolveDispute(input: FacilitatorResolveInput): Promise<SignedResolution>;
  /** The arbiter address (= the facilitator's signing key). */
  getArbiterAddress(): string;
}

/**
 * Build a DisputeFacilitatorHandler from a generic EIP-712 dispute
 * signer (typically the facilitator's wallet).
 *
 * @param signer The EIP-712 signer that holds the facilitator's key.
 */
export function createDisputeFacilitatorHandler(
  signer: EIP712DisputeSigner,
): DisputeFacilitatorHandler {
  const arbiterAddress = signer.getAddress();
  return {
    getArbiterAddress() {
      return arbiterAddress;
    },
    async resolveDispute(input) {
      const payload: ResolutionPayload = {
        version: input.version ?? 1,
        disputeHash: input.disputeHash,
        verdict: input.verdict,
        settledAmount: input.settledAmount,
        arbiter: arbiterAddress,
        issuedAt: input.issuedAt ?? Math.floor(Date.now() / 1000),
        ...(input.refundTransaction !== undefined
          ? { refundTransaction: input.refundTransaction }
          : {}),
      };
      return createSignedResolution(signer, payload);
    },
  };
}

/**
 * Helper for facilitators: given a SignedDispute and a policy verdict,
 * produce the resolution in one call. Useful when the verdict has been
 * pre-decided by an off-chain arbitration process.
 *
 * @param handler The facilitator handler.
 * @param dispute The signed dispute being resolved (used for disputeHash
 *   computation; caller is responsible for providing the hash separately).
 * @param disputeHash EIP-712 hash of the signed dispute.
 * @param verdict The verdict to issue.
 * @param settledAmount The refund amount (must satisfy the verdict↔amount
 *   consistency rule — see specs/extensions/dispute.md §Verification).
 * @param refundTransaction Optional on-chain or off-chain refund reference.
 */
export async function buildFacilitatorResolution(
  handler: DisputeFacilitatorHandler,
  _dispute: SignedDispute,
  disputeHash: string,
  verdict: DisputeVerdict,
  settledAmount: string,
  refundTransaction?: string,
): Promise<SignedResolution> {
  return handler.resolveDispute({
    disputeHash,
    verdict,
    settledAmount,
    ...(refundTransaction !== undefined ? { refundTransaction } : {}),
  });
}
