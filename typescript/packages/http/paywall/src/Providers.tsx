import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import type { Chain } from "viem";
import { defaultChain, getChainByIdOrCreate } from "./evmChains";
import { isEvmNetwork } from "./paywallUtils";
import { isMobile } from "./utils/mobile";

type ProvidersProps = {
  children: ReactNode;
};

// Create QueryClient for React Query
const queryClient = new QueryClient();

/**
 * Providers component for the paywall
 * Sets up Wagmi and React Query for wallet connectivity
 *
 * @param props - The component props
 * @param props.children - The children of the Providers component
 * @returns The Providers component
 */
export function Providers({ children }: ProvidersProps) {
  const { paymentRequired } = window.t402;

  // Determine which chain to connect to
  let targetChain: Chain = defaultChain; // Default to Base

  if (paymentRequired?.accepts?.[0]) {
    const firstRequirement = paymentRequired.accepts[0];
    const network = firstRequirement.network;

    if (isEvmNetwork(network)) {
      const chainId = parseInt(network.split(":")[1]);
      targetChain = getChainByIdOrCreate(chainId);
    }
  }

  // Get app name and WalletConnect project ID from config
  const appName = window.t402.appName || "t402 Paywall";
  const walletConnectProjectId = window.t402.walletConnectProjectId;

  // Build connectors based on device type and available config
  const connectors = [];

  // Always add injected connector (browser extension wallets)
  connectors.push(injected());

  // Add Coinbase Wallet
  connectors.push(
    coinbaseWallet({
      appName,
    }),
  );

  // Add WalletConnect if project ID is provided (required for WalletConnect v2)
  // WalletConnect is especially useful on mobile for deep linking
  if (walletConnectProjectId) {
    connectors.push(
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: !isMobile(), // Show QR on desktop, use deep link on mobile
        metadata: {
          name: appName,
          description: "Pay with crypto",
          url: window.location.origin,
          icons: window.t402.appLogo ? [window.t402.appLogo] : [],
        },
      }),
    );
  }

  // Create Wagmi config
  const config = createConfig({
    chains: [targetChain],
    connectors,
    transports: {
      [targetChain.id]: http(),
    },
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
