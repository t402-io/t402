/**
 * Type definitions for USDT0 cross-chain bridging
 */

import type { Address } from "viem";

/**
 * Parameters for quoting a bridge transaction
 */
export interface BridgeQuoteParams {
  /** Source chain name (e.g., "ethereum", "arbitrum") */
  fromChain: string;
  /** Destination chain name */
  toChain: string;
  /** Amount to bridge in token units (6 decimals for USDT0) */
  amount: bigint;
  /** Recipient address on destination chain */
  recipient: Address;
}

/**
 * Quote result for a bridge transaction
 */
export interface BridgeQuote {
  /** Native token fee required (in wei) */
  nativeFee: bigint;
  /** Amount that will be sent */
  amountToSend: bigint;
  /** Minimum amount to receive (after fees/slippage) */
  minAmountToReceive: bigint;
  /** Estimated time for bridge completion in seconds */
  estimatedTime: number;
  /** Source chain */
  fromChain: string;
  /** Destination chain */
  toChain: string;
}

/**
 * Parameters for executing a bridge transaction
 */
export interface BridgeExecuteParams extends BridgeQuoteParams {
  /** Slippage tolerance as percentage (e.g., 0.5 for 0.5%) */
  slippageTolerance?: number;
  /** Custom gas limit for the destination chain execution */
  dstGasLimit?: bigint;
  /** Refund address for excess fees (defaults to sender) */
  refundAddress?: Address;
}

/**
 * Result of a bridge transaction
 */
export interface BridgeResult {
  /** Transaction hash on source chain */
  txHash: `0x${string}`;
  /** LayerZero message GUID */
  messageGuid: `0x${string}`;
  /** Amount sent */
  amountSent: bigint;
  /** Amount to be received on destination */
  amountToReceive: bigint;
  /** Source chain */
  fromChain: string;
  /** Destination chain */
  toChain: string;
  /** Estimated completion time in seconds */
  estimatedTime: number;
}

/**
 * Bridge status for tracking cross-chain transfers
 */
export type BridgeStatus =
  | "pending" // Transaction submitted, waiting for confirmation
  | "inflight" // Message sent via LayerZero, in transit
  | "delivered" // Message delivered to destination
  | "completed" // Tokens received on destination
  | "failed"; // Bridge failed

/**
 * Bridge transaction tracking info
 */
export interface BridgeTransaction {
  /** Source chain transaction hash */
  srcTxHash: `0x${string}`;
  /** LayerZero message GUID */
  messageGuid: `0x${string}`;
  /** Current status */
  status: BridgeStatus;
  /** Source chain */
  fromChain: string;
  /** Destination chain */
  toChain: string;
  /** Amount sent */
  amount: bigint;
  /** Recipient address */
  recipient: Address;
  /** Timestamp when bridge was initiated */
  timestamp: number;
  /** Destination chain transaction hash (when completed) */
  dstTxHash?: `0x${string}`;
}

/**
 * LayerZero SendParam struct (matches contract)
 */
export interface SendParam {
  dstEid: number;
  to: `0x${string}`;
  amountLD: bigint;
  minAmountLD: bigint;
  extraOptions: `0x${string}`;
  composeMsg: `0x${string}`;
  oftCmd: `0x${string}`;
}

/**
 * LayerZero MessagingFee struct
 */
export interface MessagingFee {
  nativeFee: bigint;
  lzTokenFee: bigint;
}

/**
 * LayerZero OFT receipt
 */
export interface OftReceipt {
  amountSentLD: bigint;
  amountReceivedLD: bigint;
}

/**
 * LayerZero message receipt
 */
export interface MessageReceipt {
  guid: `0x${string}`;
  nonce: bigint;
  fee: MessagingFee;
}

/**
 * Transaction log entry
 */
export interface TransactionLog {
  /** Contract address that emitted the log */
  address: Address;
  /** Indexed event parameters */
  topics: readonly `0x${string}`[];
  /** Non-indexed event data */
  data: `0x${string}`;
}

/**
 * Transaction receipt with logs
 */
export interface TransactionReceipt {
  /** Transaction status ("success" or "reverted") */
  status: string;
  /** Transaction hash */
  transactionHash: `0x${string}`;
  /** Event logs emitted during transaction */
  logs: readonly TransactionLog[];
}

/**
 * Signer interface for bridge operations
 */
export interface BridgeSigner {
  /** Wallet address */
  readonly address: Address;
  /** Read contract state */
  readContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown>;
  /** Write to contract */
  writeContract(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
    value?: bigint;
  }): Promise<`0x${string}`>;
  /** Wait for transaction receipt */
  waitForTransactionReceipt(args: {
    hash: `0x${string}`;
  }): Promise<TransactionReceipt>;
}

// ============================================================================
// LayerZero Scan Types
// ============================================================================

/**
 * LayerZero message status from Scan API
 */
export type LayerZeroMessageStatus =
  | "INFLIGHT"    // Message sent, in transit between chains
  | "CONFIRMING"  // Awaiting confirmations
  | "DELIVERED"   // Successfully delivered to destination chain
  | "FAILED"      // Delivery failed
  | "BLOCKED";    // Message blocked by DVN

/**
 * LayerZero message from Scan API
 */
export interface LayerZeroMessage {
  /** Unique message identifier */
  guid: string;
  /** Source chain LayerZero endpoint ID */
  srcEid: number;
  /** Destination chain LayerZero endpoint ID */
  dstEid: number;
  /** Source chain OApp address */
  srcUaAddress: string;
  /** Destination chain OApp address */
  dstUaAddress: string;
  /** Source chain transaction hash */
  srcTxHash: string;
  /** Destination chain transaction hash (when delivered) */
  dstTxHash?: string;
  /** Current message status */
  status: LayerZeroMessageStatus;
  /** Source chain block number */
  srcBlockNumber: number;
  /** Destination chain block number (when delivered) */
  dstBlockNumber?: number;
  /** Timestamp when message was created */
  created: string;
  /** Timestamp when message was last updated */
  updated: string;
}

/**
 * Options for waiting for message delivery
 */
export interface WaitForDeliveryOptions {
  /** Maximum time to wait in milliseconds (default: 600000 = 10 minutes) */
  timeout?: number;
  /** Polling interval in milliseconds (default: 10000 = 10 seconds) */
  pollInterval?: number;
  /** Callback when status changes */
  onStatusChange?: (status: LayerZeroMessageStatus) => void;
}

// ============================================================================
// Cross-Chain Payment Router Types
// ============================================================================

/**
 * Parameters for cross-chain payment routing
 */
export interface CrossChainPaymentParams {
  /** Source chain where user has funds */
  sourceChain: string;
  /** Destination chain where payment is needed */
  destinationChain: string;
  /** Amount to transfer (in token units, 6 decimals for USDT0) */
  amount: bigint;
  /** Payment recipient on destination chain */
  payTo: Address;
  /** Payer address (receives bridged funds on destination) */
  payer: Address;
  /** Slippage tolerance percentage (default: 0.5) */
  slippageTolerance?: number;
}

/**
 * Result of cross-chain payment routing
 */
export interface CrossChainPaymentResult {
  /** Bridge transaction hash on source chain */
  bridgeTxHash: `0x${string}`;
  /** LayerZero message GUID for tracking */
  messageGuid: `0x${string}`;
  /** Amount bridged from source chain */
  amountBridged: bigint;
  /** Estimated amount to receive on destination */
  estimatedReceiveAmount: bigint;
  /** Source chain name */
  sourceChain: string;
  /** Destination chain name */
  destinationChain: string;
  /** Estimated delivery time in seconds */
  estimatedDeliveryTime: number;
}
