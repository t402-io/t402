/**
 * Server-side offer-receipt extension.
 *
 * Signs offers when generating 402 responses and
 * signs receipts when payment succeeds.
 */

import type { ResourceServerExtension } from "@t402/core/types";

import type {
  OfferPayload,
  ReceiptPayload,
  SignedOffer,
  SignedReceipt,
  EIP712OfferReceiptSigner,
} from "./types";

import { createSignedOffer, createSignedReceipt } from "./signing";

/** Extension key for offer-receipt */
export const OFFER_RECEIPT_KEY = "offer-receipt";

/**
 * Configuration for the offer-receipt server extension.
 */
export interface OfferReceiptServerConfig {
  /** EIP-712 signer for creating offers and receipts */
  signer: EIP712OfferReceiptSigner;
  /** URL of the protected resource (used in offer/receipt payloads) */
  resourceUrl: string;
  /** Optional: default validUntil offset in seconds (0 = no expiry) */
  offerValiditySeconds?: number;
}

/**
 * Create signed offers from payment requirements (accepts array).
 *
 * Called by the server when generating a 402 response.
 * Each accepted payment method gets a corresponding signed offer.
 */
export async function createOffersFromRequirements(
  config: OfferReceiptServerConfig,
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    payTo: string;
    amount: string;
  }>,
): Promise<SignedOffer[]> {
  const now = Math.floor(Date.now() / 1000);
  const validUntil = config.offerValiditySeconds
    ? now + config.offerValiditySeconds
    : 0;

  const offers: SignedOffer[] = [];

  for (let i = 0; i < accepts.length; i++) {
    const req = accepts[i];
    const payload: OfferPayload = {
      version: 1,
      resourceUrl: config.resourceUrl,
      scheme: req.scheme,
      network: req.network,
      asset: req.asset,
      payTo: req.payTo,
      amount: req.amount,
      validUntil,
    };

    const offer = await createSignedOffer(config.signer, payload, i);
    offers.push(offer);
  }

  return offers;
}

/**
 * Create a signed receipt after successful payment.
 *
 * Called by the server after verifying and settling a payment.
 */
export async function createReceiptForPayment(
  config: OfferReceiptServerConfig,
  params: {
    network: string;
    payer: string;
    transaction?: string;
  },
): Promise<SignedReceipt> {
  const payload: ReceiptPayload = {
    version: 1,
    network: params.network,
    resourceUrl: config.resourceUrl,
    payer: params.payer,
    issuedAt: Math.floor(Date.now() / 1000),
    transaction: params.transaction,
  };

  return createSignedReceipt(config.signer, payload);
}

/**
 * Resource server extension that attaches signed offers to 402 responses.
 *
 * Usage:
 * ```ts
 * const extension = offerReceiptServerExtension({
 *   signer: myEIP712Signer,
 *   resourceUrl: "https://api.example.com/data",
 *   offerValiditySeconds: 300,
 * });
 *
 * server.registerExtension(extension);
 * ```
 */
export function offerReceiptServerExtension(
  _config: OfferReceiptServerConfig,
): ResourceServerExtension {
  return {
    key: OFFER_RECEIPT_KEY,

    enrichDeclaration: (declaration) => {
      // The offers will be populated async by the server when it generates
      // the 402 response via createOffersFromRequirements(). This extension
      // just declares the key so the framework knows to include it.
      return {
        ...(declaration as Record<string, unknown>),
        info: {
          offers: [],
        },
      };
    },
  };
}
