/**
 * EIP-2612 Gas Sponsoring Extension Facilitator-Side Implementation
 *
 * Provides functions for facilitators to extract permit data from payment
 * extensions, validate permits, and prepare on-chain submission.
 */

import type {
  Eip2612GasSponsorPayload,
  Eip2612GasSponsorExtensionInfo,
  Eip2612GasSponsorValidationResult,
} from "./types.js";
import { EIP2612_GAS_SPONSOR_EXTENSION_KEY } from "./client.js";
import { validateEip2612GasSponsorPayload } from "./server.js";

/**
 * Extracts the EIP-2612 gas sponsor payload from payment extensions.
 *
 * @param extensions - The extensions map from a PaymentPayload
 * @returns The gas sponsor payload if present, or null
 *
 * @example
 * ```typescript
 * const permit = extractEip2612GasSponsorPayload(paymentPayload.extensions);
 * if (permit) {
 *   // Submit permit tx then settle via Permit2
 * }
 * ```
 */
export function extractEip2612GasSponsorPayload(
  extensions: Record<string, unknown> | undefined,
): Eip2612GasSponsorPayload | null {
  if (!extensions) {
    return null;
  }

  const raw = extensions[EIP2612_GAS_SPONSOR_EXTENSION_KEY];
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Record<string, unknown>;

  // Validate required fields are present
  const required = [
    "network",
    "permitSignature",
    "owner",
    "spender",
    "value",
    "deadline",
    "v",
    "r",
    "s",
  ];
  for (const field of required) {
    if (!(field in payload)) {
      return null;
    }
  }

  return {
    network: payload.network as string,
    permitSignature: payload.permitSignature as string,
    owner: payload.owner as string,
    spender: payload.spender as string,
    value: payload.value as string,
    deadline: payload.deadline as number,
    v: payload.v as number,
    r: payload.r as string,
    s: payload.s as string,
  };
}

/**
 * Validates and extracts the EIP-2612 gas sponsor payload in one step.
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
 * const result = validateAndExtractPermit(
 *   paymentPayload.extensions,
 *   extensionInfo
 * );
 * if (result.valid && result.payload) {
 *   // Submit permit() on token contract, then settle via Permit2
 * }
 * ```
 */
export function validateAndExtractPermit(
  extensions: Record<string, unknown> | undefined,
  extensionInfo: Eip2612GasSponsorExtensionInfo,
): Eip2612GasSponsorValidationResult & { payload?: Eip2612GasSponsorPayload } {
  const payload = extractEip2612GasSponsorPayload(extensions);

  if (!payload) {
    return {
      valid: false,
      error: `Missing or invalid ${EIP2612_GAS_SPONSOR_EXTENSION_KEY} extension in payment`,
    };
  }

  const result = validateEip2612GasSponsorPayload(payload, extensionInfo);

  if (!result.valid) {
    return result;
  }

  return { valid: true, payload };
}

/**
 * Builds the EIP-2612 permit function call data for on-chain submission.
 *
 * Returns the ABI-encoded parameters needed to call `permit(owner, spender, value, deadline, v, r, s)`
 * on the token contract.
 *
 * @param payload - The validated gas sponsor payload
 * @returns Object with the permit call parameters
 *
 * @example
 * ```typescript
 * const permitCall = buildPermitCallData(payload);
 * // Use permitCall with your preferred web3 library to submit the tx
 * ```
 */
export function buildPermitCallData(payload: Eip2612GasSponsorPayload): {
  owner: string;
  spender: string;
  value: string;
  deadline: number;
  v: number;
  r: string;
  s: string;
} {
  return {
    owner: payload.owner,
    spender: payload.spender,
    value: payload.value,
    deadline: payload.deadline,
    v: payload.v,
    r: payload.r,
    s: payload.s,
  };
}
