"use client";

import type { ReactNode } from "react";
import { useState, useEffect, Suspense, createContext, useContext } from "react";
import dynamic from "next/dynamic";
import { ChainProvider, useChainContext } from "./ChainProvider";
import { DemoProvider } from "./DemoProvider";
import { ToastProvider } from "./ToastProvider";

// Context to track if wallet providers are mounted
const WalletReadyContext = createContext(false);
export function useWalletReady() {
  return useContext(WalletReadyContext);
}

// Dynamic import wallet providers with ssr: false
// EVM is always loaded (most common chain family)
const WagmiProviderWrapper = dynamic(
  () => import("./WagmiProvider").then((mod) => mod.WagmiProviderWrapper),
  { ssr: false, loading: () => null }
);

// Other chain providers loaded on demand
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

// Conditionally renders only the active chain's wallet provider + EVM (always loaded)
function ActiveWalletProvider({ children }: { children: ReactNode }) {
  const { activeFamily } = useChainContext();

  // EVM always wraps children (most common, relatively lightweight with Wagmi)
  let wrapped = <>{children}</>;

  // Wrap with the active chain's provider (if not EVM)
  switch (activeFamily) {
    case "ton":
      wrapped = <TonConnectProvider>{wrapped}</TonConnectProvider>;
      break;
    case "solana":
      wrapped = <SolanaProvider>{wrapped}</SolanaProvider>;
      break;
    case "near":
      wrapped = <NearProvider>{wrapped}</NearProvider>;
      break;
    case "aptos":
      wrapped = <AptosProvider>{wrapped}</AptosProvider>;
      break;
    case "tezos":
      wrapped = <TezosProvider>{wrapped}</TezosProvider>;
      break;
    case "polkadot":
      wrapped = <PolkadotProvider>{wrapped}</PolkadotProvider>;
      break;
    case "cosmos":
      wrapped = <CosmosProvider>{wrapped}</CosmosProvider>;
      break;
  }

  return (
    <WagmiProviderWrapper>
      {wrapped}
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

  // After mount, wrap with active chain's wallet provider
  return (
    <WalletReadyContext.Provider value={true}>
      <ChainProvider>
        <DemoProvider>
          <ToastProvider>
            <Suspense fallback={children}>
              <ActiveWalletProvider>
                {children}
              </ActiveWalletProvider>
            </Suspense>
          </ToastProvider>
        </DemoProvider>
      </ChainProvider>
    </WalletReadyContext.Provider>
  );
}
