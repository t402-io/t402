/**
 * Registration function for Aptos Exact-Direct facilitator
 */

import { t402Facilitator } from "@t402/core/facilitator";
import type { Network } from "@t402/core/types";
import type { FacilitatorAptosSigner } from "../../types.js";
import {
  ExactDirectAptosFacilitator,
  type ExactDirectAptosFacilitatorConfig,
} from "./scheme.js";

/**
 * Configuration options for registering Aptos schemes to a t402Facilitator
 */
export interface AptosFacilitatorConfig {
  /**
   * The Aptos signer for facilitator operations (verify and settle)
   */
  signer: FacilitatorAptosSigner;

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (aptos:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactDirectAptosFacilitatorConfig;
}

/**
 * Registers Aptos exact-direct payment schemes to a t402Facilitator instance.
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for Aptos facilitator registration
 * @returns The facilitator instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectAptosFacilitator } from "@t402/aptos/exact-direct/facilitator";
 * import { t402Facilitator } from "@t402/core/facilitator";
 *
 * const facilitator = new t402Facilitator();
 * registerExactDirectAptosFacilitator(facilitator, {
 *   signer: myAptosSigner,
 *   networks: ["aptos:1"]
 * });
 * ```
 */
export function registerExactDirectAptosFacilitator(
  facilitator: t402Facilitator,
  config: AptosFacilitatorConfig,
): t402Facilitator {
  const scheme = new ExactDirectAptosFacilitator(
    config.signer,
    config.schemeConfig,
  );

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      facilitator.register(network, scheme);
    });
  } else {
    // Register wildcard for all Aptos networks
    facilitator.register("aptos:*", scheme);
  }

  return facilitator;
}
