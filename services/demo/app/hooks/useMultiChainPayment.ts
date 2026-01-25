"use client";

import { useCallback } from "react";
import { useChainContext } from "@/providers/ChainProvider";
import { useDemoContext } from "@/providers/DemoProvider";
import { useEvmPayment } from "./useEvmPayment";
import { useTonPayment } from "./useTonPayment";
import { useSolanaPayment } from "./useSolanaPayment";
import { useTronPayment } from "./useTronPayment";
import { useStacksPayment } from "./useStacksPayment";
import { useNearPayment } from "./useNearPayment";
import { useAptosPayment } from "./useAptosPayment";
import { useTezosPayment } from "./useTezosPayment";
import { usePolkadotPayment } from "./usePolkadotPayment";
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
  const mockAddress = (() => {
    switch (family) {
      case "evm":
        return "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68";
      case "ton":
        return "EQAbcdef1234567890abcdef1234567890abcdef12345";
      case "tron":
        return "TAbcdefghijk1234567890abcdefghijk";
      case "solana":
        return "7nYBs9EwPjhpBZNPDnqWrRcU9d1Q9jK5xN3xH8r4gVMp";
      case "stacks":
        return "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
      case "near":
        return "demo-user.testnet";
      case "aptos":
        return "0x742d35cc6634c0532925a3b844bc9e7595f2bd68742d35cc6634c0532925a3b8";
      case "tezos":
        return "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
      case "polkadot":
        return "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
      default:
        return "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68";
    }
  })();

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
  const near = useNearPayment();
  const aptos = useAptosPayment();
  const tezos = useTezosPayment();
  const polkadot = usePolkadotPayment();

  const isConnected = (() => {
    switch (activeFamily) {
      case "evm": return evm.isConnected;
      case "ton": return ton.isConnected;
      case "solana": return solana.isConnected;
      case "tron": return tron.isConnected;
      case "stacks": return stacks.isConnected;
      case "near": return near.isConnected;
      case "aptos": return aptos.isConnected;
      case "tezos": return tezos.isConnected;
      case "polkadot": return polkadot.isConnected;
      default: return false;
    }
  })();

  const address = (() => {
    switch (activeFamily) {
      case "evm": return evm.address;
      case "ton": return ton.address;
      case "solana": return solana.address;
      case "tron": return tron.address;
      case "stacks": return stacks.address;
      case "near": return near.address;
      case "aptos": return aptos.address;
      case "tezos": return tezos.address;
      case "polkadot": return polkadot.address;
      default: return null;
    }
  })();

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
        case "near":
          return near.signPayment(requirements) as Promise<PaymentPayload>;
        case "aptos":
          return aptos.signPayment(requirements) as Promise<PaymentPayload>;
        case "tezos":
          return tezos.signPayment(requirements) as Promise<PaymentPayload>;
        case "polkadot":
          return polkadot.signPayment(requirements) as Promise<PaymentPayload>;
        default:
          throw new Error(`Unsupported chain: ${activeFamily}`);
      }
    },
    [activeFamily, isDemo, evm, ton, solana, tron, stacks, near, aptos, tezos, polkadot]
  );

  return {
    activeFamily,
    activeConfig,
    isConnected: isDemo || isConnected,
    address: isDemo ? "demo-wallet" : address,
    signPayment,
  };
}
