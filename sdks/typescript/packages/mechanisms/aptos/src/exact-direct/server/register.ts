/**
 * Registration function for Aptos Exact-Direct server
 */

import { t402ResourceServer } from "@t402/core/server";
import type { Network } from "@t402/core/types";
import {
  ExactDirectAptosServer,
  type ExactDirectAptosServerConfig,
} from "./scheme.js";

/**
 * Configuration options for registering Aptos schemes to a t402ResourceServer
 */
export interface AptosServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (aptos:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactDirectAptosServerConfig;
}

/**
 * Registers Aptos exact-direct payment schemes to a t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Aptos server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectAptosServer } from "@t402/aptos/exact-direct/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer();
 * registerExactDirectAptosServer(server, {
 *   networks: ["aptos:1"],
 *   schemeConfig: { preferredToken: "USDT" }
 * });
 * ```
 */
export function registerExactDirectAptosServer(
  server: t402ResourceServer,
  config: AptosServerConfig = {},
): t402ResourceServer {
  const scheme = new ExactDirectAptosServer(config.schemeConfig);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      server.register(network, scheme);
    });
  } else {
    // Register wildcard for all Aptos networks
    server.register("aptos:*", scheme);
  }

  return server;
}
