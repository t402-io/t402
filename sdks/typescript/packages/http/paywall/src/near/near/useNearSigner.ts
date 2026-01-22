import { useMemo } from "react";
import type { NearAccount, NearNetwork } from "./types";
import { getUsdcContractAddress, buildFtTransferAction } from "./rpc";
import type { NearWalletId } from "./useNearWallet";

/**
 * NEAR client signer interface
 */
export interface ClientNearSigner {
  /** Account ID */
  readonly accountId: string;
  /** Sign and broadcast a USDC transfer */
  signAndBroadcastTransfer(params: {
    recipient: string;
    amount: bigint;
    memo?: string;
  }): Promise<string>;
}

/**
 * Hook to create a NEAR signer from connected wallet
 */
export function useNearSigner(
  account: NearAccount | null,
  walletId: NearWalletId | null,
  network: NearNetwork,
): ClientNearSigner | null {
  return useMemo(() => {
    if (!account || !walletId) {
      return null;
    }

    const usdcContract = getUsdcContractAddress(network);

    const signer: ClientNearSigner = {
      get accountId() {
        return account.accountId;
      },

      async signAndBroadcastTransfer(params) {
        const action = buildFtTransferAction(params.recipient, params.amount, params.memo);

        let result: { transaction: { hash: string } };

        if (walletId === "mynearwallet") {
          if (!window.near) {
            throw new Error("MyNearWallet not available");
          }

          result = await window.near.signAndSendTransaction({
            receiverId: usdcContract,
            actions: [action],
          });
        } else if (walletId === "meteor") {
          if (!window.meteorWallet) {
            throw new Error("Meteor wallet not available");
          }

          result = await window.meteorWallet.signAndSendTransaction({
            receiverId: usdcContract,
            actions: [action],
          });
        } else {
          throw new Error(`Unknown wallet: ${walletId}`);
        }

        return result.transaction.hash;
      },
    };

    return signer;
  }, [account, walletId, network]);
}
