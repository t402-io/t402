/**
 * EIP-712 type definitions for Offer and Receipt signing.
 *
 * The chainId is fixed at 1 (Ethereum mainnet) for all signatures,
 * as EIP-712 serves as an off-chain format independent of actual payment networks.
 */

/** EIP-712 domain for offer signing */
export const OFFER_DOMAIN = {
  name: "t402 offer",
  version: "1",
  chainId: 1,
} as const;

/** EIP-712 domain for receipt signing */
export const RECEIPT_DOMAIN = {
  name: "t402 receipt",
  version: "1",
  chainId: 1,
} as const;

/** EIP-712 typed data types for Offer */
export const OFFER_TYPES = {
  Offer: [
    { name: "version", type: "uint256" },
    { name: "resourceUrl", type: "string" },
    { name: "scheme", type: "string" },
    { name: "network", type: "string" },
    { name: "asset", type: "string" },
    { name: "payTo", type: "string" },
    { name: "amount", type: "string" },
    { name: "validUntil", type: "uint256" },
  ],
} as const;

/** EIP-712 typed data types for Receipt */
export const RECEIPT_TYPES = {
  Receipt: [
    { name: "version", type: "uint256" },
    { name: "network", type: "string" },
    { name: "resourceUrl", type: "string" },
    { name: "payer", type: "string" },
    { name: "issuedAt", type: "uint256" },
    { name: "transaction", type: "string" },
  ],
} as const;

/** Primary type name for offers */
export const OFFER_PRIMARY_TYPE = "Offer" as const;

/** Primary type name for receipts */
export const RECEIPT_PRIMARY_TYPE = "Receipt" as const;

/**
 * Normalize an OfferPayload for EIP-712 signing.
 * Optional fields use 0 or "" when absent.
 *
 * @param payload
 * @param payload.version
 * @param payload.resourceUrl
 * @param payload.scheme
 * @param payload.network
 * @param payload.asset
 * @param payload.payTo
 * @param payload.amount
 * @param payload.validUntil
 */
export function normalizeOfferForSigning(payload: {
  version: number;
  resourceUrl: string;
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  validUntil?: number;
}): Record<string, unknown> {
  return {
    version: payload.version,
    resourceUrl: payload.resourceUrl,
    scheme: payload.scheme,
    network: payload.network,
    asset: payload.asset,
    payTo: payload.payTo,
    amount: payload.amount,
    validUntil: payload.validUntil ?? 0,
  };
}

/**
 * Normalize a ReceiptPayload for EIP-712 signing.
 * Optional fields use "" when absent.
 *
 * @param payload
 * @param payload.version
 * @param payload.network
 * @param payload.resourceUrl
 * @param payload.payer
 * @param payload.issuedAt
 * @param payload.transaction
 */
export function normalizeReceiptForSigning(payload: {
  version: number;
  network: string;
  resourceUrl: string;
  payer: string;
  issuedAt: number;
  transaction?: string;
}): Record<string, unknown> {
  return {
    version: payload.version,
    network: payload.network,
    resourceUrl: payload.resourceUrl,
    payer: payload.payer,
    issuedAt: payload.issuedAt,
    transaction: payload.transaction ?? "",
  };
}
