import { type ChainFamily, CHAIN_CONFIGS } from "@/lib/testnet-config";
import { buildAccepts, buildRequirements, getConfigByNetwork, getDefaultConfigForFamily } from "@/lib/chain-registry";

export const FACILITATOR_URL =
  process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://facilitator.t402.io";

export const PAY_TO =
  process.env.DEMO_PAY_TO_ADDRESS || "0xC88f67e776f16DcFBf42e6bDda1B82604448899B";

export const DEMO_AMOUNT = "1000"; // 0.001 USDT (6 decimals)

/**
 * Parse request headers to determine chain preference and network mode.
 */
export function getPreferredChain(request: Request): ChainFamily {
  const header = request.headers.get("x-preferred-chain");
  if (header && header in CHAIN_CONFIGS) {
    return header as ChainFamily;
  }
  return "evm";
}

/**
 * Determine if the request is for testnet or mainnet.
 * Reads `x-network-mode` header; defaults to testnet.
 */
export function isTestnetRequest(request: Request): boolean {
  const mode = request.headers.get("x-network-mode");
  if (mode === "mainnet") return false;
  return true; // default: testnet
}

/**
 * Get the preferred CAIP-2 network ID from request headers.
 * For mainnet EVM, allows per-chain selection via `x-preferred-network`.
 */
export function getPreferredNetwork(request: Request): string | undefined {
  return request.headers.get("x-preferred-network") || undefined;
}

/**
 * Create the `accepts` array for a 402 response — mode-aware.
 */
export function getAcceptsForChain(
  preferredChain: ChainFamily,
  amount: string,
  request?: Request,
) {
  const isTestnet = request ? isTestnetRequest(request) : true;
  const preferredNetwork = request ? getPreferredNetwork(request) : undefined;

  // Use preferred network, or derive from family
  const network = preferredNetwork || (
    isTestnet
      ? CHAIN_CONFIGS[preferredChain].network
      : undefined
  );

  return buildAccepts(amount, isTestnet, network);
}

/**
 * Build payment requirements from a decoded payment payload — mode-aware.
 * Searches both mainnet and testnet registries to find the matching config.
 */
export function buildRequirementsFromPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paymentPayload: any,
  amount: string,
) {
  return buildRequirements(paymentPayload, amount);
}

// Legacy exports for backward compatibility
export function getNetwork() {
  return "eip155:84532";
}

export function getAsset() {
  return "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
}

export { getDefaultConfigForFamily, getConfigByNetwork };
