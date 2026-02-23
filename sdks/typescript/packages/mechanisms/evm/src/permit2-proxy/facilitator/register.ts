import { t402Facilitator } from "@t402/core/facilitator";
import { Network } from "@t402/core/types";
import { FacilitatorEvmSigner } from "../../signer";
import { Permit2ProxyEvmScheme, Permit2ProxyEvmSchemeConfig } from "./scheme";

/**
 * Configuration options for registering Permit2 Proxy schemes to an t402Facilitator
 */
export interface Permit2ProxyEvmFacilitatorConfig {
  /**
   * The EVM signer for facilitator operations (verify and settle)
   */
  signer: FacilitatorEvmSigner;

  /**
   * Networks to register (single network or array of networks)
   * Examples: "eip155:84532", ["eip155:84532", "eip155:1"]
   */
  networks: Network | Network[];

  /**
   * Optional scheme configuration (proxy contract addresses, etc.)
   */
  schemeConfig?: Permit2ProxyEvmSchemeConfig;
}

/**
 * Registers Permit2 Proxy EVM payment schemes to an t402Facilitator instance.
 *
 * @param facilitator - The t402Facilitator instance to register schemes to
 * @param config - Configuration for Permit2 Proxy EVM facilitator registration
 * @returns The facilitator instance for chaining
 */
export function registerPermit2ProxyEvmScheme(
  facilitator: t402Facilitator,
  config: Permit2ProxyEvmFacilitatorConfig,
): t402Facilitator {
  facilitator.register(
    config.networks,
    new Permit2ProxyEvmScheme(config.signer, config.schemeConfig),
  );

  return facilitator;
}
