/**
 * Registration function for Tezos Exact-Direct client
 */

import { t402Client } from "@t402/core/client";
import type { Network } from "@t402/core/types";
import type { TezosSigner } from "../../types.js";
import {
  ExactDirectTezosClient,
  type ExactDirectTezosClientConfig,
} from "./scheme.js";

/**
 * Configuration options for registering Tezos schemes to a t402Client
 */
export interface TezosClientConfig {
  /**
   * The Tezos signer for payment operations
   */
  signer: TezosSigner;

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (tezos:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration
   */
  schemeConfig?: ExactDirectTezosClientConfig;
}

/**
 * Registers Tezos exact-direct payment scheme to a t402Client instance.
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for Tezos client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactDirectTezosClient } from "@t402/tezos/exact-direct/client";
 * import { t402Client } from "@t402/core/client";
 *
 * const client = new t402Client();
 * registerExactDirectTezosClient(client, {
 *   signer: myTezosSigner,
 *   networks: ["tezos:NetXdQprcVkpaWU"]
 * });
 * ```
 */
export function registerExactDirectTezosClient(
  client: t402Client,
  config: TezosClientConfig,
): t402Client {
  const scheme = new ExactDirectTezosClient(config.signer, config.schemeConfig);

  // Register scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach((network) => {
      client.register(network, scheme);
    });
  } else {
    // Register wildcard for all Tezos networks
    client.register("tezos:*", scheme);
  }

  return client;
}
