"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { type ReactNode, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { TonWalletContext } from "@/hooks/useTonPayment";

// Lazy-load the inner context provider that reads from @tonconnect/ui-react hooks
const TonWalletContextProvider = dynamic(() => import("./TonWalletContext"), {
  ssr: false,
});

// Fallback context values before the real provider loads
const FALLBACK_TON_STATE = {
  tonConnectUI: null,
  rawAddress: null,
  friendlyAddress: null,
};

export function TonConnectProvider({ children }: { children: ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);

  useEffect(() => {
    setManifestUrl(`${window.location.origin}/tonconnect-manifest.json`);
  }, []);

  // Render children with fallback context until we have the manifest URL
  if (!manifestUrl) {
    return (
      <TonWalletContext.Provider value={FALLBACK_TON_STATE}>
        {children}
      </TonWalletContext.Provider>
    );
  }

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <TonWalletContextProvider>
        {children}
      </TonWalletContextProvider>
    </TonConnectUIProvider>
  );
}
