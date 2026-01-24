/**
 * Registration function for Stacks exact-direct server
 */

import { t402ResourceServer } from "@t402/core/server";
import type { Network } from "@t402/core/types";
import { STACKS_CAIP2_NAMESPACE } from "../../constants.js";
import { ExactDirectStacksServer, type ExactDirectStacksServerConfig } from "./scheme.js";

/**
 * Configuration for registering Stacks server schemes
 */
export interface StacksServerRegistrationConfig extends ExactDirectStacksServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (stacks:*)
   */
  networks?: Network[];
}

/**
 * Registers Stacks exact-direct payment scheme to a t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Stacks server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectStacksServer } from "@t402/stacks/exact-direct/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer();
 * registerExactDirectStacksServer(server, {
 *   networks: ["stacks:1"]
 * });
 * ```
 */
export function registerExactDirectStacksServer(
  server: t402ResourceServer,
  config: StacksServerRegistrationConfig = {},
): t402ResourceServer {
  const scheme = new ExactDirectStacksServer(config);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      server.register(network, scheme);
    });
  } else {
    // Register wildcard for all Stacks networks
    server.register(`${STACKS_CAIP2_NAMESPACE}:*`, scheme);
  }

  return server;
}
