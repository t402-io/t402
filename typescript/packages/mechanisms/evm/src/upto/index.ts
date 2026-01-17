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
 * @packageDocumentation
 */

// Client exports
export { UptoEvmScheme, createUptoEvmScheme } from "./client";

// Re-export types
export type {
  UptoEIP2612Payload,
  UptoEIP2612PayloadCompact,
  UptoEvmPayloadV2,
  UptoEvmExtra,
  UptoEvmSettlement,
  PermitSignature,
  PermitAuthorization,
} from "../types";

export { permitTypes, isUptoEIP2612Payload } from "../types";
