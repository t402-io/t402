"use client";

import { useState, useCallback } from "react";
import { AppConfig, UserSession, showConnect, openContractCall } from "@stacks/connect";
import { uintCV, standardPrincipalCV } from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";

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

const appConfig = new AppConfig(["store_write"]);
const userSession = new UserSession({ appConfig });

// Parse a Stacks contract address into [address, contractName]
function parseContractId(asset: string): { address: string; contractName: string } {
  // Format: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-usdt"
  const parts = asset.split(".");
  return { address: parts[0], contractName: parts[1] || "token-usdt" };
}

export function useStacksPayment() {
  const [address, setAddress] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      return userData.profile?.stxAddress?.testnet || null;
    }
    return null;
  });

  const isConnected = !!address;

  const connect = useCallback(async () => {
    return new Promise<void>((resolve) => {
      showConnect({
        appDetails: {
          name: "T402 Demo",
          icon: "https://demo.t402.io/icon.svg",
        },
        onFinish: () => {
          if (userSession.isUserSignedIn()) {
            const userData = userSession.loadUserData();
            setAddress(userData.profile?.stxAddress?.testnet || null);
          }
          resolve();
        },
        onCancel: () => resolve(),
        userSession,
      });
    });
  }, []);

  const disconnect = useCallback(async () => {
    userSession.signUserOut();
    setAddress(null);
  }, []);

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!address) {
        throw new Error("Stacks wallet not connected");
      }

      const { address: contractAddress, contractName } = parseContractId(requirements.asset);
      const amount = BigInt(requirements.amount);

      // Use openContractCall which opens Hiro Wallet popup for signing
      return new Promise<PaymentPayload>((resolve, reject) => {
        openContractCall({
          contractAddress,
          contractName,
          functionName: "transfer",
          functionArgs: [
            uintCV(amount),
            standardPrincipalCV(address),
            standardPrincipalCV(requirements.payTo),
          ],
          network: STACKS_TESTNET,
          onFinish: (data) => {
            resolve({
              t402Version: 2,
              scheme: requirements.scheme,
              network: requirements.network,
              payload: {
                txId: data.txId,
                from: address,
                to: requirements.payTo,
                value: requirements.amount,
                contractAddress,
                contractName,
              },
            });
          },
          onCancel: () => {
            reject(new Error("Transaction cancelled by user"));
          },
        });
      });
    },
    [address]
  );

  return {
    address,
    isConnected,
    signPayment,
    connect,
    disconnect,
  };
}
