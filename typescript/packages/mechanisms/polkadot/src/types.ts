/**
 * Polkadot Asset Hub T402 Types
 */

import type { Network } from "@t402/core/types";

/**
 * Payment payload for exact-direct scheme on Polkadot
 */
export type ExactDirectPolkadotPayload = {
  /** Extrinsic hash (block hash + extrinsic index) */
  extrinsicHash: string;
  /** Block hash containing the extrinsic */
  blockHash: string;
  /** Extrinsic index within the block */
  extrinsicIndex: number;
  /** Sender address (SS58 format) */
  from: string;
  /** Recipient address (SS58 format) */
  to: string;
  /** Amount in smallest unit (with decimals) */
  amount: string;
  /** Asset ID */
  assetId: number;
};

/**
 * Result of a Polkadot extrinsic query
 */
export interface PolkadotExtrinsicResult {
  /** Extrinsic hash */
  extrinsicHash: string;
  /** Block hash */
  blockHash: string;
  /** Block number */
  blockNumber: number;
  /** Extrinsic index */
  extrinsicIndex: number;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Signer address */
  signer: string;
  /** Success status */
  success: boolean;
  /** Module name (e.g., "assets") */
  module: string;
  /** Call name (e.g., "transfer") */
  call: string;
  /** Call arguments */
  args: Record<string, unknown>;
  /** Events emitted by the extrinsic */
  events: PolkadotEvent[];
}

/**
 * Polkadot event structure
 */
export interface PolkadotEvent {
  /** Module name */
  module: string;
  /** Event name */
  name: string;
  /** Event data */
  data: Record<string, unknown>;
}

/**
 * Parsed asset transfer from extrinsic
 */
export interface ParsedAssetTransfer {
  /** Asset ID */
  assetId: number;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount transferred */
  amount: string;
  /** Whether the transfer was successful */
  success: boolean;
}

/**
 * Signer interface for Polkadot facilitator
 */
export interface FacilitatorPolkadotSigner {
  /**
   * Get the facilitator's addresses for a network
   */
  getAddresses(network: Network): string[];

  /**
   * Query an extrinsic by hash
   */
  queryExtrinsic(
    extrinsicHash: string,
    blockHash?: string,
    extrinsicIndex?: number,
  ): Promise<PolkadotExtrinsicResult | null>;

  /**
   * Get balance of an asset for an address
   */
  getBalance(assetId: number, address: string): Promise<string>;
}

/**
 * Client signer interface for signing transactions
 */
export interface ClientPolkadotSigner {
  /**
   * Get the signer's address
   */
  getAddress(): Promise<string>;

  /**
   * Sign and submit an asset transfer
   * Returns the extrinsic hash, block hash, and extrinsic index
   */
  transferAsset(
    assetId: number,
    to: string,
    amount: string,
  ): Promise<{
    extrinsicHash: string;
    blockHash: string;
    extrinsicIndex: number;
  }>;
}

/**
 * Configuration for Polkadot server
 */
export interface PolkadotServerConfig {
  /** Custom RPC URL */
  rpcUrl?: string;
  /** Custom indexer URL */
  indexerUrl?: string;
  /** Facilitator addresses per network */
  facilitatorAddresses?: Record<string, string>;
}

/**
 * Configuration for Polkadot facilitator
 */
export interface PolkadotFacilitatorConfig {
  /** Maximum age of extrinsic to accept (in seconds) */
  maxExtrinsicAge?: number;
  /** Duration to cache used extrinsic hashes */
  usedExtrinsicCacheDuration?: number;
}
