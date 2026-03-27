import { FACILITATOR_URL } from "./config";

/**
 * Check if a network uses pre-broadcast model (wallet broadcasts before facilitator).
 * For these networks, verify/settle may fail because the tx is already on-chain.
 */
export function isPreBroadcastNetwork(network: string): boolean {
  return ["ton:", "solana:", "tron:"].some((p) => network.startsWith(p));
}

const FACILITATOR_TIMEOUT_MS = 30_000;

/**
 * Fetch with a 30-second timeout via AbortController.
 */
async function facilitatorFetch(url: string, init?: RequestInit): Promise<Response> {
  const apiKey = process.env.FACILITATOR_API_KEY || "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FACILITATOR_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
        ...init?.headers,
      },
    });
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Facilitator request timed out after 30s");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verify a payment payload against the facilitator.
 */
export async function verifyPayment(paymentPayload: unknown, paymentRequirements: unknown) {
  const response = await facilitatorFetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      t402Version: 2,
      paymentPayload,
      paymentRequirements,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Facilitator returned ${response.status}: ${text}`);
  }
  return response.json();
}

/**
 * Settle a verified payment on-chain via the facilitator.
 * @param metadata Optional context for Explorer (e.g. { source, description })
 */
export async function settlePayment(paymentPayload: unknown, paymentRequirements: unknown, metadata?: Record<string, unknown>) {
  const response = await facilitatorFetch(`${FACILITATOR_URL}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      t402Version: 2,
      paymentPayload,
      paymentRequirements,
      ...(metadata ? { metadata } : {}),
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Facilitator returned ${response.status}: ${text}`);
  }
  return response.json();
}

/**
 * Check facilitator health and supported networks.
 */
export async function getFacilitatorSupported() {
  const response = await facilitatorFetch(`${FACILITATOR_URL}/supported`);
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
