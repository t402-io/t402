/**
 * Registration function for Aptos Exact-Direct client
 */

import { t402Client, PaymentPolicy } from "@t402/core/client";
import type { Network } from "@t402/core/types";
import type { ClientAptosSigner } from "../../types.js";
import {
  ExactDirectAptosClient,
  type ExactDirectAptosClientConfig,
} from "./scheme.js";

/**
 * Configuration options for registering Aptos schemes to a t402Client
 */
export interface AptosClientConfig {
  /**
   * The Aptos signer for client operations
   */
  signer: ClientAptosSigner;

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[];

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (aptos:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactDirectAptosClientConfig;
}

/**
 * Registers Aptos exact-direct payment schemes to a t402Client instance.
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for Aptos client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectAptosClient } from "@t402/aptos/exact-direct/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerExactDirectAptosClient(client, {
 *   signer: myAptosSigner,
 *   networks: ["aptos:1"]
 * });
 * ```
 */
export function registerExactDirectAptosClient(
  client: t402Client,
  config: AptosClientConfig,
): t402Client {
  const scheme = new ExactDirectAptosClient(config.signer, config.schemeConfig);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      client.register(network, scheme);
    });
  } else {
    // Register wildcard for all Aptos networks
    client.register("aptos:*", scheme);
  }

  // Apply policies if provided
  if (config.policies) {
    config.policies.forEach((policy) => {
      client.registerPolicy(policy);
    });
  }

  return client;
}
