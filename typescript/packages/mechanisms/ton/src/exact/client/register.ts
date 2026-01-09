import { t402Client, PaymentPolicy } from "@t402/core/client";
import { Network } from "@t402/core/types";
import { ClientTonSigner } from "../../signer.js";
import { ExactTonScheme, ExactTonSchemeConfig } from "./scheme.js";
import { TON_NETWORKS } from "../../constants.js";

/**
 * Configuration options for registering TON schemes to an t402Client
 */
export interface TonClientConfig {
  /**
   * The TON signer to use for creating payment payloads
   */
  signer: ClientTonSigner;

  /**
   * Function to get Jetton wallet address for a given owner and Jetton master
   * This is required for building Jetton transfer messages
   */
  getJettonWalletAddress: (ownerAddress: string, jettonMasterAddress: string) => Promise<string>;

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[];

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (ton:*)
   */
  networks?: Network[];

  /**
   * Optional scheme configuration (gas amounts, etc.)
   */
  schemeConfig?: ExactTonSchemeConfig;
}

/**
 * Registers TON exact payment schemes to an t402Client instance.
 *
 * This function registers:
 * - V2: ton:* wildcard scheme with ExactTonScheme (or specific networks if provided)
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for TON client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerExactTonScheme } from "@t402/ton/exact/client/register";
 * import { t402Client } from "@t402/core/client";
 * import { TonClient } from "@ton/ton";
 *
 * const tonClient = new TonClient({ endpoint: "..." });
 * const wallet = WalletContractV4.create({ ... });
 *
 * const client = new t402Client();
 * registerExactTonScheme(client, {
 *   signer: toClientTonSigner(wallet, tonClient),
 *   getJettonWalletAddress: async (owner, master) => {
 *     // Derive Jetton wallet address
 *     return jettonWalletAddress;
 *   }
 * });
 * ```
 */
export function registerExactTonScheme(client: t402Client, config: TonClientConfig): t402Client {
  const scheme = new ExactTonScheme(
    config.signer,
    config.getJettonWalletAddress,
    config.schemeConfig,
  );

  // Register V2 scheme
  if (config.networks && config.networks.length > 0) {
    // Register specific networks
    config.networks.forEach(network => {
      client.register(network, scheme);
    });
  } else {
    // Register wildcard for all TON networks
    client.register("ton:*", scheme);
  }

  // Apply policies if provided
  if (config.policies) {
    config.policies.forEach(policy => {
      client.registerPolicy(policy);
    });
  }

  return client;
}
