"use client";

import type { ReactNode } from "react";
import { useState, useEffect, Suspense, createContext, useContext, lazy } from "react";
import dynamic from "next/dynamic";
import { ChainProvider, useChainContext } from "./ChainProvider";
import { DemoProvider, useDemoContext } from "./DemoProvider";
import { ToastProvider } from "./ToastProvider";
import type { ChainFamily } from "@/lib/testnet-config";

// Context to track if wallet providers are mounted
const WalletReadyContext = createContext(false);
export function useWalletReady() {
  return useContext(WalletReadyContext);
}

// EVM provider — always loaded (most common chain family, required for all scenarios)
const WagmiProviderWrapper = dynamic(
  () => import("./WagmiProvider").then((mod) => mod.WagmiProviderWrapper),
  { ssr: false, loading: () => null }
);

/**
 * Lazy-loaded non-EVM providers. These are only imported when the user
 * actually selects that chain family. Each provider + its wallet SDK
 * is a separate webpack chunk that doesn't load until needed.
 */
const LAZY_PROVIDERS: Record<string, React.ComponentType<{ children: ReactNode }>> = {};

function getLazyProvider(family: ChainFamily): React.ComponentType<{ children: ReactNode }> | null {
  // EVM uses WagmiProvider (always loaded), TRON + Stacks use window injection
  if (family === "evm" || family === "tron" || family === "stacks") return null;

  if (!LAZY_PROVIDERS[family]) {
    // Create lazy component only on first access — this triggers the chunk download
    const LazyComponent = lazy(() => {
      switch (family) {
        case "ton": return import("./TonConnectProvider").then((m) => ({ default: m.TonConnectProvider }));
        case "solana": return import("./SolanaProvider").then((m) => ({ default: m.SolanaProvider }));
        case "near": return import("./NearProvider").then((m) => ({ default: m.NearProvider }));
        case "aptos": return import("./AptosProvider").then((m) => ({ default: m.AptosProvider }));
        case "tezos": return import("./TezosProvider").then((m) => ({ default: m.TezosProvider }));
        case "polkadot": return import("./PolkadotProvider").then((m) => ({ default: m.PolkadotProvider }));
        case "cosmos": return import("./CosmosProvider").then((m) => ({ default: m.CosmosProvider }));
        default: return Promise.resolve({ default: ({ children }: { children: ReactNode }) => <>{children}</> });
      }
    });
    LAZY_PROVIDERS[family] = LazyComponent;
  }
  return LAZY_PROVIDERS[family];
}

// Renders only the active chain's wallet provider
function ActiveWalletProvider({ children }: { children: ReactNode }) {
  const { activeFamily } = useChainContext();
  const { isDemo } = useDemoContext();

  // In demo mode, skip non-EVM providers entirely (mock wallet, no SDK needed)
  const Provider = isDemo ? null : getLazyProvider(activeFamily);

  const content = Provider ? (
    <Suspense fallback={children}>
      <Provider>{children}</Provider>
    </Suspense>
  ) : (
    children
  );

  return (
    <WagmiProviderWrapper>
      {content}
    </WagmiProviderWrapper>
  );
}

export function ClientProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR + pre-mount: core providers only, no wallet SDKs
  if (!mounted) {
    return (
      <WalletReadyContext.Provider value={false}>
        <DemoProvider>
          <ChainProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ChainProvider>
        </DemoProvider>
      </WalletReadyContext.Provider>
    );
  }

  // After mount: add wallet providers
  return (
    <WalletReadyContext.Provider value={true}>
      <DemoProvider>
        <ChainProvider>
          <ToastProvider>
            <ActiveWalletProvider>
              {children}
            </ActiveWalletProvider>
          </ToastProvider>
        </ChainProvider>
      </DemoProvider>
    </WalletReadyContext.Provider>
  );
}
