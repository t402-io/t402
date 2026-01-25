"use client";

import { useCallback, useState, useEffect, useContext, createContext } from "react";

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
  payload: Record<string, unknown>;
}

// NEAR Wallet Context - will be populated by NearProvider
interface NearWalletContextType {
  accountId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (
    receiverId: string,
    methodName: string,
    args: Record<string, unknown>,
    gas: string,
    deposit: string
  ) => Promise<string>;
}

export const NearWalletContext = createContext<NearWalletContextType>({
  accountId: null,
  isConnected: false,
  isLoading: false,
  connect: async () => {},
  disconnect: async () => {},
  signAndSendTransaction: async () => "",
});

export function useNearWallet() {
  return useContext(NearWalletContext);
}

export function useNearPayment() {
  const { accountId, isConnected, isLoading, connect, disconnect, signAndSendTransaction } = useNearWallet();
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    // Check if any NEAR wallet extension is installed
    const checkWallet = () => {
      const hasNearWallet = typeof window !== "undefined" && (
        !!(window as unknown as Record<string, unknown>).near ||
        !!(window as unknown as Record<string, unknown>).mynearwallet
      );
      setHasWallet(hasNearWallet);
    };
    checkWallet();
    window.addEventListener("load", checkWallet);
    return () => window.removeEventListener("load", checkWallet);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!accountId) {
        throw new Error("NEAR wallet not connected");
      }

      // Parse amount (NEP-141 tokens use string amounts)
      const amount = requirements.amount;

      // Execute ft_transfer on the token contract
      const txHash = await signAndSendTransaction(
        requirements.asset, // Token contract (e.g., usdc.fakes.testnet)
        "ft_transfer",
        {
          receiver_id: requirements.payTo,
          amount: amount,
          memo: "T402 payment",
        },
        "30000000000000", // 30 TGas
        "1" // 1 yoctoNEAR deposit required for ft_transfer
      );

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        payload: {
          transaction: txHash,
          from: accountId,
          to: requirements.payTo,
          value: amount,
        },
      };
    },
    [accountId, signAndSendTransaction]
  );

  return {
    address: accountId,
    isConnected,
    isLoading,
    hasWallet,
    signPayment,
    connect,
    disconnect,
  };
}
