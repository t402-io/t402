/**
 * Client-side offer-receipt extension.
 *
 * Verifies offers before making payment and
 * extracts/stores receipts from success responses.
 */

import type {
  OfferPayload,
  ReceiptPayload,
  SignedOffer,
  SignedReceipt,
  EIP712OfferReceiptVerifier,
} from "./types";

import { verifyOffer, verifyReceipt, matchOfferToRequirements, isOfferExpired } from "./signing";
import { OFFER_RECEIPT_KEY } from "./server";

/**
 * Extract offers from a 402 response's extensions.
 *
 * @param extensions
 */
export function extractOffers(extensions?: Record<string, unknown>): SignedOffer[] {
  if (!extensions) return [];

  const ext = extensions[OFFER_RECEIPT_KEY] as { info?: { offers?: SignedOffer[] } } | undefined;

  return ext?.info?.offers ?? [];
}

/**
 * Extract a receipt from a success response's extensions.
 *
 * @param extensions
 */
export function extractReceipt(extensions?: Record<string, unknown>): SignedReceipt | null {
  if (!extensions) return null;

  const ext = extensions[OFFER_RECEIPT_KEY] as { info?: { receipt?: SignedReceipt } } | undefined;

  return ext?.info?.receipt ?? null;
}

/**
 * Find and verify the offer that matches specific payment requirements.
 *
 * Returns the verified offer if found and valid, null otherwise.
 *
 * @param verifier
 * @param offers
 * @param requirements
 * @param requirements.scheme
 * @param requirements.network
 * @param requirements.asset
 * @param requirements.payTo
 * @param requirements.amount
 * @param options
 * @param options.expectedSigner
 * @param options.nowSeconds
 */
export async function findAndVerifyOffer(
  verifier: EIP712OfferReceiptVerifier,
  offers: SignedOffer[],
  requirements: {
    scheme: string;
    network: string;
    asset: string;
    payTo: string;
    amount: string;
  },
  options?: {
    /** Expected signer address (e.g., payTo). If set, verification checks this. */
    expectedSigner?: string;
    /** Current time in seconds (for expiry check). Defaults to now. */
    nowSeconds?: number;
  },
): Promise<{
  offer: SignedOffer;
  signer: string;
  payload: OfferPayload;
} | null> {
  for (const offer of offers) {
    // Check if offer matches requirements
    if (!matchOfferToRequirements(offer, requirements)) continue;

    // Check expiry
    if (isOfferExpired(offer, options?.nowSeconds)) continue;

    // Verify signature
    const result = await verifyOffer(verifier, offer);
    if (!result.valid || !result.signer || !result.payload) continue;

    // Check expected signer if specified
    if (
      options?.expectedSigner &&
      result.signer.toLowerCase() !== options.expectedSigner.toLowerCase()
    ) {
      continue;
    }

    return {
      offer,
      signer: result.signer,
      payload: result.payload,
    };
  }

  return null;
}

/**
 * Verify a receipt from a success response.
 *
 * Returns the verified receipt data if valid, null otherwise.
 *
 * @param verifier
 * @param extensions
 * @param options
 * @param options.expectedSigner
 */
export async function verifyReceiptFromResponse(
  verifier: EIP712OfferReceiptVerifier,
  extensions?: Record<string, unknown>,
  options?: {
    /** Expected signer address. */
    expectedSigner?: string;
  },
): Promise<{
  signer: string;
  payload: ReceiptPayload;
} | null> {
  const receipt = extractReceipt(extensions);
  if (!receipt) return null;

  const result = await verifyReceipt(verifier, receipt);
  if (!result.valid || !result.signer || !result.payload) return null;

  if (
    options?.expectedSigner &&
    result.signer.toLowerCase() !== options.expectedSigner.toLowerCase()
  ) {
    return null;
  }

  return {
    signer: result.signer,
    payload: result.payload,
  };
}
