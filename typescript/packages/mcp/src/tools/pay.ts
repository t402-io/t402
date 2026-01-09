/**
 * t402/pay - Execute a payment on a specific network
 */

import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import type { SupportedNetwork, PaymentResult } from "../types.js";
import {
  DEFAULT_RPC_URLS,
  ERC20_ABI,
  getTokenAddress,
  getExplorerTxUrl,
  supportsToken,
} from "../constants.js";

/**
 * Input schema for pay tool
 */
export const payInputSchema = z.object({
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
      "ink",
      "berachain",
      "unichain",
    ])
    .describe("Network to execute payment on"),
  memo: z
    .string()
    .optional()
    .describe("Optional memo/reference for the payment"),
});

export type PayInput = z.infer<typeof payInputSchema>;

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
 * Options for executing payment
 */
export interface PayOptions {
  /** Private key for signing (hex with 0x prefix) */
  privateKey: string;
  /** Custom RPC URL */
  rpcUrl?: string;
  /** Demo mode - simulate without executing */
  demoMode?: boolean;
}

/**
 * Execute pay tool
 */
export async function executePay(
  input: PayInput,
  options: PayOptions
): Promise<PaymentResult> {
  const { to, amount, token, network, memo } = input;
  const { privateKey, rpcUrl, demoMode } = options;

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
    const fakeTxHash = `0x${"0".repeat(64)}` as `0x${string}`;
    return {
      txHash: fakeTxHash,
      network,
      amount,
      token,
      to: to as Address,
      explorerUrl: getExplorerTxUrl(network, fakeTxHash),
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

  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  // Check balance
  const balance = (await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  if (balance < amountBigInt) {
    throw new Error(
      `Insufficient ${token} balance. Have: ${balance.toString()}, Need: ${amountBigInt.toString()}`
    );
  }

  // Execute transfer
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to as Address, amountBigInt],
  });

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Transaction failed: ${hash}`);
  }

  return {
    txHash: hash,
    network,
    amount,
    token,
    to: to as Address,
    explorerUrl: getExplorerTxUrl(network, hash),
  };
}

/**
 * Format payment result for display
 */
export function formatPaymentResult(result: PaymentResult): string {
  return [
    `## Payment Successful`,
    "",
    `- **Amount:** ${result.amount} ${result.token}`,
    `- **To:** \`${result.to}\``,
    `- **Network:** ${result.network}`,
    `- **Transaction:** \`${result.txHash}\``,
    "",
    `[View on Explorer](${result.explorerUrl})`,
  ].join("\n");
}
