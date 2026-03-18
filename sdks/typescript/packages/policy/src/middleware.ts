import type { PaymentRequirements } from "@t402/core/types";

import { PaymentPolicyEngine } from "./engine";
import type { PaymentPolicy } from "./types";

/**
 * A minimal interface representing a t402 client that can handle
 * payment-required responses.
 */
export interface T402Client {
  /**
   * Handle a 402 Payment Required response by selecting requirements
   * and producing a signed payment payload.
   */
  handlePaymentRequired(
    accepts: PaymentRequirements[],
    ...args: unknown[]
  ): Promise<{ accepted: PaymentRequirements; payload: Record<string, unknown> }>;
}

/**
 * A policy-wrapped client that enforces payment policies before
 * allowing any payment to proceed.
 */
export interface PolicyWrappedClient extends T402Client {
  /** The underlying policy engine */
  readonly policyEngine: PaymentPolicyEngine;
}

/**
 * Wrap a t402 client with policy enforcement. The returned client
 * evaluates every payment against the policy before allowing it,
 * and records successful payments to track session stats.
 *
 * @param client - The t402 client to wrap
 * @param policy - The payment policy to enforce
 * @returns A wrapped client that enforces the given policy
 *
 * @example
 * ```ts
 * const wrappedClient = withPolicy(client, {
 *   maxAmountPerPayment: "1000000", // 1 USDT
 *   allowedNetworks: ["eip155:8453"],
 * });
 * ```
 */
export function withPolicy(
  client: T402Client,
  policy: PaymentPolicy,
  options?: { now?: () => number },
): PolicyWrappedClient {
  const engine = new PaymentPolicyEngine(policy, options);

  const wrapped: PolicyWrappedClient = {
    policyEngine: engine,

    async handlePaymentRequired(
      accepts: PaymentRequirements[],
      ...args: unknown[]
    ): Promise<{ accepted: PaymentRequirements; payload: Record<string, unknown> }> {
      // Filter accepts to only those that pass the policy
      const allowedAccepts: PaymentRequirements[] = [];
      const rejections: string[] = [];

      for (const req of accepts) {
        const decision = await engine.evaluate({
          scheme: req.scheme,
          network: req.network,
          asset: req.asset,
          amount: req.amount,
          payTo: req.payTo,
        });

        if (decision.allowed) {
          allowedAccepts.push(req);
        } else {
          rejections.push(`${req.network}/${req.scheme}: ${decision.reason}`);
        }
      }

      if (allowedAccepts.length === 0) {
        const reasons = rejections.join("; ");
        throw new PolicyViolationError(
          `No payment options passed policy check. Rejections: ${reasons}`,
        );
      }

      const result = await client.handlePaymentRequired(allowedAccepts, ...args);

      // Record the payment
      engine.recordPayment(result.accepted.amount);

      return result;
    },
  };

  return wrapped;
}

/**
 * Error thrown when a payment violates the configured policy.
 */
export class PolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyViolationError";
  }
}
