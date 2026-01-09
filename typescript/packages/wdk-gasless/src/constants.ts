/**
 * WDK Gasless Constants
 *
 * Addresses and configuration for gasless USDT0 payments.
 */

import type { Address } from "viem";

/**
 * USDT0 OFT addresses by chain
 */
export const USDT0_ADDRESSES: Record<string, Address> = {
  ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  ink: "0x0200C29006150606B650577BBE7B6248F58470c1",
  berachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
  unichain: "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
  base: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  optimism: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
} as const;

/**
 * USDC addresses by chain
 */
export const USDC_ADDRESSES: Record<string, Address> = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
} as const;

/**
 * Chain IDs for supported networks
 */
export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  polygon: 137,
  ink: 57073,
  berachain: 80084,
  unichain: 130,
} as const;

/**
 * Default bundler URLs by chain (using public endpoints)
 */
export const DEFAULT_BUNDLER_URLS: Record<number, string> = {
  1: "https://api.pimlico.io/v2/ethereum/rpc",
  42161: "https://api.pimlico.io/v2/arbitrum/rpc",
  8453: "https://api.pimlico.io/v2/base/rpc",
  10: "https://api.pimlico.io/v2/optimism/rpc",
  137: "https://api.pimlico.io/v2/polygon/rpc",
} as const;

/**
 * Get token address for a chain
 */
export function getTokenAddress(
  token: "USDT0" | "USDC" | Address,
  chainName: string,
): Address {
  if (token.startsWith("0x")) {
    return token as Address;
  }

  const addresses = token === "USDT0" ? USDT0_ADDRESSES : USDC_ADDRESSES;
  const address = addresses[chainName.toLowerCase()];

  if (!address) {
    throw new Error(`Token ${token} not available on ${chainName}`);
  }

  return address;
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: number): string {
  const entry = Object.entries(CHAIN_IDS).find(([, id]) => id === chainId);
  if (!entry) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return entry[0];
}
