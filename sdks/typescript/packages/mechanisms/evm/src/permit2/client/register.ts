import { t402Client, SelectPaymentRequirements, PaymentPolicy } from "@t402/core/client";
import { Network } from "@t402/core/types";
import { ClientEvmSigner } from "../../signer";
import { Permit2EvmScheme } from "./scheme";

/**
 * Configuration options for registering Permit2 EVM schemes to an t402Client
 */
export interface Permit2EvmClientConfig {
  /**
   * The EVM signer to use for creating payment payloads
   */
  signer: ClientEvmSigner;

  /**
   * Optional payment requirements selector function
   * If not provided, uses the default selector (first available option)
   */
  paymentRequirementsSelector?: SelectPaymentRequirements;

  /**
   * Optional policies to apply to the client
   */
  policies?: PaymentPolicy[];

  /**
   * Optional specific networks to register
   * If not provided, registers wildcard support (eip155:*)
   */
  networks?: Network[];
}

/**
 * Registers Permit2 EVM payment schemes to an t402Client instance.
 *
 * @param client - The t402Client instance to register schemes to
 * @param config - Configuration for Permit2 EVM client registration
 * @returns The client instance for chaining
 *
 * @example
 * ```typescript
 * import { registerPermit2EvmScheme } from "@t402/evm/permit2/client";
 * import { t402Client } from "@t402/core/client";
 * import { privateKeyToAccount } from "viem/accounts";
 *
 * const account = privateKeyToAccount("0x...");
 * const client = new t402Client();
 * registerPermit2EvmScheme(client, { signer: account });
 * ```
 */
export function registerPermit2EvmScheme(
  client: t402Client,
  config: Permit2EvmClientConfig,
): t402Client {
  if (config.networks && config.networks.length > 0) {
    config.networks.forEach(network => {
      client.register(network, new Permit2EvmScheme(config.signer));
    });
  } else {
    client.register("eip155:*", new Permit2EvmScheme(config.signer));
  }

  if (config.policies) {
    config.policies.forEach(policy => {
      client.registerPolicy(policy);
    });
  }

  return client;
}
