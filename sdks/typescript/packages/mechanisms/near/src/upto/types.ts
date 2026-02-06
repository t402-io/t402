/**
 * NEAR Up-To Scheme Types
 *
 * Defines the payload and extra types for the NEAR upto payment scheme.
 * The upto scheme uses an escrow pattern:
 * 1. Client ft_transfers maxAmount to the facilitator's NEAR account
 * 2. Facilitator verifies the transfer
 * 3. Facilitator forwards settleAmount to payTo and refunds (maxAmount - settleAmount)
 *
 * Note: NEAR NEP-141 tokens don't have native approve/transferFrom.
 * This implementation uses an escrow pattern instead.
 */

/**
 * Authorization metadata for NEAR upto payments.
 * Contains the transfer details for verification.
 */
export type UptoNearAuthorization = {
  /** Sender's NEAR account ID (e.g., "alice.near") */
  from: string;

  /** Facilitator's NEAR account ID that receives the initial transfer */
  facilitator: string;

  /** NEP-141 token contract ID (e.g., "usdt.tether-token.near") */
  tokenContract: string;

  /** Maximum authorized amount in smallest units (as string) */
  maxAmount: string;
};

/**
 * NEAR upto payment payload.
 * Contains the transaction hash of the client's transfer to the facilitator.
 */
export type UptoNearPayload = {
  /** NEAR transaction hash of the transfer to facilitator */
  txHash: string;

  /** Authorization metadata for verification */
  authorization: UptoNearAuthorization;

  /** Unique nonce for replay protection (hex string) */
  paymentNonce: string;
};

/**
 * Extra fields for upto scheme payment requirements on NEAR.
 * Included in the PaymentRequirements.extra field.
 */
export type UptoNearExtra = {
  /** Facilitator account ID that will receive the initial transfer */
  facilitator?: string;

  /** Maximum payment amount authorized */
  maxAmount?: string;

  /** Minimum acceptable settlement amount */
  minAmount?: string;

  /** Billing unit (e.g., "token", "request", "second") */
  unit?: string;

  /** Price per unit in smallest denomination */
  unitPrice?: string;
};

/**
 * Settlement data for NEAR upto scheme.
 */
export type UptoNearSettlement = {
  /** Actual amount to settle (must be <= maxAmount) */
  settleAmount: string;

  /** Usage details for auditing */
  usageDetails?: {
    unitsConsumed?: number;
    unitPrice?: string;
    unitType?: string;
    startTime?: number;
    endTime?: number;
  };
};

/**
 * Type guard for UptoNearPayload.
 *
 * Checks that the data has the correct structure for a NEAR upto payload,
 * distinguishing it from exact-direct payloads.
 *
 * @param data - The data to check
 * @returns True if the data is a valid UptoNearPayload
 */
export function isUptoNearPayload(data: unknown): data is UptoNearPayload {
  if (typeof data !== "object" || data === null) return false;
  const p = data as Record<string, unknown>;
  if (typeof p.txHash !== "string" || !p.txHash) return false;
  if (typeof p.paymentNonce !== "string" || !p.paymentNonce) return false;
  if (typeof p.authorization !== "object" || p.authorization === null) return false;

  const auth = p.authorization as Record<string, unknown>;
  return (
    typeof auth.from === "string" &&
    typeof auth.facilitator === "string" &&
    typeof auth.tokenContract === "string" &&
    typeof auth.maxAmount === "string" &&
    !!auth.from &&
    !!auth.facilitator
  );
}
