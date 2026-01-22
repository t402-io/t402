import { t402ResourceServer } from "@t402/core/server";
import { Network } from "@t402/core/types";
import { ExactEvmScheme } from "./scheme";

/**
 * Configuration options for registering EVM schemes to an t402ResourceServer
 */
export interface EvmResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (eip155:*)
   */
  networks?: Network[];
}

/**
 * Registers EVM exact payment schemes to an t402ResourceServer instance.
 *
 * This function registers:
 * - V2: eip155:* wildcard scheme with ExactEvmScheme (or specific networks if provided)
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for EVM resource server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactEvmScheme } from "@t402/evm/exact/server/register";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer(facilitatorClient);
 * registerExactEvmScheme(server, {});
 * ```
 */
export function registerExactEvmScheme(
  server: t402ResourceServer,
  config: EvmResourceServerConfig = {},
): t402ResourceServer {
  // Register V2 scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach(network => {
      server.register(network, new ExactEvmScheme());
    });
  } else {
    // Register wildcard for all EVM chains
    server.register("eip155:*", new ExactEvmScheme());
  }

  return server;
}
