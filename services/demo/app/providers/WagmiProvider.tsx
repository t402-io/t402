"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import type { Chain } from "viem";
import {
  mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  avalanche,
  celo,
  fantom,
  flare,
  rootstock,
  sei,
  mantle,
  confluxESpace,
  kaia,
  ink,
  berachain,
  unichain,
  corn,
  monad,
  hyperEvm,
  plasma,
  xLayer,
  baseSepolia,
} from "viem/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

// Custom chains not yet in viem/chains
const megaeth: Chain = {
  id: 4326,
  name: "MegaETH",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.megaeth.com"] } },
  blockExplorers: { default: { name: "MegaETH Explorer", url: "https://explorer.megaeth.com" } },
};

const stable: Chain = {
  id: 988,
  name: "Stable",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.stable.io"] } },
  blockExplorers: { default: { name: "Stable Explorer", url: "https://explorer.stable.io" } },
};

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

const allChains = [
  mainnet, base, arbitrum, optimism, polygon, bsc, avalanche,
  celo, fantom, flare, rootstock, sei, mantle, confluxESpace, kaia,
  ink, berachain, unichain, corn, monad, hyperEvm, plasma, xLayer,
  megaeth, stable,
  baseSepolia,
] as const;

// Build transports — use default RPC for each chain
const transports: Record<number, ReturnType<typeof http>> = {};
for (const chain of allChains) {
  transports[chain.id] = http();
}
// Override specific chains with known-good public RPCs
transports[baseSepolia.id] = http("https://base-sepolia.publicnode.com");
transports[base.id] = http("https://mainnet.base.org");
transports[mainnet.id] = http("https://ethereum-rpc.publicnode.com");

const config = createConfig({
  chains: allChains,
  connectors: [
    injected(),
    ...(projectId
      ? [
          walletConnect({ projectId }),
          coinbaseWallet({ appName: "T402 Demo" }),
        ]
      : []),
  ],
  transports: transports as any,
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
