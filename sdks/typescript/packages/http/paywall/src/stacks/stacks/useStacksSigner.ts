import { useMemo } from "react";
import type { StacksAccount, StacksNetwork } from "./types";
import { STACKS_NETWORKS } from "./types";
import { getUsdcContractAddress, parseContractId, fetchAccountInfo } from "./rpc";

/**
 * Stacks client signer interface compatible with @t402/stacks (future)
 * For now, this provides the basic signing capability
 */
export interface ClientStacksSigner {
  /** Stacks address */
  readonly address: string;
  /** Public key if available */
  readonly publicKey?: string;
  /** Sign a SIP-010 token transfer */
  signTokenTransfer(params: {
    recipient: string;
    amount: bigint;
    tokenContract: string;
    memo?: string;
  }): Promise<string>;
  /** Get current nonce for the account */
  getNonce(): Promise<number>;
}

/**
 * Build a SIP-010 transfer function call payload
 * This is a simplified implementation - in production, use @stacks/transactions
 */
function buildTransferPayload(params: {
  recipient: string;
  amount: bigint;
  tokenContract: string;
  sender: string;
  memo?: string;
}): {
  functionName: string;
  contractAddress: string;
  contractName: string;
  args: string[];
} {
  const { address: contractAddress, name: contractName } = parseContractId(params.tokenContract);

  return {
    functionName: "transfer",
    contractAddress,
    contractName,
    args: [
      params.amount.toString(), // amount (uint)
      params.sender, // sender (principal)
      params.recipient, // recipient (principal)
      params.memo || "", // memo (optional buff)
    ],
  };
}

/**
 * Sign transaction with Leather wallet
 */
async function signWithLeather(
  payload: ReturnType<typeof buildTransferPayload>,
  network: StacksNetwork,
): Promise<string> {
  const provider = window.LeatherProvider || window.HiroWalletProvider;
  if (!provider) {
    throw new Error("Leather wallet not available");
  }

  const networkMode = network === STACKS_NETWORKS.MAINNET ? "mainnet" : "testnet";

  const response = await provider.request("stx_callContract", {
    contract: `${payload.contractAddress}.${payload.contractName}`,
    functionName: payload.functionName,
    functionArgs: payload.args,
    network: networkMode,
  });

  const result = response as { result?: { txId: string } };
  if (!result.result?.txId) {
    throw new Error("Transaction failed - no txId returned");
  }

  return result.result.txId;
}

/**
 * Sign transaction with Xverse wallet
 */
async function signWithXverse(
  payload: ReturnType<typeof buildTransferPayload>,
  network: StacksNetwork,
): Promise<string> {
  const provider = window.XverseProviders?.StacksProvider;
  if (!provider) {
    throw new Error("Xverse wallet not available");
  }

  const networkMode = network === STACKS_NETWORKS.MAINNET ? "mainnet" : "testnet";

  const response = await provider.request("stx_callContract", {
    contract: `${payload.contractAddress}.${payload.contractName}`,
    functionName: payload.functionName,
    functionArgs: payload.args,
    network: networkMode,
  });

  const result = response as { result?: { txId: string } };
  if (!result.result?.txId) {
    throw new Error("Transaction failed - no txId returned");
  }

  return result.result.txId;
}

/**
 * Hook to create a Stacks signer from connected wallet
 *
 * @param account - Connected Stacks account
 * @param walletId - Which wallet is connected
 * @param network - Target network
 * @returns Client signer or null if not connected
 */
export function useStacksSigner(
  account: StacksAccount | null,
  walletId: "leather" | "xverse" | null,
  network: StacksNetwork,
): ClientStacksSigner | null {
  const signer = useMemo(() => {
    if (!account || !walletId) {
      return null;
    }

    const clientSigner: ClientStacksSigner = {
      get address() {
        return account.address;
      },

      get publicKey() {
        return account.publicKey;
      },

      async signTokenTransfer(params) {
        const tokenContract = params.tokenContract || getUsdcContractAddress(network);

        const payload = buildTransferPayload({
          recipient: params.recipient,
          amount: params.amount,
          tokenContract,
          sender: account.address,
          memo: params.memo,
        });

        if (walletId === "leather") {
          return signWithLeather(payload, network);
        } else {
          return signWithXverse(payload, network);
        }
      },

      async getNonce() {
        const info = await fetchAccountInfo(account.address, network);
        return info?.nonce || 0;
      },
    };

    return clientSigner;
  }, [account, walletId, network]);

  return signer;
}

/**
 * Create a payment payload for T402 protocol
 * This will be used when @t402/stacks is implemented
 */
export function createStacksPaymentPayload(params: {
  signer: ClientStacksSigner;
  payTo: string;
  amount: string;
  tokenContract: string;
  network: StacksNetwork;
}): {
  scheme: string;
  network: string;
  from: string;
  to: string;
  amount: string;
  asset: string;
} {
  return {
    scheme: "exact",
    network: params.network,
    from: params.signer.address,
    to: params.payTo,
    amount: params.amount,
    asset: params.tokenContract,
  };
}
