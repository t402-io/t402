/**
 * Payment ID Extension Client-Side Implementation
 *
 * Provides functions for clients to echo payment IDs back to servers.
 */

import { PaymentIdExtension, PaymentIdPayload } from "./types.js";

/**
 * Creates a payment ID payload from a server extension.
 *
 * Reads the payment ID from requirements and echoes it back.
 *
 * @param extension - Payment ID extension from server's 402 response
 * @param clientId - Optional client-generated correlation ID
 * @returns Payment ID payload for inclusion in payment extensions
 *
 * @example
 * ```typescript
 * const extension = paymentRequirements.extensions?.paymentId;
 * const payload = createPaymentIdPayload(extension, "my-correlation-id");
 * // Include in payment payload extensions:
 * // extensions: { [PAYMENT_ID_EXTENSION_KEY]: payload }
 * ```
 */
export function createPaymentIdPayload(
  extension: PaymentIdExtension,
  clientId?: string,
): PaymentIdPayload {
  return {
    id: extension.info.id,
    clientId,
  };
}

/**
 * Encodes a payment ID payload for header-based transport.
 *
 * @param payload - The payment ID payload to encode
 * @returns Base64-encoded JSON string
 */
export function encodePaymentIdHeader(payload: PaymentIdPayload): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64");
  }
  return btoa(json);
}
