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

// Tezos Wallet Context - will be populated by TezosProvider
interface TezosWalletContextType {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  transferFA2: (
    contractAddress: string,
    tokenId: number,
    recipient: string,
    amount: string
  ) => Promise<string>;
}

export const TezosWalletContext = createContext<TezosWalletContextType>({
  address: null,
  isConnected: false,
  isLoading: false,
  connect: async () => {},
  disconnect: async () => {},
  transferFA2: async () => "",
});

export function useTezosWallet() {
  return useContext(TezosWalletContext);
}

export function useTezosPayment() {
  const { address, isConnected, isLoading, connect, disconnect, transferFA2 } = useTezosWallet();
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    // Check if Temple or other Tezos wallet is installed
    const checkWallet = () => {
      const hasTezosWallet = typeof window !== "undefined" && (
        !!(window as unknown as Record<string, unknown>).tezos ||
        !!(window as unknown as Record<string, unknown>).kukai
      );
      setHasWallet(hasTezosWallet);
    };
    checkWallet();
    window.addEventListener("load", checkWallet);
    return () => window.removeEventListener("load", checkWallet);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address) {
        throw new Error("Tezos wallet not connected");
      }

      // Execute FA2 transfer (TZIP-12)
      // Token ID is 0 for USDt
      const opHash = await transferFA2(
        requirements.asset, // Contract address
        0, // Token ID
        requirements.payTo,
        requirements.amount
      );

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        payload: {
          operation: opHash,
          from: address,
          to: requirements.payTo,
          value: requirements.amount,
        },
      };
    },
    [address, transferFA2]
  );

  return {
    address,
    isConnected,
    isLoading,
    hasWallet,
    signPayment,
    connect,
    disconnect,
  };
}
