import { type ChainFamily, CHAIN_CONFIGS } from "@/lib/testnet-config";

export const FACILITATOR_URL =
  process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://facilitator.t402.io";

export const PAY_TO =
  process.env.DEMO_PAY_TO_ADDRESS || "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";

export const TESTNET_NETWORK = "eip155:84532"; // Base Sepolia
export const MAINNET_NETWORK = "eip155:8453"; // Base

// USDT on Base Sepolia (test token)
export const TESTNET_ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
// USDT on Base mainnet
export const MAINNET_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913";

export const DEMO_AMOUNT = "1000"; // 0.001 USDT (6 decimals)

export function getNetwork() {
  return process.env.NEXT_PUBLIC_TESTNET === "true" ? TESTNET_NETWORK : MAINNET_NETWORK;
}

export function getAsset() {
  return process.env.NEXT_PUBLIC_TESTNET === "true" ? TESTNET_ASSET : MAINNET_ASSET;
}

/**
 * Parse the X-Preferred-Chain header to determine which chain family the client wants.
 * Falls back to "evm" if not specified or invalid.
 */
export function getPreferredChain(request: Request): ChainFamily {
  const header = request.headers.get("x-preferred-chain");
  if (header && header in CHAIN_CONFIGS) {
    return header as ChainFamily;
  }
  return "evm";
}

/**
 * Create the `accepts` array for a 402 response based on the preferred chain.
 * Returns the preferred chain first, followed by all other chains.
 */
export function createMultiChainAccepts(amount: string, scheme = "exact") {
  const families: ChainFamily[] = [
    "evm", "ton", "tron", "solana", "stacks",
    "near", "aptos", "tezos", "polkadot"
  ];
  return families.map((family) => {
    const config = CHAIN_CONFIGS[family];
    return {
      scheme,
      network: config.network,
      amount,
      asset: config.asset,
      payTo: config.payTo,
      maxTimeoutSeconds: 60,
    };
  });
}

/**
 * Create an `accepts` array with the preferred chain first.
 */
export function getAcceptsForChain(preferredChain: ChainFamily, amount: string, scheme = "exact") {
  const all = createMultiChainAccepts(amount, scheme);
  const preferredIndex = all.findIndex(
    (a) => a.network === CHAIN_CONFIGS[preferredChain].network
  );
  if (preferredIndex > 0) {
    const [preferred] = all.splice(preferredIndex, 1);
    all.unshift(preferred);
  }
  return all;
}
