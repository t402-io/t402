/**
 * ERC-4337 Account Abstraction Constants
 *
 * Provides constants for ERC-4337 v0.7 implementation including:
 * - EntryPoint contract addresses
 * - Default gas limits
 * - ABI definitions
 *
 * @see https://eips.ethereum.org/EIPS/eip-4337
 */

import type { Address } from "viem";

/**
 * EntryPoint v0.7 contract address (canonical deployment)
 * Deployed on all major EVM chains at the same address
 */
export const ENTRYPOINT_V07_ADDRESS: Address =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

/**
 * EntryPoint v0.6 contract address (legacy)
 */
export const ENTRYPOINT_V06_ADDRESS: Address =
  "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

/**
 * Default gas limits for UserOperations
 */
export const DEFAULT_GAS_LIMITS = {
  /** Gas for account validation */
  verificationGasLimit: 150000n,
  /** Gas for callData execution */
  callGasLimit: 100000n,
  /** Gas paid to bundler for overhead */
  preVerificationGas: 50000n,
  /** Gas for paymaster validation */
  paymasterVerificationGasLimit: 50000n,
  /** Gas for paymaster post-op */
  paymasterPostOpGasLimit: 50000n,
} as const;

/**
 * EntryPoint v0.7 ABI (essential functions)
 */
export const ENTRYPOINT_V07_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "ops",
        type: "tuple[]",
      },
      { name: "beneficiary", type: "address" },
    ],
    name: "handleOps",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "sender", type: "address" }],
    name: "getNonce",
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "sender", type: "address" },
      { name: "key", type: "uint192" },
    ],
    name: "getNonce",
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "userOp",
        type: "tuple",
      },
    ],
    name: "getUserOpHash",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * IAccount interface ABI (smart wallet validation)
 */
export const ACCOUNT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "sender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "initCode", type: "bytes" },
          { name: "callData", type: "bytes" },
          { name: "accountGasLimits", type: "bytes32" },
          { name: "preVerificationGas", type: "uint256" },
          { name: "gasFees", type: "bytes32" },
          { name: "paymasterAndData", type: "bytes" },
          { name: "signature", type: "bytes" },
        ],
        name: "userOp",
        type: "tuple",
      },
      { name: "userOpHash", type: "bytes32" },
      { name: "missingAccountFunds", type: "uint256" },
    ],
    name: "validateUserOp",
    outputs: [{ name: "validationData", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "dest", type: "address" },
      { name: "value", type: "uint256" },
      { name: "func", type: "bytes" },
    ],
    name: "execute",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "dest", type: "address[]" },
      { name: "value", type: "uint256[]" },
      { name: "func", type: "bytes[]" },
    ],
    name: "executeBatch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Bundler JSON-RPC method names
 */
export const BUNDLER_METHODS = {
  sendUserOperation: "eth_sendUserOperation",
  estimateUserOperationGas: "eth_estimateUserOperationGas",
  getUserOperationByHash: "eth_getUserOperationByHash",
  getUserOperationReceipt: "eth_getUserOperationReceipt",
  supportedEntryPoints: "eth_supportedEntryPoints",
  chainId: "eth_chainId",
} as const;

/**
 * Common paymaster types
 */
export enum PaymasterType {
  /** No paymaster - user pays gas */
  None = "none",
  /** Verifying paymaster with off-chain signature */
  Verifying = "verifying",
  /** Token paymaster - pay gas with ERC20 */
  Token = "token",
  /** Sponsoring paymaster - third party pays */
  Sponsoring = "sponsoring",
}

/**
 * Pack verification and call gas limits into bytes32
 */
export function packAccountGasLimits(
  verificationGasLimit: bigint,
  callGasLimit: bigint,
): `0x${string}` {
  // First 16 bytes: verification gas limit
  // Last 16 bytes: call gas limit
  const verificationHex = verificationGasLimit.toString(16).padStart(32, "0");
  const callHex = callGasLimit.toString(16).padStart(32, "0");
  return `0x${verificationHex}${callHex}` as `0x${string}`;
}

/**
 * Unpack account gas limits from bytes32
 */
export function unpackAccountGasLimits(packed: `0x${string}`): {
  verificationGasLimit: bigint;
  callGasLimit: bigint;
} {
  const hex = packed.slice(2);
  const verificationHex = hex.slice(0, 32);
  const callHex = hex.slice(32, 64);
  return {
    verificationGasLimit: BigInt("0x" + verificationHex),
    callGasLimit: BigInt("0x" + callHex),
  };
}

/**
 * Pack max priority fee and max fee per gas into bytes32
 */
export function packGasFees(
  maxPriorityFeePerGas: bigint,
  maxFeePerGas: bigint,
): `0x${string}` {
  const priorityHex = maxPriorityFeePerGas.toString(16).padStart(32, "0");
  const maxHex = maxFeePerGas.toString(16).padStart(32, "0");
  return `0x${priorityHex}${maxHex}` as `0x${string}`;
}

/**
 * Unpack gas fees from bytes32
 */
export function unpackGasFees(packed: `0x${string}`): {
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
} {
  const hex = packed.slice(2);
  const priorityHex = hex.slice(0, 32);
  const maxHex = hex.slice(32, 64);
  return {
    maxPriorityFeePerGas: BigInt("0x" + priorityHex),
    maxFeePerGas: BigInt("0x" + maxHex),
  };
}
