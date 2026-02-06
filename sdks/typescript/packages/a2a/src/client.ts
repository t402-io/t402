/**
 * A2A Payment Client
 *
 * Handles payment flows for A2A client agents, including detecting
 * payment-required states and submitting payment payloads.
 */

import type {
  A2ATask,
  A2AMessage,
  PaymentPayload,
  PaymentRequired,
  SchemeNetworkClient,
} from "@t402/core/types";
import {
  isPaymentRequired,
  getPaymentRequired,
  createPaymentSubmissionMessage,
} from "@t402/core/types";

/**
 * Options for A2APaymentClient
 */
export interface A2APaymentClientOptions {
  /**
   * Optional callback when payment is required
   */
  onPaymentRequired?: (requirements: PaymentRequired) => void;

  /**
   * Optional callback when payment is submitted
   */
  onPaymentSubmitted?: (payload: PaymentPayload) => void;

  /**
   * Optional callback when payment is completed
   */
  onPaymentCompleted?: (task: A2ATask) => void;

  /**
   * Optional callback when payment fails
   */
  onPaymentFailed?: (error: string, task: A2ATask) => void;
}

/**
 * A2A Payment Client
 *
 * Provides methods for handling t402 payments in A2A client agents.
 *
 * @example
 * ```typescript
 * const client = new A2APaymentClient({
 *   onPaymentRequired: (req) => console.log('Payment required:', req),
 * });
 *
 * // Check if task requires payment
 * if (client.requiresPayment(task)) {
 *   const requirements = client.getRequirements(task);
 *   const payload = await mechanism.createPaymentPayload(requirements);
 *   const message = client.createPaymentMessage(payload);
 *   // Send message via A2A
 * }
 * ```
 */
export class A2APaymentClient {
  private options: A2APaymentClientOptions;

  constructor(options: A2APaymentClientOptions = {}) {
    this.options = options;
  }

  /**
   * Check if a task requires payment
   */
  requiresPayment(task: A2ATask): boolean {
    const requires = isPaymentRequired(task);
    if (requires) {
      const requirements = getPaymentRequired(task);
      if (requirements && this.options.onPaymentRequired) {
        this.options.onPaymentRequired(requirements);
      }
    }
    return requires;
  }

  /**
   * Get payment requirements from a task
   */
  getRequirements(task: A2ATask): PaymentRequired | undefined {
    return getPaymentRequired(task);
  }

  /**
   * Select the best payment option from requirements
   *
   * @param requirements - Payment requirements with accepts array
   * @param preferredNetwork - Preferred network (CAIP-2 format)
   * @param preferredScheme - Preferred scheme (e.g., 'exact', 'upto')
   * @returns The best matching payment option or undefined
   */
  selectPaymentOption(
    requirements: PaymentRequired,
    preferredNetwork?: string,
    preferredScheme?: string,
  ): PaymentRequired["accepts"][0] | undefined {
    const accepts = requirements.accepts;
    if (!accepts || accepts.length === 0) {
      return undefined;
    }

    // Try to find exact match for both network and scheme
    if (preferredNetwork && preferredScheme) {
      const exact = accepts.find(
        a => a.network === preferredNetwork && a.scheme === preferredScheme,
      );
      if (exact) return exact;
    }

    // Try to find match for network only
    if (preferredNetwork) {
      const byNetwork = accepts.find(a => a.network === preferredNetwork);
      if (byNetwork) return byNetwork;
    }

    // Try to find match for scheme only
    if (preferredScheme) {
      const byScheme = accepts.find(a => a.scheme === preferredScheme);
      if (byScheme) return byScheme;
    }

    // Return first option
    return accepts[0];
  }

  /**
   * Create a payment payload using a mechanism client
   *
   * @param mechanism - The scheme/network client to use
   * @param requirements - Payment requirements to fulfill
   * @returns Promise resolving to the payment payload
   */
  async createPayload(
    mechanism: SchemeNetworkClient,
    requirements: PaymentRequired,
  ): Promise<PaymentPayload> {
    // Select the best payment option
    const selected = this.selectPaymentOption(requirements);
    if (!selected) {
      throw new Error("No payment options available");
    }

    // Create the base payload using the mechanism
    const basePayload = await mechanism.createPaymentPayload(
      requirements.t402Version,
      selected,
    );

    // Build the full payment payload with the accepted requirements
    const payload: PaymentPayload = {
      ...basePayload,
      resource: requirements.resource,
      accepted: selected,
    };

    if (this.options.onPaymentSubmitted) {
      this.options.onPaymentSubmitted(payload);
    }

    return payload;
  }

  /**
   * Create a payment submission message
   *
   * @param payload - The payment payload to submit
   * @param text - Optional text message
   * @returns A2A message with payment metadata
   */
  createPaymentMessage(
    payload: PaymentPayload,
    text: string = "Here is the payment authorization.",
  ): A2AMessage {
    return createPaymentSubmissionMessage(payload, text);
  }

  /**
   * Handle a complete payment flow for a task
   *
   * This is a convenience method that checks for payment requirements,
   * creates a payload, and returns a payment message.
   *
   * @param task - The A2A task that may require payment
   * @param mechanism - The mechanism client to use for signing
   * @param preferredNetwork - Optional preferred network
   * @param preferredScheme - Optional preferred scheme
   * @returns A2A message with payment, or undefined if no payment needed
   */
  async handlePayment(
    task: A2ATask,
    mechanism: SchemeNetworkClient,
    preferredNetwork?: string,
    preferredScheme?: string,
  ): Promise<A2AMessage | undefined> {
    if (!this.requiresPayment(task)) {
      return undefined;
    }

    const requirements = this.getRequirements(task);
    if (!requirements) {
      return undefined;
    }

    // Override preferred options if specified
    const selected = this.selectPaymentOption(requirements, preferredNetwork, preferredScheme);
    if (!selected) {
      throw new Error("No compatible payment option found");
    }

    const payload = await this.createPayload(mechanism, requirements);
    return this.createPaymentMessage(payload);
  }
}
