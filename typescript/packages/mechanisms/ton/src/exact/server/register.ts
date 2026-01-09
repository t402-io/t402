import { t402ResourceServer } from "@t402/core/server";
import { Network } from "@t402/core/types";
import { ExactTonScheme, ExactTonSchemeConfig } from "./scheme.js";

/**
 * Configuration options for registering TON schemes to an t402ResourceServer
 */
export interface TonResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (ton:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration (preferred Jetton, etc.)
   */
  schemeConfig?: ExactTonSchemeConfig;
}

/**
 * Registers TON exact payment schemes to an t402ResourceServer instance.
 *
 * This function registers:
 * - V2: ton:* wildcard scheme with ExactTonScheme (or specific networks if provided)
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for TON resource server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactTonScheme } from "@t402/ton/exact/server/register";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer(facilitatorClient);
 * registerExactTonScheme(server, {});
 *
 * // Or with specific Jetton preference
 * registerExactTonScheme(server, {
 *   schemeConfig: { preferredJetton: "USDT" }
 * });
 * ```
 */
export function registerExactTonScheme(
  server: t402ResourceServer,
  config: TonResourceServerConfig = {},
): t402ResourceServer {
  const scheme = new ExactTonScheme(config.schemeConfig);

  // Register V2 scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach(network => {
      server.register(network, scheme);
    });
  } else {
    // Register wildcard for all TON networks
    server.register("ton:*", scheme);
  }

  return server;
}
