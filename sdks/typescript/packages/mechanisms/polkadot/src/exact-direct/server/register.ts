/**
 * Registration function for Polkadot exact-direct server
 */

import { t402ResourceServer } from "@t402/core/server";
import type { Network } from "@t402/core/types";
import { POLKADOT_CAIP2_NAMESPACE } from "../../constants.js";
import { ExactDirectPolkadotServer, type ExactDirectPolkadotServerConfig } from "./scheme.js";

/**
 * Configuration for registering Polkadot server schemes
 */
export interface PolkadotServerRegistrationConfig extends ExactDirectPolkadotServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (polkadot:*)
   */
  networks?: Network[];
}

/**
 * Registers Polkadot exact-direct payment scheme to a t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Polkadot server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectPolkadotServer } from "@t402/polkadot/exact-direct/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer();
 * registerExactDirectPolkadotServer(server, {
 *   networks: ["polkadot:68d56f15f85d3136970ec16946040bc1"]
 * });
 * ```
 */
export function registerExactDirectPolkadotServer(
  server: t402ResourceServer,
  config: PolkadotServerRegistrationConfig = {},
): t402ResourceServer {
  const scheme = new ExactDirectPolkadotServer(config);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      server.register(network, scheme);
    });
  } else {
    // Register wildcard for all Polkadot networks
    server.register(`${POLKADOT_CAIP2_NAMESPACE}:*`, scheme);
  }

  return server;
}
