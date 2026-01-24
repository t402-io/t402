import { useMemo } from "react";
import type { StacksAccount, StacksNetwork } from "./types";
import { STACKS_NETWORKS } from "./types";
import { parseContractId } from "./rpc";
import type { ClientStacksSigner } from "@t402/stacks";

/**
 * Build a SIP-010 transfer function call payload
 */
function buildTransferPayload(params: {
  recipient: string;
  amount: string;
  tokenContract: string;
  sender: string;
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
      params.amount, // amount (uint)
      params.sender, // sender (principal)
      params.recipient, // recipient (principal)
      "", // memo (optional buff)
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
 * Hook to create a Stacks signer from connected wallet.
 *
 * Returns a ClientStacksSigner compatible with @t402/stacks exact-direct client.
 *
 * @param account - Connected Stacks account
 * @param walletId - Which wallet is connected
 * @param network - Target network
 * @returns Client signer compatible with @t402/stacks or null if not connected
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
      async getAddress() {
        return account.address;
      },

      async transferToken(contractAddress: string, to: string, amount: string) {
        const payload = buildTransferPayload({
          recipient: to,
          amount,
          tokenContract: contractAddress,
          sender: account.address,
        });

        let txId: string;
        if (walletId === "leather") {
          txId = await signWithLeather(payload, network);
        } else {
          txId = await signWithXverse(payload, network);
        }

        return { txId };
      },
    };

    return clientSigner;
  }, [account, walletId, network]);

  return signer;
}
