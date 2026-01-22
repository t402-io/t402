/**
 * exact-legacy scheme for EVM tokens without EIP-3009 support
 *
 * This scheme uses the traditional approve + transferFrom pattern:
 * 1. Client must first approve the facilitator to spend tokens
 * 2. Client signs an EIP-712 authorization message
 * 3. Facilitator verifies the signature and calls transferFrom
 *
 * Supported tokens:
 * - Legacy USDT (Ethereum, Polygon)
 * - Other ERC20 tokens without EIP-3009
 */

export { ExactLegacyEvmScheme as ExactLegacyEvmClientScheme } from "./client/index.js";
export { ExactLegacyEvmScheme as ExactLegacyEvmServerScheme } from "./server/index.js";
export type { ExactLegacyEvmSchemeConfig as ExactLegacyEvmServerSchemeConfig } from "./server/index.js";
export { ExactLegacyEvmScheme as ExactLegacyEvmFacilitatorScheme } from "./facilitator/index.js";
export type { ExactLegacyEvmSchemeConfig as ExactLegacyEvmFacilitatorSchemeConfig } from "./facilitator/index.js";
