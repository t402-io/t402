// Types
export type {
  SignatureFormat,
  OfferPayload,
  ReceiptPayload,
  EIP712Offer,
  JWSOffer,
  SignedOffer,
  EIP712Receipt,
  JWSReceipt,
  SignedReceipt,
  OfferReceiptRequirementsExtension,
  OfferReceiptSettlementExtension,
  EIP712OfferReceiptSigner,
  EIP712OfferReceiptVerifier,
} from "./types";

// EIP-712 constants
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

// Signing and verification
export {
  createSignedOffer,
  createSignedReceipt,
  verifyOffer,
  verifyReceipt,
  matchOfferToRequirements,
  isOfferExpired,
} from "./signing";
export type { VerifyOfferReceiptOptions } from "./signing";

// JWS verification
export { verifyJWSSignature } from "./jws";
export type { JWSAlgorithm, JWSProtectedHeader, JWSVerifyResult, JWSKeyResolver } from "./jws";

// Server extension
export {
  OFFER_RECEIPT_KEY,
  createOffersFromRequirements,
  createReceiptForPayment,
  offerReceiptServerExtension,
} from "./server";
export type { OfferReceiptServerConfig } from "./server";

// Client utilities
export {
  extractOffers,
  extractReceipt,
  findAndVerifyOffer,
  verifyReceiptFromResponse,
} from "./client";
