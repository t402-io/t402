import { t402ResourceServer } from '@t402/core/server'
import { Network } from '@t402/core/types'
import { ExactBtcScheme, ExactBtcSchemeConfig } from './scheme.js'

/**
 * Configuration options for registering BTC schemes to an t402ResourceServer
 */
export interface BtcResourceServerConfig {
  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (bip122:*)
   */
  networks?: Network[]

  /**
   * Scheme configuration (payTo address, etc.)
   */
  schemeConfig: ExactBtcSchemeConfig
}

/**
 * Registers Bitcoin exact payment schemes to an t402ResourceServer instance.
 *
 * @param server - The t402ResourceServer instance to register schemes to
 * @param config - Configuration for BTC resource server registration
 * @returns The server instance for chaining
 */
export function registerExactBtcScheme(
  server: t402ResourceServer,
  config: BtcResourceServerConfig,
): t402ResourceServer {
  const scheme = new ExactBtcScheme(config.schemeConfig)

  if (config.networks && config.networks.length > 0) {
    config.networks.forEach((network) => {
      server.register(network, scheme)
    })
  } else {
    server.register('bip122:*', scheme)
  }

  return server
}
