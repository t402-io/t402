/**
 * Registration function for Tezos Exact-Direct facilitator
 */

import { t402Facilitator } from "@t402/core/facilitator";
import type { Network } from "@t402/core/types";
import type { FacilitatorTezosSigner } from "../../types.js";
import {
  ExactDirectTezosFacilitator,
  type ExactDirectTezosFacilitatorConfig,
} from "./scheme.js";

/**
 * Configuration options for registering Tezos schemes to a t402Facilitator
 */
export interface TezosFacilitatorConfig {
  /**
   * The Tezos signer for facilitator operations (verify and settle)
   */
  signer: FacilitatorTezosSigner;

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (tezos:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactDirectTezosFacilitatorConfig;
}

/**
 * Registers Tezos exact-direct payment schemes to a t402Facilitator instance.
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for Tezos facilitator registration
 * @returns The facilitator instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectTezosFacilitator } from "@t402/tezos/exact-direct/facilitator";
 * import { t402Facilitator } from "@t402/core/facilitator";
 *
 * const facilitator = new t402Facilitator();
 * registerExactDirectTezosFacilitator(facilitator, {
 *   signer: myTezosSigner,
 *   networks: ["tezos:NetXdQprcVkpaWU"]
 * });
 * ```
 */
export function registerExactDirectTezosFacilitator(
  facilitator: t402Facilitator,
  config: TezosFacilitatorConfig,
): t402Facilitator {
  const scheme = new ExactDirectTezosFacilitator(
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
    // Register wildcard for all Tezos networks
    facilitator.register("tezos:*", scheme);
  }

  return facilitator;
}
