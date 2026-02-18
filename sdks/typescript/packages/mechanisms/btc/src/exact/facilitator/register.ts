import { t402Facilitator } from '@t402/core/facilitator'
import { Network } from '@t402/core/types'
import { FacilitatorBtcSigner, ExactBtcScheme } from './scheme.js'

/**
 * Configuration options for registering BTC schemes to an t402Facilitator
 */
export interface BtcFacilitatorConfig {
  /**
   * The Bitcoin signer for facilitator operations (verify and settle)
   */
  signer: FacilitatorBtcSigner

  /**
   * Networks to register (single network or array of networks)
   * Examples: "bip122:000000000019d6689c085ae165831e93"
   */
  networks: Network | Network[]
}

/**
 * Registers Bitcoin exact payment schemes to an t402Facilitator instance.
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for BTC facilitator registration
 * @returns The facilitator instance for chaining
 */
export function registerExactBtcScheme(
  facilitator: t402Facilitator,
  config: BtcFacilitatorConfig,
): t402Facilitator {
  facilitator.register(config.networks, new ExactBtcScheme(config.signer))
  return facilitator
}
