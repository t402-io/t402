import { t402Client, PaymentPolicy } from '@t402/core/client'
import { Network } from '@t402/core/types'
import { ClientLightningSigner } from '../../signer.js'
import { LightningScheme } from './scheme.js'

/**
 * Configuration options for registering Lightning schemes to an t402Client
 */
export interface LightningClientConfig {
  /**
   * The Lightning signer to use for paying invoices
   */
  signer: ClientLightningSigner

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[]

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (lightning:*)
   */
  networks?: Network[]
}

/**
 * Registers Lightning payment schemes to an t402Client instance.
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for Lightning client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerLightningScheme } from "@t402/btc/lightning/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerLightningScheme(client, {
 *   signer: myLnSigner,
 * });
 * ```
 */
export function registerLightningScheme(
  client: t402Client,
  config: LightningClientConfig,
): t402Client {
  const scheme = new LightningScheme(config.signer)

  if (config.networks && config.networks.length > 0) {
    config.networks.forEach((network) => {
      client.register(network, scheme)
    })
  } else {
    client.register('lightning:*', scheme)
  }

  if (config.policies) {
    config.policies.forEach((policy) => {
      client.registerPolicy(policy)
    })
  }

  return client
}
