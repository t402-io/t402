/**
 * WDK Multi-sig Types
 *
 * Type definitions for multi-sig Safe smart accounts using Tether WDK.
 */

import type { Address, Hex, PublicClient } from "viem";
import type {
  SmartAccountSigner,
  BundlerConfig,
  PaymasterConfig,
  UserOperation,
} from "@t402/evm";
import type { WDKSigner, T402WDKConfig } from "@t402/wdk";
import type {
  GaslessPaymentParams,
  BatchPaymentParams,
  GaslessPaymentReceipt,
} from "@t402/wdk-gasless";

/**
 * Configuration for multi-sig WDK smart account
 */
export interface MultiSigWDKConfig {
  /** Multiple WDK signers as owners */
  owners: WDKSigner[];
  /** M-of-N threshold requirement */
  threshold: number;
  /** Chain ID for the Safe account */
  chainId: number;
  /** Public client for chain interactions */
  publicClient: PublicClient;
  /** Salt nonce for deterministic address generation */
  saltNonce?: bigint;
}

/**
 * Configuration for single-seed multi-sig setup
 * One seed phrase generates multiple owner addresses via different HD paths
 */
export interface SingleSeedConfig {
  /** Single seed phrase */
  seedPhrase: string;
  /** Account indices to use as owners (e.g., [0, 1, 2] for 3 owners) */
  accountIndices: number[];
  /** M-of-N threshold */
  threshold: number;
  /** Chain configuration */
  chainConfig: T402WDKConfig;
  /** Chain to use for the Safe account */
  chain: string;
  /** Salt nonce for address generation */
  saltNonce?: bigint;
  /** Bundler configuration */
  bundler: BundlerConfig;
  /** Paymaster configuration for gas sponsorship */
  paymaster?: PaymasterConfig;
}

/**
 * Configuration for multi-seed multi-sig setup
 * Each seed phrase generates one owner address
 */
export interface MultiSeedConfig {
  /** Array of seed phrases (one per owner) */
  seedPhrases: string[];
  /** M-of-N threshold */
  threshold: number;
  /** Chain configuration */
  chainConfig: T402WDKConfig;
  /** Chain to use for the Safe account */
  chain: string;
  /** Salt nonce for address generation */
  saltNonce?: bigint;
  /** Bundler configuration */
  bundler: BundlerConfig;
  /** Paymaster configuration for gas sponsorship */
  paymaster?: PaymasterConfig;
}

/**
 * Pending signature for multi-sig transactions
 */
export interface PendingSignature {
  /** Owner address that needs to sign */
  owner: Address;
  /** Index of the owner in the Safe's owner list */
  ownerIndex: number;
  /** Whether this owner has signed */
  signed: boolean;
  /** The signature if signed */
  signature?: Hex;
}

/**
 * Multi-sig transaction request awaiting signatures
 */
export interface MultiSigTransactionRequest {
  /** Unique identifier for this request */
  id: string;
  /** The UserOperation to sign */
  userOp: UserOperation;
  /** UserOperation hash for signing */
  userOpHash: Hex;
  /** Current signatures collected */
  signatures: PendingSignature[];
  /** Number of signatures required */
  threshold: number;
  /** Number of signatures collected so far */
  collectedCount: number;
  /** Whether enough signatures are collected */
  isReady: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt: number;
}

/**
 * Result of multi-sig payment initiation
 */
export interface MultiSigPaymentResult {
  /** Transaction request ID */
  requestId: string;
  /** Smart account address */
  sender: Address;
  /** UserOperation hash */
  userOpHash: Hex;
  /** Whether gas is sponsored */
  sponsored: boolean;
  /** Signatures collected so far */
  signatures: PendingSignature[];
  /** Number of signatures required */
  threshold: number;
  /** Number of signatures collected */
  collectedCount: number;
  /** Whether ready to submit */
  isReady: boolean;
  /** Add a signature from an owner */
  addSignature(ownerIndex: number, signer: WDKSigner): Promise<void>;
  /** Submit when ready */
  submit(): Promise<MultiSigSubmitResult>;
}

/**
 * Result of submitting a multi-sig transaction
 */
export interface MultiSigSubmitResult {
  /** UserOperation hash */
  userOpHash: Hex;
  /** Smart account address */
  sender: Address;
  /** Wait for confirmation */
  wait(): Promise<GaslessPaymentReceipt>;
}

/**
 * Configuration for multi-sig gasless client
 */
export interface MultiSigGaslessClientConfig {
  /** Multi-sig smart account signer */
  signer: MultiSigSmartAccountSigner;
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
 * Multi-sig smart account signer interface
 * Extends SmartAccountSigner to handle multiple owner signatures
 */
export interface MultiSigSmartAccountSigner extends SmartAccountSigner {
  /** Get all owner addresses */
  getOwners(): Address[];
  /** Get threshold */
  getThreshold(): number;
  /** Get all WDK signers */
  getSigners(): WDKSigner[];
  /** Sign with a specific owner index */
  signWithOwner(userOpHash: Hex, ownerIndex: number): Promise<Hex>;
  /** Combine multiple signatures into final signature */
  combineSignatures(signatures: Map<number, Hex>): Hex;
  /** Check if we have enough signatures */
  hasEnoughSignatures(signatures: Map<number, Hex>): boolean;
}

/**
 * Re-export common types from wdk-gasless
 */
export type {
  GaslessPaymentParams,
  BatchPaymentParams,
  GaslessPaymentReceipt,
};
