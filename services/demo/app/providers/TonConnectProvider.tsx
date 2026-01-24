"use client";

import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { type ReactNode, useState, useEffect } from "react";

export function TonConnectProvider({ children }: { children: ReactNode }) {
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);

  useEffect(() => {
    setManifestUrl(`${window.location.origin}/tonconnect-manifest.json`);
  }, []);

  // Render children without TonConnect until we have the manifest URL (avoids hydration mismatch)
  if (!manifestUrl) {
    return <>{children}</>;
  }

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      {children}
    </TonConnectUIProvider>
  );
}
