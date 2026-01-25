"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { TezosWalletContext } from "@/hooks/useTezosPayment";

/**
 * Tezos Wallet Context provider using Beacon SDK.
 * Loaded lazily to keep ~300KB out of the initial bundle.
 */
export default function TezosWalletContextProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wallet, setWallet] = useState<{
    requestPermissions: () => Promise<{ address: string }>;
    disconnect: () => Promise<void>;
    getActiveAccount: () => Promise<{ address: string } | undefined>;
  } | null>(null);
  const [tezos, setTezos] = useState<{
    setWalletProvider: (provider: unknown) => void;
    wallet: {
      at: (address: string) => Promise<{
        methods: {
          transfer: (params: Array<{
            from_: string;
            txs: Array<{ to_: string; token_id: number; amount: number }>;
          }>) => { send: () => Promise<{ hash: string; confirmation: () => Promise<void> }> };
        };
      }>;
    };
  } | null>(null);

  useEffect(() => {
    const initWallet = async () => {
      try {
        // Dynamically import Taquito and Beacon
        const { TezosToolkit } = await import("@taquito/taquito");
        const { BeaconWallet } = await import("@taquito/beacon-wallet");

        const tezosClient = new TezosToolkit("https://ghostnet.tezos.marigold.dev");
        // Use custom network for ghostnet
        const beaconWallet = new BeaconWallet({
          name: "T402 Demo",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          network: { type: "custom" as any, rpcUrl: "https://ghostnet.tezos.marigold.dev" },
        });

        tezosClient.setWalletProvider(beaconWallet);

        // Check if already connected
        const activeAccount = await beaconWallet.client.getActiveAccount();
        if (activeAccount) {
          setAddress(activeAccount.address);
        }

        setWallet(beaconWallet as unknown as typeof wallet);
        setTezos(tezosClient as unknown as typeof tezos);
      } catch (error) {
        console.error("Failed to initialize Tezos wallet:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initWallet();
  }, []);

  const connect = useCallback(async () => {
    if (!wallet) {
      window.open("https://templewallet.com/", "_blank");
      return;
    }

    try {
      const permissions = await wallet.requestPermissions();
      setAddress(permissions.address);
    } catch (error) {
      console.error("Failed to connect Tezos wallet:", error);
      throw error;
    }
  }, [wallet]);

  const disconnect = useCallback(async () => {
    if (wallet) {
      await wallet.disconnect();
      setAddress(null);
    }
  }, [wallet]);

  const transferFA2 = useCallback(
    async (
      contractAddress: string,
      tokenId: number,
      recipient: string,
      amount: string
    ): Promise<string> => {
      if (!tezos || !address) {
        throw new Error("Tezos wallet not initialized");
      }

      // Get the FA2 contract
      const contract = await tezos.wallet.at(contractAddress);

      // Build FA2 transfer params (TZIP-12)
      const transferParams = [
        {
          from_: address,
          txs: [
            {
              to_: recipient,
              token_id: tokenId,
              amount: parseInt(amount, 10),
            },
          ],
        },
      ];

      // Execute the transfer
      const operation = await contract.methods.transfer(transferParams).send();

      // Wait for confirmation
      await operation.confirmation();

      return operation.hash;
    },
    [tezos, address]
  );

  return (
    <TezosWalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isLoading,
        connect,
        disconnect,
        transferFA2,
      }}
    >
      {children}
    </TezosWalletContext.Provider>
  );
}
