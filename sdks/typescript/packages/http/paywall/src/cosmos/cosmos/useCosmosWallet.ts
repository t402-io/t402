import { useState, useCallback, useEffect } from "react";
import type { CosmosAccount, CosmosNetwork, ChainInfo } from "./types";
import { COSMOS_NETWORKS, NOBLE_RPC_ENDPOINTS, NOBLE_REST_ENDPOINTS, NOBLE_CHAIN_IDS } from "./types";

export type CosmosWalletId = "keplr" | "leap";

interface UseCosmosWalletResult {
  account: CosmosAccount | null;
  walletId: CosmosWalletId | null;
  isConnecting: boolean;
  error: string | null;
  availableWallets: CosmosWalletId[];
  connect: (walletId: CosmosWalletId) => Promise<void>;
  disconnect: () => void;
}

/**
 * Get Noble chain info for wallet suggestion
 */
function getNobleChainInfo(network: CosmosNetwork): ChainInfo {
  const chainId = NOBLE_CHAIN_IDS[network];
  const isMainnet = network === COSMOS_NETWORKS.NOBLE_MAINNET;

  return {
    chainId,
    chainName: isMainnet ? "Noble" : "Noble Testnet",
    rpc: NOBLE_RPC_ENDPOINTS[network],
    rest: NOBLE_REST_ENDPOINTS[network],
    bip44: { coinType: 118 },
    bech32Config: {
      bech32PrefixAccAddr: "noble",
      bech32PrefixAccPub: "noblepub",
      bech32PrefixValAddr: "noblevaloper",
      bech32PrefixValPub: "noblevaloperpub",
      bech32PrefixConsAddr: "noblevalcons",
      bech32PrefixConsPub: "noblevalconspub",
    },
    currencies: [
      {
        coinDenom: "USDC",
        coinMinimalDenom: "uusdc",
        coinDecimals: 6,
      },
    ],
    feeCurrencies: [
      {
        coinDenom: "USDC",
        coinMinimalDenom: "uusdc",
        coinDecimals: 6,
        gasPriceStep: {
          low: 0.1,
          average: 0.25,
          high: 0.5,
        },
      },
    ],
    stakeCurrency: {
      coinDenom: "STAKE",
      coinMinimalDenom: "ustake",
      coinDecimals: 6,
    },
  };
}

/**
 * Hook to manage Cosmos wallet connection (Keplr, Leap)
 */
export function useCosmosWallet(network: CosmosNetwork): UseCosmosWalletResult {
  const [account, setAccount] = useState<CosmosAccount | null>(null);
  const [walletId, setWalletId] = useState<CosmosWalletId | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableWallets, setAvailableWallets] = useState<CosmosWalletId[]>([]);

  // Check available wallets on mount
  useEffect(() => {
    const checkWallets = () => {
      const wallets: CosmosWalletId[] = [];
      if (window.keplr) wallets.push("keplr");
      if (window.leap) wallets.push("leap");
      setAvailableWallets(wallets);
    };

    // Check immediately
    checkWallets();

    // Also check after a delay for wallets that inject slowly
    const timeout = setTimeout(checkWallets, 500);
    return () => clearTimeout(timeout);
  }, []);

  const connect = useCallback(
    async (selectedWalletId: CosmosWalletId) => {
      setIsConnecting(true);
      setError(null);

      try {
        const wallet =
          selectedWalletId === "keplr" ? window.keplr : window.leap;

        if (!wallet) {
          throw new Error(
            `${selectedWalletId === "keplr" ? "Keplr" : "Leap"} wallet not found. Please install the extension.`,
          );
        }

        const chainId = NOBLE_CHAIN_IDS[network];

        // Try to suggest the chain if not already added
        try {
          await wallet.experimentalSuggestChain(getNobleChainInfo(network));
        } catch {
          // Chain might already exist, continue
        }

        // Enable the chain
        await wallet.enable(chainId);

        // Get account
        const key = await wallet.getKey(chainId);

        setAccount({
          address: key.bech32Address,
          pubKey: Array.from(key.pubKey)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
          walletName: key.name,
        });
        setWalletId(selectedWalletId);
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

  const disconnect = useCallback(() => {
    setAccount(null);
    setWalletId(null);
    setError(null);
  }, []);

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
