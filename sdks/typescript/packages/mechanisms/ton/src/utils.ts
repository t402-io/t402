/**
 * TON Utility Functions
 *
 * Helper functions for TON address handling, message building,
 * and network operations.
 */

import { Address, beginCell, Cell } from "@ton/core";
import type { Network } from "@t402/core/types";
import {
  TON_MAINNET_CAIP2,
  TON_TESTNET_CAIP2,
  TON_NETWORKS,
  NETWORK_ENDPOINTS,
  JETTON_TRANSFER_OP,
} from "./constants.js";

/**
 * Normalize network identifier to CAIP-2 format
 *
 * @param network - Network identifier (may be legacy format)
 * @returns Normalized CAIP-2 network identifier
 * @throws Error if network is not supported
 */
export function normalizeNetwork(network: Network): Network {
  // Already in CAIP-2 format
  if (network.startsWith("ton:")) {
    if (!TON_NETWORKS.includes(network as (typeof TON_NETWORKS)[number])) {
      throw new Error(`Unsupported TON network: ${network}`);
    }
    return network as Network;
  }

  // Handle legacy format conversions
  const mapping: Record<string, Network> = {
    ton: TON_MAINNET_CAIP2 as Network,
    "ton-mainnet": TON_MAINNET_CAIP2 as Network,
    mainnet: TON_MAINNET_CAIP2 as Network,
    "ton-testnet": TON_TESTNET_CAIP2 as Network,
    testnet: TON_TESTNET_CAIP2 as Network,
  };

  const caip2 = mapping[network.toLowerCase()];
  if (!caip2) {
    throw new Error(`Unsupported TON network: ${network}`);
  }
  return caip2;
}

/**
 * Get RPC endpoint for a network
 *
 * @param network - Network identifier
 * @returns RPC endpoint URL
 */
export function getEndpoint(network: Network): string {
  const caip2 = normalizeNetwork(network);
  const endpoint = NETWORK_ENDPOINTS[caip2];
  if (!endpoint) {
    throw new Error(`No endpoint configured for network: ${network}`);
  }
  return endpoint;
}

/**
 * Check if a network identifier is a supported TON network
 *
 * @param network - Network identifier to check
 * @returns true if supported
 */
export function isTonNetwork(network: string): boolean {
  try {
    normalizeNetwork(network as Network);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate TON address format
 *
 * @param address - Address to validate
 * @returns true if valid TON address
 */
export function validateTonAddress(address: string): boolean {
  try {
    Address.parse(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse TON address from string
 *
 * @param address - Address string (friendly or raw format)
 * @returns Parsed Address object
 * @throws Error if invalid format
 */
export function parseTonAddress(address: string): Address {
  return Address.parse(address);
}

/**
 * Compare two TON addresses for equality
 * Handles different address formats (friendly, raw, bounceable/non-bounceable)
 *
 * @param addr1 - First address
 * @param addr2 - Second address
 * @returns true if addresses are equal
 */
export function addressesEqual(addr1: string, addr2: string): boolean {
  try {
    const a1 = Address.parse(addr1);
    const a2 = Address.parse(addr2);
    return a1.equals(a2);
  } catch {
    return false;
  }
}

/**
 * Format address to friendly format
 *
 * @param address - Address to format
 * @param options - Formatting options
 * @returns Friendly format address string
 */
export function formatAddress(
  address: string | Address,
  options?: { bounceable?: boolean; testOnly?: boolean },
): string {
  const addr = typeof address === "string" ? Address.parse(address) : address;
  return addr.toString({
    bounceable: options?.bounceable ?? true,
    testOnly: options?.testOnly ?? false,
  });
}

/**
 * Convert decimal amount to smallest units (e.g., nano-Jettons)
 *
 * @param decimalAmount - Amount in decimal format (e.g., "1.50")
 * @param decimals - Number of decimal places
 * @returns Amount in smallest units as string
 */
export function convertToJettonAmount(decimalAmount: string, decimals: number): string {
  const amount = parseFloat(decimalAmount);
  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${decimalAmount}`);
  }
  const jettonAmount = Math.floor(amount * Math.pow(10, decimals));
  return jettonAmount.toString();
}

/**
 * Convert smallest units to decimal amount
 *
 * @param jettonAmount - Amount in smallest units
 * @param decimals - Number of decimal places
 * @returns Amount in decimal format as string
 */
export function convertFromJettonAmount(jettonAmount: string | bigint, decimals: number): string {
  const amount = typeof jettonAmount === "string" ? BigInt(jettonAmount) : jettonAmount;
  const divisor = BigInt(Math.pow(10, decimals));
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  return `${wholePart}.${fractionalStr}`.replace(/\.?0+$/, "");
}

/**
 * Generate a unique query ID for Jetton transfer
 * Uses timestamp + random component for uniqueness
 *
 * @returns BigInt query ID
 */
export function generateQueryId(): bigint {
  const timestamp = BigInt(Date.now());
  const random = BigInt(Math.floor(Math.random() * 1000000));
  return timestamp * 1000000n + random;
}

/**
 * Build Jetton transfer message body (TEP-74)
 *
 * @param params - Transfer parameters
 * @returns Cell containing the transfer message
 */
export function buildJettonTransferBody(params: {
  queryId: bigint;
  amount: bigint;
  destination: Address;
  responseDestination: Address;
  forwardAmount?: bigint;
  forwardPayload?: Cell;
}): Cell {
  const builder = beginCell()
    .storeUint(JETTON_TRANSFER_OP, 32) // op: transfer
    .storeUint(params.queryId, 64) // query_id
    .storeCoins(params.amount) // amount
    .storeAddress(params.destination) // destination
    .storeAddress(params.responseDestination) // response_destination
    .storeBit(false); // no custom payload

  // Forward amount (for notification)
  builder.storeCoins(params.forwardAmount ?? 1n);

  // Forward payload (optional)
  if (params.forwardPayload) {
    builder.storeBit(true).storeRef(params.forwardPayload);
  } else {
    builder.storeBit(false);
  }

  return builder.endCell();
}

/**
 * Parse Jetton transfer message from Cell
 *
 * @param body - Cell containing the message
 * @returns Parsed transfer parameters
 * @throws Error if not a valid Jetton transfer message
 */
export function parseJettonTransferBody(body: Cell): {
  op: number;
  queryId: bigint;
  amount: bigint;
  destination: Address;
  responseDestination: Address;
  forwardAmount: bigint;
  forwardPayload?: Cell;
} {
  const slice = body.beginParse();

  const op = slice.loadUint(32);
  if (op !== JETTON_TRANSFER_OP) {
    throw new Error(`Not a Jetton transfer message. Expected op ${JETTON_TRANSFER_OP}, got ${op}`);
  }

  const queryId = slice.loadUintBig(64);
  const amount = slice.loadCoins();
  const destination = slice.loadAddress();
  const responseDestination = slice.loadAddress();

  // Skip custom_payload bit
  const hasCustomPayload = slice.loadBit();
  if (hasCustomPayload) {
    slice.loadRef(); // Skip custom payload
  }

  const forwardAmount = slice.loadCoins();

  // Forward payload
  const hasForwardPayload = slice.loadBit();
  const forwardPayload = hasForwardPayload ? slice.loadRef() : undefined;

  return {
    op,
    queryId,
    amount,
    destination,
    responseDestination,
    forwardAmount,
    forwardPayload,
  };
}

/**
 * Calculate estimated gas for Jetton transfer
 * Based on typical TON network fees
 *
 * @param params - Optional parameters for estimation
 * @returns Estimated gas in nanoTON
 */
export function estimateJettonTransferGas(_params?: {
  hasForwardPayload?: boolean;
}): bigint {
  // Base cost for Jetton transfer (typical)
  // Includes: external message, wallet internal message, Jetton wallet message
  return 100_000_000n; // 0.1 TON (conservative estimate)
}
