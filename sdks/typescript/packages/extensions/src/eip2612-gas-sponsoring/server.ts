/**
 * EIP-2612 Gas Sponsoring Extension Server-Side Implementation
 *
 * Provides functions for servers to declare gas sponsoring requirements,
 * parse client headers, and validate permit payloads.
 */

import type {
  Eip2612GasSponsorExtension,
  Eip2612GasSponsorExtensionInfo,
  Eip2612GasSponsorPayload,
  DeclareEip2612GasSponsorOptions,
  ValidateEip2612GasSponsorOptions,
  Eip2612GasSponsorValidationResult,
} from "./types.js";

/**
 * JSON Schema for EIP-2612 gas sponsor payload validation.
 */
const EIP2612_GAS_SPONSOR_SCHEMA = {
  type: "object",
  required: ["network", "permitSignature", "owner", "spender", "value", "deadline", "v", "r", "s"],
  properties: {
    network: { type: "string" },
    permitSignature: { type: "string" },
    owner: { type: "string" },
    spender: { type: "string" },
    value: { type: "string" },
    deadline: { type: "number" },
    v: { type: "number" },
    r: { type: "string" },
    s: { type: "string" },
  },
};

/**
 * Declares an EIP-2612 gas sponsor extension for server responses.
 *
 * @param options - Extension declaration options
 * @returns Gas sponsor extension object ready for response
 *
 * @example
 * ```typescript
 * const extension = declareEip2612GasSponsorExtension({
 *   sponsoredNetworks: ["eip155:8453", "eip155:42161"],
 *   maxAmount: "1000000000",
 *   sponsorAddress: "0xFacilitator...",
 * });
 * ```
 */
export function declareEip2612GasSponsorExtension(
  options: DeclareEip2612GasSponsorOptions,
): Eip2612GasSponsorExtension {
  const info: Eip2612GasSponsorExtensionInfo = {
    sponsoredNetworks: options.sponsoredNetworks,
    maxAmount: options.maxAmount,
    permitDeadline: options.permitDeadline ?? 300,
    sponsorAddress: options.sponsorAddress,
  };

  return {
    info,
    schema: EIP2612_GAS_SPONSOR_SCHEMA,
  };
}

/**
 * Parses an EIP-2612 gas sponsor header from client request.
 *
 * The header format is base64-encoded JSON.
 *
 * @param header - Base64-encoded gas sponsor header value
 * @returns Parsed gas sponsor payload
 * @throws Error if header is invalid
 *
 * @example
 * ```typescript
 * const payload = parseEip2612GasSponsorHeader(
 *   request.headers['x-t402-eip2612-gas-sponsoring']
 * );
 * ```
 */
export function parseEip2612GasSponsorHeader(header: string): Eip2612GasSponsorPayload {
  if (!header) {
    throw new Error("Missing EIP-2612 gas sponsor header");
  }

  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const payload = JSON.parse(decoded) as Eip2612GasSponsorPayload;

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
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid EIP-2612 gas sponsor header: malformed JSON");
    }
    throw error;
  }
}

/**
 * Validates an EIP-2612 gas sponsor payload against server extension info.
 *
 * @param payload - The gas sponsor payload from the client
 * @param extensionInfo - The server's gas sponsor extension info
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateEip2612GasSponsorPayload(payload, extension.info);
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 * ```
 */
export function validateEip2612GasSponsorPayload(
  payload: Eip2612GasSponsorPayload,
  extensionInfo: Eip2612GasSponsorExtensionInfo,
  options: ValidateEip2612GasSponsorOptions = {},
): Eip2612GasSponsorValidationResult {
  const now = options.now ? options.now() : Date.now();
  const nowSeconds = Math.floor(now / 1000);

  // Validate network is in sponsoredNetworks
  if (!extensionInfo.sponsoredNetworks.includes(payload.network)) {
    return {
      valid: false,
      error: `Network ${payload.network} is not in sponsored networks: ${extensionInfo.sponsoredNetworks.join(", ")}`,
    };
  }

  // Validate amount does not exceed maxAmount
  const payloadValue = BigInt(payload.value);
  const maxAmount = BigInt(extensionInfo.maxAmount);
  if (payloadValue > maxAmount) {
    return {
      valid: false,
      error: `Value ${payload.value} exceeds maximum amount ${extensionInfo.maxAmount}`,
    };
  }

  // Validate deadline is in the future
  if (payload.deadline <= nowSeconds) {
    return {
      valid: false,
      error: "Permit deadline has expired",
    };
  }

  // Validate deadline does not exceed permitDeadline seconds from now
  const maxDeadline = nowSeconds + extensionInfo.permitDeadline;
  if (payload.deadline > maxDeadline) {
    return {
      valid: false,
      error: `Permit deadline ${payload.deadline} exceeds maximum allowed deadline ${maxDeadline}`,
    };
  }

  // Validate spender matches sponsorAddress
  if (payload.spender.toLowerCase() !== extensionInfo.sponsorAddress.toLowerCase()) {
    return {
      valid: false,
      error: `Spender ${payload.spender} does not match sponsor address ${extensionInfo.sponsorAddress}`,
    };
  }

  // Validate permitSignature format (65 bytes = 130 hex chars)
  const sigHex = payload.permitSignature.startsWith("0x")
    ? payload.permitSignature.slice(2)
    : payload.permitSignature;
  if (sigHex.length !== 130) {
    return {
      valid: false,
      error: `Invalid permit signature length: expected 130 hex chars, got ${sigHex.length}`,
    };
  }

  // Validate v is 27 or 28
  if (payload.v !== 27 && payload.v !== 28) {
    return {
      valid: false,
      error: `Invalid v value: expected 27 or 28, got ${payload.v}`,
    };
  }

  // Validate r format (32 bytes = 64 hex chars)
  const rHex = payload.r.startsWith("0x") ? payload.r.slice(2) : payload.r;
  if (rHex.length !== 64) {
    return {
      valid: false,
      error: `Invalid r length: expected 64 hex chars, got ${rHex.length}`,
    };
  }

  // Validate s format (32 bytes = 64 hex chars)
  const sHex = payload.s.startsWith("0x") ? payload.s.slice(2) : payload.s;
  if (sHex.length !== 64) {
    return {
      valid: false,
      error: `Invalid s length: expected 64 hex chars, got ${sHex.length}`,
    };
  }

  return { valid: true };
}
