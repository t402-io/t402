"use client";

import { useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";

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
  payload: {
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: number;
      validBefore: number;
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

export function useEvmPayment() {
  const { address, isConnected, chain } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address || !isConnected) {
        throw new Error("Wallet not connected");
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
        payload: {
          authorization: {
            from: address,
            to: requirements.payTo,
            value: requirements.amount,
            validAfter: Number(authorization.validAfter),
            validBefore: Number(authorization.validBefore),
            nonce: authorization.nonce,
          },
          signature,
        },
      };
    },
    [address, isConnected, signTypedDataAsync]
  );

  return {
    address,
    isConnected,
    chain,
    signPayment,
  };
}
