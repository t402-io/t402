/**
 * ERC-20 Approval Gas Sponsoring Extension Client-Side Implementation
 *
 * Provides functions for clients to construct ERC-20 approve() calldata
 * and encode gas sponsor payloads for transmission.
 */

import type {
  ERC20ApprovalGasSponsorPayload,
  ERC20ApprovalGasSponsorExtensionInfo,
  CreateERC20ApprovalParams,
} from "./types.js";

/**
 * Extension key for ERC-20 approval gas sponsoring in payment requirements.
 */
export const ERC20_APPROVAL_GAS_SPONSOR_EXTENSION_KEY = "erc20ApprovalGasSponsoring";

/**
 * HTTP header name for ERC-20 approval gas sponsor payload.
 */
export const ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME = "X-T402-ERC20-Approval-Gas-Sponsoring";

/**
 * ERC-20 approve(address,uint256) function selector.
 */
export const APPROVE_FUNCTION_SELECTOR = "0x095ea7b3";

/**
 * Encodes ERC-20 approve(address spender, uint256 amount) calldata.
 *
 * @param spender - The spender address to approve
 * @param amount - The approval amount in base units
 * @returns Hex-encoded calldata with 0x prefix
 *
 * @example
 * ```typescript
 * const calldata = encodeApproveCalldata("0xFacilitator...", "1000000");
 * // Returns "0x095ea7b3" + abi-encoded args
 * ```
 */
export function encodeApproveCalldata(spender: string, amount: string): string {
  // Remove 0x prefix from spender address
  const spenderHex = spender.startsWith("0x") ? spender.slice(2) : spender;

  // Pad spender address to 32 bytes (left-padded with zeros)
  const paddedSpender = spenderHex.toLowerCase().padStart(64, "0");

  // Convert amount to hex and pad to 32 bytes (left-padded with zeros)
  const amountBigInt = BigInt(amount);
  const amountHex = amountBigInt.toString(16).padStart(64, "0");

  return APPROVE_FUNCTION_SELECTOR + paddedSpender + amountHex;
}

/**
 * Creates an ERC-20 approval gas sponsor payload from params and extension info.
 *
 * @param info - The server's extension info
 * @param params - The approval parameters
 * @returns Gas sponsor payload ready for header encoding
 *
 * @example
 * ```typescript
 * const payload = createERC20ApprovalGasSponsorPayload(extensionInfo, {
 *   network: "eip155:8453",
 *   from: wallet.address,
 *   asset: "0xUSDT...",
 *   amount: "1000000",
 *   signedApprovalTx: signedTx,
 *   chainId: 8453,
 * });
 * ```
 */
export function createERC20ApprovalGasSponsorPayload(
  info: ERC20ApprovalGasSponsorExtensionInfo,
  params: CreateERC20ApprovalParams,
): ERC20ApprovalGasSponsorPayload {
  const payload: ERC20ApprovalGasSponsorPayload = {
    network: params.network,
    from: params.from,
    asset: params.asset,
    amount: params.amount,
    signedApprovalTx: params.signedApprovalTx.startsWith("0x")
      ? params.signedApprovalTx
      : "0x" + params.signedApprovalTx,
    chainId: params.chainId,
  };

  if (params.nonce !== undefined) {
    payload.nonce = params.nonce;
  }

  return payload;
}

/**
 * Encodes an ERC-20 approval gas sponsor payload for transmission in HTTP header.
 *
 * @param payload - The gas sponsor payload to encode
 * @returns Base64-encoded JSON string
 *
 * @example
 * ```typescript
 * const header = encodeERC20ApprovalGasSponsorHeader(payload);
 * fetch(url, {
 *   headers: { [ERC20_APPROVAL_GAS_SPONSOR_HEADER_NAME]: header }
 * });
 * ```
 */
export function encodeERC20ApprovalGasSponsorHeader(
  payload: ERC20ApprovalGasSponsorPayload,
): string {
  const json = JSON.stringify(payload);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64");
  }
  return btoa(json);
}
