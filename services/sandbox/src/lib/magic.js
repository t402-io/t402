/**
 * Magic test addresses for payment simulation.
 * These addresses trigger deterministic responses without hitting upstream.
 * Like Stripe's test card numbers (4242...).
 */

export const MAGIC_ADDRESSES = {
  // Always verify as valid
  VERIFY_SUCCESS: "0x0000000000000000000000000000000000CAFE01",
  // Always verify as invalid (bad signature)
  VERIFY_FAIL_SIGNATURE: "0x0000000000000000000000000000000000CAFE02",
  // Always verify as invalid (expired)
  VERIFY_FAIL_EXPIRED: "0x0000000000000000000000000000000000CAFE03",
  // Always settle successfully
  SETTLE_SUCCESS: "0x0000000000000000000000000000000000CAFE11",
  // Always settle with failure (insufficient funds)
  SETTLE_FAIL_FUNDS: "0x0000000000000000000000000000000000CAFE12",
  // Always settle with failure (timeout)
  SETTLE_FAIL_TIMEOUT: "0x0000000000000000000000000000000000CAFE13",
  // Simulate slow response (2 second delay)
  SLOW_RESPONSE: "0x0000000000000000000000000000000000CAFE99",
};

export const SUPPORTED_NETWORKS = [
  "eip155:84532",        // Base Sepolia
  "eip155:11155111",     // Ethereum Sepolia
  "eip155:421614",       // Arbitrum Sepolia
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1", // Solana Devnet
  "ton:testnet",         // TON Testnet
  "tron:nile",           // TRON Nile
  "stellar:testnet",     // Stellar Testnet
];

// SupportedKind objects matching SDK SupportedResponse type
export const SUPPORTED_KINDS = SUPPORTED_NETWORKS.map((network) => ({
  t402Version: 2,
  scheme: "exact",
  network,
}));

/**
 * Find the magic address key for a given payer address.
 * Returns the key (e.g. "VERIFY_SUCCESS") or null.
 */
export function findMagicKey(payer) {
  if (!payer) return null;
  const upper = payer.toUpperCase();
  const entry = Object.entries(MAGIC_ADDRESSES).find(([, v]) => v.toUpperCase() === upper);
  return entry ? entry[0] : null;
}

/**
 * Extract the payer address from a request body (multiple possible locations).
 */
export function extractPayer(body) {
  return body?.paymentPayload?.payload?.payer
    || body?.paymentPayload?.authorization?.payer
    || body?.paymentPayload?.payer;
}

/**
 * Validate that a network is a supported testnet.
 * Returns an error string or null if valid.
 */
export function validateNetwork(network) {
  if (!network || typeof network !== "string") {
    return "Missing or invalid paymentRequirements.network";
  }
  if (!SUPPORTED_NETWORKS.includes(network)) {
    return `Sandbox only supports testnets: ${SUPPORTED_NETWORKS.join(", ")}`;
  }
  return null;
}
