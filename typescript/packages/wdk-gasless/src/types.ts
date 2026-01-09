/**
 * WDK Gasless Types
 *
 * Type definitions for gasless payments using Tether WDK and ERC-4337.
 */

import type { Address, Hex, PublicClient } from "viem";
import type {
  SmartAccountSigner,
  BundlerConfig,
  PaymasterConfig,
} from "@t402/evm";

/**
 * WDK account interface (compatible with @tetherto/wdk)
 */
export interface WdkAccount {
  /** Get the account's address */
  getAddress(): Promise<string>;
  /** Get the account's native balance */
  getBalance(): Promise<bigint>;
  /** Get the account's token balance */
  getTokenBalance(tokenAddress: string): Promise<bigint>;
  /** Sign a message */
  signMessage(message: string): Promise<string>;
  /** Sign typed data (EIP-712) */
  signTypedData(params: {
    domain: {
      name?: string;
      version?: string;
      chainId?: number;
      verifyingContract?: string;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<string>;
  /** Send a transaction */
  sendTransaction(params: {
    to: string;
    value?: bigint;
    data?: string;
  }): Promise<string>;
}

/**
 * WDK instance interface
 */
export interface WdkInstance {
  /** Get accounts */
  getAccounts(): WdkAccount[];
  /** Get account by index */
  getAccount(index: number): WdkAccount;
}

/**
 * Configuration for WDK smart account
 */
export interface WdkSmartAccountConfig {
  /** WDK account to use as the signer */
  wdkAccount: WdkAccount;
  /** Public client for chain interactions */
  publicClient: PublicClient;
  /** Chain ID */
  chainId: number;
  /** Additional owners for multi-sig (optional) */
  additionalOwners?: Address[];
  /** Threshold for multi-sig (defaults to 1) */
  threshold?: number;
  /** Salt nonce for address generation (defaults to 0) */
  saltNonce?: bigint;
}

/**
 * Configuration for WDK gasless client
 */
export interface WdkGaslessClientConfig {
  /** WDK smart account signer */
  signer: SmartAccountSigner;
  /** Bundler configuration */
  bundler: BundlerConfig;
  /** Paymaster configuration for gas sponsorship */
  paymaster?: PaymasterConfig;
  /** Chain ID */
  chainId: number;
  /** Public client */
  publicClient: PublicClient;
}

/**
 * Parameters for a gasless payment
 */
export interface GaslessPaymentParams {
  /** Recipient address */
  to: Address;
  /** Amount to send (in token decimals, e.g., 1000000 for 1 USDT) */
  amount: bigint;
  /** Token to send (defaults to USDT0) */
  token?: "USDT0" | "USDC" | Address;
}

/**
 * Parameters for a batch payment
 */
export interface BatchPaymentParams {
  /** List of payments to execute */
  payments: Array<{
    /** Recipient address */
    to: Address;
    /** Amount to send */
    amount: bigint;
    /** Token to send (defaults to USDT0) */
    token?: "USDT0" | "USDC" | Address;
  }>;
}

/**
 * Result of a gasless payment
 */
export interface GaslessPaymentResult {
  /** UserOperation hash */
  userOpHash: Hex;
  /** Smart account address */
  sender: Address;
  /** Whether the payment was sponsored (free gas) */
  sponsored: boolean;
  /** Wait for the operation to be included */
  wait(): Promise<GaslessPaymentReceipt>;
}

/**
 * Receipt of a gasless payment
 */
export interface GaslessPaymentReceipt {
  /** UserOperation hash */
  userOpHash: Hex;
  /** Transaction hash (on-chain) */
  txHash: Hex;
  /** Block number */
  blockNumber: bigint;
  /** Whether the payment succeeded */
  success: boolean;
  /** Gas used (in native token) */
  gasUsed: bigint;
  /** Gas cost (in native token wei) */
  gasCost: bigint;
  /** Revert reason if failed */
  reason?: string;
}

/**
 * Sponsorship check result
 */
export interface SponsorshipInfo {
  /** Whether the payment can be sponsored */
  canSponsor: boolean;
  /** Reason if cannot sponsor */
  reason?: string;
  /** Maximum amount that can be sponsored (if applicable) */
  maxAmount?: bigint;
  /** Estimated gas cost if not sponsored */
  estimatedGasCost?: bigint;
}
