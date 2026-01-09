/**
 * t402/getBridgeFee - Get fee quote for bridging USDT0 between chains
 */

import { z } from "zod";
import {
  createPublicClient,
  http,
  formatEther,
  type Address,
} from "viem";
import * as chains from "viem/chains";
import type { SupportedNetwork, BridgeFeeQuote } from "../types.js";
import {
  DEFAULT_RPC_URLS,
  BRIDGEABLE_CHAINS,
  USDT0_ADDRESSES,
  NATIVE_SYMBOLS,
  parseTokenAmount,
} from "../constants.js";

/**
 * Input schema for getBridgeFee tool
 */
export const getBridgeFeeInputSchema = z.object({
  fromChain: z
    .enum(["ethereum", "arbitrum", "ink", "berachain", "unichain"])
    .describe("Source chain to bridge from"),
  toChain: z
    .enum(["ethereum", "arbitrum", "ink", "berachain", "unichain"])
    .describe("Destination chain to bridge to"),
  amount: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .describe("Amount of USDT0 to bridge (e.g., '100' for 100 USDT0)"),
  recipient: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe("Recipient address on destination chain"),
});

export type GetBridgeFeeInput = z.infer<typeof getBridgeFeeInputSchema>;

/**
 * LayerZero endpoint IDs for supported chains
 */
const LAYERZERO_ENDPOINT_IDS: Record<string, number> = {
  ethereum: 30101,
  arbitrum: 30110,
  ink: 30291,
  berachain: 30362,
  unichain: 30320,
};

/**
 * Estimated bridge times in seconds
 */
const ESTIMATED_BRIDGE_TIMES: Record<string, number> = {
  ethereum: 900, // 15 minutes
  arbitrum: 300, // 5 minutes
  ink: 300, // 5 minutes
  berachain: 300, // 5 minutes
  unichain: 300, // 5 minutes
};

/**
 * OFT contract ABI for quoteSend
 */
const OFT_ABI = [
  {
    name: "quoteSend",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "_sendParam",
        type: "tuple",
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      { name: "_payInLzToken", type: "bool" },
    ],
    outputs: [
      {
        name: "msgFee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
    ],
  },
] as const;

/**
 * Get the viem chain configuration for a network
 */
function getViemChain(network: SupportedNetwork) {
  switch (network) {
    case "ethereum": return chains.mainnet;
    case "arbitrum": return chains.arbitrum;
    case "ink": return chains.ink;
    case "berachain": return chains.berachain;
    case "unichain": return chains.unichain;
    default: return undefined;
  }
}

/**
 * Convert address to bytes32 format for LayerZero
 */
function addressToBytes32(address: Address): `0x${string}` {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
}

/**
 * Execute getBridgeFee tool
 */
export async function executeGetBridgeFee(
  input: GetBridgeFeeInput,
  rpcUrls?: Partial<Record<SupportedNetwork, string>>
): Promise<BridgeFeeQuote> {
  const { fromChain, toChain, amount, recipient } = input;

  // Validate chains are different
  if (fromChain === toChain) {
    throw new Error("Source and destination chains must be different");
  }

  // Validate both chains support bridging
  if (!BRIDGEABLE_CHAINS.includes(fromChain as SupportedNetwork)) {
    throw new Error(`Chain ${fromChain} does not support USDT0 bridging`);
  }
  if (!BRIDGEABLE_CHAINS.includes(toChain as SupportedNetwork)) {
    throw new Error(`Chain ${toChain} does not support USDT0 bridging`);
  }

  // Get USDT0 address on source chain
  const usdt0Address = USDT0_ADDRESSES[fromChain as SupportedNetwork];
  if (!usdt0Address) {
    throw new Error(`USDT0 not found on ${fromChain}`);
  }

  // Parse amount (6 decimals)
  const amountBigInt = parseTokenAmount(amount, 6);

  // Create client
  const chain = getViemChain(fromChain as SupportedNetwork);
  if (!chain) {
    throw new Error(`Unsupported chain: ${fromChain}`);
  }

  const rpcUrl = rpcUrls?.[fromChain as SupportedNetwork] || DEFAULT_RPC_URLS[fromChain as SupportedNetwork];
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Build send params
  const dstEid = LAYERZERO_ENDPOINT_IDS[toChain];
  const sendParam = {
    dstEid,
    to: addressToBytes32(recipient as Address),
    amountLD: amountBigInt,
    minAmountLD: amountBigInt, // No slippage for quote
    extraOptions: "0x" as `0x${string}`,
    composeMsg: "0x" as `0x${string}`,
    oftCmd: "0x" as `0x${string}`,
  };

  // Get quote from contract
  const quote = (await client.readContract({
    address: usdt0Address,
    abi: OFT_ABI,
    functionName: "quoteSend",
    args: [sendParam, false],
  })) as { nativeFee: bigint; lzTokenFee: bigint };

  const nativeSymbol = NATIVE_SYMBOLS[fromChain as SupportedNetwork];
  const estimatedTime = ESTIMATED_BRIDGE_TIMES[toChain] || 300;

  return {
    fromChain: fromChain as SupportedNetwork,
    toChain: toChain as SupportedNetwork,
    amount,
    nativeFee: quote.nativeFee.toString(),
    nativeFeeFormatted: `${formatEther(quote.nativeFee)} ${nativeSymbol}`,
    estimatedTime,
  };
}

/**
 * Format bridge fee result for display
 */
export function formatBridgeFeeResult(result: BridgeFeeQuote): string {
  const minutes = Math.ceil(result.estimatedTime / 60);

  return [
    `## Bridge Fee Quote`,
    "",
    `- **Route:** ${result.fromChain} → ${result.toChain}`,
    `- **Amount:** ${result.amount} USDT0`,
    `- **Native Fee:** ${result.nativeFeeFormatted}`,
    `- **Estimated Time:** ~${minutes} minutes`,
    "",
    "_Note: Actual fees may vary slightly at execution time._",
  ].join("\n");
}
