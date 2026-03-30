"use client";

import { useState, useCallback } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { createPublicClient, http, type Address } from "viem";
import {
  BRIDGE_CHAIN_REGISTRY, OFT_ABI, ERC20_ABI, LZ_EXTRA_OPTIONS,
  addressToBytes32, type BridgeChainInfo,
} from "@/lib/bridge-chains";

export type BridgeStep = "idle" | "approving" | "quoting" | "sending" | "confirming" | "done" | "error";

export interface BridgeQuote {
  nativeFee: bigint;
  nativeFeeFormatted: string;
  fromChain: string;
  toChain: string;
  amount: bigint;
}

export interface BridgeResult {
  txHash: string;
  guid: string | null;
  explorerUrl: string;
  layerZeroScanUrl: string;
}

export function useBridgeExecution() {
  const [step, setStep] = useState<BridgeStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BridgeResult | null>(null);

  const walletClient = useWalletClient();
  const publicClient = usePublicClient();

  /** Get a quote for bridging (view call, no gas needed) */
  const quote = useCallback(async (
    fromChainKey: string,
    toChainKey: string,
    amount: bigint,
    userAddress: string,
  ): Promise<BridgeQuote | null> => {
    const fromChain = BRIDGE_CHAIN_REGISTRY[fromChainKey];
    const toChain = BRIDGE_CHAIN_REGISTRY[toChainKey];
    if (!fromChain || !toChain) return null;

    try {
      const client = createPublicClient({ transport: http(fromChain.rpc) });
      const sendParam = {
        dstEid: toChain.lzEndpointId,
        to: addressToBytes32(userAddress),
        amountLD: amount,
        minAmountLD: amount * BigInt(995) / BigInt(1000), // 0.5% slippage
        extraOptions: LZ_EXTRA_OPTIONS,
        composeMsg: "0x" as `0x${string}`,
        oftCmd: "0x" as `0x${string}`,
      };

      const fee = await client.readContract({
        address: fromChain.oftAddress,
        abi: OFT_ABI,
        functionName: "quoteSend",
        args: [sendParam, false],
      }) as { nativeFee: bigint; lzTokenFee: bigint };

      const nativeFee = fee.nativeFee * BigInt(120) / BigInt(100); // 20% buffer
      return {
        nativeFee,
        nativeFeeFormatted: `${(Number(nativeFee) / 1e18).toFixed(6)}`,
        fromChain: fromChainKey,
        toChain: toChainKey,
        amount,
      };
    } catch (err) {
      console.error("[bridge-quote]", err);
      return null;
    }
  }, []);

  /** Execute the full bridge: approve → send */
  const execute = useCallback(async (
    fromChainKey: string,
    toChainKey: string,
    amount: bigint,
    userAddress: string,
  ): Promise<BridgeResult | null> => {
    const fromChain = BRIDGE_CHAIN_REGISTRY[fromChainKey];
    const toChain = BRIDGE_CHAIN_REGISTRY[toChainKey];
    if (!fromChain || !toChain) {
      setError("Invalid chain");
      setStep("error");
      return null;
    }

    const wc = walletClient.data;
    if (!wc) {
      setError("Wallet not connected");
      setStep("error");
      return null;
    }

    setError(null);
    setResult(null);

    try {
      // Use the from chain's RPC for read calls
      const readClient = createPublicClient({ transport: http(fromChain.rpc) });

      // Step 1: Check allowance and approve if needed
      setStep("approving");
      const allowance = await readClient.readContract({
        address: fromChain.tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [userAddress as Address, fromChain.oftAddress],
      }) as bigint;

      if (allowance < amount) {
        const approveTx = await wc.writeContract({
          address: fromChain.tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [fromChain.oftAddress, amount * BigInt(100)], // Approve 100x for convenience
          chain: null,
        });
        // Wait for approve to be mined
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        } else {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      // Step 2: Get fresh quote
      setStep("quoting");
      const sendParam = {
        dstEid: toChain.lzEndpointId,
        to: addressToBytes32(userAddress),
        amountLD: amount,
        minAmountLD: amount * BigInt(995) / BigInt(1000),
        extraOptions: LZ_EXTRA_OPTIONS,
        composeMsg: "0x" as `0x${string}`,
        oftCmd: "0x" as `0x${string}`,
      };

      const fee = await readClient.readContract({
        address: fromChain.oftAddress,
        abi: OFT_ABI,
        functionName: "quoteSend",
        args: [sendParam, false],
      }) as { nativeFee: bigint; lzTokenFee: bigint };

      const nativeFee = fee.nativeFee * BigInt(120) / BigInt(100);

      // Step 3: Execute OFT.send()
      setStep("sending");
      const txHash = await wc.writeContract({
        address: fromChain.oftAddress,
        abi: OFT_ABI,
        functionName: "send",
        args: [
          sendParam,
          { nativeFee, lzTokenFee: BigInt(0) },
          userAddress as Address,
        ],
        value: nativeFee,
        chain: null,
      });

      // Step 4: Wait for confirmation and extract GUID
      setStep("confirming");
      let guid: string | null = null;
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        // Extract OFTSent event GUID from logs (topic[1])
        for (const log of receipt.logs) {
          if (log.topics.length >= 2 && log.topics[0] === "0x85496b760a4b7f8d66384b9df21b381f5d1b1e79f229a47aaf4c232edc2fe59a") {
            guid = log.topics[1] ?? null;
            break;
          }
        }
      }

      const bridgeResult: BridgeResult = {
        txHash,
        guid,
        explorerUrl: `${fromChain.explorerTx}${txHash}`,
        layerZeroScanUrl: `https://layerzeroscan.com/tx/${txHash}`,
      };

      setResult(bridgeResult);
      setStep("done");
      return bridgeResult;
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Bridge execution failed";
      console.error("[bridge-execute]", msg);
      setError(msg.slice(0, 200));
      setStep("error");
      return null;
    }
  }, [walletClient.data, publicClient]);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setResult(null);
  }, []);

  return { step, error, result, quote, execute, reset };
}
