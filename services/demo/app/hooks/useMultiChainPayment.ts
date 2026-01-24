"use client";

import { useCallback } from "react";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useEvmPayment } from "./useEvmPayment";
import { useTonPayment } from "./useTonPayment";
import { useSolanaPayment } from "./useSolanaPayment";
import { useTronPayment } from "./useTronPayment";
import { useStacksPayment } from "./useStacksPayment";
import type { ChainFamily } from "@/lib/testnet-config";

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

function createMockPayload(requirements: PaymentRequirements, family: ChainFamily): PaymentPayload {
  const mockAddress = family === "evm"
    ? "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68"
    : family === "ton"
    ? "EQAbcdef1234567890abcdef1234567890abcdef12345"
    : family === "tron"
    ? "TAbcdefghijk1234567890abcdefghijk"
    : family === "solana"
    ? "7nYBs9EwPjhpBZNPDnqWrRcU9d1Q9jK5xN3xH8r4gVMp"
    : "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

  return {
    t402Version: 2,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: {
      authorization: {
        from: mockAddress,
        to: requirements.payTo,
        value: requirements.amount,
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 60,
        nonce: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
      },
      signature: "0x" + Array(130).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
    },
  };
}

export function useMultiChainPayment() {
  const { activeFamily, activeConfig } = useChainContext();
  const { isDemo } = useDemoContext();
  const evm = useEvmPayment();
  const ton = useTonPayment();
  const solana = useSolanaPayment();
  const tron = useTronPayment();
  const stacks = useStacksPayment();

  const isConnected =
    activeFamily === "evm" ? evm.isConnected :
    activeFamily === "ton" ? ton.isConnected :
    activeFamily === "solana" ? solana.isConnected :
    activeFamily === "tron" ? tron.isConnected :
    activeFamily === "stacks" ? stacks.isConnected :
    false;

  const address =
    activeFamily === "evm" ? evm.address :
    activeFamily === "ton" ? ton.address :
    activeFamily === "solana" ? solana.address :
    activeFamily === "tron" ? tron.address :
    activeFamily === "stacks" ? stacks.address :
    null;

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 600));
        return createMockPayload(requirements, activeFamily);
      }

      switch (activeFamily) {
        case "evm":
          return evm.signPayment(requirements) as Promise<PaymentPayload>;
        case "ton":
          return ton.signPayment(requirements) as Promise<PaymentPayload>;
        case "solana":
          return solana.signPayment(requirements) as Promise<PaymentPayload>;
        case "tron":
          return tron.signPayment(requirements) as Promise<PaymentPayload>;
        case "stacks":
          return stacks.signPayment(requirements) as Promise<PaymentPayload>;
        default:
          throw new Error(`Unsupported chain: ${activeFamily}`);
      }
    },
    [activeFamily, isDemo, evm, ton, solana, tron, stacks]
  );

  return {
    activeFamily,
    activeConfig,
    isConnected: isDemo || isConnected,
    address: isDemo ? "demo-wallet" : address,
    signPayment,
  };
}
