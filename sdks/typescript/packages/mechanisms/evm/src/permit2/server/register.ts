import { t402ResourceServer } from "@t402/core/server";
import { Network } from "@t402/core/types";
import { Permit2EvmScheme } from "./scheme";

/**
 * Configuration options for registering Permit2 schemes to an t402ResourceServer
 */
export interface Permit2EvmResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (eip155:*)
   */
  networks?: Network[];
}

/**
 * Registers Permit2 EVM payment schemes to an t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Permit2 resource server registration
 * @returns The server instance for chaining
 */
export function registerPermit2EvmScheme(
  server: t402ResourceServer,
  config: Permit2EvmResourceServerConfig = {},
): t402ResourceServer {
  if (config.networks && config.networks.length > 0) {
    config.networks.forEach(network => {
      server.register(network, new Permit2EvmScheme());
    });
  } else {
    server.register("eip155:*", new Permit2EvmScheme());
  }

  return server;
}
