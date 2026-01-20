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
 * Signs a SIWx message using the provided signer.
 *
 * @param message - CAIP-122 formatted message to sign
 * @param signer - Wallet/signer interface with signMessage
 * @param options - Signing options
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
  options?: { signatureScheme?: SignatureScheme }
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
      // EIP-712 requires structured data, not a plain message
      // This would need a typed data wrapper
      throw new Error("EIP-712 signing not yet implemented");

    case "eip1271":
    case "eip6492":
      // Smart wallet signatures go through the same signMessage path
      // but verification happens on-chain
      if (!signer.signMessage) {
        throw new Error("Signer does not support signing");
      }
      return signer.signMessage(message);

    case "siws":
    case "sep10":
      throw new Error(`Signature scheme ${scheme} not yet implemented`);

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
  signer: SIWxSigner
): Promise<SIWxPayload> {
  const { info } = serverExtension;

  // Create the message to sign
  const message = createSIWxMessage(info, signer.address);

  // Sign the message
  const signature = await signSIWxMessage(message, signer, {
    signatureScheme: info.signatureScheme,
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
