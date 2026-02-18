import { t402ResourceServer } from '@t402/core/server'
import { Network } from '@t402/core/types'
import { LightningScheme, LightningSchemeConfig } from './scheme.js'

/**
 * Configuration options for registering Lightning schemes to an t402ResourceServer
 */
export interface LightningResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (lightning:*)
   */
  networks?: Network[]

  /**
   * Scheme configuration (invoice generator, etc.)
   */
  schemeConfig: LightningSchemeConfig
}

/**
 * Registers Lightning payment schemes to an t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for Lightning resource server registration
 * @returns The server instance for chaining
 */
export function registerLightningScheme(
  server: t402ResourceServer,
  config: LightningResourceServerConfig,
): t402ResourceServer {
  const scheme = new LightningScheme(config.schemeConfig)

  if (config.networks && config.networks.length > 0) {
    config.networks.forEach((network) => {
      server.register(network, scheme)
    })
  } else {
    server.register('lightning:*', scheme)
  }

  return server
}
