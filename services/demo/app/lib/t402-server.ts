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
 * Base64url encode a JSON object for protocol headers.
 * Uses Web APIs (compatible with Edge runtime).
 */
export function encodeHeader(data: unknown): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const base64 = btoa(String.fromCharCode(...bytes));
  // Convert base64 to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a base64url-encoded protocol header.
 * Uses Web APIs (compatible with Edge runtime).
 */
export function decodeHeader(header: string): unknown {
  // Convert base64url to base64
  let base64 = header.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }
  const decoded = atob(base64);
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}
