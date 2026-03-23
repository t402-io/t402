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

// Parse "ST1PQHQKV0...token-susdc" into [address, contractName]
function parseContractId(asset: string): { address: string; contractName: string } {
  const dotIndex = asset.indexOf(".");
  if (dotIndex === -1) return { address: asset, contractName: "token-susdc" };
  return { address: asset.slice(0, dotIndex), contractName: asset.slice(dotIndex + 1) };
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

      const { address: deployer, contractName } = parseContractId(requirements.asset);
      const amount = BigInt(requirements.amount);

      // SIP-010 transfer(amount, sender, recipient)
      // Stacks is pre-broadcast — Hiro Wallet broadcasts the tx
      return new Promise<PaymentPayload>((resolve, reject) => {
        openContractCall({
          contractAddress: deployer,
          contractName,
          functionName: "transfer",
          functionArgs: [
            uintCV(amount),
            standardPrincipalCV(address),
            standardPrincipalCV(requirements.payTo),
          ],
          network: STACKS_TESTNET,
          onFinish: (data) => {
            // Build payload matching ExactDirectStacksPayload
            resolve({
              t402Version: 2,
              scheme: requirements.scheme,
              network: requirements.network,
              payload: {
                txId: data.txId,
                from: address,
                to: requirements.payTo,
                amount: requirements.amount,
                contractAddress: requirements.asset, // Full "principal.contract-name"
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
