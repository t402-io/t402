"use client";

import { useCallback } from "react";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";
import { encodeFunctionData, erc20Abi } from "viem";
import { getConfigByNetwork } from "@/lib/chain-registry";

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
  const chainId = parseInt(requirements.network.split(":")[1]);
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

const CHAIN_RPC: Record<number, string> = {
  1: "https://ethereum-rpc.publicnode.com",
  10: "https://mainnet.optimism.io",
  14: "https://flare-api.flare.network/ext/C/rpc",
  30: "https://public-node.rsk.co",
  56: "https://bsc-rpc.publicnode.com",
  130: "https://mainnet.unichain.org",
  137: "https://polygon-bor-rpc.publicnode.com",
  143: "https://rpc.monad.xyz",
  196: "https://rpc.xlayer.tech",
  250: "https://rpc.ftm.tools",
  988: "https://rpc.stable.io",
  999: "https://rpc.hyperliquid.xyz/evm",
  1030: "https://evm.confluxrpc.com",
  1329: "https://evm-rpc.sei-apis.com",
  4326: "https://rpc.megaeth.com",
  5000: "https://rpc.mantle.xyz",
  8217: "https://public-en.node.kaia.io",
  8453: "https://mainnet.base.org",
  9745: "https://rpc.plasma.to",
  42161: "https://arb1.arbitrum.io/rpc",
  42220: "https://forno.celo.org",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  57073: "https://rpc-gel.inkonchain.com",
  80094: "https://rpc.berachain.com",
  84532: "https://base-sepolia.publicnode.com",
  21000000: "https://rpc.corn.xyz",
};

const NATIVE_CURRENCY: Record<number, { name: string; symbol: string; decimals: number }> = {
  56: { name: "BNB", symbol: "BNB", decimals: 18 },
  137: { name: "MATIC", symbol: "POL", decimals: 18 },
  250: { name: "FTM", symbol: "FTM", decimals: 18 },
  42220: { name: "CELO", symbol: "CELO", decimals: 18 },
  43114: { name: "AVAX", symbol: "AVAX", decimals: 18 },
  8217: { name: "KAIA", symbol: "KAIA", decimals: 18 },
  80094: { name: "BERA", symbol: "BERA", decimals: 18 },
  143: { name: "MON", symbol: "MON", decimals: 18 },
  14: { name: "FLR", symbol: "FLR", decimals: 18 },
  30: { name: "RBTC", symbol: "RBTC", decimals: 18 },
  5000: { name: "MNT", symbol: "MNT", decimals: 18 },
};

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
  await new Promise((r) => setTimeout(r, 1000));
}

const FACILITATOR_ADDRESS = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B" as `0x${string}`;

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
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address || !isConnected) throw new Error("Wallet not connected");

      const requiredChainId = parseInt(requirements.network.split(":")[1]);
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
          // USDT quirk: if current allowance > 0, must reset to 0 first
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
