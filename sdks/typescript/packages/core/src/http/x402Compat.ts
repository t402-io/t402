/**
 * x402 Wire Format Compatibility Shim
 *
 * T402 and x402 (Coinbase) use identical wire formats except for the version
 * field name: T402 uses `t402Version`, x402 uses `x402Version`.
 *
 * This shim provides bidirectional translation at the HTTP boundary:
 *
 *   x402 CLIENT                    T402 FACILITATOR
 *   ──────────────                 ─────────────────
 *   { x402Version: 2,     ──►     { t402Version: 2,
 *     accepted: {...},      shim     accepted: {...},
 *     payload: {...} }              payload: {...} }
 *
 *   T402 CLIENT                    x402 FACILITATOR
 *   ──────────────                 ─────────────────
 *   { t402Version: 2,     ──►     { x402Version: 2,
 *     accepted: {...},      shim     accepted: {...},
 *     payload: {...} }              payload: {...} }
 *
 * All other fields are identical — no translation needed.
 *
 * @see specs/research/x402-wire-format-audit.md
 */

import type { PaymentRequired, PaymentPayload } from "../types/payments";

/**
 * Detect whether a decoded payload uses x402 format (has x402Version field).
 *
 * @param payload - Decoded payload object to inspect.
 * @returns True iff the payload has `x402Version` and not `t402Version`.
 */
export function isX402Format(payload: Record<string, unknown>): boolean {
  return "x402Version" in payload && !("t402Version" in payload);
}

/**
 * Detect whether a decoded payload uses T402 format (has t402Version field).
 *
 * @param payload - Decoded payload object to inspect.
 * @returns True iff the payload has `t402Version` and not `x402Version`.
 */
export function isT402Format(payload: Record<string, unknown>): boolean {
  return "t402Version" in payload && !("x402Version" in payload);
}

/**
 * Detect whether a decoded payload has either version field.
 *
 * @param payload - Decoded payload object to inspect.
 * @returns True if the payload has either `t402Version` or `x402Version`.
 */
export function hasVersionField(payload: Record<string, unknown>): boolean {
  return "t402Version" in payload || "x402Version" in payload;
}

/**
 * Convert an x402-format payload to T402 format.
 * Renames `x402Version` → `t402Version`. All other fields pass through.
 *
 * If the payload is already in T402 format, returns it unchanged.
 * If the payload has no version field, returns it unchanged.
 *
 * @param payload - Payload that may be in x402 format.
 * @returns Payload normalized to T402 format (or the original if no conversion needed).
 */
export function x402ToT402<T extends Record<string, unknown>>(payload: T): T {
  if (!isX402Format(payload)) return payload;

  const { x402Version, ...rest } = payload;
  return { ...rest, t402Version: x402Version } as unknown as T;
}

/**
 * Convert a T402-format payload to x402 format.
 * Renames `t402Version` → `x402Version`. All other fields pass through.
 *
 * If the payload is already in x402 format, returns it unchanged.
 * If the payload has no version field, returns it unchanged.
 *
 * @param payload - Payload that may be in T402 format.
 * @returns Payload normalized to x402 format (or the original if no conversion needed).
 */
export function t402ToX402<T extends Record<string, unknown>>(payload: T): T {
  if (!isT402Format(payload)) return payload;

  const { t402Version, ...rest } = payload;
  return { ...rest, x402Version: t402Version } as unknown as T;
}

/**
 * Normalize any payment payload to T402 format.
 * Accepts either T402 or x402 format and always returns T402 format.
 *
 * Use this at the HTTP boundary when decoding incoming headers —
 * it handles both formats transparently.
 *
 * @param payload - Payload in either T402 or x402 format.
 * @returns Payload normalized to T402 format.
 */
export function normalizeToT402<T extends Record<string, unknown>>(payload: T): T {
  return x402ToT402(payload);
}

/**
 * Normalize a PaymentPayload from any format to T402 format.
 *
 * @param payload - Decoded payment payload object.
 * @returns The payload typed as `PaymentPayload` in T402 format.
 */
export function normalizePaymentPayload(payload: Record<string, unknown>): PaymentPayload {
  return normalizeToT402(payload) as unknown as PaymentPayload;
}

/**
 * Normalize a PaymentRequired from any format to T402 format.
 *
 * @param payload - Decoded payment requirements object.
 * @returns The payload typed as `PaymentRequired` in T402 format.
 */
export function normalizePaymentRequired(payload: Record<string, unknown>): PaymentRequired {
  return normalizeToT402(payload) as unknown as PaymentRequired;
}
