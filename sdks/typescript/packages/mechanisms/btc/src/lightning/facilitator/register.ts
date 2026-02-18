import { t402Facilitator } from '@t402/core/facilitator'
import { Network } from '@t402/core/types'
import { FacilitatorLightningSigner, LightningScheme } from './scheme.js'

/**
 * Configuration options for registering Lightning schemes to an t402Facilitator
 */
export interface LightningFacilitatorConfig {
  /**
   * The Lightning signer for facilitator operations
   */
  signer: FacilitatorLightningSigner

  /**
   * Networks to register (single network or array of networks)
   * Examples: "lightning:mainnet", ["lightning:mainnet", "lightning:testnet"]
   */
  networks: Network | Network[]
}

/**
 * Registers Lightning payment schemes to an t402Facilitator instance.
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for Lightning facilitator registration
 * @returns The facilitator instance for chaining
 */
export function registerLightningScheme(
  facilitator: t402Facilitator,
  config: LightningFacilitatorConfig,
): t402Facilitator {
  facilitator.register(config.networks, new LightningScheme(config.signer))
  return facilitator
}
