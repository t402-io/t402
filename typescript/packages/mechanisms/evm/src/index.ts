/**
 * @module @t402/evm - t402 Payment Protocol EVM Implementation
 *
 * This module provides the EVM-specific implementation of the t402 payment protocol.
 */

// Export EVM implementation modules here
// The actual implementation logic will be added by copying from the core/src/schemes/evm folder

export { ExactEvmScheme } from "./exact";
export { toClientEvmSigner, toFacilitatorEvmSigner } from "./signer";
export type { ClientEvmSigner, FacilitatorEvmSigner } from "./signer";
