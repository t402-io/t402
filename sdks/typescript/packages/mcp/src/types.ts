/**
 * Type definitions for t402 MCP Server
 */

import type { Address } from "viem";

/**
 * Supported blockchain networks
 */
export type SupportedNetwork =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "avalanche"
  | "ink"
  | "berachain"
  | "unichain";

/**
 * Token balance information
 */
export interface TokenBalance {
  /** Token symbol (e.g., "USDC", "USDT") */
  symbol: string;
  /** Token contract address */
  address: Address;
  /** Balance in smallest unit (wei/satoshi equivalent) */
  balance: string;
  /** Human-readable balance with decimals */
  formatted: string;
  /** Token decimals */
  decimals: number;
}

/**
 * Chain balance information
 */
export interface ChainBalance {
  /** Network identifier */
  network: SupportedNetwork;
  /** Chain ID */
  chainId: number;
  /** Native token balance (ETH/MATIC/etc) */
  native: {
    symbol: string;
    balance: string;
    formatted: string;
  };
  /** Supported stablecoin balances */
  tokens: TokenBalance[];
}

/**
 * Payment parameters
 */
export interface PaymentParams {
  /** Recipient address */
  to: Address;
  /** Amount to pay (in token units) */
  amount: string;
  /** Token to use for payment */
  token: "USDC" | "USDT" | "USDT0";
  /** Network to execute payment on */
  network: SupportedNetwork;
  /** Optional: memo/reference for payment */
  memo?: string;
}

/**
 * Payment result
 */
export interface PaymentResult {
  /** Transaction hash */
  txHash: string;
  /** Network where payment was executed */
  network: SupportedNetwork;
  /** Amount paid (formatted) */
  amount: string;
  /** Token used */
  token: string;
  /** Recipient address */
  to: Address;
  /** Block explorer URL */
  explorerUrl: string;
}

/**
 * Gasless payment result (ERC-4337)
 */
export interface GaslessPaymentResult extends PaymentResult {
  /** User operation hash */
  userOpHash: string;
  /** Paymaster used */
  paymaster?: string;
}

/**
 * Bridge fee quote
 */
export interface BridgeFeeQuote {
  /** Source chain */
  fromChain: SupportedNetwork;
  /** Destination chain */
  toChain: SupportedNetwork;
  /** Amount to bridge (formatted) */
  amount: string;
  /** Native fee required (in source chain native token) */
  nativeFee: string;
  /** Native fee formatted with symbol */
  nativeFeeFormatted: string;
  /** Estimated time in seconds */
  estimatedTime: number;
}

/**
 * Bridge result
 */
export interface BridgeResult {
  /** Source chain transaction hash */
  txHash: string;
  /** LayerZero message GUID for tracking */
  messageGuid: string;
  /** Amount bridged (formatted) */
  amount: string;
  /** Source chain */
  fromChain: SupportedNetwork;
  /** Destination chain */
  toChain: SupportedNetwork;
  /** Estimated delivery time in seconds */
  estimatedTime: number;
  /** LayerZero Scan URL for tracking */
  trackingUrl: string;
}

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
  /** Private key for signing transactions (hex string) */
  privateKey?: string;
  /** RPC URLs by network */
  rpcUrls?: Partial<Record<SupportedNetwork, string>>;
  /** Enable demo mode (simulates transactions without executing) */
  demoMode?: boolean;
  /** Paymaster URL for gasless transactions */
  paymasterUrl?: string;
  /** Bundler URL for ERC-4337 */
  bundlerUrl?: string;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Server configuration */
  config: McpServerConfig;
  /** Get wallet client for a network */
  getWalletClient: (network: SupportedNetwork) => Promise<unknown>;
  /** Get public client for a network */
  getPublicClient: (network: SupportedNetwork) => Promise<unknown>;
}
