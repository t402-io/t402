"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { TezosWalletContext } from "@/hooks/useTezosPayment";

// Lazy-load Taquito + Beacon SDK (~300KB) into a separate chunk.
const TezosWalletContextProvider = dynamic(() => import("./TezosWalletContext"), {
  ssr: false,
});

// Fallback context values before the real provider loads
const FALLBACK_TEZOS_STATE = {
  address: null,
  isConnected: false,
  isLoading: true,
  connect: async () => {},
  disconnect: async () => {},
  transferFA2: async () => "",
};

export function TezosProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before the real Tezos provider loads, provide clean fallback context
  if (!mounted) {
    return (
      <TezosWalletContext.Provider value={FALLBACK_TEZOS_STATE}>
        {children}
      </TezosWalletContext.Provider>
    );
  }

  return <TezosWalletContextProvider>{children}</TezosWalletContextProvider>;
}
