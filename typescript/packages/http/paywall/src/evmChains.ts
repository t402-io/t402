/**
 * Optimized EVM chain definitions.
 *
 * This module provides a curated set of commonly-used EVM chains
 * instead of importing all 1000+ chains from viem/chains.
 * This reduces bundle size by ~500KB.
 */
import type { Chain } from "viem";
import {
  // Mainnets
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  avalanche,
  gnosis,
  celo,
  fantom,
  linea,
  scroll,
  zkSync,
  mantle,
  blast,
  mode,
  zora,
  flare,
  rootstock,
  sei,
  confluxESpace,
  // Testnets
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
  bscTestnet,
  avalancheFuji,
  lineaSepolia,
  scrollSepolia,
  zkSyncSepoliaTestnet,
  mantleSepoliaTestnet,
  blastSepolia,
  zoraSepolia,
} from "viem/chains";

/**
 * Custom chain definitions for USDT0 networks not in viem/chains
 */

// Ink Mainnet (Kraken L2)
export const ink: Chain = {
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-gel.inkonchain.com"] },
  },
  blockExplorers: {
    default: { name: "Ink Explorer", url: "https://explorer.inkonchain.com" },
  },
};

// Berachain Mainnet
export const berachain: Chain = {
  id: 80094,
  name: "Berachain",
  nativeCurrency: { name: "BERA", symbol: "BERA", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.berachain.com"] },
  },
  blockExplorers: {
    default: { name: "Berascan", url: "https://berascan.com" },
  },
};

// Unichain Mainnet
export const unichain: Chain = {
  id: 130,
  name: "Unichain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.unichain.org"] },
  },
  blockExplorers: {
    default: { name: "Unichain Explorer", url: "https://explorer.unichain.org" },
  },
};

// Plasma Mainnet
export const plasma: Chain = {
  id: 9745,
  name: "Plasma",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.plasma.io"] },
  },
  blockExplorers: {
    default: { name: "Plasma Explorer", url: "https://explorer.plasma.io" },
  },
};

// Monad Mainnet
export const monad: Chain = {
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://explorer.monad.xyz" },
  },
};

// XLayer Mainnet (OKX L2)
export const xlayer: Chain = {
  id: 196,
  name: "XLayer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "XLayer Explorer", url: "https://www.okx.com/explorer/xlayer" },
  },
};

// Stable Mainnet
export const stable: Chain = {
  id: 988,
  name: "Stable",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.stable.io"] },
  },
  blockExplorers: {
    default: { name: "Stable Explorer", url: "https://explorer.stable.io" },
  },
};

// HyperEVM Mainnet
export const hyperEvm: Chain = {
  id: 999,
  name: "HyperEVM",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.hyperevm.xyz"] },
  },
  blockExplorers: {
    default: { name: "HyperEVM Explorer", url: "https://explorer.hyperevm.xyz" },
  },
};

// MegaETH Mainnet
export const megaeth: Chain = {
  id: 4326,
  name: "MegaETH",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.megaeth.com"] },
  },
  blockExplorers: {
    default: { name: "MegaETH Explorer", url: "https://explorer.megaeth.com" },
  },
};

// Corn Mainnet
export const corn: Chain = {
  id: 21000000,
  name: "Corn",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.corn.xyz"] },
  },
  blockExplorers: {
    default: { name: "Corn Explorer", url: "https://explorer.corn.xyz" },
  },
};

/**
 * Map of chain IDs to chain definitions for commonly used EVM chains.
 * Only includes chains that are likely to be used with T402.
 */
export const KNOWN_CHAINS: Record<number, Chain> = {
  // Mainnets - Standard
  [mainnet.id]: mainnet,
  [base.id]: base,
  [arbitrum.id]: arbitrum,
  [optimism.id]: optimism,
  [polygon.id]: polygon,
  [bsc.id]: bsc,
  [avalanche.id]: avalanche,
  [gnosis.id]: gnosis,
  [celo.id]: celo,
  [fantom.id]: fantom,
  [linea.id]: linea,
  [scroll.id]: scroll,
  [zkSync.id]: zkSync,
  [mantle.id]: mantle,
  [blast.id]: blast,
  [mode.id]: mode,
  [zora.id]: zora,
  // Mainnets - From viem/chains (USDT0 networks)
  [flare.id]: flare,
  [rootstock.id]: rootstock,
  [sei.id]: sei,
  [confluxESpace.id]: confluxESpace,
  // Mainnets - Custom USDT0 networks
  [ink.id]: ink,
  [berachain.id]: berachain,
  [unichain.id]: unichain,
  [plasma.id]: plasma,
  [monad.id]: monad,
  [xlayer.id]: xlayer,
  [stable.id]: stable,
  [hyperEvm.id]: hyperEvm,
  [megaeth.id]: megaeth,
  [corn.id]: corn,
  // Testnets
  [sepolia.id]: sepolia,
  [baseSepolia.id]: baseSepolia,
  [arbitrumSepolia.id]: arbitrumSepolia,
  [optimismSepolia.id]: optimismSepolia,
  [polygonAmoy.id]: polygonAmoy,
  [bscTestnet.id]: bscTestnet,
  [avalancheFuji.id]: avalancheFuji,
  [lineaSepolia.id]: lineaSepolia,
  [scrollSepolia.id]: scrollSepolia,
  [zkSyncSepoliaTestnet.id]: zkSyncSepoliaTestnet,
  [mantleSepoliaTestnet.id]: mantleSepoliaTestnet,
  [blastSepolia.id]: blastSepolia,
  [zoraSepolia.id]: zoraSepolia,
};

// Re-export base as default chain
export { base as defaultChain };

/**
 * Get a chain definition by chain ID.
 *
 * @param chainId - The EVM chain ID
 * @returns The chain definition, or undefined if not found
 */
export function getChainById(chainId: number): Chain | undefined {
  return KNOWN_CHAINS[chainId];
}

/**
 * Get the display name for an EVM chain.
 *
 * @param chainId - The EVM chain ID
 * @returns The chain name, or a fallback "Chain {id}" for unknown chains
 */
export function getEvmChainName(chainId: number): string {
  const chain = KNOWN_CHAINS[chainId];
  return chain?.name ?? `Chain ${chainId}`;
}

/**
 * Check if an EVM chain is a testnet.
 *
 * @param chainId - The EVM chain ID
 * @returns True if the chain is a testnet, false otherwise
 */
export function isEvmTestnet(chainId: number): boolean {
  const chain = KNOWN_CHAINS[chainId];
  return chain?.testnet ?? false;
}

/**
 * Create a minimal chain definition for unknown chains.
 * This allows the paywall to work with any EVM chain, even if
 * we don't have full metadata for it.
 *
 * @param chainId - The EVM chain ID
 * @returns A minimal chain definition
 */
export function createUnknownChain(chainId: number): Chain {
  return {
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [] },
    },
  };
}

/**
 * Get a chain definition by chain ID, creating a minimal definition
 * for unknown chains.
 *
 * @param chainId - The EVM chain ID
 * @returns The chain definition (known or minimal)
 */
export function getChainByIdOrCreate(chainId: number): Chain {
  return KNOWN_CHAINS[chainId] ?? createUnknownChain(chainId);
}
