/**
 * @module sign-in-with-x - t402 Payment Protocol Sign-In-With-X Extension
 *
 * This module provides Sign-In-With-X (SIWx) authentication capabilities for the t402 protocol.
 * It implements CAIP-122 standard wallet-based identity assertions, allowing clients to prove
 * control of a wallet that may have previously paid for a resource.
 *
 * @example Server-side usage
 * ```typescript
 * import {
 *   declareSIWxExtension,
 *   parseSIWxHeader,
 *   validateSIWxMessage,
 *   verifySIWxSignature
 * } from "@t402/extensions/sign-in-with-x";
 *
 * // Declare extension in 402 response
 * const extension = declareSIWxExtension({
 *   resourceUri: "https://api.example.com/premium",
 *   network: "eip155:8453",
 *   statement: "Sign in to access premium content",
 * });
 *
 * // Parse and verify client header
 * const payload = parseSIWxHeader(request.headers['x-t402-siwx']);
 * const validation = validateSIWxMessage(payload, "https://api.example.com/premium");
 * const verification = await verifySIWxSignature(payload, payload.signature);
 * ```
 *
 * @example Client-side usage
 * ```typescript
 * import {
 *   createSIWxPayload,
 *   encodeSIWxHeader,
 *   SIWX_HEADER_NAME
 * } from "@t402/extensions/sign-in-with-x";
 *
 * // Get extension from 402 response
 * const extension = paymentRequirements.extensions?.siwx;
 *
 * // Create signed payload
 * const payload = await createSIWxPayload(extension, wallet);
 *
 * // Retry with SIWx header
 * fetch(url, {
 *   headers: { [SIWX_HEADER_NAME]: encodeSIWxHeader(payload) }
 * });
 * ```
 */

// Type exports
export type {
  SignatureScheme,
  SIWxExtensionInfo,
  SIWxExtension,
  SIWxPayload,
  DeclareSIWxOptions,
  ValidateSIWxOptions,
  VerifySIWxOptions,
  SIWxValidationResult,
  SIWxVerificationResult,
  SIWxSigner,
} from "./types.js";

// Server exports
export {
  declareSIWxExtension,
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
  constructMessage,
} from "./server.js";

// Client exports
export {
  encodeSIWxHeader,
  createSIWxMessage,
  signSIWxMessage,
  createSIWxPayload,
  SIWX_EXTENSION_KEY,
  SIWX_HEADER_NAME,
} from "./client.js";
