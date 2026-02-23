import { t402ResourceServer } from "@t402/core/server";
import { Network } from "@t402/core/types";
import { Permit2ProxyEvmScheme, Permit2ProxyEvmSchemeConfig } from "./scheme";

/**
 * Configuration options for registering Permit2 Proxy schemes to an t402ResourceServer
 */
export interface Permit2ProxyEvmResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (eip155:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: Permit2ProxyEvmSchemeConfig;
}

/**
 * Registers Permit2 Proxy EVM payment schemes to an t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Permit2 Proxy resource server registration
 * @returns The server instance for chaining
 */
export function registerPermit2ProxyEvmScheme(
  server: t402ResourceServer,
  config: Permit2ProxyEvmResourceServerConfig = {},
): t402ResourceServer {
  if (config.networks && config.networks.length > 0) {
    config.networks.forEach(network => {
      server.register(network, new Permit2ProxyEvmScheme(config.schemeConfig));
    });
  } else {
    server.register("eip155:*", new Permit2ProxyEvmScheme(config.schemeConfig));
  }

  return server;
}
