import { useCallback, useState } from "react";
import type { PaymentRequired } from "@t402/core/types";
import {
  fetchTokenBalance,
  getUsdcContractAddress,
  getTargetStacksNetwork,
} from "./rpc";
import type { StacksNetwork } from "./types";

/**
 * Hook return type for Stacks token balance
 */
export interface UseStacksBalanceReturn {
  /** Raw balance in smallest unit */
  balance: bigint | null;
  /** Formatted balance for display */
  formattedBalance: string | null;
  /** Whether balance is being fetched */
  isFetching: boolean;
  /** Refresh balance for a specific address */
  refreshBalance: (address?: string) => Promise<bigint | null>;
  /** Reset balance state */
  resetBalance: () => void;
}

/**
 * Hook for fetching sUSDC balance on Stacks
 *
 * @param options - Hook options
 * @param options.address - Stacks address to check balance for
 * @param options.paymentRequired - Payment requirements containing network info
 * @param options.onStatus - Callback for status updates
 * @returns Balance state and methods
 */
export function useStacksBalance(options: {
  address: string | null;
  paymentRequired: PaymentRequired;
  onStatus?: (status: string) => void;
}): UseStacksBalanceReturn {
  const { address, paymentRequired, onStatus } = options;

  const [balance, setBalance] = useState<bigint | null>(null);
  const [formattedBalance, setFormattedBalance] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const network = paymentRequired.accepts[0]?.network;
  const targetNetwork: StacksNetwork = getTargetStacksNetwork(network || "stacks:1");

  const refreshBalance = useCallback(
    async (addressOverride?: string): Promise<bigint | null> => {
      const targetAddress = addressOverride || address;
      if (!targetAddress) {
        return null;
      }

      setIsFetching(true);

      try {
        const contractId = getUsdcContractAddress(targetNetwork);
        const balanceInfo = await fetchTokenBalance(
          targetAddress,
          contractId,
          targetNetwork,
        );

        if (balanceInfo) {
          const rawBalance = BigInt(balanceInfo.balance);
          setBalance(rawBalance);

          // sUSDC has 6 decimals
          const formatted = (Number(rawBalance) / 1_000_000).toFixed(2);
          setFormattedBalance(formatted);

          return rawBalance;
        }

        // No balance found, set to 0
        setBalance(0n);
        setFormattedBalance("0.00");
        return 0n;
      } catch (error) {
        console.error("Error fetching Stacks balance:", error);
        onStatus?.("Failed to fetch balance");
        return null;
      } finally {
        setIsFetching(false);
      }
    },
    [address, targetNetwork, onStatus],
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
