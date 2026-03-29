"use client";

import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import type { Chain } from "viem";
import {
  mainnet, base, arbitrum, optimism, polygon, bsc, avalanche,
  celo, fantom, flare, rootstock, sei, mantle, confluxESpace, kaia,
  ink, berachain, unichain, corn, monad, hyperEvm, plasma, xLayer,
  baseSepolia,
} from "viem/chains";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

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

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "366aad3aa440d118a3e92ae5efe88d11";

const allChains = [
  mainnet, base, arbitrum, optimism, polygon, bsc, avalanche,
  celo, fantom, flare, rootstock, sei, mantle, confluxESpace, kaia,
  ink, berachain, unichain, corn, monad, hyperEvm, plasma, xLayer,
  megaeth, stable,
  baseSepolia,
] as const;

// Build transports
const transports: Record<number, ReturnType<typeof http>> = {};
for (const chain of allChains) {
  transports[chain.id] = http();
}
transports[mainnet.id] = http("https://ethereum-rpc.publicnode.com");
transports[arbitrum.id] = http("https://arbitrum-one-rpc.publicnode.com");
transports[optimism.id] = http("https://optimism-rpc.publicnode.com");
transports[polygon.id] = http("https://polygon-bor-rpc.publicnode.com");
transports[bsc.id] = http("https://bsc-rpc.publicnode.com");
transports[avalanche.id] = http("https://avalanche-c-chain-rpc.publicnode.com");
transports[base.id] = http("https://base-rpc.publicnode.com");
transports[baseSepolia.id] = http("https://base-sepolia.publicnode.com");

// Wagmi Adapter for AppKit
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: allChains as any,
  transports: transports as any,
});

// Initialize AppKit — wallet selector modal with mobile deep link support
// Featured wallets: OKX, MetaMask, Phantom, Trust, imToken (user's most-used)
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: allChains as any,
  defaultNetwork: baseSepolia as any,
  metadata: {
    name: "T402 Demo",
    description: "T402 HTTP Payment Protocol Demo",
    url: "https://demo.t402.io",
    icons: ["https://demo.t402.io/icon.svg"],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  featuredWalletIds: [
    "971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709", // OKX
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
    "a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393", // Phantom
    "0b415a746fb9ee99cce155c2ceca0c6f6061b1dbca2d722b3ba16381d0562150", // Trust Wallet
    "ef333840daf915aafdc4a004525502d6d49c8b07f0c3fcd4acc1ffdefab711f3", // imToken
  ],
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#50AF95",
    "--w3m-border-radius-master": "2px",
  },
});

export const config = wagmiAdapter.wagmiConfig;

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
