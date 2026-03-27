"use client";

import { useCallback } from "react";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";
import { encodeFunctionData, erc20Abi } from "viem";
import { getConfigByNetwork } from "@/lib/chain-registry";
import { EVM_CHAIN_RPC, EVM_NATIVE_CURRENCY, getEvmChainName } from "@/lib/evm-chains";

interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

interface PaymentPayload {
  t402Version: number;
  scheme: string;
  network: string;
  accepted?: { scheme: string; network: string };
  payload: Record<string, unknown>;
}

function getDomain(requirements: PaymentRequirements) {
  const chainId = parseInt(requirements.network.split(":")[1], 10);
  return {
    name: (requirements.extra?.name as string) || "USD Coin",
    version: (requirements.extra?.version as string) || "2",
    chainId,
    verifyingContract: requirements.asset as `0x${string}`,
  };
}

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const LEGACY_TRANSFER_AUTHORIZATION_TYPES = {
  LegacyTransferAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "spender", type: "address" },
  ],
} as const;

function createNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// CHAIN_RPC and NATIVE_CURRENCY are now in @/lib/evm-chains.ts
// Aliases for backward compatibility within this file
const CHAIN_RPC = EVM_CHAIN_RPC;
const NATIVE_CURRENCY = EVM_NATIVE_CURRENCY;

async function ensureCorrectChain(
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  requiredChainId: number,
  chainName: string,
) {
  try {
    await switchChainAsync({ chainId: requiredChainId });
  } catch (switchError: any) {
    const code = switchError?.code ?? switchError?.cause?.code;
    if (code === 4902 || code === -32603 || code === 4001) {
      const provider = (window as any).ethereum;
      if (!provider?.request) throw new Error(`Please add ${chainName} to your wallet manually.`);
      const rpcUrl = CHAIN_RPC[requiredChainId];
      if (!rpcUrl) throw new Error(`Please add ${chainName} (Chain ID: ${requiredChainId}) manually.`);
      const config = getConfigByNetwork(`eip155:${requiredChainId}`);
      const nativeCurrency = NATIVE_CURRENCY[requiredChainId] || { name: "ETH", symbol: "ETH", decimals: 18 };
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${requiredChainId.toString(16)}`,
            chainName: config?.name || chainName,
            rpcUrls: [rpcUrl],
            nativeCurrency,
            blockExplorerUrls: config?.explorer ? [config.explorer.replace("/tx/", "")] : undefined,
          }],
        });
        await switchChainAsync({ chainId: requiredChainId });
      } catch {
        throw new Error(`Failed to add ${chainName}. Add manually (Chain ID: ${requiredChainId}).`);
      }
    } else {
      throw new Error(`Please switch your wallet to ${chainName} manually.`);
    }
  }
}

// Facilitator address — sourced from config, falls back to well-known address
const FACILITATOR_ADDRESS = (process.env.NEXT_PUBLIC_FACILITATOR_ADDRESS || "0xC88f67e776f16DcFBf42e6bDda1B82604448899B") as `0x${string}`;

/**
 * Check on-chain allowance for the facilitator.
 * Returns the raw allowance as a bigint via direct RPC call.
 */
async function checkAllowance(chainId: number, tokenAddress: string, ownerAddress: string): Promise<bigint> {
  const rpcUrl = CHAIN_RPC[chainId];
  if (!rpcUrl) return BigInt(0);

  // allowance(address,address) = 0xdd62ed3e
  const owner = ownerAddress.slice(2).toLowerCase().padStart(64, "0");
  const spender = FACILITATOR_ADDRESS.slice(2).toLowerCase().padStart(64, "0");
  const data = `0xdd62ed3e${owner}${spender}`;

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: tokenAddress, data }, "latest"], id: 1 }),
    });
    const result = await response.json();
    if (result.result) return BigInt(result.result);
  } catch { /* ignore */ }
  return BigInt(0);
}

export function useEvmPayment() {
  const { address, isConnected, chain } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();
  const signPayment = useCallback(
    async (requirements: PaymentRequirements, onProgress?: (step: string) => void): Promise<PaymentPayload> => {
      if (!address || !isConnected) throw new Error("Wallet not connected");

      const requiredChainId = parseInt(requirements.network.split(":")[1], 10);
      const chainConfig = getConfigByNetwork(requirements.network);
      const chainName = chainConfig?.name || `Chain ${requiredChainId}`;

      if (chain?.id !== requiredChainId) {
        await ensureCorrectChain(switchChainAsync, requiredChainId, chainName);
      }

      const isLegacy = requirements.scheme === "exact-legacy";
      const now = Math.floor(Date.now() / 1000);
      const nonce = createNonce() as `0x${string}`;
      const domain = getDomain(requirements);

      if (isLegacy) {
        // ──────────────────────────────────────────────────
        // exact-legacy: Check allowance → Approve if needed → Sign
        // ──────────────────────────────────────────────────
        const requiredAmount = BigInt(requirements.amount);
        const currentAllowance = await checkAllowance(requiredChainId, requirements.asset, address);

        if (currentAllowance < requiredAmount) {
          // Step 1: Send on-chain approve transaction via wallet provider
          onProgress?.("approving");
          const provider = (window as any).ethereum;
          if (!provider?.request) throw new Error("Wallet provider not available for approve transaction");

          if (currentAllowance > BigInt(0)) {
            // Reset allowance to 0 first (USDT requires this)
            const resetData = encodeFunctionData({
              abi: erc20Abi,
              functionName: "approve",
              args: [FACILITATOR_ADDRESS, BigInt(0)],
            });
            await provider.request({
              method: "eth_sendTransaction",
              params: [{ from: address, to: requirements.asset, data: resetData }],
            });
            await new Promise((r) => setTimeout(r, 5000)); // Wait for reset tx
          }

          // Approve a large amount (not maxUint256 — some legacy tokens reject it)
          const approveAmount = BigInt("1000000000000"); // 1M USDT (enough for a while)
          const approveData = encodeFunctionData({
            abi: erc20Abi,
            functionName: "approve",
            args: [FACILITATOR_ADDRESS, approveAmount],
          });
          await provider.request({
            method: "eth_sendTransaction",
            params: [{ from: address, to: requirements.asset, data: approveData }],
          });

          // Wait for approve tx to be mined
          await new Promise((r) => setTimeout(r, 15000)); // Ethereum ~12s/block
        }

        // Step 2: Sign EIP-712 LegacyTransferAuthorization
        onProgress?.("signing");
        const authorization = {
          from: address,
          to: requirements.payTo as `0x${string}`,
          value: BigInt(requirements.amount),
          validAfter: BigInt(now - 600),
          validBefore: BigInt(now + requirements.maxTimeoutSeconds),
          nonce,
          spender: FACILITATOR_ADDRESS,
        };

        const signature = await signTypedDataAsync({
          domain,
          types: LEGACY_TRANSFER_AUTHORIZATION_TYPES,
          primaryType: "LegacyTransferAuthorization",
          message: authorization,
        });

        return {
          t402Version: 2,
          scheme: requirements.scheme,
          network: requirements.network,
          accepted: { scheme: requirements.scheme, network: requirements.network },
          payload: {
            authorization: {
              from: address,
              to: requirements.payTo,
              value: requirements.amount,
              validAfter: String(authorization.validAfter),
              validBefore: String(authorization.validBefore),
              nonce,
              spender: FACILITATOR_ADDRESS,
            },
            signature,
          },
        };
      }

      // ──────────────────────────────────────────────────
      // exact: TransferWithAuthorization (EIP-3009) — one step
      // ──────────────────────────────────────────────────
      const authorization = {
        from: address,
        to: requirements.payTo as `0x${string}`,
        value: BigInt(requirements.amount),
        validAfter: BigInt(now - 600),
        validBefore: BigInt(now + requirements.maxTimeoutSeconds),
        nonce,
      };

      const signature = await signTypedDataAsync({
        domain,
        types: TRANSFER_WITH_AUTHORIZATION_TYPES,
        primaryType: "TransferWithAuthorization",
        message: authorization,
      });

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        accepted: { scheme: requirements.scheme, network: requirements.network },
        payload: {
          authorization: {
            from: address,
            to: requirements.payTo,
            value: requirements.amount,
            validAfter: String(authorization.validAfter),
            validBefore: String(authorization.validBefore),
            nonce,
          },
          signature,
        },
      };
    },
    [address, isConnected, chain, signTypedDataAsync, switchChainAsync]
  );

  return { address, isConnected, chain, signPayment };
}
