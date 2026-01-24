/**
 * Encode a payment payload as base64url for the Payment-Signature header.
 * Uses base64url (RFC 4648 §5) to match the server's decodeHeader().
 */
export function encodePaymentHeader(payload: unknown): string {
  const json = JSON.stringify(payload);
  return btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
