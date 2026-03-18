/**
 * Offer and Receipt signing and verification logic.
 *
 * Supports EIP-712 format. JWS support can be added later.
 */

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
 * Verify an EIP-712 signed offer.
 * Returns the recovered signer address, or throws if invalid.
 */
export async function verifyOffer(
  verifier: EIP712OfferReceiptVerifier,
  offer: SignedOffer,
): Promise<{ valid: boolean; signer?: string; payload?: OfferPayload }> {
  if (offer.format === "jws") {
    // JWS verification not yet implemented
    return { valid: false };
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
 * Verify an EIP-712 signed receipt.
 * Returns the recovered signer address, or throws if invalid.
 */
export async function verifyReceipt(
  verifier: EIP712OfferReceiptVerifier,
  receipt: SignedReceipt,
): Promise<{ valid: boolean; signer?: string; payload?: ReceiptPayload }> {
  if (receipt.format === "jws") {
    // JWS verification not yet implemented
    return { valid: false };
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
