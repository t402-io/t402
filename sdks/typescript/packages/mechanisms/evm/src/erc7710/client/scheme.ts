/**
 * ERC-7710 Client Scheme
 *
 * Creates payment payloads for ERC-7710 delegation-based payments.
 * The client provides a pre-existing delegation (permissionContext)
 * that authorizes the facilitator to execute token transfers.
 *
 * Delegations are obtained out-of-band via ERC-7715 permission requests,
 * direct wallet interactions, or pre-configured session keys.
 */

import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@t402/core/types";
import type { ExactERC7710Payload } from "@t402/evm-core";

/**
 * Configuration for the ERC-7710 client scheme.
 */
export interface ERC7710ClientConfig {
  /** Address of the ERC-7710 Delegation Manager contract */
  delegationManager: string;
  /** Delegation proof/context (obtained from wallet or ERC-7715) */
  permissionContext: string;
  /** Delegator address (the smart account that created the delegation) */
  delegator: string;
}

/**
 * ERC-7710 client implementation for delegation-based payments.
 *
 * @example
 * ```ts
 * const client = new ERC7710ClientScheme({
 *   delegationManager: "0xDelegationManager...",
 *   permissionContext: "0x...",
 *   delegator: "0xMySmartAccount...",
 * });
 *
 * const payload = await client.createPaymentPayload(2, requirements);
 * ```
 */
export class ERC7710ClientScheme implements SchemeNetworkClient {
  readonly scheme = "exact";
  private readonly config: ERC7710ClientConfig;

  constructor(config: ERC7710ClientConfig) {
    if (!config.delegationManager) throw new Error("delegationManager is required");
    if (!config.permissionContext) throw new Error("permissionContext is required");
    if (!config.delegator) throw new Error("delegator is required");
    this.config = config;
  }

  /**
   * Creates a payment payload containing the delegation proof.
   * No signing is needed — the delegation itself is the authorization.
   */
  async createPaymentPayload(
    t402Version: number,
    _paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "t402Version" | "payload">> {
    const payload: ExactERC7710Payload = {
      delegationManager: this.config.delegationManager,
      permissionContext: this.config.permissionContext,
      delegator: this.config.delegator,
    };

    return {
      t402Version,
      payload: payload as unknown as Record<string, unknown>,
    };
  }
}
