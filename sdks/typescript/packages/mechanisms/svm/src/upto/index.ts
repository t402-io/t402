/**
 * Up-To Scheme for SVM (Solana)
 *
 * The upto scheme enables usage-based billing by authorizing
 * the facilitator to transfer up to a maximum amount using
 * SPL ApproveChecked.
 *
 * @module
 */

export type { UptoSvmPayload, UptoSvmAuthorization, UptoSvmExtra } from "./types.js";
export { isUptoSvmPayload } from "./types.js";
