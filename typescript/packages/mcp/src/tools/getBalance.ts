/**
 * t402/getBalance - Get token balance for a specific network
 */

import { z } from "zod";
import {
  createPublicClient,
  http,
  formatEther,
  formatUnits,
  type Address,
} from "viem";
import * as chains from "viem/chains";
import type { SupportedNetwork, TokenBalance, ChainBalance } from "../types.js";
import {
  CHAIN_IDS,
  NATIVE_SYMBOLS,
  DEFAULT_RPC_URLS,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  USDT0_ADDRESSES,
  ERC20_ABI,
} from "../constants.js";

/**
 * Input schema for getBalance tool
 */
export const getBalanceInputSchema = z.object({
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
    .describe("Blockchain network to check balance on"),
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("Wallet address to check balance for"),
});

export type GetBalanceInput = z.infer<typeof getBalanceInputSchema>;

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
 * Get token balance for an address
 */
async function getTokenBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  tokenAddress: Address,
  walletAddress: Address
): Promise<TokenBalance | null> {
  try {
    const [balance, decimals, symbol] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress],
      }) as Promise<bigint>,
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "decimals",
      }) as Promise<number>,
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "symbol",
      }) as Promise<string>,
    ]);

    return {
      symbol,
      address: tokenAddress,
      balance: balance.toString(),
      formatted: formatUnits(balance, decimals),
      decimals,
    };
  } catch {
    return null;
  }
}

/**
 * Execute getBalance tool
 */
export async function executeGetBalance(
  input: GetBalanceInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>
): Promise<ChainBalance> {
  const { network, address } = input;
  const walletAddress = address as Address;

  const rpcUrl = rpcUrls?.[network] || DEFAULT_RPC_URLS[network];
  const chain = getViemChain(network);

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Get native balance
  const nativeBalance = await client.getBalance({ address: walletAddress });

  // Get token balances
  const tokenAddresses: { token: Address; expected: string }[] = [];

  if (USDC_ADDRESSES[network]) {
    tokenAddresses.push({ token: USDC_ADDRESSES[network]!, expected: "USDC" });
  }
  if (USDT_ADDRESSES[network]) {
    tokenAddresses.push({ token: USDT_ADDRESSES[network]!, expected: "USDT" });
  }
  if (USDT0_ADDRESSES[network]) {
    tokenAddresses.push({ token: USDT0_ADDRESSES[network]!, expected: "USDT0" });
  }

  const tokenBalances = await Promise.all(
    tokenAddresses.map(({ token }) =>
      getTokenBalance(client, token, walletAddress)
    )
  );

  const tokens = tokenBalances.filter(
    (t): t is TokenBalance => t !== null
  );

  return {
    network,
    chainId: CHAIN_IDS[network],
    native: {
      symbol: NATIVE_SYMBOLS[network],
      balance: nativeBalance.toString(),
      formatted: formatEther(nativeBalance),
    },
    tokens,
  };
}

/**
 * Format balance result for display
 */
export function formatBalanceResult(balance: ChainBalance): string {
  const lines: string[] = [
    `## Balance on ${balance.network} (Chain ID: ${balance.chainId})`,
    "",
    `### Native Token`,
    `- ${balance.native.symbol}: ${balance.native.formatted}`,
    "",
  ];

  if (balance.tokens.length > 0) {
    lines.push("### Stablecoins");
    for (const token of balance.tokens) {
      lines.push(`- ${token.symbol}: ${token.formatted}`);
    }
  } else {
    lines.push("_No stablecoin balances found_");
  }

  return lines.join("\n");
}
