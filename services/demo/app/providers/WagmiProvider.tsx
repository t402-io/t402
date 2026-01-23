"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({ projectId }),
          coinbaseWallet({ appName: "T402 Demo" }),
        ]
      : []),
  ],
  transports: {
    [baseSepolia.id]: http("https://base-sepolia.publicnode.com"),
    [base.id]: http("https://mainnet.base.org"),
  },
});

export function WagmiProviderWrapper({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
