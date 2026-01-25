"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ChainProvider } from "./ChainProvider";
import { DemoProvider } from "./DemoProvider";
import { ToastProvider } from "./ToastProvider";

// Dynamic import wallet providers with ssr: false
const WagmiProviderWrapper = dynamic(
  () => import("./WagmiProvider").then((mod) => mod.WagmiProviderWrapper),
  { ssr: false }
);

const TonConnectProvider = dynamic(
  () => import("./TonConnectProvider").then((mod) => mod.TonConnectProvider),
  { ssr: false }
);

const SolanaProvider = dynamic(
  () => import("./SolanaProvider").then((mod) => mod.SolanaProvider),
  { ssr: false }
);

const NearProvider = dynamic(
  () => import("./NearProvider").then((mod) => mod.NearProvider),
  { ssr: false }
);

const AptosProvider = dynamic(
  () => import("./AptosProvider").then((mod) => mod.AptosProvider),
  { ssr: false }
);

const TezosProvider = dynamic(
  () => import("./TezosProvider").then((mod) => mod.TezosProvider),
  { ssr: false }
);

const PolkadotProvider = dynamic(
  () => import("./PolkadotProvider").then((mod) => mod.PolkadotProvider),
  { ssr: false }
);

export function ClientProviders({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR and initial hydration, just render children with basic providers
  if (!mounted) {
    return (
      <ChainProvider>
        <DemoProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </DemoProvider>
      </ChainProvider>
    );
  }

  // After hydration, wrap with all wallet providers
  return (
    <ChainProvider>
      <DemoProvider>
        <ToastProvider>
          <WagmiProviderWrapper>
            <TonConnectProvider>
              <SolanaProvider>
                <NearProvider>
                  <AptosProvider>
                    <TezosProvider>
                      <PolkadotProvider>
                        {children}
                      </PolkadotProvider>
                    </TezosProvider>
                  </AptosProvider>
                </NearProvider>
              </SolanaProvider>
            </TonConnectProvider>
          </WagmiProviderWrapper>
        </ToastProvider>
      </DemoProvider>
    </ChainProvider>
  );
}
