"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { AptosWalletContext } from "@/hooks/useAptosPayment";

// Dynamic import types for Aptos
type AptosClient = {
  waitForTransaction: (args: { transactionHash: string }) => Promise<void>;
};

type PetraWallet = {
  connect: () => Promise<{ address: string }>;
  disconnect: () => Promise<void>;
  account: () => Promise<{ address: string } | null>;
  isConnected: () => Promise<boolean>;
  signAndSubmitTransaction: (payload: {
    function: string;
    type_arguments: string[];
    arguments: (string | number)[];
  }) => Promise<{ hash: string }>;
};

/**
 * Aptos Wallet Context provider using Petra wallet.
 * Loaded lazily to keep ~150KB out of the initial bundle.
 */
export default function AptosWalletContextProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aptos, setAptos] = useState<AptosClient | null>(null);

  const getWallet = (): PetraWallet | null => {
    if (typeof window !== "undefined") {
      return (window as unknown as { aptos?: PetraWallet }).aptos || null;
    }
    return null;
  };

  useEffect(() => {
    const initWallet = async () => {
      try {
        // Dynamically import Aptos SDK
        const { Aptos, AptosConfig, Network } = await import("@aptos-labs/ts-sdk");
        const config = new AptosConfig({ network: Network.TESTNET });
        const aptosClient = new Aptos(config);
        setAptos(aptosClient as unknown as AptosClient);

        // Check if already connected
        const wallet = getWallet();
        if (wallet) {
          try {
            const isConnected = await wallet.isConnected();
            if (isConnected) {
              const account = await wallet.account();
              if (account) {
                setAddress(account.address);
              }
            }
          } catch {
            // Wallet not connected
          }
        }
      } catch (error) {
        console.error("Failed to initialize Aptos:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initWallet();
  }, []);

  const connect = useCallback(async () => {
    const wallet = getWallet();
    if (!wallet) {
      window.open("https://petra.app/", "_blank");
      return;
    }

    try {
      const response = await wallet.connect();
      setAddress(response.address);
    } catch (error) {
      console.error("Failed to connect Aptos wallet:", error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    const wallet = getWallet();
    if (wallet) {
      await wallet.disconnect();
      setAddress(null);
    }
  }, []);

  const transferFungibleAsset = useCallback(
    async (metadataAddress: string, recipient: string, amount: string): Promise<string> => {
      const wallet = getWallet();
      if (!wallet || !aptos) {
        throw new Error("Aptos wallet not initialized");
      }

      // Use primary_fungible_store::transfer for FA transfers
      const payload = {
        function: "0x1::primary_fungible_store::transfer" as const,
        type_arguments: ["0x1::fungible_asset::Metadata"],
        arguments: [metadataAddress, recipient, parseInt(amount, 10)],
      };

      const response = await wallet.signAndSubmitTransaction(payload);

      // Wait for transaction confirmation
      await aptos.waitForTransaction({ transactionHash: response.hash });

      return response.hash;
    },
    [aptos]
  );

  return (
    <AptosWalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isLoading,
        connect,
        disconnect,
        transferFungibleAsset,
      }}
    >
      {children}
    </AptosWalletContext.Provider>
  );
}
