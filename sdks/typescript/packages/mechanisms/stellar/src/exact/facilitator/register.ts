import { t402Facilitator } from '@t402/core/facilitator'
import { Network } from '@t402/core/types'
import { FacilitatorStellarSigner } from '../../signer.js'
import { ExactStellarScheme, ExactStellarSchemeConfig } from './scheme.js'

/**
 * Configuration options for registering Stellar schemes to an t402Facilitator
 */
export interface StellarFacilitatorConfig {
  /**
   * The Stellar signer for facilitator operations (verify and settle)
   */
  signer: FacilitatorStellarSigner

  /**
   * Networks to register (single network or array of networks)
   * Examples: "stellar:pubnet", ["stellar:pubnet", "stellar:testnet"]
   */
  networks: Network | Network[]

  /**
   * Optional scheme configuration (fee sponsorship, etc.)
   */
  schemeConfig?: ExactStellarSchemeConfig
}

/**
 * Registers Stellar exact payment schemes to an t402Facilitator instance.
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for Stellar facilitator registration
 * @returns The facilitator instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactStellarScheme } from "@t402/stellar/exact/facilitator";
 * import { t402Facilitator } from "@t402/core/facilitator";
 *
 * const facilitator = new t402Facilitator();
 * registerExactStellarScheme(facilitator, {
 *   signer: stellarSigner,
 *   networks: "stellar:pubnet"
 * });
 * ```
 */
export function registerExactStellarScheme(
  facilitator: t402Facilitator,
  config: StellarFacilitatorConfig,
): t402Facilitator {
  facilitator.register(
    config.networks,
    new ExactStellarScheme(config.signer, config.schemeConfig),
  )

  return facilitator
}
