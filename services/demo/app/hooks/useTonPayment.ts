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

// TON Wallet Context — populated by TonConnectProvider
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
 * Build Jetton transfer body using @ton/core (same approach as scan2pay).
 */
async function buildJettonTransferCell(params: {
  amount: bigint;
  destination: string; // payTo address
  responseDestination: string; // sender's address for excess
}): Promise<string> {
  // Dynamic import to keep @ton/core out of initial bundle
  const { beginCell, Address, toNano } = await import("@ton/core");

  const JETTON_TRANSFER_OP = 0xf8a7ea5;

  const body = beginCell()
    .storeUint(JETTON_TRANSFER_OP, 32)  // op: jetton_transfer
    .storeUint(0, 64)                    // query_id
    .storeCoins(params.amount)           // amount in smallest units
    .storeAddress(Address.parse(params.destination))     // destination
    .storeAddress(Address.parse(params.responseDestination)) // response_destination
    .storeBit(false)                     // no custom_payload
    .storeCoins(toNano("0.05"))          // forward_ton_amount
    .storeBit(false)                     // no forward_payload
    .endCell();

  return body.toBoc().toString("base64");
}

/**
 * Get user's Jetton wallet address by calling get_wallet_address on the Jetton master.
 */
async function getJettonWalletAddress(jettonMaster: string, ownerAddress: string): Promise<string> {
  const { TonClient } = await import("@ton/ton");
  const { Address, beginCell } = await import("@ton/core");

  const client = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
  });

  const masterAddr = Address.parse(jettonMaster);
  const ownerAddr = Address.parse(ownerAddress);

  const result = await client.runMethod(masterAddr, "get_wallet_address", [
    { type: "slice", cell: beginCell().storeAddress(ownerAddr).endCell() },
  ]);

  const walletAddress = result.stack.readAddress();
  return walletAddress.toString(); // Returns user-friendly format
}

export function useTonPayment() {
  const { tonConnectUI, rawAddress, friendlyAddress } = useContext(TonWalletContext);

  const isConnected = !!rawAddress;

  const signPayment = useCallback(
    async (requirements: PaymentRequirements): Promise<PaymentPayload> => {
      if (!rawAddress || !tonConnectUI) {
        throw new Error("TON wallet not connected");
      }

      const amount = BigInt(requirements.amount);
      const senderFriendly = friendlyAddress || rawAddress;

      // Step 1: Get user's Jetton wallet address (not the master contract!)
      console.log("[TON] Getting jetton wallet for", requirements.asset, "owner", rawAddress);
      const jettonWalletAddress = await getJettonWalletAddress(requirements.asset, rawAddress);
      console.log("[TON] Jetton wallet address:", jettonWalletAddress);

      // Step 2: Build the Jetton transfer body cell
      const payloadBase64 = await buildJettonTransferCell({
        amount,
        destination: requirements.payTo,
        responseDestination: rawAddress,
      });

      // Step 3: Send transaction via TonConnect
      console.log("[TON] Sending transaction:", { address: jettonWalletAddress, payloadLen: payloadBase64.length });
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
        messages: [
          {
            address: jettonWalletAddress, // User's Jetton wallet, NOT the master
            amount: "100000000", // 0.1 TON for gas
            payload: payloadBase64,
          },
        ],
      });

      // Step 4: Compute BOC hash for tx tracking
      let bocHash = "";
      try {
        const { Cell } = await import("@ton/core");
        const cell = Cell.fromBoc(Buffer.from(result.boc, "base64"))[0];
        bocHash = cell.hash().toString("hex");
      } catch { /* ignore */ }

      return {
        t402Version: 2,
        scheme: requirements.scheme,
        network: requirements.network,
        accepted: { scheme: requirements.scheme, network: requirements.network },
        payload: {
          signedBoc: result.boc,
          bocHash,
          authorization: {
            from: senderFriendly,
            to: requirements.payTo,
            jettonMaster: requirements.asset,
            jettonAmount: requirements.amount,
            tonAmount: "100000000",
            validUntil: Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
            seqno: 0,
            queryId: "0",
          },
        },
      };
    },
    [rawAddress, friendlyAddress, tonConnectUI]
  );

  return {
    address: friendlyAddress || rawAddress,
    isConnected,
    signPayment,
    connect: useCallback(async () => {
      if (tonConnectUI) {
        await tonConnectUI.openModal();
      }
    }, [tonConnectUI]),
    disconnect: useCallback(async () => {
      if (tonConnectUI) {
        await tonConnectUI.disconnect();
      }
    }, [tonConnectUI]),
  };
}
