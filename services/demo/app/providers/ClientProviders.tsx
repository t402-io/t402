"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { ChainProvider } from "./ChainProvider";
import { DemoProvider } from "./DemoProvider";
import { ToastProvider } from "./ToastProvider";

// Lazy load wallet providers only on client
let WagmiProviderWrapper: React.ComponentType<{ children: ReactNode }> | null = null;
let TonConnectProvider: React.ComponentType<{ children: ReactNode }> | null = null;
let SolanaProvider: React.ComponentType<{ children: ReactNode }> | null = null;
let NearProvider: React.ComponentType<{ children: ReactNode }> | null = null;
let AptosProvider: React.ComponentType<{ children: ReactNode }> | null = null;
let TezosProvider: React.ComponentType<{ children: ReactNode }> | null = null;
let PolkadotProvider: React.ComponentType<{ children: ReactNode }> | null = null;

// Passthrough component for when providers aren't loaded
function Passthrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function ClientProviders({ children }: { children: ReactNode }) {
  const [walletProviders, setWalletProviders] = useState<{
    Wagmi: React.ComponentType<{ children: ReactNode }>;
    Ton: React.ComponentType<{ children: ReactNode }>;
    Solana: React.ComponentType<{ children: ReactNode }>;
    Near: React.ComponentType<{ children: ReactNode }>;
    Aptos: React.ComponentType<{ children: ReactNode }>;
    Tezos: React.ComponentType<{ children: ReactNode }>;
    Polkadot: React.ComponentType<{ children: ReactNode }>;
  }>({
    Wagmi: Passthrough,
    Ton: Passthrough,
    Solana: Passthrough,
    Near: Passthrough,
    Aptos: Passthrough,
    Tezos: Passthrough,
    Polkadot: Passthrough,
  });

  useEffect(() => {
    // Load all wallet providers in parallel
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
        setWalletProviders({
          Wagmi,
          Ton,
          Solana,
          Near,
          Aptos,
          Tezos,
          Polkadot,
        });
      })
      .catch((error) => {
        console.error("Failed to load wallet providers:", error);
      });
  }, []);

  const { Wagmi, Ton, Solana, Near, Aptos, Tezos, Polkadot } = walletProviders;

  return (
    <ChainProvider>
      <DemoProvider>
        <ToastProvider>
          <Wagmi>
            <Ton>
              <Solana>
                <Near>
                  <Aptos>
                    <Tezos>
                      <Polkadot>
                        {children}
                      </Polkadot>
                    </Tezos>
                  </Aptos>
                </Near>
              </Solana>
            </Ton>
          </Wagmi>
        </ToastProvider>
      </DemoProvider>
    </ChainProvider>
  );
}
