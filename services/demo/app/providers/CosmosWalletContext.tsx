"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { CosmosWalletContext } from "@/hooks/useCosmosPayment";

// Noble Grand testnet chain info for Keplr
const NOBLE_TESTNET_CHAIN_ID = "grand-1";
const NOBLE_TESTNET_RPC = "https://rpc.testnet.noble.strange.love";
const NOBLE_TESTNET_REST = "https://api.testnet.noble.strange.love";

const NOBLE_TESTNET_CHAIN_INFO = {
  chainId: NOBLE_TESTNET_CHAIN_ID,
  chainName: "Noble Testnet",
  rpc: NOBLE_TESTNET_RPC,
  rest: NOBLE_TESTNET_REST,
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
    { coinDenom: "USDC", coinMinimalDenom: "uusdc", coinDecimals: 6 },
  ],
  feeCurrencies: [
    {
      coinDenom: "USDC",
      coinMinimalDenom: "uusdc",
      coinDecimals: 6,
      gasPriceStep: { low: 0.01, average: 0.025, high: 0.04 },
    },
  ],
  stakeCurrency: {
    coinDenom: "STAKE",
    coinMinimalDenom: "ustake",
    coinDecimals: 6,
  },
};

// Keplr window interface (minimal)
interface KeplrWindow {
  experimentalSuggestChain: (chainInfo: unknown) => Promise<void>;
  enable: (chainId: string) => Promise<void>;
  getOfflineSigner: (chainId: string) => {
    getAccounts: () => Promise<Array<{ address: string; pubkey: Uint8Array }>>;
  };
  getKey: (chainId: string) => Promise<{ bech32Address: string; name: string }>;
}

function getKeplr(): KeplrWindow | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as Record<string, unknown>).keplr as KeplrWindow | null;
}

/**
 * Cosmos Wallet Context provider using Keplr.
 * Uses lightweight window.keplr detection without heavy SDK dependencies.
 */
export default function CosmosWalletContextProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const keplr = getKeplr();
        if (!keplr) {
          setIsLoading(false);
          return;
        }

        // Try to get the key without enabling (checks if already connected)
        try {
          const key = await keplr.getKey(NOBLE_TESTNET_CHAIN_ID);
          if (key?.bech32Address) {
            setAddress(key.bech32Address);
          }
        } catch {
          // Not connected yet, that's fine
        }
      } catch (error) {
        console.error("Failed to check Keplr connection:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkExisting();

    // Listen for Keplr account changes
    const handleAccountChange = () => {
      checkExisting();
    };
    window.addEventListener("keplr_keystorechange", handleAccountChange);
    return () => window.removeEventListener("keplr_keystorechange", handleAccountChange);
  }, []);

  const connect = useCallback(async () => {
    const keplr = getKeplr();
    if (!keplr) {
      window.open("https://www.keplr.app/", "_blank");
      return;
    }

    try {
      // Suggest the Noble testnet chain to Keplr
      await keplr.experimentalSuggestChain(NOBLE_TESTNET_CHAIN_INFO);

      // Enable the chain
      await keplr.enable(NOBLE_TESTNET_CHAIN_ID);

      // Get the account address
      const key = await keplr.getKey(NOBLE_TESTNET_CHAIN_ID);
      setAddress(key.bech32Address);
    } catch (error) {
      console.error("Failed to connect Keplr:", error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(async () => {
    setAddress(null);
  }, []);

  const sendTokens = useCallback(
    async (
      _contractAddress: string,
      recipient: string,
      amount: string,
      denom: string
    ): Promise<string> => {
      const keplr = getKeplr();
      if (!keplr || !address) {
        throw new Error("Keplr wallet not initialized");
      }

      // Get the offline signer for signing transactions
      const offlineSigner = keplr.getOfflineSigner(NOBLE_TESTNET_CHAIN_ID);
      const accounts = await offlineSigner.getAccounts();
      if (accounts.length === 0) {
        throw new Error("No accounts found in Keplr");
      }

      // Build and broadcast a MsgSend transaction using the REST API
      // This avoids importing cosmjs (~200KB+)
      const msg = {
        "@type": "/cosmos.bank.v1beta1.MsgSend",
        from_address: address,
        to_address: recipient,
        amount: [{ denom, amount }],
      };

      const fee = {
        amount: [{ denom: "uusdc", amount: "5000" }],
        gas: "200000",
      };

      // Use Keplr's signDirect or amino signing via the REST broadcast endpoint
      // For simplicity in the demo, we use the amino signer approach
      const { SigningStargateClient } = await import("@cosmjs/stargate");

      const client = await SigningStargateClient.connectWithSigner(
        NOBLE_TESTNET_RPC,
        offlineSigner as unknown as Parameters<typeof SigningStargateClient.connectWithSigner>[1]
      );

      const result = await client.sendTokens(
        address,
        recipient,
        [{ denom, amount }],
        fee,
        "T402 payment"
      );

      client.disconnect();

      return result.transactionHash;
    },
    [address]
  );

  return (
    <CosmosWalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isLoading,
        connect,
        disconnect,
        sendTokens,
      }}
    >
      {children}
    </CosmosWalletContext.Provider>
  );
}
