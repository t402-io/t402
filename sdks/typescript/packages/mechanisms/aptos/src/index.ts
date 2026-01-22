/**
 * @t402/aptos - Aptos (Move) mechanism for T402 payment protocol
 *
 * This package provides support for Aptos blockchain payments using
 * the Fungible Asset (FA) standard.
 *
 * @example
 * ```typescript
 * // Client usage
 * import { registerExactDirectAptosClient } from "@t402/aptos/exact-direct/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerExactDirectAptosClient(client, {
 *   signer: myAptosSigner,
 *   networks: "aptos:1"
 * });
 *
 * // Server usage
 * import { registerExactDirectAptosServer } from "@t402/aptos/exact-direct/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer();
 * registerExactDirectAptosServer(server, {
 *   networks: "aptos:1",
 *   schemeConfig: { defaultPayTo: "0x..." }
 * });
 *
 * // Facilitator usage
 * import { registerExactDirectAptosFacilitator } from "@t402/aptos/exact-direct/facilitator";
 * import { t402Facilitator } from "@t402/core/facilitator";
 *
 * const facilitator = new t402Facilitator();
 * registerExactDirectAptosFacilitator(facilitator, {
 *   signer: myAptosSigner,
 *   networks: "aptos:1"
 * });
 * ```
 *
 * @packageDocumentation
 */

// Constants
export * from "./constants.js";

// Types
export * from "./types.js";

// Token registry
export * from "./tokens.js";

// Utility functions
export * from "./utils.js";

// Re-export scheme modules for convenience
export * from "./exact-direct/client/index.js";
export * from "./exact-direct/server/index.js";
export * from "./exact-direct/facilitator/index.js";
