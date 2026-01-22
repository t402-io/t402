/**
 * Polkadot Asset Hub T402 Constants
 *
 * Polkadot Asset Hub (formerly Statemint) is a common-good parachain
 * that hosts assets like USDT on the Polkadot network.
 */

// CAIP-2 namespace for Polkadot
export const POLKADOT_CAIP2_NAMESPACE = "polkadot";

// CAIP-2 network identifiers (first 32 chars of genesis hash)
// Polkadot Asset Hub (Parachain ID: 1000)
export const POLKADOT_ASSET_HUB_CAIP2 = "polkadot:68d56f15f85d3136970ec16946040bc1";

// Kusama Asset Hub (Parachain ID: 1000 on Kusama)
export const KUSAMA_ASSET_HUB_CAIP2 = "polkadot:48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a";

// Westend Asset Hub (Testnet)
export const WESTEND_ASSET_HUB_CAIP2 = "polkadot:e143f23803ac50e8f6f8e62695d1ce9e";

// Scheme identifier
export const SCHEME_EXACT_DIRECT = "exact-direct";

// Default indexers (Subscan API)
export const DEFAULT_POLKADOT_INDEXER = "https://assethub-polkadot.api.subscan.io";
export const DEFAULT_KUSAMA_INDEXER = "https://assethub-kusama.api.subscan.io";
export const DEFAULT_WESTEND_INDEXER = "https://assethub-westend.api.subscan.io";

// Default RPC endpoints
export const DEFAULT_POLKADOT_RPC = "wss://polkadot-asset-hub-rpc.polkadot.io";
export const DEFAULT_KUSAMA_RPC = "wss://kusama-asset-hub-rpc.polkadot.io";
export const DEFAULT_WESTEND_RPC = "wss://westend-asset-hub-rpc.polkadot.io";

// Network configurations
export interface PolkadotNetworkConfig {
  readonly name: string;
  readonly caip2: string;
  readonly rpcUrl: string;
  readonly indexerUrl: string;
  readonly genesisHash: string;
  readonly ss58Prefix: number;
  readonly isTestnet: boolean;
}

export const POLKADOT_NETWORKS: Record<string, PolkadotNetworkConfig> = {
  [POLKADOT_ASSET_HUB_CAIP2]: {
    name: "Polkadot Asset Hub",
    caip2: POLKADOT_ASSET_HUB_CAIP2,
    rpcUrl: DEFAULT_POLKADOT_RPC,
    indexerUrl: DEFAULT_POLKADOT_INDEXER,
    genesisHash: "0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f",
    ss58Prefix: 0, // Polkadot
    isTestnet: false,
  },
  [KUSAMA_ASSET_HUB_CAIP2]: {
    name: "Kusama Asset Hub",
    caip2: KUSAMA_ASSET_HUB_CAIP2,
    rpcUrl: DEFAULT_KUSAMA_RPC,
    indexerUrl: DEFAULT_KUSAMA_INDEXER,
    genesisHash: "0x48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a",
    ss58Prefix: 2, // Kusama
    isTestnet: false,
  },
  [WESTEND_ASSET_HUB_CAIP2]: {
    name: "Westend Asset Hub",
    caip2: WESTEND_ASSET_HUB_CAIP2,
    rpcUrl: DEFAULT_WESTEND_RPC,
    indexerUrl: DEFAULT_WESTEND_INDEXER,
    genesisHash: "0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e",
    ss58Prefix: 42, // Generic Substrate
    isTestnet: true,
  },
};

/**
 * Get network configuration by CAIP-2 identifier
 */
export function getNetworkConfig(network: string): PolkadotNetworkConfig | undefined {
  return POLKADOT_NETWORKS[network];
}

/**
 * Check if a network identifier is a Polkadot network
 */
export function isPolkadotNetwork(network: string): boolean {
  return network.startsWith(`${POLKADOT_CAIP2_NAMESPACE}:`);
}
