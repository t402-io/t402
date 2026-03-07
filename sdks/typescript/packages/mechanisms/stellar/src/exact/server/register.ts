import { t402ResourceServer } from '@t402/core/server'
import { Network } from '@t402/core/types'
import { ExactStellarScheme, ExactStellarSchemeConfig } from './scheme.js'

/**
 * Configuration options for registering Stellar schemes to an t402ResourceServer
 */
export interface StellarResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (stellar:*)
   */
  networks?: Network[]

  /**
   * Optional scheme configuration (preferred token, etc.)
   */
  schemeConfig?: ExactStellarSchemeConfig
}

/**
 * Registers Stellar exact payment schemes to an t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Stellar resource server registration
 * @returns The server instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactStellarScheme } from "@t402/stellar/exact/server";
 * import { t402ResourceServer } from "@t402/core/server";
 *
 * const server = new t402ResourceServer(facilitatorClient);
 * registerExactStellarScheme(server, {});
 * ```
 */
export function registerExactStellarScheme(
  server: t402ResourceServer,
  config: StellarResourceServerConfig = {},
): t402ResourceServer {
  const scheme = new ExactStellarScheme(config.schemeConfig)

  if (config.networks && config.networks.length > 0) {
    config.networks.forEach((network) => {
      server.register(network, scheme)
    })
  } else {
    server.register('stellar:*', scheme)
  }

  return server
}
