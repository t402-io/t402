/**
 * Tezos mechanism types
 */

import type { Network } from "@t402/core/types";

/**
 * Exact-direct payment payload for Tezos
 */
export type ExactDirectTezosPayload = {
  /** Operation hash (o...) */
  opHash: string;
  /** Sender address (tz1/tz2/tz3...) */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount in smallest units */
  amount: string;
  /** FA2 contract address (KT1...) */
  contractAddress: string;
  /** Token ID within the FA2 contract */
  tokenId: number;
};

/**
 * Tezos signer interface for client-side operations
 */
export interface TezosSigner {
  /** Get the signer's address */
  getAddress(): Promise<string>;

  /**
   * Execute an FA2 transfer
   * @param contractAddress FA2 contract address
   * @param tokenId Token ID
   * @param to Recipient address
   * @param amount Amount to transfer
   * @returns Operation hash
   */
  transfer(
    contractAddress: string,
    tokenId: number,
    to: string,
    amount: bigint,
  ): Promise<string>;

  /**
   * Get token balance
   * @param contractAddress FA2 contract address
   * @param tokenId Token ID
   * @param address Address to check (optional, defaults to signer address)
   * @returns Balance in smallest units
   */
  getBalance(
    contractAddress: string,
    tokenId: number,
    address?: string,
  ): Promise<bigint>;
}

/**
 * Tezos signer interface for facilitator operations
 */
export interface FacilitatorTezosSigner {
  /** Get facilitator addresses for a network */
  getAddresses(network: Network): string[];

  /**
   * Query an operation by hash
   * @param opHash Operation hash
   * @returns Operation result or null if not found
   */
  queryOperation(opHash: string): Promise<TezosOperationResult | null>;

  /**
   * Get token balance for an address
   * @param contractAddress FA2 contract address
   * @param tokenId Token ID
   * @param address Address to check
   * @returns Balance as string
   */
  getBalance(
    contractAddress: string,
    tokenId: number,
    address: string,
  ): Promise<string>;
}

/**
 * Tezos operation result from indexer
 */
export interface TezosOperationResult {
  /** Operation hash */
  hash: string;
  /** Block level */
  level: number;
  /** Timestamp */
  timestamp: string;
  /** Status: applied, failed, backtracked, skipped */
  status: "applied" | "failed" | "backtracked" | "skipped";
  /** Sender address */
  sender: {
    address: string;
  };
  /** Target contract (for contract calls) */
  target?: {
    address: string;
  };
  /** Entrypoint called */
  entrypoint?: string;
  /** Parameter value */
  parameter?: unknown;
  /** Amount transferred (in mutez for XTZ) */
  amount?: number;
  /** Errors if failed */
  errors?: Array<{
    type: string;
    message?: string;
  }>;
}

/**
 * FA2 transfer parameter structure
 */
export interface FA2TransferParam {
  from_: string;
  txs: Array<{
    to_: string;
    token_id: number;
    amount: string;
  }>;
}

/**
 * Check if a string is a valid Tezos address
 */
export function isValidTezosAddress(address: string): boolean {
  if (!address) return false;
  // tz1, tz2, tz3 for implicit accounts, KT1 for contracts
  const prefixPattern = /^(tz1|tz2|tz3|KT1)/;
  if (!prefixPattern.test(address)) return false;
  // Base58 check - length should be 36 characters
  return address.length === 36;
}

/**
 * Check if a string is a valid Tezos operation hash
 */
export function isValidOperationHash(opHash: string): boolean {
  if (!opHash) return false;
  // Operation hashes start with 'o' and are 51 characters
  return opHash.startsWith("o") && opHash.length === 51;
}

/**
 * Check if a network is a Tezos network
 */
export function isTezosNetwork(network: string): boolean {
  return network.startsWith("tezos:");
}
