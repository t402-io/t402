/**
 * ERC-4337 Account Abstraction Types
 *
 * Type definitions for ERC-4337 v0.7 implementation.
 */

import type { Address, Hex } from "viem";

/**
 * UserOperation for off-chain representation
 * This is the format used before packing for on-chain submission
 */
export interface UserOperation {
  /** Smart account address */
  sender: Address;
  /** Anti-replay nonce */
  nonce: bigint;
  /** Factory address + init data (for account deployment) or empty */
  initCode: Hex;
  /** Encoded call data for the account's execute function */
  callData: Hex;
  /** Gas limit for account validation */
  verificationGasLimit: bigint;
  /** Gas limit for call execution */
  callGasLimit: bigint;
  /** Gas to pay bundler for overhead */
  preVerificationGas: bigint;
  /** Max priority fee per gas (tip) */
  maxPriorityFeePerGas: bigint;
  /** Max fee per gas */
  maxFeePerGas: bigint;
  /** Paymaster address + data, or empty for self-pay */
  paymasterAndData: Hex;
  /** Signature over the UserOperation hash */
  signature: Hex;
}

/**
 * PackedUserOperation for on-chain submission (v0.7)
 * Gas fields are packed into bytes32 for efficiency
 */
export interface PackedUserOperation {
  /** Smart account address */
  sender: Address;
  /** Anti-replay nonce */
  nonce: bigint;
  /** Factory address + init data, or empty */
  initCode: Hex;
  /** Encoded call data */
  callData: Hex;
  /** Packed: verificationGasLimit (16 bytes) + callGasLimit (16 bytes) */
  accountGasLimits: Hex;
  /** Gas for bundler overhead */
  preVerificationGas: bigint;
  /** Packed: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes) */
  gasFees: Hex;
  /** Paymaster address + verification gas + postOp gas + data */
  paymasterAndData: Hex;
  /** Authorization signature */
  signature: Hex;
}

/**
 * Paymaster data for gas sponsorship
 */
export interface PaymasterData {
  /** Paymaster contract address */
  paymaster: Address;
  /** Gas limit for paymaster validation */
  paymasterVerificationGasLimit: bigint;
  /** Gas limit for paymaster post-operation */
  paymasterPostOpGasLimit: bigint;
  /** Additional paymaster-specific data */
  paymasterData: Hex;
}

/**
 * Gas estimation result from bundler
 */
export interface GasEstimate {
  /** Gas for account validation */
  verificationGasLimit: bigint;
  /** Gas for call execution */
  callGasLimit: bigint;
  /** Gas for bundler overhead */
  preVerificationGas: bigint;
  /** Gas for paymaster validation (if applicable) */
  paymasterVerificationGasLimit?: bigint;
  /** Gas for paymaster post-op (if applicable) */
  paymasterPostOpGasLimit?: bigint;
}

/**
 * UserOperation receipt from bundler
 */
export interface UserOperationReceipt {
  /** UserOperation hash */
  userOpHash: Hex;
  /** Smart account address */
  sender: Address;
  /** Nonce used */
  nonce: bigint;
  /** Paymaster address (if used) */
  paymaster?: Address;
  /** Actual gas cost */
  actualGasCost: bigint;
  /** Actual gas used */
  actualGasUsed: bigint;
  /** Success status */
  success: boolean;
  /** Revert reason (if failed) */
  reason?: string;
  /** Transaction receipt */
  receipt: {
    transactionHash: Hex;
    blockNumber: bigint;
    blockHash: Hex;
  };
}

/**
 * Bundler client configuration
 */
export interface BundlerConfig {
  /** Bundler RPC endpoint URL */
  bundlerUrl: string;
  /** EntryPoint contract address */
  entryPoint?: Address;
  /** Chain ID */
  chainId: number;
}

/**
 * Paymaster configuration
 */
export interface PaymasterConfig {
  /** Paymaster contract address */
  address: Address;
  /** Paymaster service URL (for verifying paymasters) */
  url?: string;
  /** Paymaster type */
  type: "verifying" | "token" | "sponsoring";
  /** Additional configuration */
  options?: Record<string, unknown>;
}

/**
 * Smart account signer interface
 */
export interface SmartAccountSigner {
  /** Get the smart account address */
  getAddress(): Promise<Address>;
  /** Sign a UserOperation hash */
  signUserOpHash(userOpHash: Hex): Promise<Hex>;
  /** Get the account's init code (for deployment) */
  getInitCode(): Promise<Hex>;
  /** Check if the account is deployed */
  isDeployed(): Promise<boolean>;
  /** Encode a call to the account's execute function */
  encodeExecute(target: Address, value: bigint, data: Hex): Hex;
  /** Encode a batch call to the account's executeBatch function */
  encodeExecuteBatch(
    targets: Address[],
    values: bigint[],
    datas: Hex[],
  ): Hex;
}

/**
 * UserOperation builder configuration
 */
export interface UserOpBuilderConfig {
  /** Smart account signer */
  signer: SmartAccountSigner;
  /** Bundler configuration */
  bundler: BundlerConfig;
  /** Optional paymaster configuration */
  paymaster?: PaymasterConfig;
}

/**
 * Transaction intent for building UserOperations
 */
export interface TransactionIntent {
  /** Target contract address */
  to: Address;
  /** Value to send (in wei) */
  value?: bigint;
  /** Call data */
  data?: Hex;
}

/**
 * Result of submitting a UserOperation
 */
export interface UserOperationResult {
  /** UserOperation hash */
  userOpHash: Hex;
  /** Wait for the operation to be included */
  wait(): Promise<UserOperationReceipt>;
}
