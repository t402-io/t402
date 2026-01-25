"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { NearWalletContext } from "@/hooks/useNearPayment";

// Dynamic import types for NEAR Wallet Selector
type WalletSelector = {
  wallet: () => Promise<{
    signAndSendTransaction: (params: {
      receiverId: string;
      actions: Array<{
        type: "FunctionCall";
        params: {
          methodName: string;
          args: Record<string, unknown>;
          gas: string;
          deposit: string;
        };
      }>;
    }) => Promise<{ transaction: { hash: string } }>;
    signOut: () => Promise<void>;
  }>;
  store: {
    getState: () => { accounts: Array<{ accountId: string }> };
    observable: {
      subscribe: (callback: (state: { accounts: Array<{ accountId: string }> }) => void) => { unsubscribe: () => void };
    };
  };
};

type WalletSelectorModal = {
  show: () => void;
  hide: () => void;
};

/**
 * NEAR Wallet Context provider using NEAR Wallet Selector.
 * Loaded lazily to keep ~200KB out of the initial bundle.
 */
export default function NearWalletContextProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initWallet = async () => {
      try {
        // Dynamically import NEAR Wallet Selector
        const { setupWalletSelector } = await import("@near-wallet-selector/core");
        const { setupModal } = await import("@near-wallet-selector/modal-ui");
        const { setupMyNearWallet } = await import("@near-wallet-selector/my-near-wallet");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const _selector = await setupWalletSelector({
          network: "testnet",
          modules: [setupMyNearWallet() as any],
        });

        const _modal = setupModal(_selector, {
          contractId: "usdc.fakes.testnet",
        });

        // Get initial account state
        const state = _selector.store.getState();
        const accounts = state.accounts;
        if (accounts.length > 0) {
          setAccountId(accounts[0].accountId);
        }

        // Subscribe to account changes
        _selector.store.observable.subscribe((state) => {
          const accounts = state.accounts;
          setAccountId(accounts.length > 0 ? accounts[0].accountId : null);
        });

        setSelector(_selector as unknown as WalletSelector);
        setModal(_modal as unknown as WalletSelectorModal);
      } catch (error) {
        console.error("Failed to initialize NEAR wallet:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initWallet();
  }, []);

  const connect = useCallback(async () => {
    if (modal) {
      modal.show();
    }
  }, [modal]);

  const disconnect = useCallback(async () => {
    if (selector) {
      const wallet = await selector.wallet();
      await wallet.signOut();
      setAccountId(null);
    }
  }, [selector]);

  const signAndSendTransaction = useCallback(
    async (
      receiverId: string,
      methodName: string,
      args: Record<string, unknown>,
      gas: string,
      deposit: string
    ): Promise<string> => {
      if (!selector) {
        throw new Error("NEAR wallet not initialized");
      }

      const wallet = await selector.wallet();
      const result = await wallet.signAndSendTransaction({
        receiverId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName,
              args,
              gas,
              deposit,
            },
          },
        ],
      });

      return result.transaction.hash;
    },
    [selector]
  );

  return (
    <NearWalletContext.Provider
      value={{
        accountId,
        isConnected: !!accountId,
        isLoading,
        connect,
        disconnect,
        signAndSendTransaction,
      }}
    >
      {children}
    </NearWalletContext.Provider>
  );
}
