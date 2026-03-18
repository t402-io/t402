/**
 * Types for the Offer and Receipt extension.
 *
 * Offers: Server commits to payment terms (signed before payment).
 * Receipts: Server confirms transaction completion (signed after payment).
 */

/** Signature format for offers and receipts */
export type SignatureFormat = "eip712" | "jws";

// ============================================================================
// Offer Types
// ============================================================================

/** Canonical offer payload fields */
export interface OfferPayload {
  /** Schema version (currently 1) */
  version: number;
  /** URL of the paid resource */
  resourceUrl: string;
  /** Payment scheme (e.g., "exact") */
  scheme: string;
  /** CAIP-2 network identifier */
  network: string;
  /** Token contract address */
  asset: string;
  /** Recipient wallet address */
  payTo: string;
  /** Required payment amount (string to preserve precision) */
  amount: string;
  /** Unix timestamp expiration (0 if not set) */
  validUntil?: number;
}

/** A signed offer (EIP-712 format) */
export interface EIP712Offer {
  format: "eip712";
  payload: OfferPayload;
  signature: string;
  acceptIndex?: number;
}

/** A signed offer (JWS format) */
export interface JWSOffer {
  format: "jws";
  signature: string;
  acceptIndex?: number;
}

/** A signed offer in either format */
export type SignedOffer = EIP712Offer | JWSOffer;

// ============================================================================
// Receipt Types
// ============================================================================

/** Canonical receipt payload fields */
export interface ReceiptPayload {
  /** Schema version (currently 1) */
  version: number;
  /** CAIP-2 network identifier */
  network: string;
  /** URL of the paid resource */
  resourceUrl: string;
  /** Payer identifier (wallet address) */
  payer: string;
  /** Unix timestamp when issued (seconds) */
  issuedAt: number;
  /** Blockchain transaction hash (empty string if not available) */
  transaction?: string;
}

/** A signed receipt (EIP-712 format) */
export interface EIP712Receipt {
  format: "eip712";
  payload: ReceiptPayload;
  signature: string;
}

/** A signed receipt (JWS format) */
export interface JWSReceipt {
  format: "jws";
  signature: string;
}

/** A signed receipt in either format */
export type SignedReceipt = EIP712Receipt | JWSReceipt;

// ============================================================================
// Extension Types
// ============================================================================

/** Extension data in the 402 response (payment requirements) */
export interface OfferReceiptRequirementsExtension {
  info: {
    offers: SignedOffer[];
  };
}

/** Extension data in the success response */
export interface OfferReceiptSettlementExtension {
  info: {
    receipt: SignedReceipt;
  };
}

// ============================================================================
// Signer Interfaces
// ============================================================================

/** Signer for creating EIP-712 offers and receipts */
export interface EIP712OfferReceiptSigner {
  /** Sign an offer payload, returning the EIP-712 signature */
  signOffer(payload: OfferPayload): Promise<string>;
  /** Sign a receipt payload, returning the EIP-712 signature */
  signReceipt(payload: ReceiptPayload): Promise<string>;
  /** Get the signer's address for verification */
  getAddress(): string;
}

/** Verifier for checking EIP-712 signatures */
export interface EIP712OfferReceiptVerifier {
  /** Verify an offer signature, returning the recovered signer address */
  recoverOfferSigner(payload: OfferPayload, signature: string): Promise<string>;
  /** Verify a receipt signature, returning the recovered signer address */
  recoverReceiptSigner(payload: ReceiptPayload, signature: string): Promise<string>;
}
