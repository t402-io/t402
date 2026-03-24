"use client";

import { useState, useCallback, useEffect } from "react";

interface PaymentRequirements {
  scheme: string;
  network: string;
  accepted?: { scheme: string; network: string };
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

interface TronAuthorization {
  from: string;
  to: string;
  contractAddress: string;
  amount: string;
  expiration: number;
  refBlockBytes: string;
  refBlockHash: string;
  timestamp: number;
}

// TronWeb type declarations for the injected window.tronWeb
interface TronTransaction {
  txID: string;
  raw_data: {
    ref_block_bytes: string;
    ref_block_hash: string;
    expiration: number;
    timestamp: number;
    contract: unknown[];
  };
  raw_data_hex: string;
  signature?: string[];
  visible?: boolean;
}

interface TronWeb {
  ready: boolean;
  defaultAddress: { base58: string; hex: string };
  trx: {
    sign: (transaction: TronTransaction) => Promise<TronTransaction>;
    sendRawTransaction: (signedTx: TronTransaction) => Promise<{ result: boolean; txid: string }>;
  };
  transactionBuilder: {
    triggerSmartContract: (
      contractAddress: string,
      functionSelector: string,
      options: { feeLimit?: number; callValue?: number },
      parameter: { type: string; value: unknown }[],
      issuerAddress: string
    ) => Promise<{ result: { result: boolean }; transaction: TronTransaction }>;
  };
}

declare global {
  interface Window {
    tronWeb?: TronWeb;
    tronLink?: { ready: boolean; request: (args: { method: string }) => Promise<unknown> };
    okxwallet?: { tronLink?: { ready: boolean; tronWeb?: TronWeb; request?: (args: { method: string }) => Promise<unknown> } };
  }
}

export function useTronPayment() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect TronLink or OKX Wallet TRON support
  useEffect(() => {
    const checkTronLink = () => {
      if (typeof window === "undefined") return;

      // OKX Wallet injects tronWeb via window.okxwallet.tronLink
      const okxTron = window.okxwallet?.tronLink;
      if (okxTron?.tronWeb && okxTron.tronWeb.ready) {
        // Promote OKX's tronWeb to window.tronWeb so signPayment works
        if (!window.tronWeb) (window as any).tronWeb = okxTron.tronWeb;
        setIsInstalled(true);
        setIsConnected(true);
        setAddress(okxTron.tronWeb.defaultAddress.base58);
        return;
      }

      const tronWeb = window.tronWeb;
      if (tronWeb && tronWeb.ready) {
        setIsInstalled(true);
        setIsConnected(true);
        setAddress(tronWeb.defaultAddress.base58);
      } else if (window.tronLink || okxTron) {
        setIsInstalled(true);
        setIsConnected(false);
        setAddress(null);
      }
    };

    // Wallet extensions may inject after page load
    checkTronLink();
    const timer = setTimeout(checkTronLink, 1000);
    const timer2 = setTimeout(checkTronLink, 3000); // OKX may be slower

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
      clearTimeout(timer2);
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const connect = useCallback(async () => {
    // Try OKX Wallet TRON first
    const okxTron = window.okxwallet?.tronLink;
    if (okxTron?.request) {
      try {
        await okxTron.request({ method: "tron_requestAccounts" });
        await new Promise((r) => setTimeout(r, 1000));
        const tw = okxTron.tronWeb || window.tronWeb;
        if (tw?.ready) {
          if (!window.tronWeb) (window as any).tronWeb = tw;
          setIsInstalled(true);
          setIsConnected(true);
          setAddress(tw.defaultAddress.base58);
          return;
        }
      } catch { /* user rejected or not available */ }
    }

    // Try TronLink
    if (window.tronLink) {
      try {
        await window.tronLink.request({ method: "tron_requestAccounts" });
        await new Promise((r) => setTimeout(r, 500));
        if (window.tronWeb?.ready) {
          setIsConnected(true);
          setAddress(window.tronWeb.defaultAddress.base58);
          return;
        }
      } catch { /* user rejected */ }
    }

    // No TRON wallet found
    window.open("https://www.tronlink.org/", "_blank");
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

      // 1. Build TRC-20 transfer(address _to, uint256 _value)
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

      // 2. Sign the transaction
      const signedTx = await tronWeb.trx.sign(transaction);

      // 3. Broadcast (TRON is pre-broadcast — wallet sends tx before facilitator sees it)
      await tronWeb.trx.sendRawTransaction(signedTx);

      // 4. Extract block info from the signed transaction's raw_data
      const authorization: TronAuthorization = {
        from: address,
        to: requirements.payTo,
        contractAddress: requirements.asset,
        amount: requirements.amount,
        expiration: signedTx.raw_data.expiration,
        refBlockBytes: signedTx.raw_data.ref_block_bytes,
        refBlockHash: signedTx.raw_data.ref_block_hash,
        timestamp: signedTx.raw_data.timestamp,
      };

      // 5. Build payload matching ExactTronPayloadV2
      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        accepted: { scheme: requirements.scheme, network: requirements.network },
        payload: {
          signedTransaction: signedTx.raw_data_hex,
          authorization,
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
