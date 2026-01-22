import { useState, useCallback, useEffect } from "react";
import type { NearAccount, NearNetwork } from "./types";
import { getUsdcContractAddress } from "./rpc";

export type NearWalletId = "mynearwallet" | "meteor";

interface UseNearWalletResult {
  account: NearAccount | null;
  walletId: NearWalletId | null;
  isConnecting: boolean;
  error: string | null;
  availableWallets: NearWalletId[];
  connect: (walletId: NearWalletId) => Promise<void>;
  disconnect: () => void;
}

/**
 * Hook to manage NEAR wallet connection
 */
export function useNearWallet(network: NearNetwork): UseNearWalletResult {
  const [account, setAccount] = useState<NearAccount | null>(null);
  const [walletId, setWalletId] = useState<NearWalletId | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<NearWalletId[]>([]);

  // Check available wallets on mount
  useEffect(() => {
    const checkWallets = () => {
      const wallets: NearWalletId[] = [];

      // Check for MyNearWallet (injected as window.near)
      if (window.near) {
        wallets.push("mynearwallet");
      }

      // Check for Meteor wallet
      if (window.meteorWallet) {
        wallets.push("meteor");
      }

      // If no wallets detected, still show MyNearWallet as it uses redirect flow
      if (wallets.length === 0) {
        wallets.push("mynearwallet");
      }

      setAvailableWallets(wallets);
    };

    // Check immediately
    checkWallets();

    // Also check after a delay for wallets that inject slowly
    const timeout = setTimeout(checkWallets, 500);
    return () => clearTimeout(timeout);
  }, []);

  // Check if already signed in on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      // Check MyNearWallet
      if (window.near?.isSignedIn()) {
        const accountId = window.near.getAccountId();
        setAccount({
          accountId,
          walletName: "MyNearWallet",
        });
        setWalletId("mynearwallet");
        return;
      }

      // Check Meteor
      if (window.meteorWallet) {
        try {
          const isSignedIn = await window.meteorWallet.isSignedIn();
          if (isSignedIn) {
            const accountId = await window.meteorWallet.getAccountId();
            setAccount({
              accountId,
              walletName: "Meteor",
            });
            setWalletId("meteor");
          }
        } catch {
          // Not signed in
        }
      }
    };

    checkExistingConnection();
  }, []);

  const connect = useCallback(
    async (selectedWalletId: NearWalletId) => {
      setIsConnecting(true);
      setError(null);

      try {
        const usdcContract = getUsdcContractAddress(network);

        if (selectedWalletId === "mynearwallet") {
          if (window.near) {
            // Use injected wallet
            await window.near.requestSignIn({
              contractId: usdcContract,
              methodNames: ["ft_transfer"],
            });

            if (window.near.isSignedIn()) {
              const accountId = window.near.getAccountId();
              setAccount({
                accountId,
                walletName: "MyNearWallet",
              });
              setWalletId("mynearwallet");
            }
          } else {
            // Redirect to MyNearWallet
            const currentUrl = window.location.href;
            const networkId = network === "near:mainnet" ? "mainnet" : "testnet";
            const walletUrl =
              networkId === "mainnet"
                ? "https://app.mynearwallet.com"
                : "https://testnet.mynearwallet.com";

            const loginUrl = new URL(`${walletUrl}/login`);
            loginUrl.searchParams.set("referrer", "T402 Payment");
            loginUrl.searchParams.set("success_url", currentUrl);
            loginUrl.searchParams.set("failure_url", currentUrl);
            loginUrl.searchParams.set("contract_id", usdcContract);

            window.location.href = loginUrl.toString();
            return;
          }
        } else if (selectedWalletId === "meteor") {
          if (!window.meteorWallet) {
            throw new Error("Meteor wallet not found. Please install the extension.");
          }

          const result = await window.meteorWallet.signIn();
          setAccount({
            accountId: result.accountId,
            walletName: "Meteor",
          });
          setWalletId("meteor");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to connect wallet";
        setError(message);
        console.error("Wallet connection error:", err);
      } finally {
        setIsConnecting(false);
      }
    },
    [network],
  );

  const disconnect = useCallback(async () => {
    try {
      if (walletId === "mynearwallet" && window.near) {
        await window.near.signOut();
      } else if (walletId === "meteor" && window.meteorWallet) {
        await window.meteorWallet.signOut();
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }

    setAccount(null);
    setWalletId(null);
    setError(null);
  }, [walletId]);

  return {
    account,
    walletId,
    isConnecting,
    error,
    availableWallets,
    connect,
    disconnect,
  };
}
