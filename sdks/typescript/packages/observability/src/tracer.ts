import type { PaymentEvent, PaymentEventType } from "./types";

/**
 * Represents a tracked payment flow with its events.
 */
export interface PaymentFlow {
  paymentId: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  events: PaymentEvent[];
  metadata?: Record<string, unknown>;
}

/**
 * Tracks individual payment flows from start to completion.
 *
 * Automatically computes durations between consecutive steps
 * and provides per-flow querying.
 */
export class PaymentTracer {
  private flows: Map<string, PaymentFlow> = new Map();

  /**
   * Start tracking a new payment flow.
   *
   * @param paymentId - Unique identifier for this payment flow
   * @param metadata - Optional metadata to attach to the flow
   * @returns The created PaymentFlow
   * @throws Error if a flow with this ID already exists
   */
  startFlow(paymentId: string, metadata?: Record<string, unknown>): PaymentFlow {
    if (this.flows.has(paymentId)) {
      throw new Error(`Flow already exists: ${paymentId}`);
    }

    const flow: PaymentFlow = {
      paymentId,
      startTime: Date.now(),
      events: [],
      metadata,
    };

    this.flows.set(paymentId, flow);
    return flow;
  }

  /**
   * Record a step in an existing payment flow.
   *
   * Automatically computes the duration from the previous event.
   *
   * @param paymentId - The payment flow ID
   * @param type - The event type for this step
   * @param data - Optional additional event data
   * @returns The recorded PaymentEvent
   * @throws Error if the flow does not exist
   */
  recordStep(
    paymentId: string,
    type: PaymentEventType,
    data?: Partial<Omit<PaymentEvent, "type" | "timestamp" | "paymentId" | "durationMs">>,
  ): PaymentEvent {
    const flow = this.flows.get(paymentId);
    if (!flow) {
      throw new Error(`Flow not found: ${paymentId}`);
    }

    const now = Date.now();
    const lastEvent = flow.events[flow.events.length - 1];
    const durationMs = lastEvent ? now - lastEvent.timestamp : now - flow.startTime;

    const event: PaymentEvent = {
      type,
      timestamp: now,
      paymentId,
      durationMs,
      ...data,
    };

    flow.events.push(event);
    return event;
  }

  /**
   * Mark a payment flow as completed or failed.
   *
   * @param paymentId - The payment flow ID
   * @param success - Whether the flow completed successfully
   * @param error - Error message if the flow failed
   * @returns The final PaymentEvent (completed or failed)
   * @throws Error if the flow does not exist
   */
  endFlow(paymentId: string, success: boolean, error?: string): PaymentEvent {
    const flow = this.flows.get(paymentId);
    if (!flow) {
      throw new Error(`Flow not found: ${paymentId}`);
    }

    flow.endTime = Date.now();
    flow.success = success;

    const type: PaymentEventType = success ? "payment.completed" : "payment.failed";
    const lastEvent = flow.events[flow.events.length - 1];
    const durationMs = lastEvent ? flow.endTime - lastEvent.timestamp : flow.endTime - flow.startTime;

    const event: PaymentEvent = {
      type,
      timestamp: flow.endTime,
      paymentId,
      durationMs,
      error,
    };

    flow.events.push(event);
    return event;
  }

  /**
   * Get a payment flow by ID.
   *
   * @param paymentId - The payment flow ID
   * @returns The PaymentFlow, or undefined if not found
   */
  getFlow(paymentId: string): PaymentFlow | undefined {
    return this.flows.get(paymentId);
  }

  /**
   * Get all tracked payment flows.
   *
   * @returns Array of all PaymentFlows
   */
  getAllFlows(): PaymentFlow[] {
    return Array.from(this.flows.values());
  }

  /**
   * Get all events for a payment flow in chronological order.
   *
   * @param paymentId - The payment flow ID
   * @returns Array of events, or empty array if flow not found
   */
  getFlowEvents(paymentId: string): PaymentEvent[] {
    const flow = this.flows.get(paymentId);
    return flow ? [...flow.events] : [];
  }

  /**
   * Get the total duration of a completed flow in milliseconds.
   *
   * @param paymentId - The payment flow ID
   * @returns Duration in ms, or undefined if flow not found or not ended
   */
  getFlowDuration(paymentId: string): number | undefined {
    const flow = this.flows.get(paymentId);
    if (!flow || flow.endTime === undefined) {
      return undefined;
    }
    return flow.endTime - flow.startTime;
  }

  /**
   * Remove a tracked flow.
   *
   * @param paymentId - The payment flow ID
   * @returns true if the flow was removed
   */
  removeFlow(paymentId: string): boolean {
    return this.flows.delete(paymentId);
  }

  /**
   * Clear all tracked flows.
   */
  clear(): void {
    this.flows.clear();
  }

  /**
   * Get the number of tracked flows.
   */
  get size(): number {
    return this.flows.size;
  }
}
