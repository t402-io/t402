/**
 * Up-To Scheme for EVM
 *
 * The upto scheme enables usage-based billing by authorizing
 * transfer of up to a maximum amount using EIP-2612 Permit.
 *
 * @example
 * ```typescript
 * // Client-side
 * import { UptoEvmScheme } from "@t402/evm/upto/client";
 *
 * const scheme = new UptoEvmScheme(signer);
 * client.registerScheme("eip155:8453", scheme);
 *
 * // Make request with upto authorization
 * const response = await fetchWithPayment("https://api.example.com/llm", {
 *   method: "POST",
 *   body: JSON.stringify({ prompt: "Hello" }),
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Server-side
 * import { UptoEvmServerScheme } from "@t402/evm/upto/server";
 *
 * const scheme = new UptoEvmServerScheme({
 *   routerAddress: "0x...",
 *   defaultUnit: "token",
 * });
 * server.registerScheme("eip155:8453", scheme);
 * ```
 *
 * @example
 * ```typescript
 * // Facilitator-side
 * import { UptoEvmFacilitatorScheme } from "@t402/evm/upto/facilitator";
 *
 * const scheme = new UptoEvmFacilitatorScheme(signer, {
 *   routerAddresses: { "eip155:8453": "0x..." },
 * });
 * facilitator.registerScheme(scheme);
 * ```
 *
 * @module
 */

// Client exports
export { UptoEvmScheme, createUptoEvmScheme } from "./client/index.js";

// Server exports
export { UptoEvmServerScheme, createUptoEvmServerScheme } from "./server/index.js";
export type { UptoEvmServerSchemeConfig } from "./server/index.js";

// Facilitator exports
export { UptoEvmFacilitatorScheme, createUptoEvmFacilitatorScheme } from "./facilitator/index.js";
export type { UptoEvmFacilitatorSchemeConfig } from "./facilitator/index.js";

// Re-export types
export type {
  UptoEIP2612Payload,
  UptoEIP2612PayloadCompact,
  UptoEvmPayloadV2,
  UptoEvmExtra,
  UptoEvmSettlement,
  PermitSignature,
  PermitAuthorization,
} from "../types.js";

export { permitTypes, isUptoEIP2612Payload } from "../types.js";
