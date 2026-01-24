/**
 * Stacks T402 Types
 */

import type { Network } from "@t402/core/types";

/**
 * Payment payload for exact-direct scheme on Stacks
 */
export type ExactDirectStacksPayload = {
  /** Transaction ID (0x-prefixed hex, 64 chars) */
  txId: string;
  /** Sender address (Stacks principal) */
  from: string;
  /** Recipient address (Stacks principal) */
  to: string;
  /** Amount in smallest unit (atomic) */
  amount: string;
  /** SIP-010 contract address (principal.contract-name) */
  contractAddress: string;
};

/**
 * Result of a Stacks transaction query from Hiro API
 */
export interface StacksTransactionResult {
  /** Transaction ID */
  txId: string;
  /** Transaction type */
  txType: string;
  /** Transaction status */
  txStatus: "success" | "abort_by_response" | "abort_by_post_condition" | "pending";
  /** Block hash */
  blockHash: string;
  /** Block height */
  blockHeight: number;
  /** Burn block time (unix timestamp) */
  burnBlockTime: number;
  /** Sender address */
  senderAddress: string;
  /** Contract call details (for contract-call transactions) */
  contractCall?: StacksContractCall;
  /** Post-condition mode */
  postConditionMode: string;
  /** Post conditions */
  postConditions: StacksPostCondition[];
  /** Events */
  events: StacksEvent[];
}

/**
 * Stacks contract call details
 */
export interface StacksContractCall {
  /** Contract ID (principal.contract-name) */
  contractId: string;
  /** Function name */
  functionName: string;
  /** Function arguments */
  functionArgs: StacksFunctionArg[];
}

/**
 * Stacks function argument
 */
export interface StacksFunctionArg {
  /** Hex-encoded value */
  hex: string;
  /** Human-readable representation */
  repr: string;
  /** Argument type */
  type: string;
}

/**
 * Stacks post condition
 */
export interface StacksPostCondition {
  /** Principal (sender) */
  principal: {
    type_id: string;
    address: string;
    contract_name?: string;
  };
  /** Condition code */
  conditionCode: string;
  /** Amount */
  amount: string;
  /** Asset info */
  asset?: {
    contractAddress: string;
    contractName: string;
    assetName: string;
  };
}

/**
 * Stacks transaction event
 */
export interface StacksEvent {
  /** Event type */
  eventType: string;
  /** Event index */
  eventIndex: number;
  /** Fungible token transfer asset event (for ft_transfer events) */
  asset?: {
    assetEventType: string;
    assetId: string;
    sender: string;
    recipient: string;
    amount: string;
  };
}

/**
 * Parsed token transfer from transaction events
 */
export interface ParsedTokenTransfer {
  /** Contract address (principal.contract-name) */
  contractAddress: string;
  /** Sender address */
  from: string;
  /** Recipient address */
  to: string;
  /** Amount transferred (atomic units) */
  amount: string;
  /** Whether the transfer was successful */
  success: boolean;
}

/**
 * Signer interface for Stacks facilitator
 */
export interface FacilitatorStacksSigner {
  /**
   * Get the facilitator's addresses for a network
   */
  getAddresses(network: Network): string[];

  /**
   * Query a transaction by ID from Hiro API
   */
  queryTransaction(txId: string): Promise<StacksTransactionResult | null>;
}

/**
 * Client signer interface for signing transactions
 */
export interface ClientStacksSigner {
  /**
   * Get the signer's address
   */
  getAddress(): Promise<string>;

  /**
   * Sign and submit a SIP-010 token transfer
   * Returns the transaction ID
   */
  transferToken(
    contractAddress: string,
    to: string,
    amount: string,
  ): Promise<{ txId: string }>;
}

/**
 * Configuration for Stacks server
 */
export interface StacksServerConfig {
  /** Custom API URL */
  apiUrl?: string;
  /** Facilitator addresses per network */
  facilitatorAddresses?: Record<string, string>;
}

/**
 * Configuration for Stacks facilitator
 */
export interface StacksFacilitatorConfig {
  /** Maximum age of transaction to accept (in seconds) */
  maxTransactionAge?: number;
  /** Duration to cache used transaction IDs */
  usedTxCacheDuration?: number;
}
