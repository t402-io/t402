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
const EXACT_DIRECT_FAMILIES: ChainFamily[] = ["stacks", "near", "aptos", "tezos", "polkadot", "cosmos"];

export function createMultiChainAccepts(amount: string, schemeOverride?: string) {
  const families: ChainFamily[] = [
    "evm", "ton", "tron", "solana", "stacks",
    "near", "aptos", "tezos", "polkadot", "cosmos"
  ];
  return families.map((family) => {
    const config = CHAIN_CONFIGS[family];
    const scheme = schemeOverride ?? (EXACT_DIRECT_FAMILIES.includes(family) ? "exact-direct" : "exact");
    return {
      scheme,
      network: config.network,
      amount,
      asset: config.asset,
      payTo: config.payTo,
      maxTimeoutSeconds: 60,
      ...(config.tokenContractName ? {
        extra: {
          name: config.tokenContractName,
          version: config.tokenContractVersion || "1",
        },
      } : {}),
    };
  });
}

/**
 * Build payment requirements from a decoded payment payload.
 * Extracts the `network` field from the payload and finds the matching chain config
 * so that live-mode verify/settle uses the correct network, asset, payTo, and scheme.
 */
export function buildRequirementsFromPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paymentPayload: any,
  amount: string,
  schemeOverride?: string,
) {
  const network: string | undefined = paymentPayload?.network;
  const matchingFamily = network
    ? (Object.keys(CHAIN_CONFIGS) as ChainFamily[]).find(
        (f) => CHAIN_CONFIGS[f].network === network,
      )
    : undefined;

  const config = matchingFamily ? CHAIN_CONFIGS[matchingFamily] : undefined;
  const family = matchingFamily ?? "evm";
  const scheme =
    schemeOverride ??
    (EXACT_DIRECT_FAMILIES.includes(family) ? "exact-direct" : "exact");

  return {
    scheme,
    network: config?.network ?? getNetwork(),
    amount,
    asset: config?.asset ?? getAsset(),
    payTo: config?.payTo ?? PAY_TO,
    maxTimeoutSeconds: 60,
  };
}

/**
 * Create an `accepts` array with the preferred chain first.
 * When no schemeOverride is given, each chain uses its correct scheme automatically.
 */
export function getAcceptsForChain(preferredChain: ChainFamily, amount: string, schemeOverride?: string) {
  const all = createMultiChainAccepts(amount, schemeOverride);
  const preferredIndex = all.findIndex(
    (a) => a.network === CHAIN_CONFIGS[preferredChain].network
  );
  if (preferredIndex > 0) {
    const [preferred] = all.splice(preferredIndex, 1);
    all.unshift(preferred);
  }
  return all;
}
