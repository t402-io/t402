/**
 * @module payment-id - t402 Payment Protocol Payment ID Extension
 *
 * Provides unique payment identifiers for correlation, idempotency, and audit trails.
 *
 * @example Server-side usage
 * ```typescript
 * import {
 *   declarePaymentIdExtension,
 *   parsePaymentIdPayload,
 *   validatePaymentId,
 *   PAYMENT_ID_EXTENSION_KEY,
 * } from "@t402/extensions/payment-id";
 *
 * // Declare extension in 402 response
 * const extension = declarePaymentIdExtension();
 * // extensions: { [PAYMENT_ID_EXTENSION_KEY]: extension }
 *
 * // Parse and validate client payload
 * const payload = parsePaymentIdPayload(paymentPayload.extensions);
 * const isValid = validatePaymentId(payload, extension.info);
 * ```
 *
 * @example Client-side usage
 * ```typescript
 * import {
 *   createPaymentIdPayload,
 *   encodePaymentIdHeader,
 *   PAYMENT_ID_EXTENSION_KEY,
 * } from "@t402/extensions/payment-id";
 *
 * const payload = createPaymentIdPayload(extension);
 * ```
 */

// Type exports
export type {
  PaymentIdExtensionInfo,
  PaymentIdExtension,
  PaymentIdPayload,
  DeclarePaymentIdOptions,
} from "./types.js";

export { PAYMENT_ID_EXTENSION_KEY } from "./types.js";

// Server exports
export { declarePaymentIdExtension, parsePaymentIdPayload, validatePaymentId } from "./server.js";

// Client exports
export { createPaymentIdPayload, encodePaymentIdHeader } from "./client.js";
