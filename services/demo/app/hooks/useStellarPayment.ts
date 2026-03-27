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
  accepted?: { scheme: string; network: string };
  payload: Record<string, unknown>;
}

declare global {
  interface Window {
    freighterApi?: {
      isConnected: () => Promise<boolean>;
      requestAccess: () => Promise<string>;
      getPublicKey: () => Promise<string>;
      signTransaction: (xdr: string, opts?: { networkPassphrase?: string }) => Promise<string>;
      getNetwork: () => Promise<string>;
    };
  }
}

export function useStellarPayment() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  // Check for Freighter wallet
  useEffect(() => {
    const check = () => {
      const available = typeof window !== "undefined" && !!window.freighterApi;
      setHasWallet(available);
      if (available) {
        window.freighterApi!.isConnected().then((connected: boolean) => {
          if (connected) {
            window.freighterApi!.getPublicKey().then((key: string) => {
              setAddress(key);
              setIsConnected(true);
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    };
    // Freighter injects asynchronously
    if (typeof window !== "undefined") {
      check();
      const timer = setTimeout(check, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const connect = useCallback(async () => {
    if (!window.freighterApi) {
      throw new Error("Freighter wallet not found. Install it from freighter.app");
    }
    const publicKey = await window.freighterApi.requestAccess();
    setAddress(publicKey);
    setIsConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setIsConnected(false);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address) throw new Error("Stellar wallet not connected");

      // For Stellar exact-direct scheme, the client signs a pre-built transaction.
      // In demo mode, we just create a mock payload.
      // In real mode, we would build a Soroban transfer transaction and sign it.

      // Build a mock authorization for the demo
      // (Full Stellar Soroban signing requires @stellar/stellar-sdk)
      const now = Math.floor(Date.now() / 1000);
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, "0")
      ).join("");

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        accepted: { scheme: requirements.scheme, network: requirements.network },
        payload: {
          authorization: {
            from: address,
            to: requirements.payTo,
            value: requirements.amount,
            asset: requirements.asset,
            validAfter: now - 600,
            validBefore: now + requirements.maxTimeoutSeconds,
            nonce,
          },
          // In production, this would be the signed Soroban transaction XDR
          signature: `stellar_sig_${nonce.slice(0, 16)}`,
        },
      };
    },
    [address]
  );

  return { address, isConnected, hasWallet, connect, disconnect, signPayment };
}
