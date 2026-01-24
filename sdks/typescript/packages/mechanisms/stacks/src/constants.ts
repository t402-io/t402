/**
 * Stacks T402 Constants
 *
 * Stacks is a Bitcoin Layer 2 that brings smart contracts and DeFi
 * to Bitcoin. SIP-010 is the fungible token standard on Stacks.
 */

// CAIP-2 namespace for Stacks
export const STACKS_CAIP2_NAMESPACE = "stacks";

// CAIP-2 network identifiers
// Stacks Mainnet (chain ID: 1)
export const STACKS_MAINNET_CAIP2 = "stacks:1";

// Stacks Testnet (chain ID: 2147483648)
export const STACKS_TESTNET_CAIP2 = "stacks:2147483648";

// Scheme identifier
export const SCHEME_EXACT_DIRECT = "exact-direct";

// Default API endpoints (Hiro API)
export const DEFAULT_MAINNET_API = "https://api.mainnet.hiro.so";
export const DEFAULT_TESTNET_API = "https://api.testnet.hiro.so";

// Network configurations
export interface StacksNetworkConfig {
  readonly name: string;
  readonly caip2: string;
  readonly apiUrl: string;
  readonly chainId: number;
  readonly addressPrefix: string;
  readonly isTestnet: boolean;
}

export const STACKS_NETWORKS: Record<string, StacksNetworkConfig> = {
  [STACKS_MAINNET_CAIP2]: {
    name: "Stacks Mainnet",
    caip2: STACKS_MAINNET_CAIP2,
    apiUrl: DEFAULT_MAINNET_API,
    chainId: 1,
    addressPrefix: "SP",
    isTestnet: false,
  },
  [STACKS_TESTNET_CAIP2]: {
    name: "Stacks Testnet",
    caip2: STACKS_TESTNET_CAIP2,
    apiUrl: DEFAULT_TESTNET_API,
    chainId: 2147483648,
    addressPrefix: "ST",
    isTestnet: true,
  },
};

/**
 * Get network configuration by CAIP-2 identifier
 */
export function getNetworkConfig(network: string): StacksNetworkConfig | undefined {
  return STACKS_NETWORKS[network];
}

/**
 * Check if a network identifier is a Stacks network
 */
export function isStacksNetwork(network: string): boolean {
  return network.startsWith(`${STACKS_CAIP2_NAMESPACE}:`);
}
