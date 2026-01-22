/**
 * Registration function for NEAR Exact-Direct client
 */

import { t402Client, PaymentPolicy } from "@t402/core/client";
import { Network } from "@t402/core/types";
import type { ClientNearSigner } from "../../types.js";
import { ExactDirectNearClient, type ExactDirectNearClientConfig } from "./scheme.js";

/**
 * Configuration options for registering NEAR schemes to a t402Client
 */
export interface NearClientConfig {
  /**
   * The NEAR signer to use for creating payment payloads
   */
  signer: ClientNearSigner;

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[];

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (near:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration (gas amounts, memo)
   */
  schemeConfig?: ExactDirectNearClientConfig;
}

/**
 * Registers NEAR exact-direct payment schemes to a t402Client instance.
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for NEAR client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectNearClient } from "@t402/near/exact-direct/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerExactDirectNearClient(client, {
 *   signer: {
 *     accountId: "alice.near",
 *     signAndSendTransaction: async (receiverId, methodName, args, gas, deposit) => {
 *       // Sign and send using wallet
 *       return txHash;
 *     }
 *   }
 * });
 * ```
 */
export function registerExactDirectNearClient(
  client: t402Client,
  config: NearClientConfig,
): t402Client {
  const scheme = new ExactDirectNearClient(config.signer, config.schemeConfig);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      client.register(network, scheme);
    });
  } else {
    // Register wildcard for all NEAR networks
    client.register("near:*", scheme);
  }

  // Apply policies if provided
  if (config.policies) {
    config.policies.forEach((policy) => {
      client.registerPolicy(policy);
    });
  }

  return client;
}
