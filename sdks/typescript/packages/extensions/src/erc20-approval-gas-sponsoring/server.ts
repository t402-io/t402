/**
 * ERC-20 Approval Gas Sponsoring Extension Server-Side Implementation
 *
 * Provides functions for servers to declare gas sponsoring requirements,
 * parse client headers, and validate approval payloads.
 */

import type {
  ERC20ApprovalGasSponsorExtension,
  ERC20ApprovalGasSponsorExtensionInfo,
  ERC20ApprovalGasSponsorPayload,
  DeclareERC20ApprovalGasSponsorOptions,
  ValidateERC20ApprovalGasSponsorOptions,
  ERC20ApprovalGasSponsorValidationResult,
} from "./types.js";

/**
 * JSON Schema for ERC-20 approval gas sponsor payload validation.
 */
const ERC20_APPROVAL_GAS_SPONSOR_SCHEMA = {
  type: "object",
  required: ["network", "from", "asset", "amount", "signedApprovalTx", "chainId"],
  properties: {
    network: { type: "string" },
    from: { type: "string" },
    asset: { type: "string" },
    amount: { type: "string" },
    signedApprovalTx: { type: "string" },
    chainId: { type: "number" },
    nonce: { type: "number" },
  },
};

/**
 * Declares an ERC-20 approval gas sponsor extension for server responses.
 *
 * @param options - Extension declaration options
 * @returns Gas sponsor extension object ready for response
 *
 * @example
 * ```typescript
 * const extension = declareERC20ApprovalGasSponsorExtension({
 *   sponsoredNetworks: ["eip155:8453", "eip155:42161"],
 *   maxAmount: "1000000000",
 *   sponsorAddress: "0xFacilitator...",
 *   requiresAtomicBatch: true,
 * });
 * ```
 */
export function declareERC20ApprovalGasSponsorExtension(
  options: DeclareERC20ApprovalGasSponsorOptions,
): ERC20ApprovalGasSponsorExtension {
  const info: ERC20ApprovalGasSponsorExtensionInfo = {
    sponsoredNetworks: options.sponsoredNetworks,
    maxAmount: options.maxAmount,
    sponsorAddress: options.sponsorAddress,
    requiresAtomicBatch: options.requiresAtomicBatch ?? false,
  };

  if (options.permit2Address) {
    info.permit2Address = options.permit2Address;
  }

  return {
    info,
    schema: ERC20_APPROVAL_GAS_SPONSOR_SCHEMA,
  };
}

/**
 * Parses an ERC-20 approval gas sponsor header from client request.
 *
 * The header format is base64-encoded JSON.
 *
 * @param header - Base64-encoded gas sponsor header value
 * @returns Parsed gas sponsor payload
 * @throws Error if header is invalid
 *
 * @example
 * ```typescript
 * const payload = parseERC20ApprovalGasSponsorHeader(
 *   request.headers['x-t402-erc20-approval-gas-sponsoring']
 * );
 * ```
 */
export function parseERC20ApprovalGasSponsorHeader(header: string): ERC20ApprovalGasSponsorPayload {
  if (!header) {
    throw new Error("Missing ERC-20 approval gas sponsor header");
  }

  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const payload = JSON.parse(decoded) as ERC20ApprovalGasSponsorPayload;

    const required = ["network", "from", "asset", "amount", "signedApprovalTx", "chainId"];
    for (const field of required) {
      if (!(field in payload)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid ERC-20 approval gas sponsor header: malformed JSON");
    }
    throw error;
  }
}

/**
 * Validates an ERC-20 approval gas sponsor payload against server extension info.
 *
 * @param payload - The gas sponsor payload from the client
 * @param extensionInfo - The server's gas sponsor extension info
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateERC20ApprovalGasSponsorPayload(payload, extension.info);
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 * ```
 */
export function validateERC20ApprovalGasSponsorPayload(
  payload: ERC20ApprovalGasSponsorPayload,
  extensionInfo: ERC20ApprovalGasSponsorExtensionInfo,
  options: ValidateERC20ApprovalGasSponsorOptions = {},
): ERC20ApprovalGasSponsorValidationResult {
  // Validate network is in sponsoredNetworks
  if (!extensionInfo.sponsoredNetworks.includes(payload.network)) {
    return {
      valid: false,
      error: `Network ${payload.network} is not in sponsored networks: ${extensionInfo.sponsoredNetworks.join(", ")}`,
    };
  }

  // Validate amount does not exceed maxAmount
  const payloadAmount = BigInt(payload.amount);
  const maxAmount = BigInt(extensionInfo.maxAmount);
  if (payloadAmount > maxAmount) {
    return {
      valid: false,
      error: `Amount ${payload.amount} exceeds maximum amount ${extensionInfo.maxAmount}`,
    };
  }

  // Validate chainId matches expected value for network (if provided)
  if (options.expectedChainIds) {
    const expectedChainId = options.expectedChainIds[payload.network];
    if (expectedChainId !== undefined && payload.chainId !== expectedChainId) {
      return {
        valid: false,
        error: `Chain ID ${payload.chainId} does not match expected chain ID ${expectedChainId} for network ${payload.network}`,
      };
    }
  }

  // Validate signedApprovalTx is hex-encoded
  const txHex = payload.signedApprovalTx.startsWith("0x")
    ? payload.signedApprovalTx.slice(2)
    : payload.signedApprovalTx;
  if (txHex.length === 0) {
    return {
      valid: false,
      error: "Signed approval transaction is empty",
    };
  }
  if (!/^[0-9a-fA-F]+$/.test(txHex)) {
    return {
      valid: false,
      error: "Signed approval transaction is not valid hex",
    };
  }

  // Validate from address format
  const fromHex = payload.from.startsWith("0x") ? payload.from.slice(2) : payload.from;
  if (fromHex.length !== 40 || !/^[0-9a-fA-F]+$/.test(fromHex)) {
    return {
      valid: false,
      error: `Invalid from address: ${payload.from}`,
    };
  }

  // Validate asset address format
  const assetHex = payload.asset.startsWith("0x") ? payload.asset.slice(2) : payload.asset;
  if (assetHex.length !== 40 || !/^[0-9a-fA-F]+$/.test(assetHex)) {
    return {
      valid: false,
      error: `Invalid asset address: ${payload.asset}`,
    };
  }

  return { valid: true };
}
