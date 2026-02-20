/**
 * Chain configuration and token addresses for T402 WDK
 */

import type { Address } from 'viem'
import type { NormalizedChainConfig, EvmChainConfig, ChainFamily } from './types.js'

/**
 * Default chain configurations
 */
export const DEFAULT_CHAINS: Record<string, Omit<NormalizedChainConfig, 'provider'>> = {
  ethereum: {
    chainId: 1,
    network: 'eip155:1',
    name: 'ethereum',
  },
  arbitrum: {
    chainId: 42161,
    network: 'eip155:42161',
    name: 'arbitrum',
  },
  base: {
    chainId: 8453,
    network: 'eip155:8453',
    name: 'base',
  },
  ink: {
    chainId: 57073,
    network: 'eip155:57073',
    name: 'ink',
  },
  berachain: {
    chainId: 80094,
    network: 'eip155:80094',
    name: 'berachain',
  },
  unichain: {
    chainId: 130,
    network: 'eip155:130',
    name: 'unichain',
  },
  optimism: {
    chainId: 10,
    network: 'eip155:10',
    name: 'optimism',
  },
  polygon: {
    chainId: 137,
    network: 'eip155:137',
    name: 'polygon',
  },
}

/**
 * Default RPC endpoints (public endpoints, may have rate limits)
 */
export const DEFAULT_RPC_ENDPOINTS: Record<string, string> = {
  ethereum: 'https://eth.drpc.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  base: 'https://mainnet.base.org',
  ink: 'https://rpc-gel.inkonchain.com',
  optimism: 'https://mainnet.optimism.io',
  polygon: 'https://polygon-rpc.com',
}

/**
 * USDT0 token addresses by chain
 * USDT0 is Tether's omnichain token with EIP-3009 support
 */
export const USDT0_ADDRESSES: Record<string, Address> = {
  ethereum: '0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee',
  arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  ink: '0x0200C29006150606B650577BBE7B6248F58470c1',
  berachain: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
  unichain: '0x9151434b16b9763660705744891fA906F660EcC5',
}

/**
 * USDC token addresses by chain
 */
export const USDC_ADDRESSES: Record<string, Address> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
}

/**
 * Legacy USDT addresses (no EIP-3009 support)
 */
export const USDT_LEGACY_ADDRESSES: Record<string, Address> = {
  ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
}

/**
 * All supported tokens per chain with metadata
 */
export interface TokenInfo {
  address: Address
  symbol: string
  name: string
  decimals: number
  /** Whether token supports EIP-3009 (gasless transfers) */
  supportsEIP3009: boolean
}

export const CHAIN_TOKENS: Record<string, TokenInfo[]> = {
  ethereum: [
    {
      address: USDT0_ADDRESSES.ethereum,
      symbol: 'USDT0',
      name: 'TetherToken',
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDC_ADDRESSES.ethereum,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDT_LEGACY_ADDRESSES.ethereum,
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      supportsEIP3009: false,
    },
  ],
  arbitrum: [
    {
      address: USDT0_ADDRESSES.arbitrum,
      symbol: 'USDT0',
      name: 'TetherToken',
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDC_ADDRESSES.arbitrum,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  base: [
    {
      address: USDC_ADDRESSES.base,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  ink: [
    {
      address: USDT0_ADDRESSES.ink,
      symbol: 'USDT0',
      name: 'TetherToken',
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  berachain: [
    {
      address: USDT0_ADDRESSES.berachain,
      symbol: 'USDT0',
      name: 'TetherToken',
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  unichain: [
    {
      address: USDT0_ADDRESSES.unichain,
      symbol: 'USDT0',
      name: 'TetherToken',
      decimals: 6,
      supportsEIP3009: true,
    },
  ],
  polygon: [
    {
      address: USDC_ADDRESSES.polygon,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      supportsEIP3009: true,
    },
    {
      address: USDT_LEGACY_ADDRESSES.polygon,
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      supportsEIP3009: false,
    },
  ],
}

// ============================================================
// Unified Chain Registry
// ============================================================

/**
 * Token entry in the chain registry (address is string to support non-EVM)
 */
export interface RegistryToken {
  address: string
  symbol: string
  decimals: number
}

/**
 * Unified chain registry entry
 */
export interface ChainRegistryEntry {
  family: ChainFamily
  chainId?: number
  caip2: string
  rpcEndpoints: string[]
  tokens: RegistryToken[]
}

/**
 * Unified chain registry mapping chain names to metadata.
 *
 * Includes EVM chains (derived from existing data), plus TON, TRON, Solana.
 * Existing exports (DEFAULT_CHAINS, USDT0_ADDRESSES, etc.) remain the
 * canonical source for EVM data; the registry provides a single lookup
 * for cross-chain code paths.
 */
export const CHAIN_REGISTRY: Record<string, ChainRegistryEntry> = {
  // --- EVM chains (derived from existing constants) ---
  ethereum: {
    family: 'evm',
    chainId: 1,
    caip2: 'eip155:1',
    rpcEndpoints: ['https://eth.drpc.org'],
    tokens: (CHAIN_TOKENS.ethereum ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  arbitrum: {
    family: 'evm',
    chainId: 42161,
    caip2: 'eip155:42161',
    rpcEndpoints: ['https://arb1.arbitrum.io/rpc'],
    tokens: (CHAIN_TOKENS.arbitrum ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  base: {
    family: 'evm',
    chainId: 8453,
    caip2: 'eip155:8453',
    rpcEndpoints: ['https://mainnet.base.org'],
    tokens: (CHAIN_TOKENS.base ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  ink: {
    family: 'evm',
    chainId: 57073,
    caip2: 'eip155:57073',
    rpcEndpoints: ['https://rpc-gel.inkonchain.com'],
    tokens: (CHAIN_TOKENS.ink ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  berachain: {
    family: 'evm',
    chainId: 80094,
    caip2: 'eip155:80094',
    rpcEndpoints: [],
    tokens: (CHAIN_TOKENS.berachain ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  unichain: {
    family: 'evm',
    chainId: 130,
    caip2: 'eip155:130',
    rpcEndpoints: [],
    tokens: (CHAIN_TOKENS.unichain ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  optimism: {
    family: 'evm',
    chainId: 10,
    caip2: 'eip155:10',
    rpcEndpoints: ['https://mainnet.optimism.io'],
    tokens: (CHAIN_TOKENS.optimism ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  polygon: {
    family: 'evm',
    chainId: 137,
    caip2: 'eip155:137',
    rpcEndpoints: ['https://polygon-rpc.com'],
    tokens: (CHAIN_TOKENS.polygon ?? []).map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: t.decimals,
    })),
  },
  // --- Non-EVM chains ---
  ton: {
    family: 'ton',
    caip2: 'ton:mainnet',
    rpcEndpoints: ['https://toncenter.com/api/v2/jsonRPC'],
    tokens: [
      {
        address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        symbol: 'USDT',
        decimals: 6,
      },
    ],
  },
  tron: {
    family: 'tron',
    caip2: 'tron:mainnet',
    rpcEndpoints: ['https://api.trongrid.io'],
    tokens: [
      {
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        symbol: 'USDT',
        decimals: 6,
      },
    ],
  },
  solana: {
    family: 'svm',
    caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    rpcEndpoints: ['https://api.mainnet-beta.solana.com'],
    tokens: [
      {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        decimals: 6,
      },
    ],
  },
}

/**
 * Look up a chain registry entry by CAIP-2 identifier.
 */
export function getRegistryByCaip2(caip2: string): ChainRegistryEntry | undefined {
  for (const entry of Object.values(CHAIN_REGISTRY)) {
    if (entry.caip2 === caip2) {
      return entry
    }
  }
  return undefined
}

/**
 * Get all chain names for a given chain family.
 */
export function getChainsByFamily(family: ChainFamily): string[] {
  return Object.entries(CHAIN_REGISTRY)
    .filter(([, entry]) => entry.family === family)
    .map(([name]) => name)
}

/**
 * Normalize chain configuration from string or object
 */
export function normalizeChainConfig(
  chainName: string,
  config: string | EvmChainConfig,
): NormalizedChainConfig {
  const defaultConfig = DEFAULT_CHAINS[chainName]

  if (typeof config === 'string') {
    // String is RPC URL
    return {
      provider: config,
      chainId: defaultConfig?.chainId ?? 1,
      network: defaultConfig?.network ?? `eip155:1`,
      name: chainName,
    }
  }

  // Full config object — resolve primary URL from string or array
  const resolvedProvider = Array.isArray(config.provider) ? config.provider[0] : config.provider
  return {
    provider: resolvedProvider,
    chainId: config.chainId ?? defaultConfig?.chainId ?? 1,
    network: config.network ?? defaultConfig?.network ?? `eip155:${config.chainId}`,
    name: chainName,
  }
}

/**
 * Get CAIP-2 network ID from chain name
 */
export function getNetworkFromChain(chain: string): string {
  return DEFAULT_CHAINS[chain]?.network ?? `eip155:1`
}

/**
 * Get chain name from CAIP-2 network ID
 */
export function getChainFromNetwork(network: string): string | undefined {
  // Check EVM chains first (most common)
  for (const [chain, config] of Object.entries(DEFAULT_CHAINS)) {
    if (config.network === network) {
      return chain
    }
  }
  // Fall back to full registry (non-EVM chains)
  for (const [chain, entry] of Object.entries(CHAIN_REGISTRY)) {
    if (entry.caip2 === network) {
      return chain
    }
  }
  return undefined
}

/**
 * Get chain ID from chain name
 */
export function getChainId(chain: string): number {
  return DEFAULT_CHAINS[chain]?.chainId ?? 1
}

/**
 * Get all chains that support USDT0
 */
export function getUsdt0Chains(): string[] {
  return Object.keys(USDT0_ADDRESSES)
}

/**
 * Get preferred token for a chain (USDT0 > USDC > USDT)
 */
export function getPreferredToken(chain: string): TokenInfo | undefined {
  const tokens = CHAIN_TOKENS[chain]
  if (!tokens || tokens.length === 0) return undefined

  // Priority: USDT0 > USDC > others
  return (
    tokens.find((t) => t.symbol === 'USDT0') ?? tokens.find((t) => t.symbol === 'USDC') ?? tokens[0]
  )
}
