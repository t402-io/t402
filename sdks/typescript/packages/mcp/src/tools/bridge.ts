/**
 * t402/bridge - Bridge USDT0 between chains using LayerZero OFT
 */

import { z } from "zod";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import type { SupportedNetwork, BridgeResult } from "../types.js";
import {
  DEFAULT_RPC_URLS,
  BRIDGEABLE_CHAINS,
  USDT0_ADDRESSES,
  ERC20_ABI,
  parseTokenAmount,
  getLayerZeroScanUrl,
  getExplorerTxUrl,
} from "../constants.js";

/**
 * Input schema for bridge tool
 */
export const bridgeInputSchema = z.object({
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

export type BridgeInput = z.infer<typeof bridgeInputSchema>;

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
  ethereum: 900,
  arbitrum: 300,
  ink: 300,
  berachain: 300,
  unichain: 300,
};

/**
 * OFT contract ABI
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
  {
    name: "send",
    type: "function",
    stateMutability: "payable",
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
      {
        name: "_fee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
      { name: "_refundAddress", type: "address" },
    ],
    outputs: [
      {
        name: "msgReceipt",
        type: "tuple",
        components: [
          { name: "guid", type: "bytes32" },
          { name: "nonce", type: "uint64" },
          {
            name: "fee",
            type: "tuple",
            components: [
              { name: "nativeFee", type: "uint256" },
              { name: "lzTokenFee", type: "uint256" },
            ],
          },
        ],
      },
      {
        name: "oftReceipt",
        type: "tuple",
        components: [
          { name: "amountSentLD", type: "uint256" },
          { name: "amountReceivedLD", type: "uint256" },
        ],
      },
    ],
  },
] as const;

/**
 * OFTSent event topic
 */
const OFT_SENT_EVENT_TOPIC = keccak256(
  toBytes("OFTSent(bytes32,uint32,address,uint256,uint256)")
);

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
 * Options for executing bridge
 */
export interface BridgeOptions {
  /** Private key for signing (hex with 0x prefix) */
  privateKey: string;
  /** Custom RPC URL */
  rpcUrl?: string;
  /** Demo mode - simulate without executing */
  demoMode?: boolean;
  /** Slippage tolerance percentage (default: 0.5) */
  slippageTolerance?: number;
}

/**
 * Execute bridge tool
 */
export async function executeBridge(
  input: BridgeInput,
  options: BridgeOptions
): Promise<BridgeResult> {
  const { fromChain, toChain, amount, recipient } = input;
  const { privateKey, rpcUrl, demoMode, slippageTolerance = 0.5 } = options;

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

  // Calculate minimum amount with slippage
  const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance) * 100));
  const minAmountBigInt = (amountBigInt * slippageMultiplier) / 10000n;

  // Demo mode - return simulated result
  if (demoMode) {
    const fakeTxHash = `0x${"a".repeat(64)}` as `0x${string}`;
    const fakeGuid = `0x${"b".repeat(64)}` as `0x${string}`;
    const estimatedTime = ESTIMATED_BRIDGE_TIMES[toChain] || 300;

    return {
      txHash: fakeTxHash,
      messageGuid: fakeGuid,
      amount,
      fromChain: fromChain as SupportedNetwork,
      toChain: toChain as SupportedNetwork,
      estimatedTime,
      trackingUrl: getLayerZeroScanUrl(fakeGuid),
    };
  }

  // Create clients
  const chain = getViemChain(fromChain as SupportedNetwork);
  if (!chain) {
    throw new Error(`Unsupported chain: ${fromChain}`);
  }

  const transport = http(rpcUrl || DEFAULT_RPC_URLS[fromChain as SupportedNetwork]);
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

  // Check USDT0 balance
  const balance = (await publicClient.readContract({
    address: usdt0Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;

  if (balance < amountBigInt) {
    throw new Error(
      `Insufficient USDT0 balance. Have: ${balance.toString()}, Need: ${amountBigInt.toString()}`
    );
  }

  // Build send params
  const dstEid = LAYERZERO_ENDPOINT_IDS[toChain];
  const sendParam = {
    dstEid,
    to: addressToBytes32(recipient as Address),
    amountLD: amountBigInt,
    minAmountLD: minAmountBigInt,
    extraOptions: "0x" as `0x${string}`,
    composeMsg: "0x" as `0x${string}`,
    oftCmd: "0x" as `0x${string}`,
  };

  // Get quote
  const quote = (await publicClient.readContract({
    address: usdt0Address,
    abi: OFT_ABI,
    functionName: "quoteSend",
    args: [sendParam, false],
  })) as { nativeFee: bigint; lzTokenFee: bigint };

  // Add 10% buffer to fee
  const nativeFeeWithBuffer = (quote.nativeFee * 110n) / 100n;

  // Execute send
  const hash = await walletClient.writeContract({
    address: usdt0Address,
    abi: OFT_ABI,
    functionName: "send",
    args: [
      sendParam,
      { nativeFee: nativeFeeWithBuffer, lzTokenFee: 0n },
      account.address,
    ],
    value: nativeFeeWithBuffer,
  });

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Bridge transaction failed: ${hash}`);
  }

  // Extract message GUID from OFTSent event
  let messageGuid: `0x${string}` = "0x" as `0x${string}`;
  for (const log of receipt.logs) {
    if (log.topics[0] === OFT_SENT_EVENT_TOPIC && log.topics[1]) {
      messageGuid = log.topics[1] as `0x${string}`;
      break;
    }
  }

  if (messageGuid === "0x") {
    throw new Error("Failed to extract message GUID from transaction logs");
  }

  const estimatedTime = ESTIMATED_BRIDGE_TIMES[toChain] || 300;

  return {
    txHash: hash,
    messageGuid,
    amount,
    fromChain: fromChain as SupportedNetwork,
    toChain: toChain as SupportedNetwork,
    estimatedTime,
    trackingUrl: getLayerZeroScanUrl(messageGuid),
  };
}

/**
 * Format bridge result for display
 */
export function formatBridgeResult(result: BridgeResult): string {
  const minutes = Math.ceil(result.estimatedTime / 60);

  return [
    `## Bridge Transaction Submitted`,
    "",
    `- **Route:** ${result.fromChain} → ${result.toChain}`,
    `- **Amount:** ${result.amount} USDT0`,
    `- **Transaction:** \`${result.txHash}\``,
    `- **Message GUID:** \`${result.messageGuid}\``,
    `- **Estimated Delivery:** ~${minutes} minutes`,
    "",
    `### Tracking`,
    `- [View on LayerZero Scan](${result.trackingUrl})`,
    `- [View Source TX](${getExplorerTxUrl(result.fromChain, result.txHash)})`,
    "",
    "_Your USDT0 will arrive on ${result.toChain} once the LayerZero message is delivered._",
  ].join("\n");
}
