import { t402Client, PaymentPolicy } from '@t402/core/client'
import { Network } from '@t402/core/types'
import { ClientBtcSigner } from '../../signer.js'
import { ExactBtcScheme } from './scheme.js'

/**
 * Configuration options for registering BTC schemes to an t402Client
 */
export interface BtcClientConfig {
  /**
   * The Bitcoin signer to use for creating payment payloads
   */
  signer: ClientBtcSigner

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[]

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (bip122:*)
   */
  networks?: Network[]
}

/**
 * Registers Bitcoin exact payment schemes to an t402Client instance.
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for BTC client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactBtcScheme } from "@t402/btc/exact/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerExactBtcScheme(client, {
 *   signer: myBtcSigner,
 * });
 * ```
 */
export function registerExactBtcScheme(client: t402Client, config: BtcClientConfig): t402Client {
  const scheme = new ExactBtcScheme(config.signer)

  if (config.networks && config.networks.length > 0) {
    config.networks.forEach((network) => {
      client.register(network, scheme)
    })
  } else {
    client.register('bip122:*', scheme)
  }

  if (config.policies) {
    config.policies.forEach((policy) => {
      client.registerPolicy(policy)
    })
  }

  return client
}
