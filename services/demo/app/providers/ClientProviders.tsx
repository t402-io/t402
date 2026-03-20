"use client";

import type { ReactNode } from "react";
import { useState, useEffect, Suspense, createContext, useContext } from "react";
import dynamic from "next/dynamic";
import { ChainProvider } from "./ChainProvider";
import { DemoProvider } from "./DemoProvider";
import { ToastProvider } from "./ToastProvider";

// Context to track if wallet providers are mounted
const WalletReadyContext = createContext(false);
export function useWalletReady() {
  return useContext(WalletReadyContext);
}

// Fallback component for loading states
function ProviderFallback({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// Dynamic import wallet providers with ssr: false and loading fallbacks
const WagmiProviderWrapper = dynamic(
  () => import("./WagmiProvider").then((mod) => mod.WagmiProviderWrapper),
  { ssr: false, loading: () => null }
);

const TonConnectProvider = dynamic(
  () => import("./TonConnectProvider").then((mod) => mod.TonConnectProvider),
  { ssr: false, loading: () => null }
);

const SolanaProvider = dynamic(
  () => import("./SolanaProvider").then((mod) => mod.SolanaProvider),
  { ssr: false, loading: () => null }
);

const NearProvider = dynamic(
  () => import("./NearProvider").then((mod) => mod.NearProvider),
  { ssr: false, loading: () => null }
);

const AptosProvider = dynamic(
  () => import("./AptosProvider").then((mod) => mod.AptosProvider),
  { ssr: false, loading: () => null }
);

const TezosProvider = dynamic(
  () => import("./TezosProvider").then((mod) => mod.TezosProvider),
  { ssr: false, loading: () => null }
);

const PolkadotProvider = dynamic(
  () => import("./PolkadotProvider").then((mod) => mod.PolkadotProvider),
  { ssr: false, loading: () => null }
);

const CosmosProvider = dynamic(
  () => import("./CosmosProvider").then((mod) => mod.CosmosProvider),
  { ssr: false, loading: () => null }
);

// Wrapper that handles the wallet providers with error resilience
function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProviderWrapper>
      <TonConnectProvider>
        <SolanaProvider>
          <NearProvider>
            <AptosProvider>
              <TezosProvider>
                <PolkadotProvider>
                  <CosmosProvider>
                    {children}
                  </CosmosProvider>
                </PolkadotProvider>
              </TezosProvider>
            </AptosProvider>
          </NearProvider>
        </SolanaProvider>
      </TonConnectProvider>
    </WagmiProviderWrapper>
  );
}

export function ClientProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Core providers that work on both server and client
  const coreProviders = (
    <WalletReadyContext.Provider value={false}>
      <ChainProvider>
        <DemoProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </DemoProvider>
      </ChainProvider>
    </WalletReadyContext.Provider>
  );

  // During SSR, render with core providers only
  if (!mounted) {
    return coreProviders;
  }

  // After mount, wrap with wallet providers
  return (
    <WalletReadyContext.Provider value={true}>
      <ChainProvider>
        <DemoProvider>
          <ToastProvider>
            <Suspense fallback={children}>
              <WalletProviders>
                {children}
              </WalletProviders>
            </Suspense>
          </ToastProvider>
        </DemoProvider>
      </ChainProvider>
    </WalletReadyContext.Provider>
  );
}
