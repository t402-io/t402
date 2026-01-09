import { t402Facilitator } from "@t402/core/facilitator";
import { Network } from "@t402/core/types";
import { FacilitatorTonSigner } from "../../signer.js";
import { ExactTonScheme, ExactTonSchemeConfig } from "./scheme.js";

/**
 * Configuration options for registering TON schemes to an t402Facilitator
 */
export interface TonFacilitatorConfig {
  /**
   * The TON signer for facilitator operations (verify and settle)
   */
  signer: FacilitatorTonSigner;

  /**
   * Networks to register (single network or array of networks)
   * Examples: "ton:mainnet", ["ton:mainnet", "ton:testnet"]
   */
  networks: Network | Network[];

  /**
   * Optional scheme configuration (gas sponsorship, etc.)
   */
  schemeConfig?: ExactTonSchemeConfig;
}

/**
 * Registers TON exact payment schemes to an t402Facilitator instance.
 *
 * This function registers:
 * - V2: Specified networks with ExactTonScheme
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for TON facilitator registration
 * @returns The facilitator instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactTonScheme } from "@t402/ton/exact/facilitator/register";
 * import { t402Facilitator } from "@t402/core/facilitator";
 * import { TonClient } from "@ton/ton";
 *
 * const tonClient = new TonClient({ endpoint: "..." });
 * const facilitator = new t402Facilitator();
 *
 * // Single network
 * registerExactTonScheme(facilitator, {
 *   signer: toFacilitatorTonSigner(tonClient),
 *   networks: "ton:mainnet"
 * });
 *
 * // Multiple networks
 * registerExactTonScheme(facilitator, {
 *   signer: toFacilitatorTonSigner(tonClient),
 *   networks: ["ton:mainnet", "ton:testnet"]
 * });
 *
 * // With gas sponsorship
 * registerExactTonScheme(facilitator, {
 *   signer: toFacilitatorTonSigner(tonClient),
 *   networks: "ton:mainnet",
 *   schemeConfig: { canSponsorGas: true }
 * });
 * ```
 */
export function registerExactTonScheme(
  facilitator: t402Facilitator,
  config: TonFacilitatorConfig,
): t402Facilitator {
  // Register V2 scheme with specified networks
  facilitator.register(config.networks, new ExactTonScheme(config.signer, config.schemeConfig));

  return facilitator;
}
