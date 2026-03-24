"use client";

import { useCallback, useContext, createContext } from "react";

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

// TON Wallet Context — populated by TonConnectProvider, safe to use without provider
interface TonWalletContextType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tonConnectUI: any;
  rawAddress: string | null;
  friendlyAddress: string | null;
}

export const TonWalletContext = createContext<TonWalletContextType>({
  tonConnectUI: null,
  rawAddress: null,
  friendlyAddress: null,
});

/**
 * Convert TON user-friendly address (EQ.../kQ.../UQ...) to raw format (0:hex).
 * TonConnect sendTransaction requires raw format addresses.
 */
function toRawAddress(friendlyAddr: string): string {
  // If already raw format, return as-is
  if (friendlyAddr.includes(":")) return friendlyAddr;

  // Decode base64url
  let base64 = friendlyAddr.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // bytes[0] = flags, bytes[1] = workchain (0 or -1), bytes[2..33] = hash
  const workchain = bytes[1] === 0xff ? -1 : bytes[1];
  const hash = Array.from(bytes.slice(2, 34)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${workchain}:${hash}`;
}

// Build a Jetton transfer message body cell (simplified for demo)
// In production, use @t402/ton which handles full BOC construction
function buildJettonTransferBody(params: {
  queryId: bigint;
  amount: bigint;
  destination: string;
  responseDestination: string;
}): string {
  // Jetton transfer opcode: 0x0f8a7ea5
  // This is a simplified hex representation for the demo
  // Real implementation uses @ton/core Cell builder
  const opcode = "0f8a7ea5";
  const queryId = params.queryId.toString(16).padStart(16, "0");
  const amount = params.amount.toString(16).padStart(32, "0");
  return `${opcode}${queryId}${amount}`;
}

export function useTonPayment() {
  const { tonConnectUI, rawAddress, friendlyAddress } = useContext(TonWalletContext);

  const isConnected = !!rawAddress;

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!rawAddress || !tonConnectUI) {
        throw new Error("TON wallet not connected");
      }

      const queryId = BigInt(Date.now());
      const amount = BigInt(requirements.amount);

      // Build the jetton transfer payload
      const body = buildJettonTransferBody({
        queryId,
        amount,
        destination: requirements.payTo,
        responseDestination: rawAddress,
      });

      // Send transaction via TonConnect
      // This signs and broadcasts the jetton transfer
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
        messages: [
          {
            address: requirements.asset, // User-friendly format (EQ.../kQ...) required by TonConnect
            amount: "50000000", // 0.05 TON for gas
            payload: body,
          },
        ],
      });

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        accepted: { scheme: requirements.scheme, network: requirements.network },
        payload: {
          signedBoc: result.boc,
          authorization: {
            from: rawAddress,
            to: requirements.payTo,
            jettonMaster: requirements.asset,
            jettonAmount: requirements.amount,
            tonAmount: "50000000",
            validUntil: Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
            seqno: 0,
            queryId: "0",
          },
        },
      };
    },
    [rawAddress, tonConnectUI]
  );

  const connect = useCallback(async () => {
    if (tonConnectUI) await tonConnectUI.openModal();
  }, [tonConnectUI]);

  const disconnect = useCallback(async () => {
    if (tonConnectUI) await tonConnectUI.disconnect();
  }, [tonConnectUI]);

  return {
    address: friendlyAddress || null,
    rawAddress: rawAddress || null,
    isConnected,
    signPayment,
    connect,
    disconnect,
  };
}
