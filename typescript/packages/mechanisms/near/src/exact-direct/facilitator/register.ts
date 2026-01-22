/**
 * Registration function for NEAR Exact-Direct facilitator
 */

import { t402Facilitator } from "@t402/core/facilitator";
import { Network } from "@t402/core/types";
import type { FacilitatorNearSigner } from "../../types.js";
import { ExactDirectNearFacilitator, type ExactDirectNearFacilitatorConfig } from "./scheme.js";

/**
 * Configuration options for registering NEAR schemes to a t402Facilitator
 */
export interface NearFacilitatorConfig {
  /**
   * The NEAR signer for facilitator operations (verify and settle)
   */
  signer: FacilitatorNearSigner;

  /**
   * Networks to register (single network or array of networks)
   * Examples: "near:mainnet", ["near:mainnet", "near:testnet"]
   */
  networks: Network | Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactDirectNearFacilitatorConfig;
}

/**
 * Registers NEAR exact-direct payment schemes to a t402Facilitator instance.
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for NEAR facilitator registration
 * @returns The facilitator instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectNearFacilitator } from "@t402/near/exact-direct/facilitator";
 * import { t402Facilitator } from "@t402/core/facilitator";
 *
 * const facilitator = new t402Facilitator();
 *
 * // Single network
 * registerExactDirectNearFacilitator(facilitator, {
 *   signer: myNearSigner,
 *   networks: "near:mainnet"
 * });
 *
 * // Multiple networks
 * registerExactDirectNearFacilitator(facilitator, {
 *   signer: myNearSigner,
 *   networks: ["near:mainnet", "near:testnet"]
 * });
 * ```
 */
export function registerExactDirectNearFacilitator(
  facilitator: t402Facilitator,
  config: NearFacilitatorConfig,
): t402Facilitator {
  const scheme = new ExactDirectNearFacilitator(config.signer, config.schemeConfig);

  // Register scheme with specified networks
  facilitator.register(config.networks, scheme);

  return facilitator;
}
