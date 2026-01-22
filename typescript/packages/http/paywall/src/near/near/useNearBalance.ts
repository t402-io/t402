import { useState, useCallback } from "react";
import type { NearNetwork } from "./types";
import { fetchUsdcBalance, formatUsdcBalance } from "./rpc";

interface UseNearBalanceResult {
  balance: bigint | null;
  formattedBalance: string | null;
  isFetching: boolean;
  refreshBalance: (accountId?: string) => Promise<bigint | null>;
  resetBalance: () => void;
}

/**
 * Hook to fetch and manage USDC balance on NEAR
 */
export function useNearBalance(
  accountId: string | null,
  network: NearNetwork,
  onStatus?: (status: string) => void,
): UseNearBalanceResult {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const refreshBalance = useCallback(
    async (accountIdOverride?: string): Promise<bigint | null> => {
      const targetAccountId = accountIdOverride || accountId;
      if (!targetAccountId) {
        return null;
      }

      setIsFetching(true);
      onStatus?.("Fetching USDC balance...");

      try {
        const fetchedBalance = await fetchUsdcBalance(targetAccountId, network);
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
    [accountId, network, onStatus],
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
