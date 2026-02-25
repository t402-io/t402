/**
 * A2A Payment Server
 *
 * Handles server-side payment processing for A2A agent endpoints,
 * including generating payment requirements and processing payment submissions.
 */

import type {
  A2ATask,
  A2AMessage,
  A2ATaskStatus,
  PaymentPayload,
  PaymentRequired,
  SettleResponse,
} from "@t402/core/types";
import {
  createPaymentRequiredMessage,
  createPaymentCompletedMessage,
  createPaymentFailedMessage,
} from "@t402/core/types";
import type { FacilitatorClient } from "@t402/core/server";

/**
 * Result of payment processing
 */
export interface A2APaymentResult {
  /** Whether payment was successful */
  success: boolean;

  /** Settlement receipts (if settled) */
  receipts?: SettleResponse[];

  /** Error message (if failed) */
  error?: string;

  /** A2A message to include in response */
  message: A2AMessage;
}

/**
 * Payment handler function type
 */
export type A2APaymentHandler = (
  payload: PaymentPayload,
  requirements: PaymentRequired,
) => Promise<A2APaymentResult>;

/**
 * Options for A2APaymentServer
 */
export interface A2APaymentServerOptions {
  /**
   * Facilitator client for verification and settlement
   */
  facilitator?: FacilitatorClient;

  /**
   * Custom payment handler (alternative to facilitator)
   */
  paymentHandler?: A2APaymentHandler;

  /**
   * Default payment requirements template
   */
  defaultRequirements?: Partial<PaymentRequired>;

  /**
   * Optional callback when payment is received
   */
  onPaymentReceived?: (payload: PaymentPayload) => void;

  /**
   * Optional callback when payment is verified
   */
  onPaymentVerified?: (payload: PaymentPayload) => void;

  /**
   * Optional callback when payment is settled
   */
  onPaymentSettled?: (receipts: SettleResponse[]) => void;

  /**
   * Optional callback when payment fails
   */
  onPaymentFailed?: (error: string, payload?: PaymentPayload) => void;
}

/**
 * A2A Payment Server
 *
 * Provides server-side payment handling for A2A agent endpoints.
 *
 * @example
 * ```typescript
 * const server = new A2APaymentServer({
 *   facilitator: facilitatorClient,
 *   defaultRequirements: {
 *     t402Version: 2,
 *     resource: 'agent://my-agent/skill',
 *   },
 * });
 *
 * // Create payment-required response
 * const requirements = server.createRequirements({
 *   accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', ... }],
 * });
 * const task = server.createPaymentRequiredTask(taskId, requirements);
 *
 * // Process payment submission
 * const result = await server.processPayment(message, requirements);
 * if (result.success) {
 *   // Continue with task execution
 * }
 * ```
 */
export class A2APaymentServer {
  private options: A2APaymentServerOptions;

  constructor(options: A2APaymentServerOptions = {}) {
    this.options = options;
  }

  /**
   * Create payment requirements with defaults
   *
   * @param requirements - Partial requirements to merge with defaults
   * @returns Complete payment requirements
   */
  createRequirements(requirements: Partial<PaymentRequired>): PaymentRequired {
    return {
      t402Version: 2,
      ...this.options.defaultRequirements,
      ...requirements,
    } as PaymentRequired;
  }

  /**
   * Create a payment-required task status
   *
   * @param requirements - Payment requirements
   * @param text - Optional text message
   * @returns A2A task status
   */
  createPaymentRequiredStatus(
    requirements: PaymentRequired,
    text?: string,
  ): A2ATaskStatus {
    return {
      state: "input-required",
      message: createPaymentRequiredMessage(requirements, text),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a payment-required task
   *
   * @param taskId - Task identifier
   * @param requirements - Payment requirements
   * @param text - Optional text message
   * @returns A2A task in input-required state
   */
  createPaymentRequiredTask(
    taskId: string,
    requirements: PaymentRequired,
    text?: string,
  ): A2ATask {
    return {
      kind: "task",
      id: taskId,
      status: this.createPaymentRequiredStatus(requirements, text),
    };
  }

  /**
   * Extract payment payload from an A2A message
   *
   * @param message - A2A message that may contain payment
   * @returns Payment payload or undefined
   */
  extractPaymentPayload(message: A2AMessage): PaymentPayload | undefined {
    return (message.metadata?.["t402.payment.payload"] ??
      message.metadata?.["x402.payment.payload"]) as PaymentPayload | undefined;
  }

  /**
   * Check if a message contains a payment submission
   *
   * @param message - A2A message to check
   * @returns Whether the message contains a payment
   */
  hasPaymentPayload(message: A2AMessage): boolean {
    const status =
      message.metadata?.["t402.payment.status"] ??
      message.metadata?.["x402.payment.status"];
    const payload =
      message.metadata?.["t402.payment.payload"] ??
      message.metadata?.["x402.payment.payload"];
    return status === "payment-submitted" && payload !== undefined;
  }

  /**
   * Process a payment submission
   *
   * @param message - A2A message containing payment payload
   * @param requirements - Original payment requirements
   * @returns Payment processing result
   */
  async processPayment(
    message: A2AMessage,
    requirements: PaymentRequired,
  ): Promise<A2APaymentResult> {
    const payload = this.extractPaymentPayload(message);

    if (!payload) {
      const error = "No payment payload in message";
      this.options.onPaymentFailed?.(error);
      return {
        success: false,
        error,
        message: createPaymentFailedMessage([], "T402-1001", error),
      };
    }

    this.options.onPaymentReceived?.(payload);

    // Use custom handler if provided
    if (this.options.paymentHandler) {
      return this.options.paymentHandler(payload, requirements);
    }

    // Use facilitator client
    if (!this.options.facilitator) {
      const error = "No facilitator or payment handler configured";
      this.options.onPaymentFailed?.(error, payload);
      return {
        success: false,
        error,
        message: createPaymentFailedMessage([], "T402-5001", error),
      };
    }

    try {
      // Build the payment requirements from the accepted option
      const paymentRequirements = payload.accepted;

      // Verify the payment
      const verifyResponse = await this.options.facilitator.verify(
        payload,
        paymentRequirements,
      );

      if (!verifyResponse.isValid) {
        const error = verifyResponse.invalidReason || "Payment verification failed";
        this.options.onPaymentFailed?.(error, payload);
        return {
          success: false,
          error,
          message: createPaymentFailedMessage([], "T402-2001", error),
        };
      }

      this.options.onPaymentVerified?.(payload);

      // Settle the payment
      const settleResponse = await this.options.facilitator.settle(
        payload,
        paymentRequirements,
      );

      const receipts = [settleResponse];

      if (!settleResponse.success) {
        const error = settleResponse.errorReason || "Payment settlement failed";
        this.options.onPaymentFailed?.(error, payload);
        return {
          success: false,
          receipts,
          error,
          message: createPaymentFailedMessage(receipts, "T402-3001", error),
        };
      }

      this.options.onPaymentSettled?.(receipts);

      return {
        success: true,
        receipts,
        message: createPaymentCompletedMessage(receipts),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Payment processing error";
      this.options.onPaymentFailed?.(error, payload);
      return {
        success: false,
        error,
        message: createPaymentFailedMessage([], "T402-5002", error),
      };
    }
  }

  /**
   * Create a completed task status with payment receipts
   *
   * @param receipts - Settlement receipts
   * @param text - Optional text message
   * @returns A2A task status
   */
  createPaymentCompletedStatus(
    receipts: SettleResponse[],
    text?: string,
  ): A2ATaskStatus {
    return {
      state: "completed",
      message: createPaymentCompletedMessage(receipts, text),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a failed task status with payment error
   *
   * @param error - Error message
   * @param receipts - Optional settlement receipts
   * @param errorCode - Optional error code
   * @returns A2A task status
   */
  createPaymentFailedStatus(
    error: string,
    receipts: SettleResponse[] = [],
    errorCode: string = "T402-5000",
  ): A2ATaskStatus {
    return {
      state: "failed",
      message: createPaymentFailedMessage(receipts, errorCode, error),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update a task with payment completion
   *
   * @param task - Original task
   * @param result - Payment processing result
   * @returns Updated task
   */
  updateTaskWithPaymentResult(task: A2ATask, result: A2APaymentResult): A2ATask {
    if (result.success) {
      return {
        ...task,
        status: this.createPaymentCompletedStatus(result.receipts || []),
        history: [...(task.history || []), result.message],
      };
    }

    return {
      ...task,
      status: this.createPaymentFailedStatus(result.error || "Payment failed", result.receipts),
      history: [...(task.history || []), result.message],
    };
  }

  /**
   * Handle a complete payment flow for a task
   *
   * This is a convenience method that processes a payment submission
   * and returns an updated task.
   *
   * @param task - The current A2A task
   * @param message - The message containing payment payload
   * @param requirements - Payment requirements
   * @returns Updated task with payment result
   */
  async handlePayment(
    task: A2ATask,
    message: A2AMessage,
    requirements: PaymentRequired,
  ): Promise<A2ATask> {
    const result = await this.processPayment(message, requirements);
    return this.updateTaskWithPaymentResult(task, result);
  }
}
