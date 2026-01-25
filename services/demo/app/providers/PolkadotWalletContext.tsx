"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { PolkadotWalletContext } from "@/hooks/usePolkadotPayment";

type InjectedAccount = {
  address: string;
  meta: { name?: string; source: string };
};

type InjectedExtension = {
  signer: {
    signPayload: (payload: unknown) => Promise<{ signature: string }>;
  };
};

/**
 * Polkadot Wallet Context provider using Polkadot.js extension.
 * Loaded lazily to keep ~500KB out of the initial bundle.
 */
export default function PolkadotWalletContextProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<InjectedAccount[]>([]);
  const [injector, setInjector] = useState<InjectedExtension | null>(null);
  const [api, setApi] = useState<{
    tx: {
      assets: {
        transfer: (assetId: number, dest: string, amount: string) => {
          signAndSend: (
            address: string,
            options: { signer: unknown },
            callback: (result: { status: { isFinalized: boolean }; txHash: { toHex: () => string } }) => void
          ) => Promise<() => void>;
        };
      };
    };
  } | null>(null);

  useEffect(() => {
    const initWallet = async () => {
      try {
        // Dynamically import Polkadot API and extension
        const { ApiPromise, WsProvider } = await import("@polkadot/api");
        const { web3Enable, web3Accounts, web3FromAddress } = await import("@polkadot/extension-dapp");

        // Connect to Westend Asset Hub
        const wsProvider = new WsProvider("wss://westend-asset-hub-rpc.polkadot.io");
        const apiInstance = await ApiPromise.create({ provider: wsProvider });

        // Enable extension and get accounts
        const extensions = await web3Enable("T402 Demo");
        if (extensions.length > 0) {
          const allAccounts = await web3Accounts();
          setAccounts(allAccounts as InjectedAccount[]);

          if (allAccounts.length > 0) {
            const firstAccount = allAccounts[0];
            setAddress(firstAccount.address);
            const injectorInstance = await web3FromAddress(firstAccount.address);
            setInjector(injectorInstance as unknown as InjectedExtension);
          }
        }

        setApi(apiInstance as unknown as typeof api);
      } catch (error) {
        console.error("Failed to initialize Polkadot wallet:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initWallet();
  }, []);

  const connect = useCallback(async () => {
    try {
      const { web3Enable, web3Accounts, web3FromAddress } = await import("@polkadot/extension-dapp");

      const extensions = await web3Enable("T402 Demo");
      if (extensions.length === 0) {
        window.open("https://polkadot.js.org/extension/", "_blank");
        return;
      }

      const allAccounts = await web3Accounts();
      if (allAccounts.length === 0) {
        throw new Error("No accounts found. Please create an account in your Polkadot wallet.");
      }

      setAccounts(allAccounts as InjectedAccount[]);
      const firstAccount = allAccounts[0];
      setAddress(firstAccount.address);

      const injectorInstance = await web3FromAddress(firstAccount.address);
      setInjector(injectorInstance as unknown as InjectedExtension);
    } catch (error) {
      console.error("Failed to connect Polkadot wallet:", error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
    setAccounts([]);
    setInjector(null);
  }, []);

  const transferAsset = useCallback(
    async (assetId: string, recipient: string, amount: string): Promise<string> => {
      if (!api || !address || !injector) {
        throw new Error("Polkadot wallet not initialized");
      }

      return new Promise((resolve, reject) => {
        api.tx.assets
          .transfer(parseInt(assetId, 10), recipient, amount)
          .signAndSend(address, { signer: injector.signer }, (result) => {
            if (result.status.isFinalized) {
              resolve(result.txHash.toHex());
            }
          })
          .catch(reject);
      });
    },
    [api, address, injector]
  );

  return (
    <PolkadotWalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isLoading,
        connect,
        disconnect,
        transferAsset,
      }}
    >
      {children}
    </PolkadotWalletContext.Provider>
  );
}
