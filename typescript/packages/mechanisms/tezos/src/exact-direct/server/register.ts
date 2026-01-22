/**
 * Registration function for Tezos Exact-Direct server
 */

import { t402ResourceServer } from "@t402/core/server";
import type { Network } from "@t402/core/types";
import {
  ExactDirectTezosServer,
  type ExactDirectTezosServerConfig,
} from "./scheme.js";

/**
 * Configuration options for registering Tezos schemes to a t402ResourceServer
 */
export interface TezosServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (tezos:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactDirectTezosServerConfig;
}

/**
 * Registers Tezos exact-direct payment scheme to a t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Tezos server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectTezosServer } from "@t402/tezos/exact-direct/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer();
 * registerExactDirectTezosServer(server, {
 *   networks: ["tezos:NetXdQprcVkpaWU"]
 * });
 * ```
 */
export function registerExactDirectTezosServer(
  server: t402ResourceServer,
  config: TezosServerConfig = {},
): t402ResourceServer {
  const scheme = new ExactDirectTezosServer(config.schemeConfig);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      server.register(network, scheme);
    });
  } else {
    // Register wildcard for all Tezos networks
    server.register("tezos:*", scheme);
  }

  return server;
}
