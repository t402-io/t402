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

export const TOKEN_INFO = {
  "eip155:84532": { symbol: "USDC", address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
  "eip155:11155111": { symbol: "USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
  "eip155:421614": { symbol: "USDC", address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", decimals: 6 },
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": { symbol: "USDC", address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", decimals: 6 },
  "ton:testnet": { symbol: "USDT", address: "kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy", decimals: 6 },
  "tron:nile": { symbol: "USDT", address: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", decimals: 6 },
  "stellar:testnet": { symbol: "USDC", address: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", decimals: 7 },
};

// SupportedKind objects matching SDK SupportedResponse type
export const SUPPORTED_KINDS = SUPPORTED_NETWORKS.map((network) => ({
  t402Version: 2,
  scheme: "exact",
  network,
  token: TOKEN_INFO[network] || null,
  upstream: false, // will be enriched by checkUpstream
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

const MAINNET_TO_TESTNET = {
  "eip155:1": "eip155:11155111",
  "eip155:8453": "eip155:84532",
  "eip155:42161": "eip155:421614",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "ton:mainnet": "ton:testnet",
  "tron:mainnet": "tron:nile",
  "stellar:pubnet": "stellar:testnet",
};

/**
 * Validate that a network is a supported testnet.
 * Returns an error object { error, suggestion? } or null if valid.
 */
export function validateNetwork(network) {
  if (!network || typeof network !== "string") {
    return { error: "Missing or invalid paymentRequirements.network" };
  }
  if (!SUPPORTED_NETWORKS.includes(network)) {
    const suggestion = MAINNET_TO_TESTNET[network];
    return {
      error: `Sandbox only supports testnets: ${SUPPORTED_NETWORKS.join(", ")}`,
      ...(suggestion && { suggestion: `Did you mean "${suggestion}"?` }),
    };
  }
  return null;
}
