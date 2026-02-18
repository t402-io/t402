/**
 * Payment ID Extension Type Definitions
 *
 * Allows servers to attach unique identifiers to payments for
 * correlation, idempotency, and audit trails.
 */

/**
 * Extension key for payment ID in requirements/payload extensions.
 */
export const PAYMENT_ID_EXTENSION_KEY = "paymentId";

/**
 * Information provided by server about the payment identifier.
 */
export interface PaymentIdExtensionInfo {
  /** Unique payment identifier (UUID v4) */
  id: string;

  /** Optional idempotency key for replay protection */
  idempotencyKey?: string;

  /** Optional payment group for batching */
  groupId?: string;

  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Payment ID extension declaration for server responses.
 */
export interface PaymentIdExtension {
  /** Extension information */
  info: PaymentIdExtensionInfo;

  /** JSON Schema for validation */
  schema: object;
}

/**
 * Payment ID payload echoed back by the client.
 */
export interface PaymentIdPayload {
  /** Payment ID echoed back from requirements */
  id: string;

  /** Optional client-generated correlation ID */
  clientId?: string;
}

/**
 * Options for declaring a payment ID extension.
 */
export interface DeclarePaymentIdOptions {
  /** Custom payment ID (defaults to crypto.randomUUID()) */
  id?: string;

  /** Optional idempotency key for replay protection */
  idempotencyKey?: string;

  /** Optional payment group for batching */
  groupId?: string;

  /** Optional metadata */
  metadata?: Record<string, string>;
}
