"use client";

import { useCallback } from "react";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";
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
  payload: {
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: string;
    };
    signature: string;
  };
}

// EIP-712 domain for TransferWithAuthorization
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

function createNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Try to switch the wallet to the required chain.
 * If wallet_switchEthereumChain fails (chain not added), try wallet_addEthereumChain.
 */
async function ensureCorrectChain(
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  requiredChainId: number,
  chainName: string,
) {
  try {
    await switchChainAsync({ chainId: requiredChainId });
  } catch (switchError: any) {
    // Error code 4902 = chain not added to wallet
    // Some wallets also throw generic errors when chain is unknown
    const code = switchError?.code ?? switchError?.cause?.code;
    if (code === 4902 || code === -32603) {
      // Try adding the chain via provider
      const provider = (window as any).ethereum;
      if (provider?.request) {
        const config = getConfigByNetwork(`eip155:${requiredChainId}`);
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: `0x${requiredChainId.toString(16)}`,
              chainName: config?.name || chainName,
              rpcUrls: [config?.explorer?.replace("/tx/", "").replace("https://", "https://rpc.") || `https://rpc.publicnode.com`],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: config?.explorer ? [config.explorer.replace("/tx/", "")] : undefined,
            }],
          });
          // After adding, try switching again
          await switchChainAsync({ chainId: requiredChainId });
        } catch {
          throw new Error(`Please add ${chainName} to your wallet manually and try again.`);
        }
      } else {
        throw new Error(`Please add ${chainName} to your wallet manually and try again.`);
      }
    } else {
      throw new Error(
        `Please switch your wallet to ${chainName}. ` +
        `Your wallet may not support automatic chain switching.`
      );
    }
  }

  // Wait for wagmi to update chain state after switch
  await new Promise((r) => setTimeout(r, 1000));
}

export function useEvmPayment() {
  const { address, isConnected, chain } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address || !isConnected) {
        throw new Error("Wallet not connected");
      }

      const requiredChainId = parseInt(requirements.network.split(":")[1]);
      const chainConfig = getConfigByNetwork(requirements.network);
      const chainName = chainConfig?.name || `Chain ${requiredChainId}`;

      // Auto-switch to the required chain if wallet is on a different one
      if (chain?.id !== requiredChainId) {
        await ensureCorrectChain(switchChainAsync, requiredChainId, chainName);
      }

      const now = Math.floor(Date.now() / 1000);
      const authorization = {
        from: address,
        to: requirements.payTo as `0x${string}`,
        value: BigInt(requirements.amount),
        validAfter: BigInt(now - 600), // 10 min buffer
        validBefore: BigInt(now + requirements.maxTimeoutSeconds),
        nonce: createNonce() as `0x${string}`,
      };

      const domain = getDomain(requirements);

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
            nonce: authorization.nonce,
          },
          signature,
        },
      };
    },
    [address, isConnected, chain, signTypedDataAsync, switchChainAsync]
  );

  return {
    address,
    isConnected,
    chain,
    signPayment,
  };
}
