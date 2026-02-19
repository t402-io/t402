/**
 * Payment ID Extension Server-Side Implementation
 *
 * Provides functions for servers to declare payment ID requirements,
 * parse client payloads, and validate payment IDs.
 */

import { randomUUID } from "crypto";
import {
  PaymentIdExtension,
  PaymentIdExtensionInfo,
  PaymentIdPayload,
  DeclarePaymentIdOptions,
  PAYMENT_ID_EXTENSION_KEY,
} from "./types.js";

/**
 * JSON Schema for payment ID payload validation.
 */
const PAYMENT_ID_SCHEMA = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", format: "uuid" },
    clientId: { type: "string" },
  },
};

/**
 * Declares a payment ID extension for server responses.
 *
 * @param options - Optional configuration for the payment ID
 * @returns Payment ID extension object ready for response
 *
 * @example
 * ```typescript
 * const extension = declarePaymentIdExtension();
 * // Include in PaymentRequired response extensions:
 * // extensions: { [PAYMENT_ID_EXTENSION_KEY]: extension }
 * ```
 */
export function declarePaymentIdExtension(
  options: DeclarePaymentIdOptions = {},
): PaymentIdExtension {
  const info: PaymentIdExtensionInfo = {
    id: options.id || randomUUID(),
    idempotencyKey: options.idempotencyKey,
    groupId: options.groupId,
    metadata: options.metadata,
  };

  return {
    info,
    schema: PAYMENT_ID_SCHEMA,
  };
}

/**
 * Parses a payment ID payload from client request extensions.
 *
 * @param extensions - Extensions object from the payment payload
 * @returns Parsed payment ID payload, or null if not present
 * @throws Error if payload is present but invalid
 *
 * @example
 * ```typescript
 * const payload = parsePaymentIdPayload(paymentPayload.extensions);
 * if (payload) {
 *   console.log("Payment ID:", payload.id);
 * }
 * ```
 */
export function parsePaymentIdPayload(
  extensions?: Record<string, unknown>,
): PaymentIdPayload | null {
  if (!extensions || !(PAYMENT_ID_EXTENSION_KEY in extensions)) {
    return null;
  }

  const raw = extensions[PAYMENT_ID_EXTENSION_KEY];
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid paymentId extension: expected object");
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.length === 0) {
    throw new Error("Invalid paymentId extension: missing or empty id");
  }

  return {
    id: obj.id,
    clientId: typeof obj.clientId === "string" ? obj.clientId : undefined,
  };
}

/**
 * Validates that a client's payment ID payload matches the expected extension.
 *
 * @param payload - The client's payment ID payload
 * @param expected - The expected payment ID from the server extension
 * @returns True if the payment ID matches
 *
 * @example
 * ```typescript
 * const isValid = validatePaymentId(clientPayload, serverExtension.info);
 * if (!isValid) {
 *   throw new Error("Payment ID mismatch");
 * }
 * ```
 */
export function validatePaymentId(
  payload: PaymentIdPayload,
  expected: PaymentIdExtensionInfo,
): boolean {
  return payload.id === expected.id;
}
