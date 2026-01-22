/**
 * Type definitions for T402 WDK integration
 */

import type { Address } from "viem";

/**
 * EVM chain configuration
 */
export interface EvmChainConfig {
  /** RPC endpoint URL */
  provider: string;
  /** Chain ID */
  chainId: number;
  /** CAIP-2 network identifier */
  network: string;
}

/**
 * T402 WDK configuration options
 */
export interface T402WDKConfig {
  /** Ethereum mainnet configuration */
  ethereum?: EvmChainConfig | string;
  /** Arbitrum One configuration */
  arbitrum?: EvmChainConfig | string;
  /** Base mainnet configuration */
  base?: EvmChainConfig | string;
  /** Ink mainnet configuration */
  ink?: EvmChainConfig | string;
  /** Berachain mainnet configuration */
  berachain?: EvmChainConfig | string;
  /** Unichain mainnet configuration */
  unichain?: EvmChainConfig | string;
  /** Polygon mainnet configuration */
  polygon?: EvmChainConfig | string;
  /** Custom chains */
  [key: string]: EvmChainConfig | string | undefined;
}

/**
 * Normalized chain configuration
 */
export interface NormalizedChainConfig {
  provider: string;
  chainId: number;
  network: string;
  name: string;
}

/**
 * Token balance information
 */
export interface TokenBalance {
  /** Token contract address */
  token: Address;
  /** Token symbol */
  symbol: string;
  /** Balance in smallest units */
  balance: bigint;
  /** Formatted balance (human-readable) */
  formatted: string;
  /** Decimals */
  decimals: number;
}

/**
 * Chain balance information
 */
export interface ChainBalance {
  /** Chain name (e.g., "arbitrum") */
  chain: string;
  /** CAIP-2 network identifier */
  network: string;
  /** Native token balance */
  native: bigint;
  /** Token balances */
  tokens: TokenBalance[];
}

/**
 * Aggregated balance across all chains
 */
export interface AggregatedBalance {
  /** Total USDT0 balance across all chains */
  totalUsdt0: bigint;
  /** Total USDC balance across all chains */
  totalUsdc: bigint;
  /** Per-chain balances */
  chains: ChainBalance[];
}

/**
 * Bridge parameters for cross-chain transfers
 */
export interface BridgeParams {
  /** Source chain name */
  fromChain: string;
  /** Destination chain name */
  toChain: string;
  /** Amount to bridge in smallest units */
  amount: bigint;
  /** Recipient address (optional, defaults to same wallet on target chain) */
  recipient?: Address;
}

/**
 * Bridge result
 */
export interface BridgeResult {
  /** Transaction hash on source chain */
  txHash: string;
  /** Estimated time for bridge completion in seconds */
  estimatedTime: number;
}

/**
 * EIP-712 typed data domain
 */
export interface TypedDataDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

/**
 * EIP-712 typed data types
 */
export type TypedDataTypes = Record<string, Array<{ name: string; type: string }>>;

/**
 * T402 Signer interface for WDK
 * Compatible with @t402/core signer requirements
 */
export interface T402WDKSigner {
  /** Get wallet address */
  readonly address: Address;

  /** Sign EIP-712 typed data */
  signTypedData(params: {
    domain: TypedDataDomain;
    types: TypedDataTypes;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;

  /** Sign a message */
  signMessage?(message: string | Uint8Array): Promise<`0x${string}`>;

  /** Get token balance */
  getTokenBalance?(tokenAddress: Address): Promise<bigint>;
}

/**
 * WDK Account interface (matches @tetherto/wdk account structure)
 */
export interface WDKAccount {
  getAddress(): Promise<string>;
  getBalance(): Promise<bigint>;
  getTokenBalance(tokenAddress: string): Promise<bigint>;
  signMessage(message: string): Promise<string>;
  signTypedData(params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<string>;
  sendTransaction(params: { to: string; value?: bigint | string; data?: string }): Promise<string>;
  estimateGas(params: { to: string; value?: bigint | string; data?: string }): Promise<bigint>;
}

/**
 * WDK instance interface (matches @tetherto/wdk structure)
 */
export interface WDKInstance {
  registerWallet<T>(
    name: string,
    manager: T,
    config: Record<string, unknown>,
  ): WDKInstance;
  registerProtocol<T>(name: string, protocol: T): WDKInstance;
  getAccount(chain: string, index: number): Promise<WDKAccount>;
  executeProtocol(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{ txHash: string }>;
}

/**
 * WDK constructor type
 */
export interface WDKConstructor {
  new (seedPhrase: string): WDKInstance;
  getRandomSeedPhrase(): string;
}

/**
 * Balance cache configuration for T402WDK
 */
export interface T402BalanceCacheConfig {
  /** Whether caching is enabled (default: true) */
  enabled?: boolean;
  /** TTL for native balance in milliseconds (default: 15000 = 15 seconds) */
  nativeBalanceTTL?: number;
  /** TTL for token balance in milliseconds (default: 30000 = 30 seconds) */
  tokenBalanceTTL?: number;
  /** TTL for aggregated balances in milliseconds (default: 60000 = 60 seconds) */
  aggregatedBalanceTTL?: number;
  /** Maximum cache entries (default: 500) */
  maxSize?: number;
}

/**
 * Extended T402 WDK configuration with cache options
 */
export interface T402WDKOptions {
  /** Balance cache configuration */
  cache?: T402BalanceCacheConfig;
}
