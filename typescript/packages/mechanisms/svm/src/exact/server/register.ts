import { t402ResourceServer } from "@t402/core/server";
import { Network } from "@t402/core/types";
import { ExactSvmScheme } from "./scheme";

/**
 * Configuration options for registering SVM schemes to an t402ResourceServer
 */
export interface SvmResourceServerConfig {
  /**
   * Optional specific networks to register
   */
  networks?: Network[];
}

/**
 * Registers SVM payment schemes to an existing t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for SVM resource server registration
 * @returns The server instance for chaining
 */
export function registerExactSvmScheme(
  server: t402ResourceServer,
  config: SvmResourceServerConfig = {},
): t402ResourceServer {
  if (config.networks && config.networks.length > 0) {
    config.networks.forEach(network => {
      server.register(network, new ExactSvmScheme());
    });
  } else {
    server.register("solana:*", new ExactSvmScheme());
  }

  return server;
}
