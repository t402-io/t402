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

// Aptos Wallet Context - will be populated by AptosProvider
interface AptosWalletContextType {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  transferFungibleAsset: (
    metadataAddress: string,
    recipient: string,
    amount: string
  ) => Promise<string>;
}

export const AptosWalletContext = createContext<AptosWalletContextType>({
  address: null,
  isConnected: false,
  isLoading: false,
  connect: async () => {},
  disconnect: async () => {},
  transferFungibleAsset: async () => "",
});

export function useAptosWallet() {
  return useContext(AptosWalletContext);
}

export function useAptosPayment() {
  const { address, isConnected, isLoading, connect, disconnect, transferFungibleAsset } = useAptosWallet();
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    // Check if Petra or other Aptos wallet is installed
    const checkWallet = () => {
      const hasAptosWallet = typeof window !== "undefined" && (
        !!(window as unknown as Record<string, unknown>).aptos ||
        !!(window as unknown as Record<string, unknown>).petra
      );
      setHasWallet(hasAptosWallet);
    };
    checkWallet();
    window.addEventListener("load", checkWallet);
    return () => window.removeEventListener("load", checkWallet);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address) {
        throw new Error("Aptos wallet not connected");
      }

      // Execute Fungible Asset transfer
      const txHash = await transferFungibleAsset(
        requirements.asset, // FA metadata address
        requirements.payTo,
        requirements.amount
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
    [address, transferFungibleAsset]
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
