/**
 * Real cross-chain bridge executor using Usdt0Bridge from @t402/evm
 *
 * Executes actual LayerZero OFT transfers for USDT0 between EVM chains.
 * Requires BRIDGE_WALLET_PRIVATE_KEY env var (uses Facilitator wallet).
 * Falls back to null (caller uses simulation) if not configured.
 */

import { createWalletClient, createPublicClient, http, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  mainnet, arbitrum, base, optimism, polygon, bsc, avalanche,
  ink, berachain,
} from "viem/chains";
import {
  Usdt0Bridge,
  getBridgeableChains,
  supportsBridging,
  USDT0_OFT_ADDRESSES,
  LAYERZERO_ENDPOINT_IDS,
} from "@t402/evm";

// Override OFT addresses with correct values from docs.usdt0.to/deployments
// The published SDK has TOKEN addresses instead of OFT addresses
// Token ≠ OFT: the OFT contract has quoteSend()/send(), the token is just ERC-20
Object.assign(USDT0_OFT_ADDRESSES, {
  ethereum: "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
  arbitrum: "0x14E4A1B13bf7F943c8ff7C51fb60FA964A298D92",
  ink: "0x1cB6De532588fCA4a21B7209DE7C456AF8434A65",
  berachain: "0x3Dc96399109df5ceb2C226664A086140bD0379cB",
  unichain: "0xc07bE8994D035631c36fb4a89C918CeFB2f03EC3",
  optimism: "0xF03b4d9AC1D5d1E7c4cEf54C2A313b9fe051A0aD",
  polygon: "0x6BA10300f0DC58B7a1e4c0e41f5daBb7D7829e13",
  mantle: "0xcb768e263FB1C62214E7cab4AA8d036D76dc59CC",
} as Record<string, `0x${string}`>);

// Add missing endpoint IDs
Object.assign(LAYERZERO_ENDPOINT_IDS, {
  ink: 30339,
  mantle: 30181,
  optimism: 30111,
  polygon: 30109,
} as Record<string, number>);

// Chain name → viem chain + RPC config
const CHAIN_MAP: Record<string, { chain: Chain; rpc: string }> = {
  ethereum: { chain: mainnet, rpc: "https://ethereum-rpc.publicnode.com" },
  arbitrum: { chain: arbitrum, rpc: "https://arbitrum-one-rpc.publicnode.com" },
  base: { chain: base, rpc: "https://base-rpc.publicnode.com" },
  optimism: { chain: optimism, rpc: "https://optimism-rpc.publicnode.com" },
  polygon: { chain: polygon, rpc: "https://polygon-bor-rpc.publicnode.com" },
  bsc: { chain: bsc, rpc: "https://bsc-rpc.publicnode.com" },
  avalanche: { chain: avalanche, rpc: "https://avalanche-c-chain-rpc.publicnode.com" },
  ink: { chain: ink, rpc: "https://rpc-gel.inkonchain.com" },
  berachain: { chain: berachain, rpc: "https://rpc.berachain.com" },
};

// Demo-friendly chain name mapping from frontend family names
const FAMILY_TO_BRIDGE_CHAIN: Record<string, string> = {
  evm: "arbitrum", // Default EVM bridge source
};

export interface BridgeExecutionResult {
  txHash: string;
  messageGuid: string;
  estimatedTime: number;
  layerZeroScanUrl: string;
  fromChain: string;
  toChain: string;
  amountSent: string;
}

/**
 * Check if a chain pair supports real USDT0 OFT bridging
 */
export function supportsRealBridge(fromChain: string, toChain: string): boolean {
  return supportsBridging(fromChain) && supportsBridging(toChain) && fromChain !== toChain;
}

/**
 * Get the list of chains that support real bridging
 */
export function getRealBridgeChains(): string[] {
  return getBridgeableChains();
}

export interface BridgeQuoteResult {
  available: boolean;
  nativeFee: string;           // wei
  nativeFeeFormatted: string;  // "0.0003 ETH"
  amountToSend: string;        // USDT0 units
  minAmountToReceive: string;  // after slippage
  estimatedTime: number;       // seconds
  estimatedTimeFormatted: string; // "~5 min"
  fromChain: string;
  toChain: string;
  protocol: string;
}

/**
 * Get a quote for bridging USDT0 without executing the transaction
 *
 * @returns Quote result with fee and timing info, or null if not configured/supported
 */
export async function quoteBridge(params: {
  fromChain: string;
  toChain: string;
  amount: bigint;
  recipient: string;
}): Promise<BridgeQuoteResult | null> {
  const rawKey = process.env.BRIDGE_WALLET_PRIVATE_KEY;
  if (!rawKey) {
    console.log("[bridge-quote] BRIDGE_WALLET_PRIVATE_KEY not configured");
    return null;
  }

  if (!supportsRealBridge(params.fromChain, params.toChain)) {
    console.log(`[bridge-quote] Chain pair ${params.fromChain} → ${params.toChain} not supported`);
    return null;
  }

  const chainConfig = CHAIN_MAP[params.fromChain];
  if (!chainConfig) {
    console.log(`[bridge-quote] No RPC config for chain: ${params.fromChain}`);
    return null;
  }

  try {
    const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc),
    });

    // Quote only needs readContract, no wallet client needed
    const signer = {
      address: account.address,
      readContract: async (args: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }) => {
        return publicClient.readContract({
          address: args.address,
          abi: args.abi as any,
          functionName: args.functionName,
          args: args.args as any,
        });
      },
      writeContract: async (_args: any): Promise<`0x${string}`> => {
        throw new Error("writeContract not available in quote mode");
      },
      waitForTransactionReceipt: async (_args: any): Promise<any> => {
        throw new Error("waitForTransactionReceipt not available in quote mode");
      },
    };

    const bridge = new Usdt0Bridge(signer, params.fromChain);

    console.log(`[bridge-quote] Quoting ${params.fromChain} → ${params.toChain}, amount: ${params.amount}`);

    const quote = await bridge.quote({
      fromChain: params.fromChain,
      toChain: params.toChain,
      amount: params.amount,
      recipient: params.recipient as Address,
    });

    // Format native fee: convert wei to ETH with 4 decimals
    const feeEth = Number(quote.nativeFee) / 1e18;
    // Use enough decimals to show small fees (LayerZero fees are often < 0.0001 ETH)
    const feeStr = feeEth < 0.0001 ? feeEth.toExponential(2) : feeEth.toFixed(6);
    const nativeFeeFormatted = `${feeStr} ETH`;

    // Format estimated time
    const minutes = Math.ceil(quote.estimatedTime / 60);
    const estimatedTimeFormatted = `~${minutes} min`;

    // Apply 0.5% slippage to amount
    const minAmountToReceive = params.amount - (params.amount * BigInt(50)) / BigInt(10000);

    return {
      available: true,
      nativeFee: quote.nativeFee.toString(),
      nativeFeeFormatted,
      amountToSend: quote.amountToSend.toString(),
      minAmountToReceive: minAmountToReceive.toString(),
      estimatedTime: quote.estimatedTime,
      estimatedTimeFormatted,
      fromChain: quote.fromChain,
      toChain: quote.toChain,
      protocol: "LayerZero V2",
    };
  } catch (error) {
    console.error(`[bridge-quote] Failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Get the list of chains configured in the demo bridge chain map
 */
export function getSupportedBridgeChains(): string[] {
  return Object.keys(CHAIN_MAP);
}

/**
 * Execute a real cross-chain USDT0 bridge via LayerZero OFT
 *
 * @returns Bridge result with real tx hash, or null if not configured/supported
 */
export async function executeBridge(params: {
  fromChain: string;
  toChain: string;
  amount: bigint;
  recipient: string;
}): Promise<BridgeExecutionResult | null> {
  const rawKey = process.env.BRIDGE_WALLET_PRIVATE_KEY;
  if (!rawKey) {
    console.log("[bridge] BRIDGE_WALLET_PRIVATE_KEY not configured, using simulation");
    return null;
  }

  if (!supportsRealBridge(params.fromChain, params.toChain)) {
    console.log(`[bridge] Chain pair ${params.fromChain} → ${params.toChain} not supported for real bridge`);
    return null;
  }

  const chainConfig = CHAIN_MAP[params.fromChain];
  if (!chainConfig) {
    console.log(`[bridge] No RPC config for chain: ${params.fromChain}`);
    return null;
  }

  try {
    // Ensure 0x prefix
    const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Create a wallet client that also has public client capabilities
    const walletClient = createWalletClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc),
      account,
    });

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc),
    });

    // BridgeSigner adapter: wraps viem walletClient + publicClient
    const signer = {
      address: account.address,
      readContract: async (args: { address: Address; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }) => {
        return publicClient.readContract({
          address: args.address,
          abi: args.abi as any,
          functionName: args.functionName,
          args: args.args as any,
        });
      },
      writeContract: async (args: { address: Address; abi: readonly unknown[]; functionName: string; args: readonly unknown[]; value?: bigint }) => {
        return walletClient.writeContract({
          address: args.address,
          abi: args.abi as any,
          functionName: args.functionName,
          args: args.args as any,
          value: args.value,
        });
      },
      waitForTransactionReceipt: async (args: { hash: `0x${string}` }) => {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: args.hash, timeout: 60_000 });
        return {
          status: receipt.status,
          transactionHash: receipt.transactionHash,
          logs: receipt.logs.map((log) => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
          })),
        };
      },
    };

    const bridge = new Usdt0Bridge(signer, params.fromChain);

    console.log(`[bridge] Quoting ${params.fromChain} → ${params.toChain}, amount: ${params.amount}`);

    // Quote
    const quote = await bridge.quote({
      fromChain: params.fromChain,
      toChain: params.toChain,
      amount: params.amount,
      recipient: params.recipient as Address,
    });

    console.log(`[bridge] Quote: nativeFee=${quote.nativeFee}, estimatedTime=${quote.estimatedTime}s`);

    // Execute
    const result = await bridge.send({
      fromChain: params.fromChain,
      toChain: params.toChain,
      amount: params.amount,
      recipient: params.recipient as Address,
    });

    console.log(`[bridge] Success! txHash=${result.txHash}, guid=${result.messageGuid}`);

    return {
      txHash: result.txHash,
      messageGuid: result.messageGuid,
      estimatedTime: quote.estimatedTime,
      layerZeroScanUrl: `https://layerzeroscan.com/tx/${result.txHash}`,
      fromChain: params.fromChain,
      toChain: params.toChain,
      amountSent: result.amountSent.toString(),
    };
  } catch (error) {
    console.error(`[bridge] Failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}
