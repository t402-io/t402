import { useCallback, useState } from "react";
import type { PaymentRequired } from "@t402/core/types";
import { USDT_CONTRACT_ADDRESSES, TRON_NETWORKS } from "./types";

/**
 * Hook return type for TRON balance state
 */
export interface UseTronBalanceReturn {
  /** Raw balance in smallest units (null if not fetched) */
  balance: bigint | null;
  /** Formatted balance string (e.g., "100.50") */
  formattedBalance: string | null;
  /** Whether balance is being fetched */
  isFetching: boolean;
  /** Refresh balance */
  refreshBalance: (address?: string) => Promise<bigint | null>;
  /** Reset balance state */
  resetBalance: () => void;
}

/**
 * Fetches TRC-20 token balance for an address
 *
 * @param userAddress - User's TRON address
 * @param contractAddress - TRC-20 contract address
 * @returns Balance in smallest units
 */
async function fetchTRC20Balance(
  userAddress: string,
  contractAddress: string,
): Promise<bigint> {
  try {
    if (!window.tronWeb) {
      console.error("TronWeb not available");
      return 0n;
    }

    const contract = await window.tronWeb.contract().at(contractAddress);
    const result = await contract.balanceOf(userAddress).call();

    // Handle different return types from TronWeb
    if (typeof result === "string") {
      return BigInt(result);
    }
    if (typeof result === "number") {
      return BigInt(result);
    }
    if (result && typeof result === "object") {
      if ("_hex" in result && typeof result._hex === "string") {
        return BigInt(result._hex);
      }
      if ("toNumber" in result && typeof result.toNumber === "function") {
        return BigInt(result.toNumber());
      }
    }

    return 0n;
  } catch (error) {
    console.error("Failed to fetch TRC-20 balance:", error);
    return 0n;
  }
}

/**
 * Formats balance from smallest units to human-readable format
 *
 * @param balance - Balance in smallest units
 * @param decimals - Token decimals (default 6 for USDT)
 * @returns Formatted balance string
 */
function formatBalance(balance: bigint, decimals = 6): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const fractionalPart = balance % divisor;

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  // Trim trailing zeros but keep at least 2 decimal places
  const trimmed = fractionalStr.replace(/0+$/, "").padEnd(2, "0");

  return `${integerPart}.${trimmed}`;
}

/**
 * Hook for managing TRON TRC-20 balance
 *
 * @param params - Hook parameters
 * @param params.address - User's TRON address
 * @param params.paymentRequired - Payment requirements
 * @param params.onStatus - Status callback
 * @returns Balance state and methods
 */
export function useTronBalance({
  address,
  paymentRequired,
  onStatus,
}: {
  address: string | null;
  paymentRequired: PaymentRequired;
  onStatus?: (status: string) => void;
}): UseTronBalanceReturn {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Get network and asset from payment requirements
  const requirement = paymentRequired.accepts[0];
  const network = requirement?.network || TRON_NETWORKS.NILE;
  const contractAddress =
    requirement?.asset ||
    USDT_CONTRACT_ADDRESSES[network as keyof typeof USDT_CONTRACT_ADDRESSES] ||
    USDT_CONTRACT_ADDRESSES[TRON_NETWORKS.NILE];

  const refreshBalance = useCallback(
    async (userAddress?: string): Promise<bigint | null> => {
      const addr = userAddress || address;
      if (!addr) {
        return null;
      }

      setIsFetching(true);
      onStatus?.("Fetching USDT balance...");

      try {
        const fetchedBalance = await fetchTRC20Balance(addr, contractAddress);
        setBalance(fetchedBalance);
        onStatus?.("");
        return fetchedBalance;
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        onStatus?.("Failed to fetch balance");
        return null;
      } finally {
        setIsFetching(false);
      }
    },
    [address, contractAddress, onStatus],
  );

  const resetBalance = useCallback(() => {
    setBalance(null);
  }, []);

  const formattedBalance = balance !== null ? formatBalance(balance) : null;

  return {
    balance,
    formattedBalance,
    isFetching,
    refreshBalance,
    resetBalance,
  };
}
