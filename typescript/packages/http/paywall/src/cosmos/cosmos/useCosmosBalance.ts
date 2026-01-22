import { useState, useCallback } from "react";
import type { CosmosNetwork } from "./types";
import { fetchUsdcBalance, formatUsdcBalance } from "./rpc";

interface UseCosmosBalanceResult {
  balance: bigint | null;
  formattedBalance: string | null;
  isFetching: boolean;
  refreshBalance: (address?: string) => Promise<bigint | null>;
  resetBalance: () => void;
}

/**
 * Hook to fetch and manage USDC balance on Noble
 */
export function useCosmosBalance(
  address: string | null,
  network: CosmosNetwork,
  onStatus?: (status: string) => void,
): UseCosmosBalanceResult {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const refreshBalance = useCallback(
    async (addressOverride?: string): Promise<bigint | null> => {
      const targetAddress = addressOverride || address;
      if (!targetAddress) {
        return null;
      }

      setIsFetching(true);
      onStatus?.("Fetching USDC balance...");

      try {
        const fetchedBalance = await fetchUsdcBalance(targetAddress, network);
        setBalance(fetchedBalance);
        setFormattedBalance(formatUsdcBalance(fetchedBalance));
        onStatus?.("");
        return fetchedBalance;
      } catch (error) {
        console.error("Error fetching balance:", error);
        onStatus?.(error instanceof Error ? error.message : "Failed to fetch balance");
        return null;
      } finally {
        setIsFetching(false);
      }
    },
    [address, network, onStatus],
  );

  const resetBalance = useCallback(() => {
    setBalance(null);
    setFormattedBalance(null);
  }, []);

  return {
    balance,
    formattedBalance,
    isFetching,
    refreshBalance,
    resetBalance,
  };
}
