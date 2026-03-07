import { t402Client, PaymentPolicy } from '@t402/core/client'
import { Network } from '@t402/core/types'
import { ClientStellarSigner } from '../../signer.js'
import { ExactStellarScheme, ExactStellarSchemeConfig } from './scheme.js'

/**
 * Configuration options for registering Stellar schemes to an t402Client
 */
export interface StellarClientConfig {
  /**
   * The Stellar signer to use for creating payment payloads
   */
  signer: ClientStellarSigner

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[]

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (stellar:*)
   */
  networks?: Network[]

  /**
   * Optional scheme configuration (timeout, etc.)
   */
  schemeConfig?: ExactStellarSchemeConfig
}

/**
 * Registers Stellar exact payment schemes to an t402Client instance.
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for Stellar client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactStellarScheme } from "@t402/stellar/exact/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerExactStellarScheme(client, {
 *   signer: stellarSigner,
 * });
 * ```
 */
export function registerExactStellarScheme(
  client: t402Client,
  config: StellarClientConfig,
): t402Client {
  const scheme = new ExactStellarScheme(config.signer, config.schemeConfig)

  if (config.networks && config.networks.length > 0) {
    config.networks.forEach((network) => {
      client.register(network, scheme)
    })
  } else {
    client.register('stellar:*', scheme)
  }

  if (config.policies) {
    config.policies.forEach((policy) => {
      client.registerPolicy(policy)
    })
  }

  return client
}
