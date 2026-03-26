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
} from "@t402/evm";

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
  const privateKey = process.env.BRIDGE_WALLET_PRIVATE_KEY;
  if (!privateKey) {
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
