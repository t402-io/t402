/**
 * @t402/near - NEAR Protocol Implementation for T402
 *
 * This package provides NEAR blockchain support for the T402 payment protocol.
 * It implements the exact-direct scheme using NEP-141 (fungible token standard).
 *
 * @example
 * ```typescript
 * // Client usage
 * import { ExactDirectNearScheme } from '@t402/near/exact-direct/client';
 *
 * const client = new ExactDirectNearScheme(signer);
 * const payload = await client.createPaymentPayload(2, requirements);
 *
 * // Server usage
 * import { ExactDirectNearScheme } from '@t402/near/exact-direct/server';
 *
 * const server = new ExactDirectNearScheme();
 * const assetAmount = await server.parsePrice(1.50, 'near:mainnet');
 * ```
 */

// Constants
export * from "./constants.js";

// Types
export * from "./types.js";

// Tokens
export * from "./tokens.js";

// Utilities
export * from "./utils.js";

// Exact-Direct scheme exports
export * from "./exact-direct/index.js";

// Upto scheme exports
export * from "./upto/index.js";
