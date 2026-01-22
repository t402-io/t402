import { useMemo } from "react";
import { useTonConnectUI } from "@tonconnect/ui-react";
import type { Wallet, SendTransactionRequest } from "@tonconnect/ui-react";
import { Address, beginCell, Cell, internal } from "@ton/core";
import { getTonClient } from "./rpc";
import type { TonNetwork } from "./types";

/**
 * ClientTonSigner interface from @t402/ton
 * Defines the signer interface needed for creating payment payloads
 */
export interface ClientTonSigner {
  /** The wallet address */
  readonly address: Address;
  /** Sign an internal message */
  signMessage(params: SignMessageParams): Promise<Cell>;
  /** Get current seqno */
  getSeqno(): Promise<number>;
}

/**
 * Parameters for signing a TON internal message
 */
export interface SignMessageParams {
  /** Destination address */
  to: Address;
  /** Amount of TON to attach (for gas) in nanoTON */
  value: bigint;
  /** Message body */
  body: Cell;
  /** Bounce flag */
  bounce?: boolean;
  /** Message validity timeout in seconds */
  timeout?: number;
}

/**
 * Creates a ClientTonSigner adapter for TonConnect
 *
 * This adapter bridges TonConnect's sendTransaction API to the ClientTonSigner
 * interface required by @t402/ton. TonConnect's sendTransaction will sign and
 * broadcast the transaction, returning the signed BOC.
 *
 * @param tonConnectUI - TonConnect UI instance
 * @param wallet - Connected wallet
 * @param network - Target TON network
 * @returns ClientTonSigner implementation
 */
export function createTonConnectSigner(
  tonConnectUI: ReturnType<typeof useTonConnectUI>[0],
  wallet: Wallet,
  network: TonNetwork,
): ClientTonSigner {
  const walletAddress = Address.parse(wallet.account.address);
  const client = getTonClient(network);

  return {
    get address(): Address {
      return walletAddress;
    },

    async getSeqno(): Promise<number> {
      try {
        // Query seqno directly from blockchain
        const result = await client.runMethod(walletAddress, "seqno", []);
        return result.stack.readNumber();
      } catch {
        // Wallet might not be deployed yet
        return 0;
      }
    },

    async signMessage(params: SignMessageParams): Promise<Cell> {
      const { to, value, body, bounce = true, timeout = 60 } = params;

      // Build the internal message (for reference)
      internal({
        to,
        value,
        body,
        bounce,
      });

      // Create transaction request for TonConnect
      const validUntil = Math.floor(Date.now() / 1000) + timeout;

      const transaction: SendTransactionRequest = {
        validUntil,
        messages: [
          {
            address: to.toString(),
            amount: value.toString(),
            payload: body.toBoc().toString("base64"),
          },
        ],
      };

      // TonConnect will sign and return the BOC
      const result = await tonConnectUI.sendTransaction(transaction);

      // Parse the signed BOC from result
      const signedBoc = Buffer.from(result.boc, "base64");
      const signedCell = Cell.fromBoc(signedBoc)[0];

      return signedCell;
    },
  };
}

/**
 * Hook for creating a TonConnect-based ClientTonSigner
 *
 * @param wallet - Connected TonConnect wallet
 * @param network - Target TON network
 * @returns ClientTonSigner or null if not connected
 */
export function useTonSigner(wallet: Wallet | null, network: TonNetwork): ClientTonSigner | null {
  const [tonConnectUI] = useTonConnectUI();

  return useMemo(() => {
    if (!wallet) {
      return null;
    }

    return createTonConnectSigner(tonConnectUI, wallet, network);
  }, [tonConnectUI, wallet, network]);
}

/**
 * Creates a getJettonWalletAddress function for the t402 client
 *
 * @param network - TON network
 * @returns Function to get Jetton wallet address
 */
export function createGetJettonWalletAddress(
  network: TonNetwork,
): (ownerAddress: string, jettonMasterAddress: string) => Promise<string> {
  const client = getTonClient(network);

  return async (ownerAddress: string, jettonMasterAddress: string): Promise<string> => {
    const masterAddress = Address.parse(jettonMasterAddress);
    const ownerAddr = Address.parse(ownerAddress);

    const ownerSlice = beginCell().storeAddress(ownerAddr).endCell();

    const result = await client.runMethod(masterAddress, "get_wallet_address", [
      { type: "slice", cell: ownerSlice },
    ]);

    const jettonWalletAddress = result.stack.readAddress();
    return jettonWalletAddress.toString();
  };
}
