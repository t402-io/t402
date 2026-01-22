/**
 * Registration function for NEAR Exact-Direct server
 */

import { t402ResourceServer } from "@t402/core/server";
import { Network } from "@t402/core/types";
import { ExactDirectNearServer, type ExactDirectNearServerConfig } from "./scheme.js";

/**
 * Configuration options for registering NEAR schemes to a t402ResourceServer
 */
export interface NearResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (near:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration (preferred token, etc.)
   */
  schemeConfig?: ExactDirectNearServerConfig;
}

/**
 * Registers NEAR exact-direct payment schemes to a t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for NEAR resource server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectNearServer } from "@t402/near/exact-direct/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer(facilitatorClient);
 * registerExactDirectNearServer(server, {});
 *
 * // Or with specific token preference
 * registerExactDirectNearServer(server, {
 *   schemeConfig: { preferredToken: "USDT" }
 * });
 * ```
 */
export function registerExactDirectNearServer(
  server: t402ResourceServer,
  config: NearResourceServerConfig = {},
): t402ResourceServer {
  const scheme = new ExactDirectNearServer(config.schemeConfig);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      server.register(network, scheme);
    });
  } else {
    // Register wildcard for all NEAR networks
    server.register("near:*", scheme);
  }

  return server;
}
