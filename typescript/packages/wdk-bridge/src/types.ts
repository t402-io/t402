/**
 * WDK Bridge Types
 *
 * Type definitions for cross-chain USDT0 bridging with Tether WDK.
 */

import type { Address, Hex } from "viem";

/**
 * WDK account interface (compatible with @tetherto/wdk)
 */
export interface WdkAccount {
  /** Get the account's address */
  getAddress(): Promise<string>;
  /** Get the account's native balance */
  getBalance(): Promise<bigint>;
  /** Get the account's token balance */
  getTokenBalance(tokenAddress: string): Promise<bigint>;
  /** Sign a message */
  signMessage(message: string): Promise<string>;
  /** Sign typed data (EIP-712) */
  signTypedData(params: {
    domain: {
      name?: string;
      version?: string;
      chainId?: number;
      verifyingContract?: string;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<string>;
  /** Send a transaction */
  sendTransaction(params: {
    to: string;
    value?: bigint;
    data?: string;
  }): Promise<string>;
}

/**
 * Chain balance info
 */
export interface ChainBalance {
  /** Chain name */
  chain: string;
  /** Chain ID */
  chainId: number;
  /** USDT0 balance (in token units, 6 decimals) */
  usdt0Balance: bigint;
  /** Native token balance (in wei) */
  nativeBalance: bigint;
  /** Whether this chain has sufficient balance for bridging */
  canBridge: boolean;
}

/**
 * Bridge route with fee information
 */
export interface BridgeRoute {
  /** Source chain */
  fromChain: string;
  /** Destination chain */
  toChain: string;
  /** Native fee required (in wei) */
  nativeFee: bigint;
  /** Amount to send */
  amountToSend: bigint;
  /** Minimum amount to receive */
  minAmountToReceive: bigint;
  /** Estimated time in seconds */
  estimatedTime: number;
  /** Whether this route is available (sufficient balance) */
  available: boolean;
  /** Reason if not available */
  unavailableReason?: string;
}

/**
 * Parameters for auto-bridging
 */
export interface AutoBridgeParams {
  /** Destination chain for the USDT0 */
  toChain: string;
  /** Amount to bridge (in token units, 6 decimals) */
  amount: bigint;
  /** Recipient address on destination chain */
  recipient: Address;
  /** Preferred source chain (optional, will auto-select if not provided) */
  preferredSourceChain?: string;
  /** Slippage tolerance percentage (default: 0.5) */
  slippageTolerance?: number;
}

/**
 * Result of a bridge operation
 */
export interface WdkBridgeResult {
  /** Transaction hash on source chain */
  txHash: Hex;
  /** LayerZero message GUID for tracking */
  messageGuid: Hex;
  /** Amount sent from source chain */
  amountSent: bigint;
  /** Estimated amount to receive on destination */
  amountToReceive: bigint;
  /** Source chain */
  fromChain: string;
  /** Destination chain */
  toChain: string;
  /** Estimated delivery time in seconds */
  estimatedTime: number;
  /** Wait for delivery confirmation */
  waitForDelivery(options?: WaitOptions): Promise<DeliveryResult>;
}

/**
 * Options for waiting for delivery
 */
export interface WaitOptions {
  /** Maximum wait time in milliseconds (default: 600000 = 10 minutes) */
  timeout?: number;
  /** Polling interval in milliseconds (default: 10000 = 10 seconds) */
  pollInterval?: number;
  /** Callback when status changes */
  onStatusChange?: (status: BridgeDeliveryStatus) => void;
}

/**
 * Bridge delivery status
 */
export type BridgeDeliveryStatus =
  | "INFLIGHT"    // Message sent, in transit
  | "CONFIRMING"  // Awaiting confirmations
  | "DELIVERED"   // Successfully delivered
  | "FAILED"      // Delivery failed
  | "BLOCKED";    // Message blocked

/**
 * Result of delivery confirmation
 */
export interface DeliveryResult {
  /** Whether delivery was successful */
  success: boolean;
  /** Final status */
  status: BridgeDeliveryStatus;
  /** Destination chain transaction hash */
  dstTxHash?: Hex;
  /** Source chain transaction hash */
  srcTxHash: Hex;
  /** LayerZero message GUID */
  messageGuid: Hex;
  /** Error message if failed */
  error?: string;
}

/**
 * Route optimization strategy
 */
export type RouteStrategy =
  | "cheapest"     // Select route with lowest fee
  | "fastest"      // Select route with fastest delivery
  | "preferred";   // Use preferred source chain if available

/**
 * Configuration for WDK bridge client
 */
export interface WdkBridgeClientConfig {
  /** WDK accounts by chain name */
  accounts: Record<string, WdkAccount>;
  /** Default route strategy (default: "cheapest") */
  defaultStrategy?: RouteStrategy;
  /** Default slippage tolerance (default: 0.5%) */
  defaultSlippage?: number;
}

/**
 * Multi-chain balance summary
 */
export interface BalanceSummary {
  /** Balances by chain */
  balances: ChainBalance[];
  /** Total USDT0 across all chains */
  totalUsdt0: bigint;
  /** Chains with USDT0 balance */
  chainsWithBalance: string[];
  /** Chains that can be bridged from */
  bridgeableChains: string[];
}
