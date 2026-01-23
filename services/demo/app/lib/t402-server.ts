import { FACILITATOR_URL } from "./config";

/**
 * Verify a payment payload against the facilitator.
 */
export async function verifyPayment(paymentPayload: unknown, paymentRequirements: unknown) {
  const response = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      t402Version: 2,
      paymentPayload,
      paymentRequirements,
    }),
  });
  return response.json();
}

/**
 * Settle a verified payment on-chain via the facilitator.
 */
export async function settlePayment(paymentPayload: unknown, paymentRequirements: unknown) {
  const response = await fetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      t402Version: 2,
      paymentPayload,
      paymentRequirements,
    }),
  });
  return response.json();
}

/**
 * Check facilitator health and supported networks.
 */
export async function getFacilitatorSupported() {
  const response = await fetch(`${FACILITATOR_URL}/supported`);
  return response.json();
}

/**
 * Base64 encode a JSON object for protocol headers.
 */
export function encodeHeader(data: unknown): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

/**
 * Decode a base64url-encoded protocol header.
 */
export function decodeHeader(header: string): unknown {
  return JSON.parse(Buffer.from(header, "base64url").toString("utf-8"));
}
