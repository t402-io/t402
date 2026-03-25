/**
 * ERC-4337 UserOperation utilities for gasless payment demo
 * Generates realistic UserOp structures without executing
 */

import { encodeFunctionData, type Address, type Hex } from "viem";
import { estimateGas } from "./pimlico-service";

// ERC-20 transfer function signature
const TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// Safe execution function signature
const SAFE_EXECUTE_ABI = [
  {
    name: "execute",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
      { name: "operation", type: "uint8" },
    ],
    outputs: [],
  },
] as const;

// Well-known addresses
export const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address;
export const SAFE_4337_MODULE = "0xa581c4A4DB7175302464fF3C06380BC3270b4037" as Address;
export const PIMLICO_PAYMASTER = "0x0000000000000039cd5e8aE05257CE51C473ddd1" as Address;

export interface UserOperation {
  sender: Address;
  nonce: Hex;
  initCode: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface GasEstimates {
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

/**
 * Generate a random nonce (simulated)
 */
function generateNonce(): Hex {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const nonce = new DataView(bytes.buffer).getUint32(0);
  return `0x${nonce.toString(16).padStart(64, "0")}` as Hex;
}

/**
 * Generate a mock signature
 */
function generateMockSignature(): Hex {
  const bytes = new Uint8Array(65);
  crypto.getRandomValues(bytes);
  return ("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")) as Hex;
}

/**
 * Encode ERC-20 transfer call data
 */
export function encodeTransferCallData(to: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amount],
  });
}

/**
 * Encode Safe execute call data
 */
export function encodeSafeExecuteCallData(
  tokenAddress: Address,
  to: Address,
  amount: bigint
): Hex {
  const transferData = encodeTransferCallData(to, amount);

  return encodeFunctionData({
    abi: SAFE_EXECUTE_ABI,
    functionName: "execute",
    args: [tokenAddress, BigInt(0), transferData, 0], // operation 0 = CALL
  });
}

/**
 * Generate realistic gas estimates for Base Sepolia
 */
export function generateGasEstimates(): GasEstimates {
  return {
    callGasLimit: BigInt(100000) + BigInt(Math.floor(Math.random() * 50000)),
    verificationGasLimit: BigInt(150000) + BigInt(Math.floor(Math.random() * 50000)),
    preVerificationGas: BigInt(50000) + BigInt(Math.floor(Math.random() * 10000)),
    maxFeePerGas: BigInt(1000000000) + BigInt(Math.floor(Math.random() * 500000000)), // ~1-1.5 gwei
    maxPriorityFeePerGas: BigInt(100000000) + BigInt(Math.floor(Math.random() * 50000000)), // ~0.1-0.15 gwei
  };
}

/**
 * Get real gas estimates from Pimlico, falling back to mock estimates
 */
export async function getRealOrMockGasEstimates(chainId: number): Promise<GasEstimates> {
  const real = await estimateGas(chainId);
  if (real) {
    return {
      callGasLimit: BigInt(real.callGasLimit),
      verificationGasLimit: BigInt(real.verificationGasLimit),
      preVerificationGas: BigInt(real.preVerificationGas),
      maxFeePerGas: BigInt(real.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(real.maxPriorityFeePerGas),
    };
  }
  return generateGasEstimates();
}

/**
 * Generate paymaster data (simulated Pimlico sponsorship)
 */
export function generatePaymasterData(): Hex {
  // Format: paymaster address (20 bytes) + validUntil (6 bytes) + validAfter (6 bytes) + signature (65 bytes)
  const validUntil = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const validAfter = Math.floor(Date.now() / 1000) - 60; // 1 minute ago

  const signatureBytes = new Uint8Array(65);
  crypto.getRandomValues(signatureBytes);
  const signature = Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return (PIMLICO_PAYMASTER.slice(2) +
    validUntil.toString(16).padStart(12, "0") +
    validAfter.toString(16).padStart(12, "0") +
    signature) as Hex;
}

/**
 * Build a complete UserOperation for gasless USDT transfer
 */
export function buildUserOperation(params: {
  sender: Address;
  tokenAddress: Address;
  to: Address;
  amount: bigint;
  isDeployed?: boolean;
}): UserOperation {
  const { sender, tokenAddress, to, amount, isDeployed = true } = params;

  const callData = encodeSafeExecuteCallData(tokenAddress, to, amount);
  const gasEstimates = generateGasEstimates();

  return {
    sender,
    nonce: generateNonce(),
    initCode: isDeployed ? "0x" : generateInitCode(sender),
    callData,
    callGasLimit: `0x${gasEstimates.callGasLimit.toString(16)}` as Hex,
    verificationGasLimit: `0x${gasEstimates.verificationGasLimit.toString(16)}` as Hex,
    preVerificationGas: `0x${gasEstimates.preVerificationGas.toString(16)}` as Hex,
    maxFeePerGas: `0x${gasEstimates.maxFeePerGas.toString(16)}` as Hex,
    maxPriorityFeePerGas: `0x${gasEstimates.maxPriorityFeePerGas.toString(16)}` as Hex,
    paymasterAndData: generatePaymasterData(),
    signature: generateMockSignature(),
  };
}

/**
 * Generate init code for undeployed Safe account (simulated)
 */
function generateInitCode(owner: Address): Hex {
  // Safe proxy factory + create2 deployment data
  const SAFE_PROXY_FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
  const mockInitData = owner.slice(2).padEnd(512, "0");
  return (SAFE_PROXY_FACTORY + mockInitData) as Hex;
}

/**
 * Calculate gas savings compared to regular ERC-20 transfer
 */
export function calculateGasSavings(gasEstimates: GasEstimates): {
  regularGasCost: bigint;
  sponsoredGasCost: bigint;
  savings: bigint;
  savingsUsd: string;
} {
  // Regular ERC-20 transfer costs ~65,000 gas
  const regularGas = BigInt(65000);
  const gasPrice = gasEstimates.maxFeePerGas;

  const regularGasCost = regularGas * gasPrice;
  const sponsoredGasCost = BigInt(0); // Fully sponsored

  const savings = regularGasCost;
  // Assume ETH price ~$3000
  const savingsEth = Number(savings) / 1e18;
  const savingsUsd = (savingsEth * 3000).toFixed(4);

  return {
    regularGasCost,
    sponsoredGasCost,
    savings,
    savingsUsd,
  };
}

/**
 * Generate a UserOp hash (simulated)
 */
export function generateUserOpHash(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")) as Hex;
}
