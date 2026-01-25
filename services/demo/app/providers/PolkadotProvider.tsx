"use client";

import { useState, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { PolkadotWalletContext } from "@/hooks/usePolkadotPayment";

// Lazy-load Polkadot API (~500KB) into a separate chunk.
const PolkadotWalletContextProvider = dynamic(() => import("./PolkadotWalletContext"), {
  ssr: false,
});

// Fallback context values before the real provider loads
const FALLBACK_POLKADOT_STATE = {
  address: null,
  isConnected: false,
  isLoading: true,
  connect: async () => {},
  disconnect: async () => {},
  transferAsset: async () => "",
};

export function PolkadotProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Before the real Polkadot provider loads, provide clean fallback context
  if (!mounted) {
    return (
      <PolkadotWalletContext.Provider value={FALLBACK_POLKADOT_STATE}>
        {children}
      </PolkadotWalletContext.Provider>
    );
  }

  return <PolkadotWalletContextProvider>{children}</PolkadotWalletContextProvider>;
}
