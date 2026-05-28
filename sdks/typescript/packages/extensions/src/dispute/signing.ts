/**
 * Dispute and Resolution signing and verification logic.
 *
 * Supports EIP-712 typed data signing via a caller-supplied
 * `EIP712DisputeSigner` / `EIP712DisputeVerifier`. JWS format is
 * declared in the spec but reserved for future implementation.
 */

import type {
  DisputePayload,
  ResolutionPayload,
  EIP712Dispute,
  EIP712Resolution,
  SignedDispute,
  SignedResolution,
  EIP712DisputeSigner,
  EIP712DisputeVerifier,
} from "./types";

/**
 * Sign a dispute payload using the supplied signer.
 *
 * @param signer The EIP-712 dispute signer.
 * @param payload The dispute payload to sign.
 * @param signerAddress Optional explicit signer address when signed by
 *   a delegate (e.g. ERC-7710) rather than the payer themselves.
 *   When omitted, the dispute is presumed to be signed by the payer.
 */
export async function createSignedDispute(
  signer: EIP712DisputeSigner,
  payload: DisputePayload,
  signerAddress?: string,
): Promise<EIP712Dispute> {
  const signature = await signer.signDispute(payload);
  return {
    format: "eip712",
    payload,
    signature,
    ...(signerAddress !== undefined ? { signer: signerAddress } : {}),
  };
}

/**
 * Sign a resolution payload using the arbiter's signer.
 *
 * @param signer The EIP-712 dispute signer (arbiter).
 * @param payload The resolution payload to sign.
 */
export async function createSignedResolution(
  signer: EIP712DisputeSigner,
  payload: ResolutionPayload,
): Promise<EIP712Resolution> {
  const signature = await signer.signResolution(payload);
  return {
    format: "eip712",
    payload,
    signature,
  };
}

/**
 * Verify a signed dispute. Returns the recovered signer address (which
 * is either the payer or the explicit `signer` field for delegate-signed
 * disputes).
 *
 * Returns `{ valid: true, signer, payload }` on success, or
 * `{ valid: false }` on signature recovery failure.
 *
 * Note: this only verifies the signature, NOT business-level rules like
 * dispute-window enforcement or receipt binding. Use `validateDispute`
 * (from ./server) for full validation.
 *
 * @param verifier The EIP-712 dispute verifier.
 * @param dispute The signed dispute to verify.
 */
export async function verifyDispute(
  verifier: EIP712DisputeVerifier,
  dispute: SignedDispute,
): Promise<{ valid: boolean; signer?: string; payload?: DisputePayload }> {
  if (dispute.format === "jws") {
    throw new Error(
      "verifyDispute: JWS format is reserved for future spec; only " +
        "EIP-712 is currently supported.",
    );
  }
  try {
    const recoveredAddress = await verifier.recoverDisputeSigner(
      dispute.payload,
      dispute.signature,
    );
    if (!recoveredAddress) {
      return { valid: false };
    }
    return {
      valid: true,
      signer: dispute.signer ?? recoveredAddress,
      payload: dispute.payload,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Verify a signed resolution. Returns the recovered arbiter address.
 *
 * @param verifier The EIP-712 dispute verifier.
 * @param resolution The signed resolution to verify.
 * @param expectedArbiter Optional expected arbiter address. When supplied,
 *   the recovered signer is asserted to equal this address; mismatch
 *   returns `valid: false`.
 */
export async function verifyResolution(
  verifier: EIP712DisputeVerifier,
  resolution: SignedResolution,
  expectedArbiter?: string,
): Promise<{ valid: boolean; signer?: string; payload?: ResolutionPayload }> {
  if (resolution.format === "jws") {
    throw new Error(
      "verifyResolution: JWS format is reserved for future spec; only " +
        "EIP-712 is currently supported.",
    );
  }
  try {
    const recoveredAddress = await verifier.recoverResolutionSigner(
      resolution.payload,
      resolution.signature,
    );
    if (!recoveredAddress) {
      return { valid: false };
    }
    if (
      expectedArbiter !== undefined &&
      recoveredAddress.toLowerCase() !== expectedArbiter.toLowerCase()
    ) {
      return { valid: false };
    }
    return {
      valid: true,
      signer: recoveredAddress,
      payload: resolution.payload,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Check whether a dispute envelope has expired based on `validUntil`.
 *
 * @param dispute The signed dispute to check.
 * @param now Current time in Unix seconds. Defaults to `Date.now() / 1000`.
 */
export function isDisputeExpired(
  dispute: SignedDispute,
  now?: number,
): boolean {
  if (dispute.format === "jws") return false;
  const current = now ?? Math.floor(Date.now() / 1000);
  return dispute.payload.validUntil < current;
}

/**
 * Validate the verdict ↔ settledAmount consistency rule from the spec
 * §Verification: denied/void → settledAmount == 0; upheld_full →
 * settledAmount == dispute.requestedAmount; upheld_partial →
 * 0 < settledAmount <= dispute.requestedAmount.
 *
 * @param resolution The resolution to validate.
 * @param disputeRequestedAmount The amount the original dispute requested.
 */
export function isVerdictAmountConsistent(
  resolution: SignedResolution,
  disputeRequestedAmount: string,
): boolean {
  if (resolution.format === "jws") return true;
  const { verdict, settledAmount } = resolution.payload;
  const settled = BigInt(settledAmount);
  const requested = BigInt(disputeRequestedAmount);
  switch (verdict) {
    case "denied":
    case "void":
      return settled === 0n;
    case "upheld_full":
      return settled === requested;
    case "upheld_partial":
      return settled > 0n && settled <= requested;
    default:
      return false;
  }
}
