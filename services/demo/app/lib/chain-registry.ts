/**
 * Unified chain registry — provides mode-aware access to chain configs.
 *
 * Testnet configs: 10 entries (one per family)
 * Mainnet configs: 34 entries (25 EVM + 9 non-EVM)
 */

import { type ChainFamily, type ChainConfig, CHAIN_CONFIGS as TESTNET_CONFIGS, CHAIN_FAMILIES } from "./testnet-config";
import { MAINNET_CONFIGS } from "./mainnet-config";

// Re-export for convenience
export type { ChainFamily, ChainConfig };
export { CHAIN_FAMILIES, TESTNET_CONFIGS, MAINNET_CONFIGS };

/** Families that use exact-direct scheme */
const EXACT_DIRECT_FAMILIES: ChainFamily[] = ["stacks", "near", "aptos", "tezos", "polkadot", "cosmos"];

/** Default mainnet network per family (used when switching from testnet family to mainnet) */
const DEFAULT_MAINNET_NETWORK: Record<ChainFamily, string> = {
  evm: "eip155:42161",       // Arbitrum (USDT0 — native ERC-20, not OFT adapter)
  ton: "ton:mainnet",
  tron: "tron:mainnet",
  solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  stacks: "stacks:1",
  near: "near:mainnet",
  aptos: "aptos:1",
  tezos: "tezos:NetXdQprcVkpaWU",
  polkadot: "polkadot:68d56f15f85d3136970ec16946040bc1",
  cosmos: "cosmos:noble-1",
};

/** Default testnet network per family */
const DEFAULT_TESTNET_NETWORK: Record<ChainFamily, string> = {
  evm: "eip155:84532",
  ton: "ton:testnet",
  tron: "tron:nile",
  solana: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  stacks: "stacks:2147483648",
  near: "near:testnet",
  aptos: "aptos:2",
  tezos: "tezos:NetXnHfVqm9iesp",
  polkadot: "polkadot:e143f23803ac50e8f6f8e62695d1ce9e",
  cosmos: "cosmos:grand-1",
};

/**
 * Get the chain config for a specific CAIP-2 network ID.
 * Searches both mainnet and testnet configs.
 */
export function getConfigByNetwork(network: string): ChainConfig | undefined {
  // Check mainnet first
  if (network in MAINNET_CONFIGS) return MAINNET_CONFIGS[network];
  // Check testnet (keyed by family, so search by network)
  for (const family of CHAIN_FAMILIES) {
    const cfg = TESTNET_CONFIGS[family];
    if (cfg.network === network) return cfg;
  }
  return undefined;
}

/**
 * Get the default config for a chain family in the given mode.
 */
export function getDefaultConfigForFamily(family: ChainFamily, isTestnet: boolean): ChainConfig {
  if (isTestnet) {
    return TESTNET_CONFIGS[family];
  }
  const network = DEFAULT_MAINNET_NETWORK[family];
  return MAINNET_CONFIGS[network];
}

/**
 * Get the default network ID for a family in the given mode.
 */
export function getDefaultNetwork(family: ChainFamily, isTestnet: boolean): string {
  return isTestnet ? DEFAULT_TESTNET_NETWORK[family] : DEFAULT_MAINNET_NETWORK[family];
}

/**
 * Get all mainnet configs for a specific family (useful for EVM which has 25 chains).
 */
export function getMainnetConfigsForFamily(family: ChainFamily): ChainConfig[] {
  return Object.values(MAINNET_CONFIGS).filter((c) => c.family === family);
}

/**
 * Get the correct scheme for a family.
 */
export function getSchemeForFamily(family: ChainFamily): string {
  return EXACT_DIRECT_FAMILIES.includes(family) ? "exact-direct" : "exact";
}

/**
 * Build the `accepts` array for a 402 response.
 * Returns one entry per family, using the preferred network first.
 * For mainnet, uses the specified EVM chain (or default).
 */
export function buildAccepts(
  amount: string,
  isTestnet: boolean,
  preferredNetwork?: string,
): Array<{
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, string>;
}> {
  const entries: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: Record<string, string>;
  }> = [];

  // One entry per family
  for (const family of CHAIN_FAMILIES) {
    let config: ChainConfig;

    if (isTestnet) {
      config = TESTNET_CONFIGS[family];
    } else {
      // For mainnet EVM, use preferred if it's an EVM chain
      if (family === "evm" && preferredNetwork?.startsWith("eip155:") && preferredNetwork in MAINNET_CONFIGS) {
        config = MAINNET_CONFIGS[preferredNetwork];
      } else {
        config = getDefaultConfigForFamily(family, false);
      }
    }

    const scheme = config.scheme || getSchemeForFamily(family);

    const entry: {
      scheme: string;
      network: string;
      amount: string;
      asset: string;
      payTo: string;
      maxTimeoutSeconds: number;
      extra?: Record<string, string>;
    } = {
      scheme,
      network: config.network,
      amount,
      asset: config.asset,
      payTo: config.payTo,
      maxTimeoutSeconds: 60,
    };

    if (config.tokenContractName) {
      entry.extra = {
        name: config.tokenContractName,
        version: config.tokenContractVersion || "1",
      };
    }

    entries.push(entry);
  }

  // Move preferred to front
  if (preferredNetwork) {
    const idx = entries.findIndex((e) => e.network === preferredNetwork);
    if (idx > 0) {
      const [preferred] = entries.splice(idx, 1);
      entries.unshift(preferred);
    }
  }

  return entries;
}

/**
 * Build payment requirements from a decoded payment payload.
 * Looks up the network in both mainnet and testnet registries.
 */
export function buildRequirements(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paymentPayload: any,
  amount: string,
) {
  const network: string | undefined = paymentPayload?.network;
  const config = network ? getConfigByNetwork(network) : undefined;

  if (network && !config) {
    console.warn(`[t402] Unknown network "${network}" in payment payload`);
  }

  const family = config?.family ?? "evm";
  const scheme = config?.scheme || getSchemeForFamily(family);

  return {
    scheme,
    network: config?.network ?? "eip155:84532",
    amount,
    asset: config?.asset ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: config?.payTo ?? "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
    maxTimeoutSeconds: 60,
  };
}

/**
 * Get explorer URL for a transaction on any network.
 */
export function getExplorerUrlByNetwork(network: string, txHash: string): string {
  const config = getConfigByNetwork(network);
  if (!config) return `https://etherscan.io/tx/${txHash}`;
  return `${config.explorer}${txHash}${config.explorerSuffix || ""}`;
}

/**
 * Derive family from CAIP-2 network ID.
 */
export function familyFromNetwork(network: string): ChainFamily {
  if (network.startsWith("eip155:")) return "evm";
  if (network.startsWith("solana:")) return "solana";
  if (network.startsWith("ton:")) return "ton";
  if (network.startsWith("tron:")) return "tron";
  if (network.startsWith("stacks:")) return "stacks";
  if (network.startsWith("near:")) return "near";
  if (network.startsWith("aptos:")) return "aptos";
  if (network.startsWith("tezos:")) return "tezos";
  if (network.startsWith("polkadot:")) return "polkadot";
  if (network.startsWith("cosmos:")) return "cosmos";
  return "evm";
}
