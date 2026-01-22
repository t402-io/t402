/**
 * Sign-In-With-X (SIWx) Client-Side Implementation
 *
 * Provides functions for clients to create and sign SIWx messages.
 */

import {
  SIWxPayload,
  SIWxExtension,
  SIWxExtensionInfo,
  SIWxSigner,
  SignatureScheme,
} from "./types.js";
import { constructMessage } from "./server.js";

/**
 * Encodes a SIWx payload for transmission in HTTP header.
 *
 * @param payload - The SIWx payload to encode
 * @returns Base64-encoded JSON string
 *
 * @example
 * ```typescript
 * const header = encodeSIWxHeader(payload);
 * fetch(url, {
 *   headers: { 'X-T402-SIWx': header }
 * });
 * ```
 */
export function encodeSIWxHeader(payload: SIWxPayload): string {
  const json = JSON.stringify(payload);
  // Use Buffer in Node.js or btoa in browser
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64");
  }
  return btoa(json);
}

/**
 * Creates a CAIP-122 formatted message string from server info.
 *
 * @param serverInfo - Extension info from server
 * @param address - Wallet address signing the message
 * @returns CAIP-122 formatted message string ready for signing
 *
 * @example
 * ```typescript
 * const message = createSIWxMessage(extension.info, wallet.address);
 * const signature = await wallet.signMessage(message);
 * ```
 */
export function createSIWxMessage(serverInfo: SIWxExtensionInfo, address: string): string {
  // Create a temporary payload for message construction
  const payload: SIWxPayload = {
    domain: serverInfo.domain,
    address,
    statement: serverInfo.statement,
    uri: serverInfo.uri,
    version: serverInfo.version,
    chainId: serverInfo.chainId,
    nonce: serverInfo.nonce,
    issuedAt: serverInfo.issuedAt,
    expirationTime: serverInfo.expirationTime,
    notBefore: serverInfo.notBefore,
    requestId: serverInfo.requestId,
    resources: serverInfo.resources,
    signature: "", // Will be added after signing
  };

  return constructMessage(payload);
}

/**
 * Creates EIP-712 typed data for SIWx signing.
 *
 * @param serverInfo - Extension info from server
 * @param address - Wallet address signing the message
 * @returns EIP-712 typed data object
 */
export function createSIWxTypedData(
  serverInfo: SIWxExtensionInfo,
  address: string,
): {
  domain: {
    name: string;
    version: string;
    chainId: number;
  };
  types: {
    SIWx: Array<{ name: string; type: string }>;
  };
  primaryType: "SIWx";
  message: Record<string, unknown>;
} {
  // Extract chain ID number from CAIP-2 format (e.g., "eip155:8453" -> 8453)
  const chainIdParts = serverInfo.chainId.split(":");
  const chainIdNum =
    chainIdParts.length > 1 ? parseInt(chainIdParts[1], 10) : parseInt(chainIdParts[0], 10);

  return {
    domain: {
      name: serverInfo.domain,
      version: serverInfo.version,
      chainId: chainIdNum,
    },
    types: {
      SIWx: [
        { name: "domain", type: "string" },
        { name: "address", type: "address" },
        { name: "statement", type: "string" },
        { name: "uri", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "string" },
        { name: "nonce", type: "string" },
        { name: "issuedAt", type: "string" },
        { name: "expirationTime", type: "string" },
        { name: "resources", type: "string[]" },
      ],
    },
    primaryType: "SIWx",
    message: {
      domain: serverInfo.domain,
      address,
      statement: serverInfo.statement || "",
      uri: serverInfo.uri,
      version: serverInfo.version,
      chainId: serverInfo.chainId,
      nonce: serverInfo.nonce,
      issuedAt: serverInfo.issuedAt,
      expirationTime: serverInfo.expirationTime || "",
      resources: serverInfo.resources || [],
    },
  };
}

/**
 * Signs a SIWx message using the provided signer.
 *
 * @param message - CAIP-122 formatted message to sign
 * @param signer - Wallet/signer interface with signMessage
 * @param options - Signing options
 * @param options.signatureScheme - Signature scheme to use
 * @param options.serverInfo - Server info for verification
 * @returns Hex-encoded signature
 *
 * @example
 * ```typescript
 * const signature = await signSIWxMessage(message, wallet, {
 *   signatureScheme: 'eip191'
 * });
 * ```
 */
export async function signSIWxMessage(
  message: string,
  signer: SIWxSigner,
  options?: { signatureScheme?: SignatureScheme; serverInfo?: SIWxExtensionInfo },
): Promise<string> {
  const scheme = options?.signatureScheme || "eip191";

  switch (scheme) {
    case "eip191":
      if (!signer.signMessage) {
        throw new Error("Signer does not support personal_sign (EIP-191)");
      }
      return signer.signMessage(message);

    case "eip712":
      if (!signer.signTypedData) {
        throw new Error("Signer does not support signTypedData (EIP-712)");
      }
      if (!options?.serverInfo) {
        throw new Error("EIP-712 signing requires serverInfo in options");
      }
      const typedData = createSIWxTypedData(options.serverInfo, signer.address);
      return signer.signTypedData(typedData);

    case "eip1271":
    case "eip6492":
      // Smart wallet signatures go through the same signMessage path
      // but verification happens on-chain
      if (!signer.signMessage) {
        throw new Error("Signer does not support signing");
      }
      return signer.signMessage(message);

    case "siws":
      // Sign-In With Solana uses Ed25519 signatures
      if (!signer.signMessage) {
        throw new Error("Signer does not support signing");
      }
      // Solana wallets typically implement signMessage that handles the encoding
      return signer.signMessage(message);

    case "sep10":
      throw new Error("Stellar SEP-10 signing not yet implemented");

    default:
      throw new Error(`Unknown signature scheme: ${scheme}`);
  }
}

/**
 * Creates a complete SIWx payload from server extension and signer.
 *
 * This is the main entry point for clients - it handles message construction,
 * signing, and payload assembly.
 *
 * @param serverExtension - Extension from server's 402 response
 * @param signer - Wallet/signer interface
 * @returns Complete signed SIWx payload ready for header encoding
 *
 * @example
 * ```typescript
 * // Get extension from server 402 response
 * const extension = paymentRequirements.extensions?.siwx;
 *
 * // Create signed payload
 * const payload = await createSIWxPayload(extension, wallet);
 *
 * // Encode and send with retry
 * const header = encodeSIWxHeader(payload);
 * fetch(url, {
 *   headers: { 'X-T402-SIWx': header }
 * });
 * ```
 */
export async function createSIWxPayload(
  serverExtension: SIWxExtension,
  signer: SIWxSigner,
): Promise<SIWxPayload> {
  const { info } = serverExtension;

  // Create the message to sign
  const message = createSIWxMessage(info, signer.address);

  // Sign the message
  const signature = await signSIWxMessage(message, signer, {
    signatureScheme: info.signatureScheme,
    serverInfo: info,
  });

  // Assemble the complete payload
  return {
    domain: info.domain,
    address: signer.address,
    statement: info.statement,
    uri: info.uri,
    version: info.version,
    chainId: info.chainId,
    nonce: info.nonce,
    issuedAt: info.issuedAt,
    expirationTime: info.expirationTime,
    notBefore: info.notBefore,
    requestId: info.requestId,
    resources: info.resources,
    signature,
  };
}

/**
 * Extension key for SIWx in payment requirements.
 */
export const SIWX_EXTENSION_KEY = "siwx";

/**
 * HTTP header name for SIWx payload.
 */
export const SIWX_HEADER_NAME = "X-T402-SIWx";
