import { useMemo } from "react";
import type { TronNetwork } from "./types";

/**
 * Parameters for signing a TRC-20 transfer transaction
 */
export interface SignTransactionParams {
  /** TRC-20 contract address */
  contractAddress: string;
  /** Recipient address */
  to: string;
  /** Amount in smallest units (as string for big numbers) */
  amount: string;
  /** Fee limit in SUN (optional) */
  feeLimit?: number;
  /** Expiration timestamp in ms (optional) */
  expiration?: number;
}

/**
 * Block info for transaction building
 */
export interface BlockInfo {
  /** Reference block bytes (hex) */
  refBlockBytes: string;
  /** Reference block hash (hex) */
  refBlockHash: string;
  /** Expiration timestamp (milliseconds) */
  expiration: number;
}

/**
 * ClientTronSigner interface from @t402/tron
 * Defines the signer interface needed for creating payment payloads
 */
export interface ClientTronSigner {
  /** The wallet address (base58 format) */
  readonly address: string;
  /** Sign a TRC-20 transfer transaction */
  signTransaction(params: SignTransactionParams): Promise<string>;
  /** Get current block info for transaction building */
  getBlockInfo(): Promise<BlockInfo>;
}

/**
 * Default fee limit in SUN (100 TRX)
 */
const DEFAULT_FEE_LIMIT = 100_000_000;

/**
 * Creates a ClientTronSigner adapter for TronLink
 *
 * This adapter bridges TronLink's TronWeb to the ClientTronSigner
 * interface required by @t402/tron.
 *
 * @param walletAddress - Connected wallet address
 * @returns ClientTronSigner implementation
 */
export function createTronLinkSigner(walletAddress: string): ClientTronSigner {
  return {
    get address(): string {
      return walletAddress;
    },

    async getBlockInfo(): Promise<BlockInfo> {
      if (!window.tronWeb) {
        throw new Error("TronWeb not available");
      }

      const block = await window.tronWeb.trx.getBlock("latest");
      const blockId = block.blockID;

      // Extract reference block bytes and hash from block ID
      // Block ID is a 64-character hex string
      return {
        refBlockBytes: blockId.slice(12, 16),
        refBlockHash: blockId.slice(16, 32),
        expiration: block.block_header.raw_data.timestamp + 60000, // 1 minute validity
      };
    },

    async signTransaction(params: SignTransactionParams): Promise<string> {
      if (!window.tronWeb) {
        throw new Error("TronWeb not available");
      }

      const { contractAddress, to, amount, feeLimit = DEFAULT_FEE_LIMIT } = params;

      // Build TRC-20 transfer transaction using TronWeb
      // transfer(address,uint256) function selector
      const functionSelector = "transfer(address,uint256)";

      // Convert recipient address to hex format if needed
      const toHex = window.tronWeb.address.toHex(to);

      const result = await window.tronWeb.transactionBuilder.triggerSmartContract(
        contractAddress,
        functionSelector,
        {
          feeLimit,
          callValue: 0,
        },
        [
          { type: "address", value: toHex },
          { type: "uint256", value: amount },
        ],
        walletAddress,
      );

      if (!result.result?.result) {
        throw new Error("Failed to build transaction");
      }

      // Sign the transaction
      const signedTx = await window.tronWeb.trx.sign(result.transaction);

      // Return the hex-encoded signed transaction
      return signedTx.raw_data_hex;
    },
  };
}

/**
 * Hook for creating a TronLink-based ClientTronSigner
 *
 * @param address - Connected wallet address
 * @param _network - Target TRON network (unused but kept for consistency)
 * @returns ClientTronSigner or null if not connected
 */
export function useTronSigner(
  address: string | null,
  _network: TronNetwork,
): ClientTronSigner | null {
  return useMemo(() => {
    if (!address || !window.tronWeb) {
      return null;
    }

    return createTronLinkSigner(address);
  }, [address]);
}
