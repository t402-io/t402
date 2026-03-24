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

// EVM provider — always loaded (wagmi hooks are used everywhere)
const WagmiProviderWrapper = dynamic(
  () => import("./WagmiProvider").then((mod) => mod.WagmiProviderWrapper),
  { ssr: false, loading: () => null }
);

/**
 * Lazy-loaded non-EVM providers. Only imported when user selects that chain.
 */
const LAZY_PROVIDERS: Record<string, React.ComponentType<{ children: ReactNode }>> = {};

function getLazyProvider(family: ChainFamily): React.ComponentType<{ children: ReactNode }> | null {
  if (family === "evm" || family === "tron" || family === "stacks") return null;

  if (!LAZY_PROVIDERS[family]) {
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

// Wraps children with the active non-EVM chain provider (if needed)
function NonEvmProvider({ children }: { children: ReactNode }) {
  const { activeFamily } = useChainContext();
  const { isDemo } = useDemoContext();

  // Demo mode: no wallet SDK needed
  const Provider = isDemo ? null : getLazyProvider(activeFamily);

  if (!Provider) return <>{children}</>;

  return (
    <Suspense fallback={children}>
      <Provider>{children}</Provider>
    </Suspense>
  );
}

export function ClientProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Core providers (work on both SSR and client)
  const core = (
    <DemoProvider>
      <ChainProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ChainProvider>
    </DemoProvider>
  );

  // SSR: no wallet providers
  if (!mounted) {
    return (
      <WalletReadyContext.Provider value={false}>
        {core}
      </WalletReadyContext.Provider>
    );
  }

  // Client: wrap with WagmiProvider (always) + non-EVM provider (on demand)
  return (
    <WalletReadyContext.Provider value={true}>
      <DemoProvider>
        <ChainProvider>
          <ToastProvider>
            <WagmiProviderWrapper>
              <NonEvmProvider>
                {children}
              </NonEvmProvider>
            </WagmiProviderWrapper>
          </ToastProvider>
        </ChainProvider>
      </DemoProvider>
    </WalletReadyContext.Provider>
  );
}
