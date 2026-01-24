"use client";

import { useState, useCallback, useEffect } from "react";

interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

interface PaymentPayload {
  t402Version: number;
  scheme: string;
  network: string;
  payload: Record<string, unknown>;
}

// TronWeb type declarations for the injected window.tronWeb
interface TronWeb {
  ready: boolean;
  defaultAddress: { base58: string; hex: string };
  trx: {
    sign: (transaction: unknown) => Promise<{ signature: string; txID: string; raw_data: unknown }>;
  };
  transactionBuilder: {
    triggerSmartContract: (
      contractAddress: string,
      functionSelector: string,
      options: { feeLimit?: number; callValue?: number },
      parameter: { type: string; value: unknown }[],
      issuerAddress: string
    ) => Promise<{ result: { result: boolean }; transaction: unknown }>;
  };
}

declare global {
  interface Window {
    tronWeb?: TronWeb;
    tronLink?: { ready: boolean; request: (args: { method: string }) => Promise<unknown> };
  }
}

export function useTronPayment() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect TronLink installation and connection state
  useEffect(() => {
    const checkTronLink = () => {
      if (typeof window === "undefined") return;

      const tronWeb = window.tronWeb;
      if (tronWeb && tronWeb.ready) {
        setIsInstalled(true);
        setIsConnected(true);
        setAddress(tronWeb.defaultAddress.base58);
      } else if (window.tronLink) {
        setIsInstalled(true);
        setIsConnected(false);
        setAddress(null);
      }
    };

    // TronLink may inject after page load
    checkTronLink();
    const timer = setTimeout(checkTronLink, 1000);

    // Listen for TronLink events
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.message?.action === "setAccount") {
        checkTronLink();
      }
      if (e.data?.message?.action === "setNode") {
        checkTronLink();
      }
    };
    window.addEventListener("message", handleMessage);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const connect = useCallback(async () => {
    if (!window.tronLink) {
      window.open("https://www.tronlink.org/", "_blank");
      return;
    }
    try {
      await window.tronLink.request({ method: "tron_requestAccounts" });
      // Wait for TronLink to update
      await new Promise((r) => setTimeout(r, 500));
      if (window.tronWeb?.ready) {
        setIsConnected(true);
        setAddress(window.tronWeb.defaultAddress.base58);
      }
    } catch {
      // User rejected
    }
  }, []);

  const disconnect = useCallback(async () => {
    setIsConnected(false);
    setAddress(null);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      const tronWeb = window.tronWeb;
      if (!tronWeb || !tronWeb.ready || !address) {
        throw new Error("TronLink wallet not connected");
      }

      // Build TRC-20 transfer transaction
      // transfer(address _to, uint256 _value)
      const parameter = [
        { type: "address", value: requirements.payTo },
        { type: "uint256", value: requirements.amount },
      ];

      const { transaction } = await tronWeb.transactionBuilder.triggerSmartContract(
        requirements.asset,
        "transfer(address,uint256)",
        { feeLimit: 100_000_000 }, // 100 TRX fee limit
        parameter,
        address
      );

      // Sign the transaction
      const signedTx = await tronWeb.trx.sign(transaction);

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        payload: {
          transaction: signedTx,
          from: address,
          to: requirements.payTo,
          value: requirements.amount,
          txID: (signedTx as { txID?: string }).txID || "",
        },
      };
    },
    [address]
  );

  return {
    address,
    isConnected,
    isInstalled,
    signPayment,
    connect,
    disconnect,
  };
}
