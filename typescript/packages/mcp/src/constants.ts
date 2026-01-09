/**
 * Constants and network configurations for t402 MCP Server
 */

import type { Address } from "viem";
import type { SupportedNetwork } from "./types.js";

/**
 * Chain IDs by network
 */
export const CHAIN_IDS: Record<SupportedNetwork, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  avalanche: 43114,
  ink: 57073,
  berachain: 80094,
  unichain: 130,
};

/**
 * Native token symbols by network
 */
export const NATIVE_SYMBOLS: Record<SupportedNetwork, string> = {
  ethereum: "ETH",
  base: "ETH",
  arbitrum: "ETH",
  optimism: "ETH",
  polygon: "MATIC",
  avalanche: "AVAX",
  ink: "ETH",
  berachain: "BERA",
  unichain: "ETH",
};

/**
 * Block explorer URLs by network
 */
export const EXPLORER_URLS: Record<SupportedNetwork, string> = {
  ethereum: "https://etherscan.io",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
  optimism: "https://optimistic.etherscan.io",
  polygon: "https://polygonscan.com",
  avalanche: "https://snowtrace.io",
  ink: "https://explorer.inkonchain.com",
  berachain: "https://berascan.com",
  unichain: "https://unichain.blockscout.com",
};

/**
 * Default RPC URLs by network (public endpoints)
 */
export const DEFAULT_RPC_URLS: Record<SupportedNetwork, string> = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  polygon: "https://polygon-rpc.com",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  ink: "https://rpc-gel.inkonchain.com",
  berachain: "https://rpc.berachain.com",
  unichain: "https://mainnet.unichain.org",
};

/**
 * USDC contract addresses by network
 */
export const USDC_ADDRESSES: Partial<Record<SupportedNetwork, Address>> = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
};

/**
 * USDT contract addresses by network
 */
export const USDT_ADDRESSES: Partial<Record<SupportedNetwork, Address>> = {
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  avalanche: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  optimism: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
};

/**
 * USDT0 (LayerZero OFT) contract addresses by network
 */
export const USDT0_ADDRESSES: Partial<Record<SupportedNetwork, Address>> = {
  ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  ink: "0x0200C29006150606B650577BBE7B6248F58470c1",
  berachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  unichain: "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
};

/**
 * Chains that support USDT0 bridging
 */
export const BRIDGEABLE_CHAINS: SupportedNetwork[] = [
  "ethereum",
  "arbitrum",
  "ink",
  "berachain",
  "unichain",
];

/**
 * ERC20 ABI for balance and transfer operations
 */
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(
  network: SupportedNetwork,
  txHash: string
): string {
  return `${EXPLORER_URLS[network]}/tx/${txHash}`;
}

/**
 * Get LayerZero Scan URL for a message
 */
export function getLayerZeroScanUrl(messageGuid: string): string {
  return `https://layerzeroscan.com/tx/${messageGuid}`;
}

/**
 * Check if a network supports a specific token
 */
export function supportsToken(
  network: SupportedNetwork,
  token: "USDC" | "USDT" | "USDT0"
): boolean {
  switch (token) {
    case "USDC":
      return network in USDC_ADDRESSES;
    case "USDT":
      return network in USDT_ADDRESSES;
    case "USDT0":
      return network in USDT0_ADDRESSES;
    default:
      return false;
  }
}

/**
 * Get token address for a network
 */
export function getTokenAddress(
  network: SupportedNetwork,
  token: "USDC" | "USDT" | "USDT0"
): Address | undefined {
  switch (token) {
    case "USDC":
      return USDC_ADDRESSES[network];
    case "USDT":
      return USDT_ADDRESSES[network];
    case "USDT0":
      return USDT0_ADDRESSES[network];
    default:
      return undefined;
  }
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  symbol: string
): string {
  const divisor = BigInt(10 ** decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "") || "0";

  if (trimmedFractional === "0") {
    return `${wholePart} ${symbol}`;
  }
  return `${wholePart}.${trimmedFractional} ${symbol}`;
}

/**
 * Parse token amount from string to bigint
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [wholePart, fractionalPart = ""] = amount.split(".");
  const paddedFractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(wholePart + paddedFractional);
}
