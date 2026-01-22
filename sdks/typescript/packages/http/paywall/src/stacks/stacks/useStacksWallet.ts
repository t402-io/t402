import { useCallback, useEffect, useState } from "react";
import {
  isLeatherInstalled,
  isXverseInstalled,
  isStacksWalletInstalled,
  getAvailableWallets,
} from "./rpc";
import type { StacksAccount, StacksNetwork } from "./types";
import { STACKS_NETWORKS } from "./types";

/**
 * Hook return type for Stacks wallet state
 */
export interface UseStacksWalletReturn {
  /** Connected wallet account or null */
  account: StacksAccount | null;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether any Stacks wallet is installed */
  isInstalled: boolean;
  /** Whether connection is in progress */
  isConnecting: boolean;
  /** Available wallet IDs */
  availableWallets: ("leather" | "xverse")[];
  /** Currently selected wallet */
  selectedWallet: "leather" | "xverse" | null;
  /** Connect to a specific wallet */
  connect: (walletId: "leather" | "xverse") => Promise<void>;
  /** Disconnect wallet */
  disconnect: () => void;
  /** Error message if any */
  error: string | null;
}

/**
 * Request accounts from Leather wallet
 */
async function connectLeather(_network: StacksNetwork): Promise<StacksAccount> {
  const provider = window.LeatherProvider || window.HiroWalletProvider;
  if (!provider) {
    throw new Error("Leather wallet not found");
  }

  const response = await provider.request("getAddresses");

  // Response contains addresses array
  const addresses = (
    response as {
      result: { addresses: Array<{ address: string; publicKey: string; type: string }> };
    }
  ).result?.addresses;

  if (!addresses || addresses.length === 0) {
    throw new Error("No addresses returned from wallet");
  }

  // Find the Stacks address (p2wpkh for mainnet, or any stacks type)
  const stacksAddress = addresses.find(
    (addr: { type: string }) => addr.type === "p2wpkh" || addr.type === "stacks",
  );

  if (!stacksAddress) {
    // Fallback to first address
    return {
      address: addresses[0].address,
      publicKey: addresses[0].publicKey,
    };
  }

  return {
    address: stacksAddress.address,
    publicKey: stacksAddress.publicKey,
  };
}

/**
 * Request accounts from Xverse wallet
 */
async function connectXverse(_network: StacksNetwork): Promise<StacksAccount> {
  const provider = window.XverseProviders?.StacksProvider;
  if (!provider) {
    throw new Error("Xverse wallet not found");
  }

  const response = await provider.request("getAddresses", {
    purposes: ["stacks"],
  });

  const addresses = (
    response as { result: { addresses: Array<{ address: string; publicKey: string }> } }
  ).result?.addresses;

  if (!addresses || addresses.length === 0) {
    throw new Error("No addresses returned from wallet");
  }

  return {
    address: addresses[0].address,
    publicKey: addresses[0].publicKey,
  };
}

/**
 * Hook for managing Stacks wallet connection
 *
 * @param network - Target Stacks network
 * @param onStatus - Callback for status updates
 * @returns Wallet connection state and methods
 */
export function useStacksWallet(
  network: StacksNetwork = STACKS_NETWORKS.MAINNET,
  onStatus?: (status: string) => void,
): UseStacksWalletReturn {
  const [account, setAccount] = useState<StacksAccount | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<"leather" | "xverse" | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInstalled = isStacksWalletInstalled();
  const isConnected = !!account;
  const availableWallets = getAvailableWallets();

  // Listen for account changes (Leather)
  useEffect(() => {
    if (!isLeatherInstalled()) return;

    const handleAccountChange = (event: MessageEvent) => {
      if (event.data?.type === "leather-provider-update") {
        // Account might have changed, clear connection
        if (selectedWallet === "leather") {
          setAccount(null);
          onStatus?.("Wallet state changed, please reconnect");
        }
      }
    };

    window.addEventListener("message", handleAccountChange);
    return () => window.removeEventListener("message", handleAccountChange);
  }, [selectedWallet, onStatus]);

  const connect = useCallback(
    async (walletId: "leather" | "xverse") => {
      if (walletId === "leather" && !isLeatherInstalled()) {
        setError("Leather wallet is not installed");
        onStatus?.("Please install Leather wallet extension");
        return;
      }

      if (walletId === "xverse" && !isXverseInstalled()) {
        setError("Xverse wallet is not installed");
        onStatus?.("Please install Xverse wallet extension");
        return;
      }

      setIsConnecting(true);
      setError(null);
      onStatus?.(`Connecting to ${walletId === "leather" ? "Leather" : "Xverse"}...`);

      try {
        let connectedAccount: StacksAccount;

        if (walletId === "leather") {
          connectedAccount = await connectLeather(network);
        } else {
          connectedAccount = await connectXverse(network);
        }

        setAccount(connectedAccount);
        setSelectedWallet(walletId);
        onStatus?.("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to connect wallet";
        setError(message);
        onStatus?.(message);
      } finally {
        setIsConnecting(false);
      }
    },
    [network, onStatus],
  );

  const disconnect = useCallback(() => {
    setAccount(null);
    setSelectedWallet(null);
    setError(null);
    onStatus?.("");
  }, [onStatus]);

  return {
    account,
    isConnected,
    isInstalled,
    isConnecting,
    availableWallets,
    selectedWallet,
    connect,
    disconnect,
    error,
  };
}

/**
 * Format Stacks address for display (truncated)
 *
 * @param address - Full address string
 * @returns Truncated address like "SP...1234"
 */
export function formatStacksAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}
