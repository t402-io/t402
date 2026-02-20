import { useCallback, useEffect, useState } from "react";
import { Address } from "@ton/core";

/**
 * Wallet type from @ton/appkit-react or @tonconnect/ui-react fallback.
 *
 * @ton/appkit-react exposes WalletInterface with getAddress()/getNetwork(),
 * but we normalize to this shape for a unified public API.
 */
type AppKitWallet = {
  account?: {
    address: string;
    chain?: string;
  };
  device?: {
    appName: string;
  };
};

/**
 * Hook return type for TON wallet state
 */
export interface UseTonWalletReturn {
  /** Connected wallet or null */
  wallet: AppKitWallet | null;
  /** Wallet address in friendly format */
  address: string | null;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Connect wallet */
  connect: () => Promise<void>;
  /** Disconnect wallet */
  disconnect: () => Promise<void>;
  /** Error message if any */
  error: string | null;
}

/**
 * Load the wallet provider dynamically.
 * Tries @ton/appkit-react first, falls back to @tonconnect/ui-react.
 */
async function loadWalletProvider(): Promise<{
  useTonConnectUI: () => [
    {
      openModal: () => Promise<void>;
      disconnect: () => Promise<void>;
      sendTransaction: (req: unknown) => Promise<{ boc: string }>;
    },
  ];
  useTonWallet: () => AppKitWallet | null;
  source: "appkit" | "tonconnect";
}> {
  try {
    const appkit = await import("@ton/appkit-react" as string);
    // @ton/appkit-react exports useAppKit (returns AppKit instance),
    // useConnectedWallets, useSelectedWallet, useAddress, useConnect, useDisconnect.
    // We adapt useAppKit to the useTonConnectUI shape for compatibility.
    return {
      useTonConnectUI: () => {
        const kit = appkit.useAppKit();
        return [
          {
            openModal: async () => {
              // Trigger connection via the first available connector
              const connector = kit.connectors[0];
              if (connector) {
                await connector.connectWallet();
              }
            },
            disconnect: async () => {
              const connector = kit.connectors[0];
              if (connector) {
                await connector.disconnectWallet();
              }
            },
            sendTransaction: async (req: unknown) => {
              const wallets = kit.walletsManager.getWallets();
              const wallet = wallets[0];
              if (!wallet) throw new Error("No wallet connected");
              return wallet.sendTransaction(req as Parameters<typeof wallet.sendTransaction>[0]);
            },
          },
        ] as [
          {
            openModal: () => Promise<void>;
            disconnect: () => Promise<void>;
            sendTransaction: (req: unknown) => Promise<{ boc: string }>;
          },
        ];
      },
      useTonWallet: () => {
        // Normalize @ton/appkit-react wallet to our shape
        try {
          const kit = appkit.useAppKit();
          const wallets = kit.walletsManager.getWallets();
          const wallet = wallets[0];
          if (!wallet) return null;
          return {
            account: {
              address: wallet.getAddress(),
              chain: wallet.getNetwork(),
            },
            device: {
              appName: wallet.connectorId,
            },
          };
        } catch {
          return null;
        }
      },
      source: "appkit",
    };
  } catch {
    // Fall back to @tonconnect/ui-react
    const tonconnect = await import("@tonconnect/ui-react");
    return {
      useTonConnectUI:
        tonconnect.useTonConnectUI as unknown as typeof loadWalletProvider extends () => Promise<
          infer R
        >
          ? R["useTonConnectUI"]
          : never,
      useTonWallet: tonconnect.useTonWallet as unknown as () => AppKitWallet | null,
      source: "tonconnect",
    };
  }
}

// Cache the provider import
let providerPromise: ReturnType<typeof loadWalletProvider> | null = null;

function getProvider() {
  if (!providerPromise) {
    providerPromise = loadWalletProvider();
  }
  return providerPromise;
}

/**
 * Hook for managing TON wallet connection
 *
 * Supports both @ton/appkit-react (preferred) and @tonconnect/ui-react (fallback).
 * The public interface remains the same regardless of which provider is used.
 *
 * @param onStatus - Callback for status updates
 * @returns Wallet connection state and methods
 */
export function useTonWalletConnection(onStatus?: (status: string) => void): UseTonWalletReturn {
  const [wallet, setWallet] = useState<AppKitWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Awaited<ReturnType<typeof loadWalletProvider>> | null>(
    null,
  );

  // Load provider on mount
  useEffect(() => {
    getProvider()
      .then(setProvider)
      .catch(() => {
        setError("Failed to load TON wallet provider");
      });
  }, []);

  useEffect(() => {
    if (!provider) return;

    // Use the provider's hooks to get wallet state.
    // Both @ton/appkit-react and @tonconnect/ui-react expose compatible hooks.
    try {
      const walletState = provider.useTonWallet();
      setWallet(walletState);
    } catch {
      // Hook not available outside React render — handled by connect/disconnect
    }
  }, [provider]);

  // Get friendly address from wallet
  const address = wallet?.account?.address
    ? Address.parse(wallet.account.address).toString({ bounceable: false })
    : null;

  const connect = useCallback(async () => {
    if (wallet) {
      return; // Already connected
    }

    setIsConnecting(true);
    setError(null);
    onStatus?.("Connecting to wallet...");

    try {
      const p = await getProvider();
      const [ui] = p.useTonConnectUI();
      await ui.openModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      onStatus?.(message);
    } finally {
      setIsConnecting(false);
    }
  }, [wallet, onStatus]);

  const disconnect = useCallback(async () => {
    try {
      const p = await getProvider();
      const [ui] = p.useTonConnectUI();
      await ui.disconnect();
      setWallet(null);
      onStatus?.("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect";
      setError(message);
      onStatus?.(message);
    }
  }, [onStatus]);

  // Clear status when connected
  useEffect(() => {
    if (wallet && isConnecting) {
      setIsConnecting(false);
      onStatus?.("");
    }
  }, [wallet, isConnecting, onStatus]);

  return {
    wallet,
    address,
    isConnected: !!wallet,
    isConnecting,
    connect,
    disconnect,
    error,
  };
}

/**
 * Format address for display (truncated)
 *
 * @param address - Full address string
 * @returns Truncated address like "UQ...1234"
 */
export function formatTonAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
