/**
 * Up-To SVM (Solana) Payment Types
 *
 * Types for the upto payment scheme on Solana using SPL ApproveChecked.
 * The client signs an approve transaction authorizing the facilitator (delegate)
 * to transfer up to maxAmount of tokens from the client's associated token account.
 */

/**
 * Authorization metadata for an SPL ApproveChecked transaction.
 * Contains the details of the delegate approval.
 */
export type UptoSvmAuthorization = {
  /** Token owner address (base58) */
  owner: string;
  /** Approved delegate address - facilitator (base58) */
  delegate: string;
  /** SPL token mint address (base58) */
  mint: string;
  /** Maximum approved amount in smallest units (as string) */
  maxAmount: string;
  /** Owner's associated token account (base58) */
  sourceATA: string;
};

/**
 * Up-To SVM payment payload containing a signed approve transaction.
 * The facilitator uses the delegated authority to transfer tokens
 * up to the approved maxAmount.
 */
export type UptoSvmPayload = {
  /** Base64 encoded signed approve transaction */
  transaction: string;
  /** Approval authorization metadata for verification */
  authorization: UptoSvmAuthorization;
  /** Unique nonce for replay protection (hex string) */
  paymentNonce: string;
};

/**
 * Extra fields for upto scheme payment requirements on SVM.
 * Included in the PaymentRequirements.extra field.
 */
export type UptoSvmExtra = {
  /** Facilitator address that will pay transaction fees (base58) */
  feePayer?: string;
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
 * Type guard for UptoSvmPayload.
 * Checks that the payload has the correct structure for an SVM upto payment.
 *
 * @param data - The data to check
 * @returns True if the data is a valid UptoSvmPayload
 */
export function isUptoSvmPayload(data: unknown): data is UptoSvmPayload {
  if (typeof data !== "object" || data === null) return false;
  const p = data as Record<string, unknown>;

  if (typeof p.transaction !== "string") return false;
  if (typeof p.paymentNonce !== "string") return false;

  if (typeof p.authorization !== "object" || p.authorization === null) return false;
  const auth = p.authorization as Record<string, unknown>;

  return (
    typeof auth.owner === "string" &&
    typeof auth.delegate === "string" &&
    typeof auth.mint === "string" &&
    typeof auth.maxAmount === "string" &&
    typeof auth.sourceATA === "string"
  );
}
