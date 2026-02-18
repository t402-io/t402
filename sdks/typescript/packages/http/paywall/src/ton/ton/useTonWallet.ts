import { useCallback, useEffect, useState } from "react";
import { Address } from "@ton/core";

// TODO: Verify @ton/appkit hook signatures once the package is published.
// The API below is based on the ton-connect/kit repository patterns.
// If @ton/appkit is not available, fall back to @tonconnect/ui-react.

/**
 * Wallet type from @ton/appkit (or @tonconnect/ui-react fallback)
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
 * Tries @ton/appkit first, falls back to @tonconnect/ui-react.
 */
async function loadWalletProvider(): Promise<{
  useTonConnectUI: () => [{ openModal: () => Promise<void>; disconnect: () => Promise<void>; sendTransaction: (req: unknown) => Promise<{ boc: string }> }];
  useTonWallet: () => AppKitWallet | null;
  source: "appkit" | "tonconnect";
}> {
  // TODO: Update import path once @ton/appkit is published
  try {
    const appkit = await import("@ton/appkit" as string);
    return {
      useTonConnectUI: appkit.useTonConnectUI ?? appkit.useAppKit,
      useTonWallet: appkit.useTonWallet ?? appkit.useWallet,
      source: "appkit",
    };
  } catch {
    // Fall back to @tonconnect/ui-react
    const tonconnect = await import("@tonconnect/ui-react");
    return {
      useTonConnectUI: tonconnect.useTonConnectUI as unknown as typeof loadWalletProvider extends () => Promise<infer R> ? R["useTonConnectUI"] : never,
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
 * Supports both @ton/appkit (preferred) and @tonconnect/ui-react (fallback).
 * The public interface remains the same regardless of which provider is used.
 *
 * @param onStatus - Callback for status updates
 * @returns Wallet connection state and methods
 */
export function useTonWalletConnection(onStatus?: (status: string) => void): UseTonWalletReturn {
  const [wallet, setWallet] = useState<AppKitWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Awaited<ReturnType<typeof loadWalletProvider>> | null>(null);

  // Load provider on mount
  useEffect(() => {
    getProvider().then(setProvider).catch(() => {
      setError("Failed to load TON wallet provider");
    });
  }, []);

  // TODO: Once @ton/appkit is published, replace this polling approach
  // with proper hook integration. The hooks from @ton/appkit may have
  // different signatures than @tonconnect/ui-react.
  useEffect(() => {
    if (!provider) return;

    // For now, use the TonConnect-compatible hooks
    // @ton/appkit is expected to maintain backward compatibility
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
