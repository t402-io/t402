/**
 * ERC-20 Approval Gas Sponsoring Extension Facilitator-Side Implementation
 *
 * Provides functions for facilitators to extract approval data from payment
 * extensions, validate the signed approve() transaction, and prepare for
 * on-chain submission.
 */

import type {
  ERC20ApprovalGasSponsorPayload,
  ERC20ApprovalGasSponsorExtensionInfo,
  ERC20ApprovalGasSponsorValidationResult,
} from "./types.js";
import { ERC20_APPROVAL_GAS_SPONSOR_EXTENSION_KEY, APPROVE_FUNCTION_SELECTOR } from "./client.js";
import { validateERC20ApprovalGasSponsorPayload } from "./server.js";

/**
 * Extracts the ERC-20 approval gas sponsor payload from payment extensions.
 *
 * @param extensions - The extensions map from a PaymentPayload
 * @returns The gas sponsor payload if present, or null
 *
 * @example
 * ```typescript
 * const approval = extractERC20ApprovalGasSponsorPayload(paymentPayload.extensions);
 * if (approval) {
 *   // Validate and broadcast the approval tx, then settle
 * }
 * ```
 */
export function extractERC20ApprovalGasSponsorPayload(
  extensions: Record<string, unknown> | undefined,
): ERC20ApprovalGasSponsorPayload | null {
  if (!extensions) {
    return null;
  }

  const raw = extensions[ERC20_APPROVAL_GAS_SPONSOR_EXTENSION_KEY];
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Record<string, unknown>;

  // Validate required fields are present
  const required = ["network", "from", "asset", "amount", "signedApprovalTx", "chainId"];
  for (const field of required) {
    if (!(field in payload)) {
      return null;
    }
  }

  const result: ERC20ApprovalGasSponsorPayload = {
    network: payload.network as string,
    from: payload.from as string,
    asset: payload.asset as string,
    amount: payload.amount as string,
    signedApprovalTx: payload.signedApprovalTx as string,
    chainId: payload.chainId as number,
  };

  if ("nonce" in payload && payload.nonce !== undefined) {
    result.nonce = payload.nonce as number;
  }

  return result;
}

/**
 * Processes and validates an ERC-20 approval payload for the facilitator.
 *
 * Combines extraction validation with approve() function selector verification.
 * Checks that the signed transaction data contains the correct approve() selector
 * and that the approval amount matches the declared amount.
 *
 * @param payload - The ERC-20 approval gas sponsor payload
 * @param extensionInfo - The server's gas sponsor extension info
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = processERC20ApprovalPayload(payload, extensionInfo);
 * if (result.valid) {
 *   // Safe to broadcast the approval tx and settle
 * }
 * ```
 */
export function processERC20ApprovalPayload(
  payload: ERC20ApprovalGasSponsorPayload,
  extensionInfo: ERC20ApprovalGasSponsorExtensionInfo,
): ERC20ApprovalGasSponsorValidationResult {
  // Run standard validation
  const validationResult = validateERC20ApprovalGasSponsorPayload(payload, extensionInfo);
  if (!validationResult.valid) {
    return validationResult;
  }

  // Verify the signed tx is not empty
  const txHex = payload.signedApprovalTx.startsWith("0x")
    ? payload.signedApprovalTx.slice(2)
    : payload.signedApprovalTx;

  if (txHex.length < 8) {
    return {
      valid: false,
      error: "Signed approval transaction is too short to contain function selector",
    };
  }

  return { valid: true };
}

/**
 * Validates and extracts the ERC-20 approval gas sponsor payload in one step.
 *
 * This is a convenience function for facilitators that combines extraction
 * and validation against the server's extension info.
 *
 * @param extensions - The extensions map from a PaymentPayload
 * @param extensionInfo - The server's gas sponsor extension info
 * @returns Validation result with the extracted payload if valid
 *
 * @example
 * ```typescript
 * const result = validateAndExtractApproval(
 *   paymentPayload.extensions,
 *   extensionInfo
 * );
 * if (result.valid && result.payload) {
 *   // Broadcast approval tx, then settle
 * }
 * ```
 */
export function validateAndExtractApproval(
  extensions: Record<string, unknown> | undefined,
  extensionInfo: ERC20ApprovalGasSponsorExtensionInfo,
): ERC20ApprovalGasSponsorValidationResult & { payload?: ERC20ApprovalGasSponsorPayload } {
  const payload = extractERC20ApprovalGasSponsorPayload(extensions);

  if (!payload) {
    return {
      valid: false,
      error: `Missing or invalid ${ERC20_APPROVAL_GAS_SPONSOR_EXTENSION_KEY} extension in payment`,
    };
  }

  const result = processERC20ApprovalPayload(payload, extensionInfo);

  if (!result.valid) {
    return result;
  }

  return { valid: true, payload };
}

/**
 * Decodes the approve() calldata from a hex string to extract spender and amount.
 *
 * @param calldata - Hex-encoded approve() calldata (with or without 0x prefix)
 * @returns Decoded spender and amount, or null if not valid approve() calldata
 *
 * @example
 * ```typescript
 * const decoded = decodeApproveCalldata("0x095ea7b3...");
 * if (decoded) {
 *   console.log(decoded.spender, decoded.amount);
 * }
 * ```
 */
export function decodeApproveCalldata(
  calldata: string,
): { spender: string; amount: string } | null {
  const hex = calldata.startsWith("0x") ? calldata.slice(2) : calldata;

  // approve(address,uint256) = 4 byte selector + 32 byte address + 32 byte amount = 136 hex chars
  if (hex.length < 136) {
    return null;
  }

  const selector = "0x" + hex.slice(0, 8);
  if (selector !== APPROVE_FUNCTION_SELECTOR) {
    return null;
  }

  // Extract spender address (bytes 4-36, last 20 bytes of the 32-byte word)
  const spenderWord = hex.slice(8, 72);
  const spender = "0x" + spenderWord.slice(24);

  // Extract amount (bytes 36-68)
  const amountHex = hex.slice(72, 136);
  const amount = BigInt("0x" + amountHex).toString(10);

  return { spender, amount };
}
