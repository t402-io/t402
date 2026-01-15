/**
 * TRON Client Scheme Registration
 *
 * Helper function to register TRON exact scheme with a t402 client.
 */

import { t402Client, PaymentPolicy } from "@t402/core/client";
import { Network } from "@t402/core/types";
import { ClientTronSigner } from "../../signer.js";
import { ExactTronScheme, ExactTronSchemeConfig } from "./scheme.js";

/**
 * Configuration options for registering TRON schemes to a t402Client
 */
export interface TronClientConfig {
  /**
   * The TRON signer to use for creating payment payloads
   */
  signer: ClientTronSigner;

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[];

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (tron:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration (fee limits, etc.)
   */
  schemeConfig?: ExactTronSchemeConfig;
}

/**
 * Registers TRON exact payment schemes to a t402Client instance.
 *
 * This function registers:
 * - V2: tron:* wildcard scheme with ExactTronScheme (or specific networks if provided)
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for TRON client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactTronScheme } from "@t402/tron/exact/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerExactTronScheme(client, {
 *   signer: tronSigner,
 * });
 * ```
 */
export function registerExactTronScheme(client: t402Client, config: TronClientConfig): t402Client {
  const scheme = new ExactTronScheme(config.signer, config.schemeConfig);

  // Register V2 scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach(network => {
      client.register(network, scheme);
    });
  } else {
    // Register wildcard for all TRON networks
    client.register("tron:*", scheme);
  }

  // Apply policies if provided
  if (config.policies) {
    config.policies.forEach(policy => {
      client.registerPolicy(policy);
    });
  }

  return client;
}
