/**
 * Aptos Types for T402 Payment Protocol
 */

import type { Network } from "@t402/core/types";

/**
 * Exact-direct payment payload for Aptos
 * Client executes the transfer and provides transaction hash as proof
 */
export type ExactDirectAptosPayload = {
  /** Transaction hash (hex string with 0x prefix) */
  txHash: string;
  /** Sender's Aptos address */
  from: string;
  /** Recipient's Aptos address */
  to: string;
  /** Amount transferred (in smallest unit) */
  amount: string;
  /** Fungible Asset metadata address */
  metadataAddress: string;
  /** Transaction version (for verification) */
  version?: string;
};

/**
 * Aptos signer interface for client operations
 */
export interface ClientAptosSigner {
  /**
   * Get the signer's Aptos address
   */
  getAddress(): Promise<string>;

  /**
   * Sign and submit a fungible asset transfer transaction
   * @param to Recipient address
   * @param metadataAddress FA metadata address
   * @param amount Amount to transfer
   * @returns Transaction hash
   */
  transfer(
    to: string,
    metadataAddress: string,
    amount: bigint,
  ): Promise<string>;

  /**
   * Get token balance for an address
   * @param metadataAddress FA metadata address
   * @returns Balance in smallest unit
   */
  getBalance(metadataAddress: string): Promise<bigint>;
}

/**
 * Aptos signer interface for facilitator operations
 */
export interface FacilitatorAptosSigner {
  /**
   * Get facilitator addresses for a network
   * @param network CAIP-2 network identifier
   */
  getAddresses(network: Network): string[];

  /**
   * Query transaction by hash
   * @param txHash Transaction hash
   * @returns Transaction details or null if not found
   */
  queryTransaction(txHash: string): Promise<AptosTransactionResult | null>;

  /**
   * Get token balance for an address
   * @param address Account address
   * @param metadataAddress FA metadata address
   * @returns Balance in smallest unit
   */
  getBalance(address: string, metadataAddress: string): Promise<bigint>;
}

/**
 * Aptos transaction result from RPC
 */
export interface AptosTransactionResult {
  /** Transaction hash */
  hash: string;
  /** Transaction version */
  version: string;
  /** Whether the transaction was successful */
  success: boolean;
  /** VM status */
  vmStatus: string;
  /** Sender address */
  sender: string;
  /** Sequence number */
  sequenceNumber: string;
  /** Gas used */
  gasUsed: string;
  /** Timestamp (microseconds) */
  timestamp: string;
  /** Transaction payload */
  payload?: AptosTransactionPayload;
  /** Events emitted by the transaction */
  events?: AptosTransactionEvent[];
  /** State changes */
  changes?: AptosStateChange[];
}

/**
 * Aptos transaction payload
 */
export interface AptosTransactionPayload {
  type: string;
  function?: string;
  typeArguments?: string[];
  arguments?: unknown[];
}

/**
 * Aptos transaction event
 */
export interface AptosTransactionEvent {
  guid: {
    creationNumber: string;
    accountAddress: string;
  };
  sequenceNumber: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Aptos state change
 */
export interface AptosStateChange {
  type: string;
  address: string;
  stateKeyHash: string;
  data?: {
    type: string;
    data: Record<string, unknown>;
  };
}

/**
 * Parsed fungible asset transfer from events
 */
export interface ParsedFATransfer {
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount transferred */
  amount: bigint;
  /** FA metadata address */
  metadataAddress: string;
}

/**
 * Extract Aptos chain ID from CAIP-2 network identifier
 */
export function extractChainId(network: Network): number {
  const parts = network.split(":");
  if (parts.length !== 2 || parts[0] !== "aptos") {
    throw new Error(`Invalid Aptos network identifier: ${network}`);
  }
  const chainId = parseInt(parts[1], 10);
  if (isNaN(chainId)) {
    throw new Error(`Invalid chain ID in network identifier: ${network}`);
  }
  return chainId;
}

