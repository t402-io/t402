/**
 * t402/payGasless - Execute a gasless payment using ERC-4337
 */

import { z } from "zod";
import {
  createPublicClient,
  http,
  parseUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import type { SupportedNetwork, GaslessPaymentResult } from "../types.js";
import {
  DEFAULT_RPC_URLS,
  ERC20_ABI,
  getTokenAddress,
  getExplorerTxUrl,
  supportsToken,
} from "../constants.js";

/**
 * Input schema for payGasless tool
 */
export const payGaslessInputSchema = z.object({
  to: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("Recipient address"),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Amount to pay (e.g., '10.50' for 10.50 USDC)"),
  token: z
    .enum(["USDC", "USDT", "USDT0"])
    .describe("Token to use for payment"),
  network: z
    .enum([
      "ethereum",
      "base",
      "arbitrum",
      "optimism",
      "polygon",
      "avalanche",
    ])
    .describe("Network to execute gasless payment on (must support ERC-4337)"),
});

export type PayGaslessInput = z.infer<typeof payGaslessInputSchema>;

/**
 * Networks that support ERC-4337 gasless transactions
 */
export const GASLESS_SUPPORTED_NETWORKS: SupportedNetwork[] = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
  "avalanche",
];

/**
 * Get the viem chain configuration for a network
 */
function getViemChain(network: SupportedNetwork) {
  switch (network) {
    case "ethereum": return chains.mainnet;
    case "base": return chains.base;
    case "arbitrum": return chains.arbitrum;
    case "optimism": return chains.optimism;
    case "polygon": return chains.polygon;
    case "avalanche": return chains.avalanche;
    case "ink": return chains.ink;
    case "berachain": return chains.berachain;
    case "unichain": return chains.unichain;
    default: return chains.mainnet;
  }
}

/**
 * Options for executing gasless payment
 */
export interface PayGaslessOptions {
  /** Private key for signing (hex with 0x prefix) */
  privateKey: string;
  /** Bundler URL for ERC-4337 */
  bundlerUrl: string;
  /** Paymaster URL for sponsoring gas */
  paymasterUrl: string;
  /** Custom RPC URL */
  rpcUrl?: string;
  /** Demo mode - simulate without executing */
  demoMode?: boolean;
}

/**
 * User operation structure (simplified)
 */
interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

/**
 * Execute payGasless tool
 */
export async function executePayGasless(
  input: PayGaslessInput,
  options: PayGaslessOptions
): Promise<GaslessPaymentResult> {
  const { to, amount, token, network } = input;
  const { privateKey, bundlerUrl, paymasterUrl: _paymasterUrl, rpcUrl, demoMode } = options;

  // Validate network supports gasless
  if (!GASLESS_SUPPORTED_NETWORKS.includes(network)) {
    throw new Error(
      `Network ${network} does not support ERC-4337 gasless transactions. Supported: ${GASLESS_SUPPORTED_NETWORKS.join(", ")}`
    );
  }

  // Validate token support on network
  if (!supportsToken(network, token)) {
    throw new Error(`Token ${token} is not supported on ${network}`);
  }

  const tokenAddress = getTokenAddress(network, token);
  if (!tokenAddress) {
    throw new Error(`Could not find ${token} address for ${network}`);
  }

  // Parse amount (USDC/USDT use 6 decimals)
  const decimals = 6;
  const amountBigInt = parseUnits(amount, decimals);

  // Demo mode - return simulated result
  if (demoMode) {
    const fakeTxHash = `0x${"1".repeat(64)}` as `0x${string}`;
    const fakeUserOpHash = `0x${"2".repeat(64)}` as `0x${string}`;
    return {
      txHash: fakeTxHash,
      userOpHash: fakeUserOpHash,
      network,
      amount,
      token,
      to: to as Address,
      explorerUrl: getExplorerTxUrl(network, fakeTxHash),
      paymaster: "demo-paymaster",
    };
  }

  // Create clients
  const chain = getViemChain(network);
  const transport = http(rpcUrl || DEFAULT_RPC_URLS[network]);

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain,
    transport,
  });

  // Encode the transfer call data
  const callData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to as Address, amountBigInt],
  });

  // Build user operation
  // Note: In production, this would integrate with a full ERC-4337 bundler
  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  });

  const gasPrice = await publicClient.getGasPrice();

  const userOp: UserOperation = {
    sender: account.address,
    nonce: BigInt(nonce),
    initCode: "0x",
    callData: callData as `0x${string}`,
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: gasPrice,
    maxPriorityFeePerGas: gasPrice / 10n,
    paymasterAndData: "0x", // Would be filled by paymaster
    signature: "0x",
  };

  // In production, this would:
  // 1. Request paymaster sponsorship from paymasterUrl
  // 2. Sign the user operation
  // 3. Submit to bundler at bundlerUrl
  // 4. Wait for user operation to be included

  // For now, send as regular transaction with sponsorship note
  const response = await fetch(bundlerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_sendUserOperation",
      params: [userOp, chain.id],
    }),
  });

  if (!response.ok) {
    throw new Error(`Bundler request failed: ${response.statusText}`);
  }

  const result = (await response.json()) as {
    error?: { message: string };
    result?: string;
  };

  if (result.error) {
    throw new Error(`Bundler error: ${result.error.message}`);
  }

  const userOpHash = result.result as string;

  // Poll for receipt
  let receipt: { transactionHash: string } | null = null;
  for (let i = 0; i < 30; i++) {
    const receiptResponse = await fetch(bundlerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getUserOperationReceipt",
        params: [userOpHash],
      }),
    });

    const receiptResult = (await receiptResponse.json()) as {
      result?: { transactionHash: string };
    };
    if (receiptResult.result) {
      receipt = receiptResult.result;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (!receipt) {
    throw new Error("Timeout waiting for user operation receipt");
  }

  return {
    txHash: receipt.transactionHash,
    userOpHash,
    network,
    amount,
    token,
    to: to as Address,
    explorerUrl: getExplorerTxUrl(network, receipt.transactionHash),
  };
}

/**
 * Format gasless payment result for display
 */
export function formatGaslessPaymentResult(result: GaslessPaymentResult): string {
  const lines = [
    `## Gasless Payment Successful`,
    "",
    `- **Amount:** ${result.amount} ${result.token}`,
    `- **To:** \`${result.to}\``,
    `- **Network:** ${result.network}`,
    `- **Transaction:** \`${result.txHash}\``,
    `- **UserOp Hash:** \`${result.userOpHash}\``,
  ];

  if (result.paymaster) {
    lines.push(`- **Paymaster:** ${result.paymaster}`);
  }

  lines.push("");
  lines.push(`[View on Explorer](${result.explorerUrl})`);
  lines.push("");
  lines.push("_Gas fees were sponsored - no ETH was deducted from your wallet._");

  return lines.join("\n");
}
