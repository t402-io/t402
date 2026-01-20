import { useCallback, useState } from "react";
import { Address, beginCell } from "@ton/core";
import type { PaymentRequired } from "@t402/core/types";
import { getTonClient } from "./rpc";
import { USDT_JETTON_ADDRESSES, TON_NETWORKS } from "./types";

/**
 * Hook return type for TON balance state
 */
export interface UseTonBalanceReturn {
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
 * Fetches Jetton balance for an address
 *
 * @param userAddress - User's TON address
 * @param jettonMasterAddress - Jetton master contract address
 * @param network - TON network
 * @returns Balance in smallest units
 */
async function fetchJettonBalance(
  userAddress: string,
  jettonMasterAddress: string,
  network: string,
): Promise<bigint> {
  try {
    const client = getTonClient(network);

    // Get user's Jetton wallet address
    const masterAddress = Address.parse(jettonMasterAddress);
    const ownerAddr = Address.parse(userAddress);

    // Build the slice containing the owner address for the get_wallet_address call
    const ownerSlice = beginCell().storeAddress(ownerAddr).endCell();

    const walletAddressResult = await client.runMethod(masterAddress, "get_wallet_address", [
      { type: "slice", cell: ownerSlice },
    ]);

    const jettonWalletAddress = walletAddressResult.stack.readAddress();

    // Check if jetton wallet is deployed
    const state = await client.getContractState(jettonWalletAddress);
    if (state.state !== "active") {
      return 0n;
    }

    // Get balance from Jetton wallet
    const balanceResult = await client.runMethod(jettonWalletAddress, "get_wallet_data", []);

    // get_wallet_data returns: balance, owner, jetton_master, jetton_wallet_code
    const balance = balanceResult.stack.readBigNumber();
    return balance;
  } catch (error) {
    console.error("Failed to fetch Jetton balance:", error);
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
 * Hook for managing TON Jetton balance
 *
 * @param params - Hook parameters
 * @param params.address - User's TON address
 * @param params.paymentRequired - Payment requirements
 * @param params.onStatus - Status callback
 * @returns Balance state and methods
 */
export function useTonBalance({
  address,
  paymentRequired,
  onStatus,
}: {
  address: string | null;
  paymentRequired: PaymentRequired;
  onStatus?: (status: string) => void;
}): UseTonBalanceReturn {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Get network and asset from payment requirements
  const requirement = paymentRequired.accepts[0];
  const network = requirement?.network || TON_NETWORKS.TESTNET;
  const jettonMaster =
    requirement?.asset ||
    USDT_JETTON_ADDRESSES[network as keyof typeof USDT_JETTON_ADDRESSES] ||
    USDT_JETTON_ADDRESSES[TON_NETWORKS.TESTNET];

  const refreshBalance = useCallback(
    async (userAddress?: string): Promise<bigint | null> => {
      const addr = userAddress || address;
      if (!addr) {
        return null;
      }

      setIsFetching(true);
      onStatus?.("Fetching USDT balance...");

      try {
        const fetchedBalance = await fetchJettonBalance(addr, jettonMaster, network);
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
    [address, jettonMaster, network, onStatus],
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
