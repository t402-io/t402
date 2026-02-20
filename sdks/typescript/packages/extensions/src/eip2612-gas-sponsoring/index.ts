/**
 * @module eip2612-gas-sponsoring - t402 Payment Protocol EIP-2612 Gas Sponsoring Extension
 *
 * This module provides EIP-2612 permit-based gas sponsoring for the t402 protocol.
 * It allows facilitators to sponsor gas fees by having clients sign off-chain permits
 * instead of submitting on-chain approval transactions. The facilitator submits the
 * permit on-chain followed by settlement via Permit2.
 *
 * @example Server-side usage
 * ```typescript
 * import {
 *   declareEip2612GasSponsorExtension,
 *   parseEip2612GasSponsorHeader,
 *   validateEip2612GasSponsorPayload,
 * } from "@t402/extensions/eip2612-gas-sponsoring";
 *
 * // Declare extension in 402 response
 * const extension = declareEip2612GasSponsorExtension({
 *   sponsoredNetworks: ["eip155:8453", "eip155:42161"],
 *   maxAmount: "1000000000",
 *   sponsorAddress: "0xFacilitator...",
 * });
 *
 * // Parse and validate client header
 * const payload = parseEip2612GasSponsorHeader(
 *   request.headers['x-t402-eip2612-gas-sponsoring']
 * );
 * const result = validateEip2612GasSponsorPayload(payload, extension.info);
 * ```
 *
 * @example Client-side usage
 * ```typescript
 * import {
 *   createPermitSignature,
 *   createEip2612GasSponsorPayload,
 *   encodeEip2612GasSponsorHeader,
 *   EIP2612_GAS_SPONSOR_HEADER_NAME,
 * } from "@t402/extensions/eip2612-gas-sponsoring";
 *
 * const permit = await createPermitSignature({
 *   signer: wallet,
 *   tokenAddress: "0xUSDT...",
 *   tokenName: "Tether USD",
 *   chainId: 8453,
 *   spender: facilitatorAddress,
 *   value: "1000000",
 *   deadline: Math.floor(Date.now() / 1000) + 300,
 * });
 *
 * const payload = createEip2612GasSponsorPayload(permit, "eip155:8453");
 * fetch(url, {
 *   headers: { [EIP2612_GAS_SPONSOR_HEADER_NAME]: encodeEip2612GasSponsorHeader(payload) }
 * });
 * ```
 *
 * @example Facilitator-side usage
 * ```typescript
 * import {
 *   extractEip2612GasSponsorPayload,
 *   validateAndExtractPermit,
 *   buildPermitCallData,
 * } from "@t402/extensions/eip2612-gas-sponsoring";
 *
 * const result = validateAndExtractPermit(
 *   paymentPayload.extensions,
 *   extensionInfo
 * );
 * if (result.valid && result.payload) {
 *   const permitCall = buildPermitCallData(result.payload);
 *   // Submit permit() tx, then settle via Permit2
 * }
 * ```
 */

// Type exports
export type {
  Eip2612GasSponsorExtensionInfo,
  Eip2612GasSponsorExtension,
  Eip2612GasSponsorPayload,
  DeclareEip2612GasSponsorOptions,
  ValidateEip2612GasSponsorOptions,
  Eip2612GasSponsorValidationResult,
  CreatePermitParams,
  PermitSigner,
} from "./types.js";

// Server exports
export {
  declareEip2612GasSponsorExtension,
  parseEip2612GasSponsorHeader,
  validateEip2612GasSponsorPayload,
} from "./server.js";

// Client exports
export {
  createPermitSignature,
  createEip2612GasSponsorPayload,
  encodeEip2612GasSponsorHeader,
  EIP2612_GAS_SPONSOR_EXTENSION_KEY,
  EIP2612_GAS_SPONSOR_HEADER_NAME,
} from "./client.js";

// Facilitator exports
export {
  extractEip2612GasSponsorPayload,
  validateAndExtractPermit,
  buildPermitCallData,
} from "./facilitator.js";
