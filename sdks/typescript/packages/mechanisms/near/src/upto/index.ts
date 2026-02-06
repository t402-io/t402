/**
 * Up-To Scheme for NEAR
 *
 * The upto scheme enables usage-based billing on NEAR using an escrow pattern.
 * The client ft_transfers maxAmount to the facilitator, which then forwards
 * the actual settlement amount to the payTo address and refunds the rest.
 *
 * @example
 * ```typescript
 * import { UptoNearPayload, UptoNearExtra, isUptoNearPayload } from "@t402/near/upto";
 *
 * // Check if a payload is an upto NEAR payload
 * if (isUptoNearPayload(data)) {
 *   console.log(data.txHash);
 *   console.log(data.authorization.maxAmount);
 * }
 * ```
 *
 * @module
 */

export type {
  UptoNearAuthorization,
  UptoNearPayload,
  UptoNearExtra,
  UptoNearSettlement,
} from "./types.js";

export { isUptoNearPayload } from "./types.js";
