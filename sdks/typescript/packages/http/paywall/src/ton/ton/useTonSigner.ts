import { useMemo } from "react";
import { Address, beginCell, Cell, internal } from "@ton/core";
import { getTonClient } from "./rpc";
import type { TonNetwork } from "./types";

// TODO: Verify @ton/appkit transaction sending API once published.
// This adapter maintains compatibility with both @ton/appkit and @tonconnect/ui-react.

/**
 * Wallet type (compatible with both @ton/appkit and @tonconnect/ui-react)
 */
type WalletLike = {
  account?: {
    address: string;
    chain?: string;
  };
};

/**
 * UI instance type (compatible with both providers)
 */
type UILike = {
  sendTransaction: (request: {
    validUntil: number;
    messages: Array<{
      address: string;
      amount: string;
      payload?: string;
    }>;
  }) => Promise<{ boc: string }>;
};

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
 * Load the UI provider dynamically.
 * Tries @ton/appkit first, falls back to @tonconnect/ui-react.
 */
async function loadUI(): Promise<{
  useUI: () => [UILike];
}> {
  // TODO: Update import path once @ton/appkit is published
  try {
    const appkit = await import("@ton/appkit" as string);
    return {
      useUI: appkit.useTonConnectUI ?? appkit.useAppKit,
    };
  } catch {
    const tonconnect = await import("@tonconnect/ui-react");
    return {
      useUI: tonconnect.useTonConnectUI as unknown as () => [UILike],
    };
  }
}

// Cached provider
let uiProviderPromise: ReturnType<typeof loadUI> | null = null;

function getUIProvider() {
  if (!uiProviderPromise) {
    uiProviderPromise = loadUI();
  }
  return uiProviderPromise;
}

/**
 * Creates a ClientTonSigner adapter for the wallet provider
 *
 * This adapter bridges the wallet provider's sendTransaction API to the
 * ClientTonSigner interface required by @t402/ton. The provider will
 * sign and broadcast the transaction, returning the signed BOC.
 *
 * @param uiInstance - Wallet UI instance (from @ton/appkit or @tonconnect/ui-react)
 * @param wallet - Connected wallet
 * @param network - Target TON network
 * @returns ClientTonSigner implementation
 */
export function createTonConnectSigner(
  uiInstance: UILike,
  wallet: WalletLike,
  network: TonNetwork,
): ClientTonSigner {
  const walletAddress = Address.parse(wallet.account!.address);
  const client = getTonClient(network);

  return {
    get address(): Address {
      return walletAddress;
    },

    async getSeqno(): Promise<number> {
      try {
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

      // Create transaction request (compatible with both providers)
      const validUntil = Math.floor(Date.now() / 1000) + timeout;

      const transaction = {
        validUntil,
        messages: [
          {
            address: to.toString(),
            amount: value.toString(),
            payload: body.toBoc().toString("base64"),
          },
        ],
      };

      // Both @ton/appkit and @tonconnect/ui-react use sendTransaction
      const result = await uiInstance.sendTransaction(transaction);

      // Parse the signed BOC from result
      const signedBoc = Buffer.from(result.boc, "base64");
      const signedCell = Cell.fromBoc(signedBoc)[0];

      return signedCell;
    },
  };
}

/**
 * Hook for creating a wallet-provider-based ClientTonSigner
 *
 * Supports both @ton/appkit and @tonconnect/ui-react.
 *
 * @param wallet - Connected wallet (from either provider)
 * @param network - Target TON network
 * @returns ClientTonSigner or null if not connected
 */
export function useTonSigner(
  wallet: WalletLike | null,
  network: TonNetwork,
): ClientTonSigner | null {
  // TODO: Once @ton/appkit is published, this hook should use
  // the appkit's native hooks if available, with tonconnect fallback.

  return useMemo(() => {
    if (!wallet || !wallet.account) {
      return null;
    }

    // We need to get the UI instance synchronously for the memo.
    // Use a lazy-loaded reference that resolves on first use.
    let cachedUI: UILike | null = null;

    const lazyUI: UILike = {
      sendTransaction: async request => {
        if (!cachedUI) {
          const provider = await getUIProvider();
          const [ui] = provider.useUI();
          cachedUI = ui;
        }
        return cachedUI.sendTransaction(request);
      },
    };

    return createTonConnectSigner(lazyUI, wallet, network);
  }, [wallet, network]);
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
