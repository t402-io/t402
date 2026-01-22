/**
 * t402/getAllBalances - Get token balances across all supported networks
 */

import { z } from "zod";
import type { SupportedNetwork, ChainBalance } from "../types.js";
import { executeGetBalance } from "./getBalance.js";

/**
 * Input schema for getAllBalances tool
 */
export const getAllBalancesInputSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("Wallet address to check balances for"),
  networks: z
    .array(
      z.enum([
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
    )
    .optional()
    .describe(
      "Optional list of networks to check. If not provided, checks all supported networks."
    ),
});

export type GetAllBalancesInput = z.infer<typeof getAllBalancesInputSchema>;

/**
 * All supported networks
 */
const ALL_NETWORKS: SupportedNetwork[] = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
  "avalanche",
  "ink",
  "berachain",
  "unichain",
];

/**
 * Result of getAllBalances
 */
export interface AllBalancesResult {
  address: string;
  balances: ChainBalance[];
  totalUsdcBalance: string;
  totalUsdtBalance: string;
  summary: string;
}

/**
 * Execute getAllBalances tool
 */
export async function executeGetAllBalances(
  input: GetAllBalancesInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>
): Promise<AllBalancesResult> {
  const { address, networks = ALL_NETWORKS } = input;

  // Fetch balances from all networks in parallel
  const balancePromises = networks.map((network) =>
    executeGetBalance({ network, address }, rpcUrls).catch((error) => {
      console.error(`Failed to fetch balance for ${network}:`, error);
      return null;
    })
  );

  const results = await Promise.all(balancePromises);
  const balances = results.filter((b): b is ChainBalance => b !== null);

  // Calculate total stablecoin balances
  let totalUsdc = 0n;
  let totalUsdt = 0n;

  for (const balance of balances) {
    for (const token of balance.tokens) {
      if (token.symbol === "USDC") {
        totalUsdc += BigInt(token.balance);
      } else if (token.symbol === "USDT" || token.symbol === "USDT0") {
        totalUsdt += BigInt(token.balance);
      }
    }
  }

  // Format totals (assuming 6 decimals for USDC/USDT)
  const formatTotal = (amount: bigint): string => {
    const divisor = BigInt(10 ** 6);
    const whole = amount / divisor;
    const fraction = amount % divisor;
    const fractionStr = fraction.toString().padStart(6, "0").replace(/0+$/, "");
    return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
  };

  const totalUsdcFormatted = formatTotal(totalUsdc);
  const totalUsdtFormatted = formatTotal(totalUsdt);

  // Create summary
  const chainsWithBalance = balances.filter(
    (b) =>
      b.tokens.some((t) => BigInt(t.balance) > 0n) ||
      BigInt(b.native.balance) > 0n
  );

  const summary = [
    `Found balances on ${chainsWithBalance.length} of ${balances.length} networks checked.`,
    `Total USDC: ${totalUsdcFormatted}`,
    `Total USDT: ${totalUsdtFormatted}`,
  ].join(" ");

  return {
    address,
    balances,
    totalUsdcBalance: totalUsdcFormatted,
    totalUsdtBalance: totalUsdtFormatted,
    summary,
  };
}

/**
 * Format all balances result for display
 */
export function formatAllBalancesResult(result: AllBalancesResult): string {
  const lines: string[] = [
    `## Multi-Chain Balance Summary`,
    `**Address:** \`${result.address}\``,
    "",
    `### Totals`,
    `- **Total USDC:** ${result.totalUsdcBalance}`,
    `- **Total USDT:** ${result.totalUsdtBalance}`,
    "",
    `### By Network`,
    "",
  ];

  for (const balance of result.balances) {
    const hasBalance =
      balance.tokens.some((t) => BigInt(t.balance) > 0n) ||
      BigInt(balance.native.balance) > 0n;

    if (!hasBalance) continue;

    lines.push(`#### ${balance.network}`);
    lines.push(`- ${balance.native.symbol}: ${balance.native.formatted}`);
    for (const token of balance.tokens) {
      if (BigInt(token.balance) > 0n) {
        lines.push(`- ${token.symbol}: ${token.formatted}`);
      }
    }
    lines.push("");
  }

  // List networks with no balance
  const emptyNetworks = result.balances.filter(
    (b) =>
      !b.tokens.some((t) => BigInt(t.balance) > 0n) &&
      BigInt(b.native.balance) === 0n
  );

  if (emptyNetworks.length > 0) {
    lines.push(`_No balance on: ${emptyNetworks.map((n) => n.network).join(", ")}_`);
  }

  return lines.join("\n");
}
