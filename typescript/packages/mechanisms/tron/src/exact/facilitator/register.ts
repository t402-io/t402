/**
 * TRON Facilitator Scheme Registration
 *
 * Helper function to register TRON exact scheme with a t402 facilitator.
 */

import { t402Facilitator } from "@t402/core/facilitator";
import { Network } from "@t402/core/types";
import { ExactTronScheme, ExactTronSchemeConfig } from "./scheme.js";
import { FacilitatorTronSigner } from "../../signer.js";

/**
 * Configuration options for registering TRON schemes to a t402Facilitator
 */
export interface TronFacilitatorConfig {
  /**
   * The signer to use for verification and settlement
   */
  signer: FacilitatorTronSigner;

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (tron:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactTronSchemeConfig;
}

/**
 * Registers TRON exact payment schemes to a t402Facilitator instance.
 *
 * This function registers:
 * - V2: tron:* wildcard scheme with ExactTronScheme (or specific networks if provided)
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for TRON facilitator registration
 * @returns The facilitator instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactTronScheme } from "@t402/tron/exact/facilitator";
 * import { t402Facilitator } from "@t402/core/facilitator";
 *
 * const signer = new MyTronSigner(privateKey);
 * const facilitator = new t402Facilitator();
 * registerExactTronScheme(facilitator, { signer });
 *
 * // Or with specific networks
 * registerExactTronScheme(facilitator, {
 *   signer,
 *   networks: ["tron:mainnet"],
 *   schemeConfig: { canSponsorGas: true }
 * });
 * ```
 */
export function registerExactTronScheme(
  facilitator: t402Facilitator,
  config: TronFacilitatorConfig,
): t402Facilitator {
  const scheme = new ExactTronScheme(config.signer, config.schemeConfig);

  // Register V2 scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach(network => {
      facilitator.register(network, scheme);
    });
  } else {
    // Register wildcard for all TRON networks
    facilitator.register("tron:*", scheme);
  }

  return facilitator;
}
