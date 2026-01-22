/**
 * Token configuration for T402 EVM payments
 *
 * This module provides comprehensive token definitions including:
 * - USDT0 (Tether's new omnichain token with EIP-3009 support)
 * - USDC (USD Coin with EIP-3009 support)
 * - Legacy tokens configuration
 */

import type { Address } from "viem";

/**
 * Token type classification for payment scheme selection
 */
export type TokenType = "eip3009" | "legacy";

/**
 * Token configuration with EIP-712 domain parameters
 */
export interface TokenConfig {
  /** Token contract address */
  address: Address;
  /** Token symbol (e.g., "USDT0", "USDC") */
  symbol: string;
  /** EIP-712 domain name for signing */
  name: string;
  /** EIP-712 domain version for signing */
  version: string;
  /** Number of decimal places */
  decimals: number;
  /** Token type for scheme selection */
  tokenType: TokenType;
  /** Payment priority (lower = higher priority) */
  priority: number;
}

/**
 * Network token registry mapping network -> symbol -> config
 */
export type NetworkTokenRegistry = Record<string, Record<string, TokenConfig>>;

/**
 * USDT0 Contract Addresses by Network
 * Source: https://docs.tether.io/usdt0/integration-guide/deployed-contracts
 *
 * USDT0 is Tether's new omnichain token using LayerZero OFT standard.
 * Key features:
 * - Supports EIP-3009 transferWithAuthorization (gasless transfers)
 * - Supports EIP-2612 permit
 * - Native cross-chain via LayerZero
 */
export const USDT0_ADDRESSES: Record<string, Address> = {
  // === Existing Networks ===
  // Ethereum Mainnet - OFT Adapter (bridge endpoint)
  "eip155:1": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  // Arbitrum One - Native USDT0
  "eip155:42161": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  // Ink Mainnet
  "eip155:57073": "0x0200C29006150606B650577BBE7B6248F58470c1",
  // Berachain Mainnet
  "eip155:80094": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  // Unichain Mainnet (updated address)
  "eip155:130": "0x9151434b16b9763660705744891fA906F660EcC5",

  // === Phase 1: High Priority Networks ===
  // Polygon PoS
  "eip155:137": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  // Mantle
  "eip155:5000": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  // Optimism
  "eip155:10": "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
  // Plasma
  "eip155:9745": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
  // Sei
  "eip155:1329": "0x9151434b16b9763660705744891fA906F660EcC5",
  // Conflux eSpace
  "eip155:1030": "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
  // Monad
  "eip155:143": "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",

  // === Phase 2: Medium Priority Networks ===
  // Rootstock (Bitcoin sidechain)
  "eip155:30": "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
  // XLayer (OKX L2)
  "eip155:196": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  // Flare
  "eip155:14": "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
  // Corn
  "eip155:21000000": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
  // HyperEVM
  "eip155:999": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
  // MegaETH
  "eip155:4326": "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
  // Stable
  "eip155:988": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
};

/**
 * USDC Contract Addresses by Network
 * Native USDC with EIP-3009 support
 */
export const USDC_ADDRESSES: Record<string, Address> = {
  // Ethereum Mainnet
  "eip155:1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  // Base Mainnet
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // Base Sepolia (testnet)
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  // Sepolia (testnet)
  "eip155:11155111": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  // Arbitrum One
  "eip155:42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  // Polygon Mainnet
  "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

/**
 * Traditional USDT Addresses (Legacy - no EIP-3009 support)
 * These require the approve + transferFrom pattern
 */
export const USDT_LEGACY_ADDRESSES: Record<string, Address> = {
  // Ethereum Mainnet
  "eip155:1": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  // Polygon Mainnet (native USDT, not USDT0)
  "eip155:137": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  // BNB Chain (BSC) - BEP-20 USDT
  "eip155:56": "0x55d398326f99059fF775485246999027B3197955",
  // Avalanche C-Chain
  "eip155:43114": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  // Fantom
  "eip155:250": "0x049d68029688eabf473097a2fc38ef61633a3c7a",
  // Celo
  "eip155:42220": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
  // Kaia (formerly Klaytn)
  "eip155:8217": "0xcee8faf64bb97a73bb51e115aa89c17ffa8dd167",
};

/**
 * Complete token registry with all supported tokens per network
 */
export const TOKEN_REGISTRY: NetworkTokenRegistry = {
  // Ethereum Mainnet
  "eip155:1": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:1"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
    USDC: {
      address: USDC_ADDRESSES["eip155:1"],
      symbol: "USDC",
      name: "USD Coin",
      version: "2",
      decimals: 6,
      tokenType: "eip3009",
      priority: 2,
    },
    USDT: {
      address: USDT_LEGACY_ADDRESSES["eip155:1"],
      symbol: "USDT",
      name: "TetherUSD",
      version: "1",
      decimals: 6,
      tokenType: "legacy",
      priority: 10, // Lower priority due to legacy flow
    },
  },

  // Arbitrum One
  "eip155:42161": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:42161"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
    USDC: {
      address: USDC_ADDRESSES["eip155:42161"],
      symbol: "USDC",
      name: "USD Coin",
      version: "2",
      decimals: 6,
      tokenType: "eip3009",
      priority: 2,
    },
  },

  // Ink Mainnet
  "eip155:57073": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:57073"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Berachain Mainnet
  "eip155:80094": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:80094"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Unichain Mainnet
  "eip155:130": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:130"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Base Mainnet
  "eip155:8453": {
    USDC: {
      address: USDC_ADDRESSES["eip155:8453"],
      symbol: "USDC",
      name: "USD Coin",
      version: "2",
      decimals: 6,
      tokenType: "eip3009",
      priority: 2,
    },
  },

  // Base Sepolia (testnet)
  "eip155:84532": {
    USDC: {
      address: USDC_ADDRESSES["eip155:84532"],
      symbol: "USDC",
      name: "USDC",
      version: "2",
      decimals: 6,
      tokenType: "eip3009",
      priority: 2,
    },
  },

  // Sepolia (testnet)
  "eip155:11155111": {
    USDC: {
      address: USDC_ADDRESSES["eip155:11155111"],
      symbol: "USDC",
      name: "USDC",
      version: "2",
      decimals: 6,
      tokenType: "eip3009",
      priority: 2,
    },
  },

  // Polygon Mainnet
  "eip155:137": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:137"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
    USDC: {
      address: USDC_ADDRESSES["eip155:137"],
      symbol: "USDC",
      name: "USD Coin",
      version: "2",
      decimals: 6,
      tokenType: "eip3009",
      priority: 2,
    },
    USDT: {
      address: USDT_LEGACY_ADDRESSES["eip155:137"],
      symbol: "USDT",
      name: "TetherUSD",
      version: "1",
      decimals: 6,
      tokenType: "legacy",
      priority: 10,
    },
  },

  // === Phase 1: High Priority USDT0 Networks ===

  // Optimism Mainnet
  "eip155:10": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:10"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Mantle Mainnet
  "eip155:5000": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:5000"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Plasma Mainnet
  "eip155:9745": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:9745"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Sei Mainnet
  "eip155:1329": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:1329"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Conflux eSpace Mainnet
  "eip155:1030": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:1030"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Monad Mainnet
  "eip155:143": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:143"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // === Phase 2: Medium Priority USDT0 Networks ===

  // Flare Mainnet
  "eip155:14": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:14"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Rootstock Mainnet (Bitcoin sidechain)
  "eip155:30": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:30"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // XLayer Mainnet (OKX L2)
  "eip155:196": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:196"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Stable Mainnet
  "eip155:988": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:988"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // HyperEVM Mainnet
  "eip155:999": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:999"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // MegaETH Mainnet
  "eip155:4326": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:4326"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // Corn Mainnet
  "eip155:21000000": {
    USDT0: {
      address: USDT0_ADDRESSES["eip155:21000000"],
      symbol: "USDT0",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "eip3009",
      priority: 1,
    },
  },

  // === Legacy USDT Networks (no EIP-3009 support) ===

  // BNB Chain (BSC) - BEP-20 USDT
  "eip155:56": {
    USDT: {
      address: USDT_LEGACY_ADDRESSES["eip155:56"],
      symbol: "USDT",
      name: "Tether USD",
      version: "1",
      decimals: 18, // BSC USDT uses 18 decimals
      tokenType: "legacy",
      priority: 10,
    },
  },

  // Avalanche C-Chain
  "eip155:43114": {
    USDT: {
      address: USDT_LEGACY_ADDRESSES["eip155:43114"],
      symbol: "USDT",
      name: "TetherToken",
      version: "1",
      decimals: 6,
      tokenType: "legacy",
      priority: 10,
    },
  },

  // Fantom
  "eip155:250": {
    USDT: {
      address: USDT_LEGACY_ADDRESSES["eip155:250"],
      symbol: "USDT",
      name: "Frapped USDT",
      version: "1",
      decimals: 6,
      tokenType: "legacy",
      priority: 10,
    },
  },

  // Celo
  "eip155:42220": {
    USDT: {
      address: USDT_LEGACY_ADDRESSES["eip155:42220"],
      symbol: "USDT",
      name: "Tether USD",
      version: "1",
      decimals: 18,
      tokenType: "legacy",
      priority: 10,
    },
  },

  // Kaia (formerly Klaytn)
  "eip155:8217": {
    USDT: {
      address: USDT_LEGACY_ADDRESSES["eip155:8217"],
      symbol: "USDT",
      name: "Tether USD",
      version: "1",
      decimals: 6,
      tokenType: "legacy",
      priority: 10,
    },
  },
};

/**
 * Token priority for payment method selection
 * Lower number = higher priority
 */
export const TOKEN_PRIORITY: Record<string, number> = {
  USDT0: 1, // Highest priority - gasless, cross-chain
  USDC: 2, // Second - wide support, EIP-3009
  USDT: 10, // Lower - requires approval transaction
  DAI: 5, // Medium - good support
};

/**
 * Get token configuration for a specific token on a network
 *
 * @param network - The network identifier in CAIP-2 format
 * @param symbol - The token symbol (e.g., "USDT0", "USDC")
 * @returns The token configuration if found, undefined otherwise
 */
export function getTokenConfig(network: string, symbol: string): TokenConfig | undefined {
  return TOKEN_REGISTRY[network]?.[symbol.toUpperCase()];
}

/**
 * Get all tokens available on a network
 *
 * @param network - The network identifier in CAIP-2 format
 * @returns Array of token configurations sorted by priority
 */
export function getNetworkTokens(network: string): TokenConfig[] {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return [];
  return Object.values(tokens).sort((a, b) => a.priority - b.priority);
}

/**
 * Get the default/preferred token for a network
 * Prefers USDT0 > USDC > others based on priority
 *
 * @param network - The network identifier in CAIP-2 format
 * @returns The highest priority token configuration, or undefined if none found
 */
export function getDefaultToken(network: string): TokenConfig | undefined {
  const tokens = getNetworkTokens(network);
  return tokens[0]; // Already sorted by priority
}

/**
 * Get token by contract address on a network
 *
 * @param network - The network identifier in CAIP-2 format
 * @param address - The token contract address
 * @returns The token configuration if found, undefined otherwise
 */
export function getTokenByAddress(network: string, address: Address): TokenConfig | undefined {
  const tokens = TOKEN_REGISTRY[network];
  if (!tokens) return undefined;

  const lowerAddress = address.toLowerCase();
  return Object.values(tokens).find(t => t.address.toLowerCase() === lowerAddress);
}

/**
 * Check if a token supports EIP-3009 (gasless transfers)
 *
 * @param network - The network identifier in CAIP-2 format
 * @param symbol - The token symbol to check
 * @returns True if the token supports EIP-3009 gasless transfers
 */
export function supportsEIP3009(network: string, symbol: string): boolean {
  const config = getTokenConfig(network, symbol);
  return config?.tokenType === "eip3009";
}

/**
 * Get all networks that support a specific token
 *
 * @param symbol - The token symbol to search for
 * @returns Array of network identifiers that support the token
 */
export function getNetworksForToken(symbol: string): string[] {
  const networks: string[] = [];
  for (const [network, tokens] of Object.entries(TOKEN_REGISTRY)) {
    if (tokens[symbol.toUpperCase()]) {
      networks.push(network);
    }
  }
  return networks;
}

/**
 * Get USDT0 networks (primary T402 token)
 *
 * @returns Array of network identifiers that support USDT0
 */
export function getUsdt0Networks(): string[] {
  return getNetworksForToken("USDT0");
}

/**
 * EIP-712 domain configuration for a token
 *
 * @param network - The network identifier in CAIP-2 format
 * @param tokenAddress - The token contract address
 * @param chainId - The numeric chain ID
 * @returns The EIP-712 domain configuration, or undefined if token not found
 */
export function getEIP712Domain(
  network: string,
  tokenAddress: Address,
  chainId: number,
): { name: string; version: string; chainId: number; verifyingContract: Address } | undefined {
  const token = getTokenByAddress(network, tokenAddress);
  if (!token) return undefined;

  return {
    name: token.name,
    version: token.version,
    chainId,
    verifyingContract: token.address,
  };
}
