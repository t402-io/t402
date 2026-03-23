"use client";

import { useCallback, useState, useEffect, useContext, createContext } from "react";

interface PaymentRequirements {
  scheme: string;
  network: string;
  accepted?: { scheme: string; network: string };
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

// Cosmos Wallet Context - will be populated by CosmosProvider
interface CosmosWalletContextType {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTokens: (
    contractAddress: string,
    recipient: string,
    amount: string,
    denom: string
  ) => Promise<string>;
}

export const CosmosWalletContext = createContext<CosmosWalletContextType>({
  address: null,
  isConnected: false,
  isLoading: false,
  connect: async () => {},
  disconnect: async () => {},
  sendTokens: async () => "",
});

export function useCosmosWallet() {
  return useContext(CosmosWalletContext);
}

export function useCosmosPayment() {
  const { address, isConnected, isLoading, connect, disconnect, sendTokens } = useCosmosWallet();
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    // Check if Keplr or Leap wallet is installed
    const checkWallet = () => {
      const hasCosmosWallet = typeof window !== "undefined" && (
        !!(window as unknown as Record<string, unknown>).keplr ||
        !!(window as unknown as Record<string, unknown>).leap
      );
      setHasWallet(hasCosmosWallet);
    };
    checkWallet();
    window.addEventListener("load", checkWallet);
    return () => window.removeEventListener("load", checkWallet);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address) {
        throw new Error("Cosmos wallet not connected");
      }

      // Execute bank send / token transfer on the Cosmos chain
      const txHash = await sendTokens(
        requirements.asset, // Token denom (e.g., "uusdc")
        requirements.payTo,
        requirements.amount,
        requirements.asset
      );

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        accepted: { scheme: requirements.scheme, network: requirements.network },
        payload: {
          transaction: txHash,
          from: address,
          to: requirements.payTo,
          value: requirements.amount,
        },
      };
    },
    [address, sendTokens]
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
