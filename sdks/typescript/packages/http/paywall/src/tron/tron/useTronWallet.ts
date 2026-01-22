import { useCallback, useEffect, useState } from "react";
import { isTronLinkInstalled, isTronLinkConnected, getTronLinkAddress } from "./rpc";

/**
 * Hook return type for TRON wallet state
 */
export interface UseTronWalletReturn {
  /** Connected wallet address or null */
  address: string | null;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether TronLink is installed */
  isInstalled: boolean;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Connect wallet */
  connect: () => Promise<void>;
  /** Disconnect wallet (clear state) */
  disconnect: () => void;
  /** Error message if any */
  error: string | null;
}

/**
 * Hook for managing TronLink wallet connection
 *
 * @param onStatus - Callback for status updates
 * @returns Wallet connection state and methods
 */
export function useTronWallet(onStatus?: (status: string) => void): UseTronWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInstalled = isTronLinkInstalled();
  const isConnected = !!address;

  // Check for existing connection on mount
  useEffect(() => {
    if (isTronLinkConnected()) {
      setAddress(getTronLinkAddress());
    }
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (!isInstalled) return;

    const handleAccountsChanged = () => {
      const newAddress = getTronLinkAddress();
      if (newAddress !== address) {
        setAddress(newAddress);
        if (!newAddress) {
          onStatus?.("Wallet disconnected");
        }
      }
    };

    // TronLink emits message events for account changes
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.message?.action === "accountsChanged") {
        handleAccountsChanged();
      }
      if (event.data?.message?.action === "setAccount") {
        handleAccountsChanged();
      }
      if (event.data?.message?.action === "disconnect") {
        setAddress(null);
        onStatus?.("Wallet disconnected");
      }
    };

    window.addEventListener("message", handleMessage);

    // Also poll for changes (backup for browsers that don't support events)
    const interval = setInterval(handleAccountsChanged, 1000);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, [isInstalled, address, onStatus]);

  const connect = useCallback(async () => {
    if (!isInstalled) {
      setError("TronLink is not installed");
      onStatus?.("Please install TronLink wallet extension");
      return;
    }

    if (isConnected) {
      return; // Already connected
    }

    setIsConnecting(true);
    setError(null);
    onStatus?.("Connecting to TronLink...");

    try {
      // Request account access
      if (window.tronLink?.request) {
        await window.tronLink.request({ method: "tron_requestAccounts" });
      }

      // Wait a bit for TronWeb to update
      await new Promise(resolve => setTimeout(resolve, 500));

      const connectedAddress = getTronLinkAddress();
      if (connectedAddress) {
        setAddress(connectedAddress);
        onStatus?.("");
      } else {
        throw new Error("Failed to get wallet address");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      onStatus?.(message);
    } finally {
      setIsConnecting(false);
    }
  }, [isInstalled, isConnected, onStatus]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError(null);
    onStatus?.("");
  }, [onStatus]);

  return {
    address,
    isConnected,
    isInstalled,
    isConnecting,
    connect,
    disconnect,
    error,
  };
}

/**
 * Format TRON address for display (truncated)
 *
 * @param address - Full address string
 * @returns Truncated address like "T...1234"
 */
export function formatTronAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
