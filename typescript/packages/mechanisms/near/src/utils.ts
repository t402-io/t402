/**
 * NEAR Utility Functions
 *
 * Helper functions for NEAR address validation, network normalization,
 * and RPC interactions.
 */

import { NEAR_CAIP2_NAMESPACE, NETWORK_RPC_ENDPOINTS, type NearNetwork } from "./constants.js";
import type { NearRpcRequest, NearRpcResponse, TransactionResult, FtTransferArgs } from "./types.js";

/**
 * Normalize a network identifier to CAIP-2 format
 * @param network - Network identifier (e.g., "mainnet", "near:mainnet")
 * @returns CAIP-2 formatted network identifier
 */
export function normalizeNetwork(network: string): NearNetwork {
  // Already in CAIP-2 format
  if (network.startsWith(`${NEAR_CAIP2_NAMESPACE}:`)) {
    return network as NearNetwork;
  }
  // Convert shorthand to CAIP-2
  return `${NEAR_CAIP2_NAMESPACE}:${network}` as NearNetwork;
}

/**
 * Extract network ID from CAIP-2 identifier
 * @param network - CAIP-2 network identifier
 * @returns Network ID (e.g., "mainnet")
 */
export function extractNetworkId(network: string): string {
  if (network.includes(":")) {
    return network.split(":")[1];
  }
  return network;
}

/**
 * Validate a NEAR account ID
 * NEAR account IDs must:
 * - Be 2-64 characters
 * - Contain only lowercase alphanumeric, underscores, hyphens
 * - Not start with a hyphen or underscore
 * @param accountId - Account ID to validate
 * @returns Whether the account ID is valid
 */
export function isValidAccountId(accountId: string): boolean {
  if (!accountId || accountId.length < 2 || accountId.length > 64) {
    return false;
  }
  // NEAR account ID regex
  const regex = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/;
  return regex.test(accountId);
}

/**
 * Get RPC endpoint for a network
 * @param network - CAIP-2 network identifier
 * @returns RPC endpoint URL
 */
export function getRpcEndpoint(network: string): string {
  const normalizedNetwork = normalizeNetwork(network);
  return NETWORK_RPC_ENDPOINTS[normalizedNetwork] || NETWORK_RPC_ENDPOINTS["near:mainnet"];
}

/**
 * Make a JSON-RPC call to NEAR
 * @param network - CAIP-2 network identifier
 * @param method - RPC method name
 * @param params - Method parameters
 * @returns RPC response result
 */
export async function rpcCall<T>(
  network: string,
  method: string,
  params: NearRpcRequest["params"],
): Promise<T> {
  const endpoint = getRpcEndpoint(network);

  const request: NearRpcRequest = {
    jsonrpc: "2.0",
    id: `t402-${Date.now()}`,
    method,
    params,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = (await response.json()) as NearRpcResponse<T>;

  if (data.error) {
    throw new Error(`NEAR RPC error: ${data.error.message}`);
  }

  return data.result as T;
}

/**
 * Query a transaction by hash
 * @param network - CAIP-2 network identifier
 * @param txHash - Transaction hash
 * @param senderAccountId - Sender account ID
 * @returns Transaction result
 */
export async function queryTransaction(
  network: string,
  txHash: string,
  senderAccountId: string,
): Promise<TransactionResult> {
  return rpcCall<TransactionResult>(network, "tx", [txHash, senderAccountId]);
}

/**
 * Query token balance
 * @param network - CAIP-2 network identifier
 * @param accountId - Account to query
 * @param tokenContract - Token contract address
 * @returns Balance as bigint
 */
export async function queryTokenBalance(
  network: string,
  accountId: string,
  tokenContract: string,
): Promise<bigint> {
  try {
    const result = await rpcCall<{ result: number[] }>(network, "query", {
      request_type: "call_function",
      finality: "final",
      account_id: tokenContract,
      method_name: "ft_balance_of",
      args_base64: btoa(JSON.stringify({ account_id: accountId })),
    });

    // Result is a byte array representing the JSON response
    const bytes = new Uint8Array(result.result);
    const text = new TextDecoder().decode(bytes);
    // Remove quotes from JSON string response
    const balance = text.replace(/"/g, "");
    return BigInt(balance);
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return 0n;
  }
}

/**
 * Parse ft_transfer args from base64 encoded string
 * @param argsBase64 - Base64 encoded JSON arguments
 * @returns Parsed ft_transfer arguments
 */
export function parseFtTransferArgs(argsBase64: string): FtTransferArgs | null {
  try {
    const argsJson = atob(argsBase64);
    return JSON.parse(argsJson) as FtTransferArgs;
  } catch {
    // Try parsing as raw JSON (some nodes return it differently)
    try {
      return JSON.parse(argsBase64) as FtTransferArgs;
    } catch {
      return null;
    }
  }
}

/**
 * Check if a transaction succeeded
 * @param status - Transaction status
 * @returns Whether the transaction succeeded
 */
export function isTransactionSuccessful(status: { SuccessValue?: string; Failure?: unknown }): boolean {
  return status.SuccessValue !== undefined && status.Failure === undefined;
}

/**
 * Format amount for display (with decimals)
 * @param amount - Amount in smallest units
 * @param decimals - Number of decimal places
 * @returns Formatted amount string
 */
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  const decimal = remainder.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${decimal}`;
}

/**
 * Convert decimal amount to token units
 * @param decimalAmount - Amount with decimals (e.g., "1.50")
 * @param decimals - Token decimals
 * @returns Amount in smallest units
 */
export function toTokenUnits(decimalAmount: string | number, decimals: number): bigint {
  const amount = typeof decimalAmount === "string" ? parseFloat(decimalAmount) : decimalAmount;
  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${decimalAmount}`);
  }
  const multiplier = 10 ** decimals;
  return BigInt(Math.floor(amount * multiplier));
}
