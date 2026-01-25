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

// Polkadot Wallet Context - will be populated by PolkadotProvider
interface PolkadotWalletContextType {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  transferAsset: (
    assetId: string,
    recipient: string,
    amount: string
  ) => Promise<string>;
}

export const PolkadotWalletContext = createContext<PolkadotWalletContextType>({
  address: null,
  isConnected: false,
  isLoading: false,
  connect: async () => {},
  disconnect: async () => {},
  transferAsset: async () => "",
});

export function usePolkadotWallet() {
  return useContext(PolkadotWalletContext);
}

export function usePolkadotPayment() {
  const { address, isConnected, isLoading, connect, disconnect, transferAsset } = usePolkadotWallet();
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    // Check if Polkadot.js or Talisman wallet is installed
    const checkWallet = () => {
      const injectedWeb3 = (window as unknown as { injectedWeb3?: Record<string, unknown> }).injectedWeb3;
      const hasPolkadotWallet = typeof window !== "undefined" && (
        !!(injectedWeb3?.["polkadot-js"]) ||
        !!(injectedWeb3?.["talisman"])
      );
      setHasWallet(hasPolkadotWallet);
    };
    checkWallet();
    window.addEventListener("load", checkWallet);
    return () => window.removeEventListener("load", checkWallet);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address) {
        throw new Error("Polkadot wallet not connected");
      }

      // Execute Asset Hub transfer
      const extrinsicHash = await transferAsset(
        requirements.asset, // Asset ID (e.g., "1984" for USDT)
        requirements.payTo,
        requirements.amount
      );

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        payload: {
          extrinsic: extrinsicHash,
          from: address,
          to: requirements.payTo,
          value: requirements.amount,
        },
      };
    },
    [address, transferAsset]
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
