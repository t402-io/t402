/**
 * TRON Server Scheme Registration
 *
 * Helper function to register TRON exact scheme with a t402 resource server.
 */

import { t402ResourceServer } from "@t402/core/server";
import { Network } from "@t402/core/types";
import { ExactTronScheme, ExactTronSchemeConfig } from "./scheme.js";

/**
 * Configuration options for registering TRON schemes to a t402ResourceServer
 */
export interface TronResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (tron:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration (preferred token, etc.)
   */
  schemeConfig?: ExactTronSchemeConfig;
}

/**
 * Registers TRON exact payment schemes to a t402ResourceServer instance.
 *
 * This function registers:
 * - V2: tron:* wildcard scheme with ExactTronScheme (or specific networks if provided)
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for TRON resource server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactTronScheme } from "@t402/tron/exact/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer(facilitatorClient);
 * registerExactTronScheme(server, {});
 *
 * // Or with specific token preference
 * registerExactTronScheme(server, {
 *   schemeConfig: { preferredToken: "USDT" }
 * });
 * ```
 */
export function registerExactTronScheme(
  server: t402ResourceServer,
  config: TronResourceServerConfig = {},
): t402ResourceServer {
  const scheme = new ExactTronScheme(config.schemeConfig);

  // Register V2 scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach(network => {
      server.register(network, scheme);
    });
  } else {
    // Register wildcard for all TRON networks
    server.register("tron:*", scheme);
  }

  return server;
}
