/**
 * Offer and Receipt signing and verification logic.
 *
 * Supports EIP-712 and JWS (compact) signature formats. EIP-712 verification
 * uses the `EIP712OfferReceiptVerifier` interface; JWS verification is
 * delegated to the `verifyJWSSignature` helper with a caller-supplied key
 * resolver (see `./jws.ts` for supported algorithms).
 */

import { verifyJWSSignature, type JWSKeyResolver } from "./jws";
import type {
  OfferPayload,
  ReceiptPayload,
  EIP712Offer,
  EIP712Receipt,
  SignedOffer,
  SignedReceipt,
  EIP712OfferReceiptSigner,
  EIP712OfferReceiptVerifier,
} from "./types";

/**
 * Options for `verifyOffer` / `verifyReceipt` covering JWS-format inputs.
 *
 * When the signed object's `format === 'jws'`, a `resolveJWSKey` callback
 * must be supplied. EIP-712 inputs do not require options.
 */
export interface VerifyOfferReceiptOptions {
  /**
   * Resolve the public key for a given JWS protected header. Called after
   * header parse and before signature verification. Typically looks up
   * `header.kid` in a JWKS endpoint or a local registry.
   */
  resolveJWSKey?: JWSKeyResolver;
}

// EIP-712 constants are re-exported at the bottom of this file

/**
 * Create a signed offer from payment requirements.
 */
export async function createSignedOffer(
  signer: EIP712OfferReceiptSigner,
  payload: OfferPayload,
  acceptIndex?: number,
): Promise<EIP712Offer> {
  const signature = await signer.signOffer(payload);
  return {
    format: "eip712",
    payload,
    signature,
    ...(acceptIndex !== undefined ? { acceptIndex } : {}),
  };
}

/**
 * Create a signed receipt after successful payment.
 */
export async function createSignedReceipt(
  signer: EIP712OfferReceiptSigner,
  payload: ReceiptPayload,
): Promise<EIP712Receipt> {
  const signature = await signer.signReceipt(payload);
  return {
    format: "eip712",
    payload,
    signature,
  };
}

/**
 * Verify a signed offer. Dispatches to EIP-712 recovery or JWS verification
 * based on `offer.format`. For JWS-format offers, `options.resolveJWSKey`
 * must be supplied (see `JWSKeyResolver`).
 *
 * Returns `{ valid: true, signer, payload }` on success, or `{ valid: false }`
 * on any failure. The `signer` field carries the recovered EVM address for
 * EIP-712 inputs and the JWS header's `kid` (when present) for JWS inputs.
 */
export async function verifyOffer(
  verifier: EIP712OfferReceiptVerifier,
  offer: SignedOffer,
  options?: VerifyOfferReceiptOptions,
): Promise<{ valid: boolean; signer?: string; payload?: OfferPayload }> {
  if (offer.format === "jws") {
    if (!options?.resolveJWSKey) {
      throw new Error(
        "verifyOffer: offer.format is 'jws' but options.resolveJWSKey was not provided. " +
          "Pass a JWS key resolver to verify JWS offers.",
      );
    }
    const result = await verifyJWSSignature(offer.signature, options.resolveJWSKey);
    if (!result.valid) return { valid: false };
    const payload = result.payload as OfferPayload | undefined;
    const kid = result.header?.kid;
    return {
      valid: true,
      ...(kid !== undefined ? { signer: kid } : {}),
      ...(payload !== undefined ? { payload } : {}),
    };
  }

  try {
    const signerAddress = await verifier.recoverOfferSigner(
      offer.payload,
      offer.signature,
    );
    return {
      valid: true,
      signer: signerAddress,
      payload: offer.payload,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Verify a signed receipt. Dispatches to EIP-712 recovery or JWS verification
 * based on `receipt.format`. Same options semantics as `verifyOffer`.
 */
export async function verifyReceipt(
  verifier: EIP712OfferReceiptVerifier,
  receipt: SignedReceipt,
  options?: VerifyOfferReceiptOptions,
): Promise<{ valid: boolean; signer?: string; payload?: ReceiptPayload }> {
  if (receipt.format === "jws") {
    if (!options?.resolveJWSKey) {
      throw new Error(
        "verifyReceipt: receipt.format is 'jws' but options.resolveJWSKey was not provided. " +
          "Pass a JWS key resolver to verify JWS receipts.",
      );
    }
    const result = await verifyJWSSignature(receipt.signature, options.resolveJWSKey);
    if (!result.valid) return { valid: false };
    const payload = result.payload as ReceiptPayload | undefined;
    const kid = result.header?.kid;
    return {
      valid: true,
      ...(kid !== undefined ? { signer: kid } : {}),
      ...(payload !== undefined ? { payload } : {}),
    };
  }

  try {
    const signerAddress = await verifier.recoverReceiptSigner(
      receipt.payload,
      receipt.signature,
    );
    return {
      valid: true,
      signer: signerAddress,
      payload: receipt.payload,
    };
  } catch {
    return { valid: false };
  }
}

/**
 * Match an offer to payment requirements by comparing key fields.
 */
export function matchOfferToRequirements(
  offer: SignedOffer,
  requirements: {
    scheme: string;
    network: string;
    asset: string;
    payTo: string;
    amount: string;
  },
): boolean {
  const payload = offer.format === "eip712" ? offer.payload : null;
  if (!payload) return false;

  return (
    payload.scheme === requirements.scheme &&
    payload.network === requirements.network &&
    payload.asset.toLowerCase() === requirements.asset.toLowerCase() &&
    payload.payTo.toLowerCase() === requirements.payTo.toLowerCase() &&
    payload.amount === requirements.amount
  );
}

/**
 * Check if an offer has expired.
 */
export function isOfferExpired(offer: SignedOffer, nowSeconds?: number): boolean {
  const payload = offer.format === "eip712" ? offer.payload : null;
  if (!payload) return true;

  if (!payload.validUntil || payload.validUntil === 0) return false;

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  return now > payload.validUntil;
}

// Re-export domain and normalization for signer implementations
export {
  OFFER_DOMAIN,
  RECEIPT_DOMAIN,
  OFFER_TYPES,
  RECEIPT_TYPES,
  OFFER_PRIMARY_TYPE,
  RECEIPT_PRIMARY_TYPE,
  normalizeOfferForSigning,
  normalizeReceiptForSigning,
} from "./eip712";
