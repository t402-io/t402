"use client";

import type { ReactNode } from "react";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { ChainProvider } from "./ChainProvider";
import { DemoProvider } from "./DemoProvider";
import { ToastProvider } from "./ToastProvider";

// Context to track if we're on the client and wallet providers are ready
const WalletReadyContext = createContext(false);
export function useWalletReady() {
  return useContext(WalletReadyContext);
}

// Lazy-load wallet providers only when mounted
function WalletProviders({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  const [providers, setProviders] = useState<{
    Wagmi: React.ComponentType<{ children: ReactNode }> | null;
    Ton: React.ComponentType<{ children: ReactNode }> | null;
    Solana: React.ComponentType<{ children: ReactNode }> | null;
    Near: React.ComponentType<{ children: ReactNode }> | null;
    Aptos: React.ComponentType<{ children: ReactNode }> | null;
    Tezos: React.ComponentType<{ children: ReactNode }> | null;
    Polkadot: React.ComponentType<{ children: ReactNode }> | null;
  }>({
    Wagmi: null,
    Ton: null,
    Solana: null,
    Near: null,
    Aptos: null,
    Tezos: null,
    Polkadot: null,
  });

  useEffect(() => {
    Promise.all([
      import("./WagmiProvider").then((m) => m.WagmiProviderWrapper),
      import("./TonConnectProvider").then((m) => m.TonConnectProvider),
      import("./SolanaProvider").then((m) => m.SolanaProvider),
      import("./NearProvider").then((m) => m.NearProvider),
      import("./AptosProvider").then((m) => m.AptosProvider),
      import("./TezosProvider").then((m) => m.TezosProvider),
      import("./PolkadotProvider").then((m) => m.PolkadotProvider),
    ])
      .then(([Wagmi, Ton, Solana, Near, Aptos, Tezos, Polkadot]) => {
        setProviders({ Wagmi, Ton, Solana, Near, Aptos, Tezos, Polkadot });
        onReady();
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { Wagmi, Ton, Solana, Near, Aptos, Tezos, Polkadot } = providers;

  // Before providers are loaded, just render children
  if (!Wagmi || !Ton || !Solana || !Near || !Aptos || !Tezos || !Polkadot) {
    return <>{children}</>;
  }

  // After providers are loaded, wrap children with all providers
  return (
    <Wagmi>
      <Ton>
        <Solana>
          <Near>
            <Aptos>
              <Tezos>
                <Polkadot>{children}</Polkadot>
              </Tezos>
            </Aptos>
          </Near>
        </Solana>
      </Ton>
    </Wagmi>
  );
}

export function ClientProviders({ children }: { children: ReactNode }) {
  const [walletReady, setWalletReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleWalletReady = useCallback(() => {
    setWalletReady(true);
  }, []);

  return (
    <WalletReadyContext.Provider value={walletReady}>
      <ChainProvider>
        <DemoProvider>
          <ToastProvider>
            {mounted ? (
              <WalletProviders onReady={handleWalletReady}>
                {children}
              </WalletProviders>
            ) : (
              children
            )}
          </ToastProvider>
        </DemoProvider>
      </ChainProvider>
    </WalletReadyContext.Provider>
  );
}
