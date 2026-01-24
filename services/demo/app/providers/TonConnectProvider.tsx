"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import type { ReactNode } from "react";

// TonConnect manifest for the demo app
const MANIFEST_URL = "https://demo.t402.io/tonconnect-manifest.json";

export function TonConnectProvider({ children }: { children: ReactNode }) {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      {children}
    </TonConnectUIProvider>
  );
}
