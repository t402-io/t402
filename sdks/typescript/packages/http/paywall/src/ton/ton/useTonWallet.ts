import { useCallback, useEffect, useState } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import type { Wallet } from "@tonconnect/ui-react";
import { Address } from "@ton/core";

/**
 * Hook return type for TON wallet state
 */
export interface UseTonWalletReturn {
  /** Connected wallet or null */
  wallet: Wallet | null;
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
 * Hook for managing TonConnect wallet connection
 *
 * @param onStatus - Callback for status updates
 * @returns Wallet connection state and methods
 */
export function useTonWalletConnection(onStatus?: (status: string) => void): UseTonWalletReturn {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await tonConnectUI.openModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
      onStatus?.(message);
    } finally {
      setIsConnecting(false);
    }
  }, [tonConnectUI, wallet, onStatus]);

  const disconnect = useCallback(async () => {
    try {
      await tonConnectUI.disconnect();
      onStatus?.("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect";
      setError(message);
      onStatus?.(message);
    }
  }, [tonConnectUI, onStatus]);

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
